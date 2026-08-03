import prisma from "../config/prisma.js";
import { unitPricing } from "./WhatsAppPricingService.js";
import { saldoDisparo, fecharCiclo, LIMIAR_ALERTA } from "./CampaignCreditService.js";

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
        select: { name: true, priceMonthly: true, maxConversations: true, maxTokens: true },
      },
    },
  });
  if (!tenant) return null;

  const { categorias } = await unitPricing();
  const credito = await saldoDisparo(tenantId);
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
    // Disparo virou saldo em dinheiro: quantidade sozinha não diz nada quando
    // uma mensagem custa 9x a outra.
    disparo: credito,
    disparosEnviados: tenant.usedCampaignMessages || 0,
    // Sem cota: é quanto o agente já respondeu no ciclo, para o relatório.
    mensagensEnviadas: tenant.usedMessages || 0,
    tokens: faixa(tenant.usedTokens || 0, (p?.maxTokens || 0) + (tenant.extraTokens || 0)),
    mensagensDeServico: tenant.usedServiceMessages || 0,
    custoRealBrl: Number((tenant.usedCostBrl || 0).toFixed(4)),
    // Onde o dinheiro foi parar, por ação. É a pergunta que o cliente faz.
    porAcao: await gastoPorAcao(tenantId),
    // Ajuda o cliente a entender o que consome: preço por unidade.
    precos: {
      marketing: categorias.MARKETING?.unitPriceBrl ?? 0,
      utilidade: categorias.UTILITY?.unitPriceBrl ?? 0,
      autenticacao: categorias.AUTHENTICATION?.unitPriceBrl ?? 0,
      servico: categorias.SERVICE?.unitPriceBrl ?? 0,
    },
    alertas: montarAlertas({ credito, conversas: faixa(tenant.usedConversations || 0, p?.maxConversations || 0), tokens: faixa(tenant.usedTokens || 0, (p?.maxTokens || 0) + (tenant.extraTokens || 0)) }),
  };
}

/**
 * Zera os contadores do ciclo. É o ÚNICO lugar que vira o mês de consumo —
 * quem renova assinatura (webhook do gateway, upgrade de plano) chama daqui
 * em vez de listar campos na mão. Cada lista inline era uma chance de
 * esquecer um contador novo, e foi exatamente o que aconteceu: o crédito de
 * disparo nasceu depois e nenhuma das listas o zerava, então a franquia nunca
 * renovava para quem pagava a mensalidade.
 *
 * Em upgrade de plano, chame ANTES de trocar o planId: o fechamento compara o
 * gasto com a franquia do plano que estava valendo.
 */
export async function reiniciarCiclo(tenantId) {
  // Antes de zerar o gasto: o que passou da franquia sai da recarga. Se isto
  // rodar depois, a recarga já consumida volta de graça.
  await fecharCiclo(tenantId);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      usedConversations: 0,
      usedServiceMessages: 0,
      usedCampaignMessages: 0,
      // Zera o gasto do ciclo, não a recarga: crédito comprado não expira.
      usedCampaignCreditsBrl: 0,
      usedCostBrl: 0,
      // Tokens de IA não precisam de fechamento: o consumo já debita
      // extraTokens assim que passa da franquia (AutomationEngine._chargeTokens).
      // Descontar de novo aqui cobraria a mesma recarga duas vezes.
      usedTokens: 0,
      usedMessages: 0,
      alertasEnviados: null,
      lastUsageReset: new Date(),
    },
  }).catch(() => {});
}

/**
 * Quanto foi gasto em cada tipo de ação no ciclo.
 *
 * "Consumi R$ 47" não ajuda ninguém a decidir nada; "R$ 44 em disparo e R$ 3
 * em IA" ajuda. Sai do razão, então bate com o extrato linha a linha.
 */
export async function gastoPorAcao(tenantId) {
  const desde = await inicioDoCiclo(tenantId);
  const linhas = await prisma.usageEvent.groupBy({
    by: ["type"],
    where: { tenantId, createdAt: { gte: desde } },
    _sum: { priceBrl: true, costBrl: true, quantity: true },
    _count: true,
  });

  const rotulos = {
    CAMPAIGN: "Disparo em massa",
    TEMPLATE_MSG: "Mensagem por template",
    CONVERSATION: "Conversas atendidas",
    SERVICE_MSG: "Mensagens do atendimento",
    AI_TOKENS: "Inteligência artificial",
  };

  return linhas
    .map((l) => ({
      tipo: l.type,
      rotulo: rotulos[l.type] || l.type,
      eventos: l._count,
      quantidade: l._sum.quantity || 0,
      precoBrl: Number((l._sum.priceBrl || 0).toFixed(2)),
      custoBrl: Number((l._sum.costBrl || 0).toFixed(4)),
    }))
    .sort((a, b) => b.precoBrl - a.precoBrl);
}

/** Início do ciclo vigente — tudo que a tela mostra é contado a partir daqui. */
async function inicioDoCiclo(tenantId) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { lastUsageReset: true },
  });
  return t?.lastUsageReset || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

/**
 * Avisos de saldo baixo. Um alerta que só aparece quando já acabou chega
 * tarde: o corte é em 20% restantes, tempo de comprar recarga antes de o
 * disparo travar no meio de uma campanha.
 */
function montarAlertas({ credito, conversas, tokens }) {
  const lista = [];
  const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (credito && !credito.semDisparo && credito.cobraPorMensagem) {
    if (credito.esgotado) {
      lista.push({
        chave: "disparo", nivel: "critico",
        titulo: "Crédito de disparo esgotado",
        texto: "Suas campanhas estão bloqueadas até a virada do ciclo ou até você comprar uma recarga.",
        acao: "recarga-disparo",
      });
    } else if (credito.baixo) {
      lista.push({
        chave: "disparo", nivel: "atencao",
        titulo: `Resta ${brl(credito.saldo)} de crédito de disparo`,
        texto: `Isso dá cerca de ${credito.equivale.UTILITY ?? 0} mensagem(ns) de utilidade ou ${credito.equivale.MARKETING ?? 0} de marketing. Vale recarregar antes da próxima campanha.`,
        acao: "recarga-disparo",
      });
    }
  }

  const perto = (f) => !f.ilimitado && f.limite > 0 && f.restante / f.limite <= LIMIAR_ALERTA;
  if (conversas && perto(conversas)) {
    lista.push({
      chave: "conversas", nivel: conversas.restante === 0 ? "critico" : "atencao",
      titulo: conversas.restante === 0
        ? "Franquia de conversas esgotada"
        : `Restam ${conversas.restante} conversas no ciclo`,
      texto: "Ao esgotar, o agente para de abrir conversa nova e o contato vai para a fila humana.",
      acao: "upgrade",
    });
  }
  if (tokens && perto(tokens)) {
    lista.push({
      chave: "tokens", nivel: tokens.restante === 0 ? "critico" : "atencao",
      titulo: tokens.restante === 0
        ? "Créditos de IA esgotados"
        : `Restam ${tokens.restante.toLocaleString("pt-BR")} créditos de IA`,
      texto: "Sem crédito o agente para de responder. A recarga não expira.",
      acao: "recarga-tokens",
    });
  }

  return lista;
}

export default {
  USAGE_TYPES, registrarEvento, conversationsHeadroom, registrarConversa,
  registrarMensagemServico, resumoConsumo, reiniciarCiclo, gastoPorAcao,
};
