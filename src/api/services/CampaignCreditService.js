import prisma from "../config/prisma.js";
import { unitPricing } from "./WhatsAppPricingService.js";

/**
 * Saldo de disparo em dinheiro.
 *
 * A franquia por quantidade obrigava o plano a escolher uma categoria e ser
 * precificado pelo pior caso, porque a Meta cobra ~9x mais por marketing que
 * por utilidade. Aqui o plano dá um valor, o cliente gasta onde quiser, e o
 * débito usa o preço vigente no momento do envio — se o dólar sobe, ele compra
 * menos mensagens, e a margem continua de pé sem ninguém mexer em tabela.
 *
 * Ordem de consumo: primeiro a franquia do mês, depois a recarga. A recarga
 * não expira — é a mesma regra dos tokens de IA, e mudar de regra entre dois
 * saldos do mesmo painel só confundiria.
 */

/** Abaixo disto o cliente é avisado de que o saldo está acabando. */
export const LIMIAR_ALERTA = 0.2;

const arred = (v) => Number((Number(v) || 0).toFixed(4));
const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Fotografia do saldo. Serve à tela, ao alerta e à trava do envio — os três
 * precisam concordar, então saem todos daqui.
 */
export async function saldoDisparo(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      usedCampaignCreditsBrl: true,
      extraCampaignCreditsBrl: true,
      plan: { select: { name: true, campaignCreditsBrl: true, whatsappMode: true } },
    },
  });
  if (!tenant) return null;

  const incluido = Number(tenant.plan?.campaignCreditsBrl || 0);
  const recarga = Number(tenant.extraCampaignCreditsBrl || 0);
  const usado = Number(tenant.usedCampaignCreditsBrl || 0);
  const total = incluido + recarga;
  const saldo = Math.max(0, total - usado);

  // Plano de QR Code não passa pela Meta: nenhuma mensagem é tarifada, então
  // o crédito não faz sentido ali — a franquia vira limite de volume zero e a
  // tela precisa dizer isso em vez de mostrar "R$ 0,00" sem explicação.
  const modo = String(tenant.plan?.whatsappMode || "BOTH").toUpperCase();
  const cobra = modo !== "BAILEYS";

  const { categorias } = await unitPricing();
  const precos = {
    MARKETING: categorias.MARKETING?.unitPriceBrl ?? 0,
    UTILITY: categorias.UTILITY?.unitPriceBrl ?? 0,
    AUTHENTICATION: categorias.AUTHENTICATION?.unitPriceBrl ?? 0,
  };

  // Quantas mensagens o saldo ainda dá, por categoria. É o que transforma
  // "R$ 34,20" em algo que o dono da conta consegue decidir em cima.
  const equivale = {};
  for (const [cat, preco] of Object.entries(precos)) {
    equivale[cat] = preco > 0 ? Math.floor(saldo / preco) : null;
  }

  const percentualRestante = total > 0 ? saldo / total : 0;

  return {
    plano: tenant.plan?.name || null,
    incluido: arred(incluido),
    recarga: arred(recarga),
    usado: arred(usado),
    total: arred(total),
    saldo: arred(saldo),
    percentualUsado: total > 0 ? Math.min(100, Math.round((usado / total) * 100)) : 0,
    percentualRestante,
    /// Verdadeiro quando resta menos que o limiar — é o gatilho do aviso.
    baixo: total > 0 && percentualRestante <= LIMIAR_ALERTA,
    esgotado: total > 0 && saldo <= 0,
    semDisparo: total <= 0,
    whatsappMode: modo,
    cobraPorMensagem: cobra,
    precos,
    equivale,
  };
}

/** Quanto custa mandar `quantidade` mensagens de uma categoria, hoje. */
export async function custoEstimado(quantidade, categoria = "MARKETING") {
  const { categorias } = await unitPricing();
  const cat = String(categoria || "MARKETING").toUpperCase();
  const unit = categorias[cat]?.unitPriceBrl ?? categorias.MARKETING?.unitPriceBrl ?? 0;
  return { categoria: cat, unitPriceBrl: unit, total: arred(unit * Math.max(0, Number(quantidade) || 0)) };
}

/**
 * O saldo cobre este disparo? Responde já com os números que a tela precisa
 * mostrar antes de confirmar — quanto custa, quanto sobra, que fatia do saldo
 * o envio consome.
 */
