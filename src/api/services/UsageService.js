import prisma from "../config/prisma.js";
import { unitPricing } from "./WhatsAppPricingService.js";

/**
 * Medição de consumo da conta.
 *
 * Até aqui o sistema contava mensagens enviadas e tokens, mas não contava a
 * unidade que o cliente entende e que a Meta cobra: a CONVERSA — a janela de
 * 24h que abre quando o cliente escreve. Sem isso não dava para limitar por
 * plano nem para saber quanto cada cliente custa de verdade.
 *
 * Aqui ficam três coisas:
 *   1. abrir/contar conversa e dizer se ainda cabe na franquia;
 *   2. contar mensagem de serviço (hoje grátis na Meta, cobrada a partir de
 *      outubro/2026 — o contador já roda para a virada não pegar de surpresa);
 *   3. o razão (UsageEvent) com custo e preço congelados no momento do uso.
 */

export const USAGE_TYPES = {
  CONVERSATION: "CONVERSATION",
  SERVICE_MSG: "SERVICE_MSG",
  TEMPLATE_MSG: "TEMPLATE_MSG",
  CAMPAIGN: "CAMPAIGN",
  AI_TOKENS: "AI_TOKENS",
};

/**
 * Registra um evento de consumo. Nunca lança: medir não pode derrubar
 * atendimento — cliente sem resposta é pior que número errado no relatório.
 */
export async function registrarEvento(tenantId, dados) {
  if (!tenantId) return null;
  try {
    const evento = await prisma.usageEvent.create({
      data: {
        tenantId,
        type: dados.type,
        category: dados.category || null,
        quantity: dados.quantity ?? 1,
        costBrl: dados.costBrl || 0,
        priceBrl: dados.priceBrl || 0,
        leadId: dados.leadId || null,
        conversationId: dados.conversationId || null,
        campaignId: dados.campaignId || null,
        note: dados.note || null,
      },
    });
    if (dados.costBrl) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { usedCostBrl: { increment: dados.costBrl } },
      }).catch(() => {});
    }
    return evento;
  } catch (e) {
    console.warn("[Uso] Não foi possível registrar o consumo:", e.message);
    return null;
  }
}

/**
 * Quanto ainda cabe de conversa no ciclo.
 * `max = 0` significa sem limite — é como estavam todas as contas antes
 * desta franquia existir, e nenhuma pode passar a ser bloqueada por isso.
 */
export async function conversationsHeadroom(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      usedConversations: true,
      plan: { select: { maxConversations: true, name: true } },
    },
  });
  if (!tenant) return { ok: false, max: 0, used: 0, remaining: 0, ilimitado: false };

  const max = Number(tenant.plan?.maxConversations || 0);
  const used = Number(tenant.usedConversations || 0);
  if (max <= 0) return { ok: true, max: 0, used, remaining: Infinity, ilimitado: true };

  const remaining = Math.max(0, max - used);
  return {
    ok: used < max,
    max,
    used,
    remaining,
    ilimitado: false,
    planName: tenant.plan?.name || null,
  };
}

/**
 * Abre (e cobra) uma conversa nova quando o cliente escreve e não havia
 * janela aberta. Conversa que já estava em andamento não conta de novo — é
 * o que a Meta faz e é o que o cliente espera ao ler "500 conversas/mês".
 *
 * @returns { nova, dentroDaFranquia, headroom }
 */
export async function registrarConversa(tenantId, { leadId, conversationId, janelaEstavaAberta }) {
  if (janelaEstavaAberta) {
    return { nova: false, dentroDaFranquia: true, headroom: null };
  }

  const headroom = await conversationsHeadroom(tenantId);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { usedConversations: { increment: 1 } },
  }).catch(() => {});

  // Conversa em si não tem custo na Meta — o custo vem das mensagens. O
  // evento existe para o relatório saber quantas conversas houve e com quem.
  await registrarEvento(tenantId, {
    type: USAGE_TYPES.CONVERSATION,
    category: "SERVICE",
    leadId,
    conversationId,
    note: headroom.ilimitado ? null : `franquia ${headroom.used + 1}/${headroom.max}`,
  });

  return { nova: true, dentroDaFranquia: headroom.ok, headroom };
}