export async function podeDisparar(tenantId, quantidade, categoria = "MARKETING") {
  const saldo = await saldoDisparo(tenantId);
  if (!saldo) return { allowed: false, reason: "Conta não encontrada." };

  const custo = await custoEstimado(quantidade, categoria);

  // Sem tarifa (QR Code) não há o que debitar: o disparo passa livre.
  if (!saldo.cobraPorMensagem) {
    return { allowed: true, ...saldo, custo: { ...custo, total: 0 }, fatiaDoSaldo: 0 };
  }

  if (saldo.semDisparo) {
    return {
      allowed: false, ...saldo, custo,
      reason: `O plano ${saldo.plano || "atual"} não inclui crédito de disparo. Faça upgrade ou compre uma recarga.`,
    };
  }
  if (custo.total > saldo.saldo) {
    return {
      allowed: false, ...saldo, custo,
      reason: `Saldo insuficiente: este envio custa ${moeda(custo.total)} e você tem ${moeda(saldo.saldo)}. Compre uma recarga para continuar.`,
    };
  }

  return {
    allowed: true, ...saldo, custo,
    fatiaDoSaldo: saldo.saldo > 0 ? custo.total / saldo.saldo : 0,
  };
}

/** Debita o que saiu de fato. Falha de envio não consome saldo. */
export async function debitar(tenantId, valorBrl) {
  const v = arred(valorBrl);
  if (!tenantId || v <= 0) return;
  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { usedCampaignCreditsBrl: { increment: v } },
    });
  } catch (e) {
    console.warn("[Crédito] Falha ao debitar disparo:", e.message);
  }
}

/**
 * Devolve crédito. Usado quando a Meta confirma que a mensagem não foi
 * entregue: ela não cobra o que não chegou, então o cliente também não paga.
 * O piso em zero evita saldo negativo por webhook reprocessado.
 */
export async function devolver(tenantId, valorBrl) {
  const v = arred(valorBrl);
  if (!tenantId || v <= 0) return;
  try {
    await prisma.tenant.updateMany({
      where: { id: tenantId, usedCampaignCreditsBrl: { gte: v } },
      data: { usedCampaignCreditsBrl: { decrement: v } },
    });
  } catch (e) {
    console.warn("[Crédito] Falha ao devolver crédito:", e.message);
  }
}

/**
 * Fecha o ciclo do crédito.
 *
 * "Franquia primeiro, depois recarga" só é verdade se o que passou da franquia
 * sair da recarga ao virar o mês. Sem isto, zerar o gasto devolvia a recarga
 * já consumida: quem tinha R$ 100 de franquia e R$ 50 de recarga e gastava
 * R$ 120 acordava no mês seguinte com os R$ 50 intactos — R$ 20 de crédito de
 * graça, todo mês, para sempre.
 *
 * Deve ser chamado ANTES de zerar usedCampaignCreditsBrl.
 */
export async function fecharCiclo(tenantId) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      usedCampaignCreditsBrl: true,
      extraCampaignCreditsBrl: true,
      plan: { select: { campaignCreditsBrl: true } },
    },
  });
  if (!t) return { consumidoDaRecarga: 0 };

  const incluido = Number(t.plan?.campaignCreditsBrl || 0);
  const usado = Number(t.usedCampaignCreditsBrl || 0);
  // O que passou da franquia do mês veio da recarga.
  const excedente = Math.max(0, usado - incluido);
  const consumido = Math.min(excedente, Number(t.extraCampaignCreditsBrl || 0));

  if (consumido > 0) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { extraCampaignCreditsBrl: { decrement: arred(consumido) } },
    }).catch(() => {});
  }
  return { consumidoDaRecarga: arred(consumido) };
}

/** Recarga comprada cai aqui. Não expira e não zera na virada do ciclo. */
export async function creditar(tenantId, valorBrl) {
  const v = arred(valorBrl);
  if (!tenantId || v <= 0) return;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { extraCampaignCreditsBrl: { increment: v } },
  });
}

export default {
  LIMIAR_ALERTA, saldoDisparo, custoEstimado, podeDisparar, debitar, devolver, creditar, fecharCiclo,
};