/**
 * Conta as mensagens de serviço (resposta dentro da janela) e o custo delas.
 * Hoje a tarifa é zero; quando o admin preencher, o custo passa a somar
 * sozinho, sem mexer em código.
 */
export async function registrarMensagemServico(tenantId, quantidade = 1, extras = {}) {
  if (!tenantId || quantidade <= 0) return;
  try {
    const { categorias } = await unitPricing();
    const unit = categorias.SERVICE || { unitCostBrl: 0, unitPriceBrl: 0 };
    const costBrl = unit.unitCostBrl * quantidade;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        usedServiceMessages: { increment: quantidade },
        ...(costBrl ? { usedCostBrl: { increment: costBrl } } : {}),
      },
    });

    // Sem tarifa não vale poluir o razão com uma linha por mensagem: o
    // contador já responde "quantas". A linha só entra quando custa dinheiro.
    if (costBrl > 0) {
      await registrarEvento(tenantId, {
        type: USAGE_TYPES.SERVICE_MSG,
        category: "SERVICE",
        quantity: quantidade,
        costBrl: 0, // já somado acima; não pode contar duas vezes
        priceBrl: unit.unitPriceBrl * quantidade,
        ...extras,
      });
    }
  } catch (e) {
    console.warn("[Uso] Falha ao contar mensagem de serviço:", e.message);
  }
}

/** Consumo do ciclo, pronto para a tela do cliente e para o admin. */
export async function resumoConsumo(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      usedConversations: true, usedServiceMessages: true, usedMessages: true,
      usedCampaignMessages: true, usedTokens: true, extraTokens: true,
      usedCostBrl: true, lastUsageReset: true, nextBillingDate: true,
      plan: {
        select: {
          name: true, priceMonthly: true, maxConversations: true,
          maxCampaignMessages: true, maxMessages: true, maxTokens: true,
          campaignCategory: true,
        },
      },
    },
  });
  if (!tenant) return null;

  const { categorias } = await unitPricing();
  const p = tenant.plan;
  const faixa = (usado, limite) => ({
    usado,
    limite: limite || 0,
    ilimitado: !limite,
    restante: limite ? Math.max(0, limite - usado) : null,
    percentual: limite ? Math.min(100, Math.round((usado / limite) * 100)) : 0,
  });

  return {
    plano: p?.name || null,
    cicloDesde: tenant.lastUsageReset,
    proximaCobranca: tenant.nextBillingDate,
    conversas: faixa(tenant.usedConversations || 0, p?.maxConversations || 0),
    disparos: faixa(tenant.usedCampaignMessages || 0, p?.maxCampaignMessages || 0),
    mensagens: faixa(tenant.usedMessages || 0, p?.maxMessages || 0),
    tokens: faixa(tenant.usedTokens || 0, (p?.maxTokens || 0) + (tenant.extraTokens || 0)),
    mensagensDeServico: tenant.usedServiceMessages || 0,
    custoRealBrl: Number((tenant.usedCostBrl || 0).toFixed(4)),
    // Ajuda o cliente a entender o que consome: preço por unidade.
    precos: {
      disparo: categorias[p?.campaignCategory || "MARKETING"]?.unitPriceBrl ?? 0,
      servico: categorias.SERVICE?.unitPriceBrl ?? 0,
    },
  };
}

/** Zera os contadores do ciclo. Chamado na renovação da assinatura. */
export async function reiniciarCiclo(tenantId) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      usedConversations: 0,
      usedServiceMessages: 0,
      usedCampaignMessages: 0,
      usedCostBrl: 0,
      lastUsageReset: new Date(),
    },
  }).catch(() => {});
}

export default {
  USAGE_TYPES, registrarEvento, conversationsHeadroom, registrarConversa,
  registrarMensagemServico, resumoConsumo, reiniciarCiclo,
};
