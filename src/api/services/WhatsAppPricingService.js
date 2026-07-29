import prisma from "../config/prisma.js";

/**
 * Precificação de disparos no WhatsApp.
 *
 * Desde julho/2025 a Meta cobra por MENSAGEM entregue (modelo PMP), e não mais
 * por conversa de 24h. A tarifa varia por categoria do template e por país do
 * destinatário; estas são as tarifas do Brasil em USD.
 *
 * Ficam como padrão porque a Meta reajusta sem aviso — o admin sobrescreve em
 * PlatformSettings.waRates sem precisar de deploy.
 */
export const DEFAULT_RATES_USD = {
  MARKETING: 0.0625,      // promoções e reengajamento — a mais cara
  UTILITY: 0.0068,        // confirmações, lembretes, atualizações de pedido
  AUTHENTICATION: 0.0068, // códigos de verificação
  SERVICE: 0,             // resposta dentro da janela de 24h é gratuita
};

/** Tarifas, câmbio e markup vigentes. */
export async function resolvePricing() {
  let s = null;
  try {
    s = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  } catch { /* usa os padrões */ }

  let rates = { ...DEFAULT_RATES_USD };
  try {
    if (s?.waRates) {
      const custom = JSON.parse(s.waRates);
      // Merge em vez de substituir: o admin pode ajustar só uma categoria.
      for (const k of Object.keys(rates)) {
        if (typeof custom?.[k] === "number" && custom[k] >= 0) rates[k] = custom[k];
      }
    }
  } catch { /* JSON inválido não pode derrubar a precificação */ }

  return {
    rates,
    usdToBrl: s?.usdToBrl && s.usdToBrl > 0 ? s.usdToBrl : 5.5,
    markup: s?.waMarkup && s.waMarkup > 0 ? s.waMarkup : 2.0,
  };
}

/**
 * Projeção de gasto de um disparo.
 * @returns custo real (o que a Meta cobra) e preço (o que o cliente paga).
 */
export async function estimateCampaign(recipientCount, category = "UTILITY") {
  const { rates, usdToBrl, markup } = await resolvePricing();
  const cat = String(category || "UTILITY").toUpperCase();
  const unitUsd = rates[cat] ?? rates.UTILITY;

  const costUsd = unitUsd * recipientCount;
  const costBrl = costUsd * usdToBrl;
  const priceBrl = costBrl * markup;

  return {
    category: cat,
    recipientCount,
    unitUsd,
    unitBrl: unitUsd * usdToBrl,
    unitPriceBrl: unitUsd * usdToBrl * markup,
    costUsd,
    costBrl,
    priceBrl,
    usdToBrl,
    markup,
  };
}

/**
 * A conta pode disparar essa quantidade? O plano define a franquia mensal e,
 * ao estourar, o envio é bloqueado (não há cobrança de excedente).
 */
export async function checkCampaignQuota(tenantId, recipientCount) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { usedCampaignMessages: true, plan: { select: { maxCampaignMessages: true, name: true } } },
  });
  if (!tenant) return { allowed: false, reason: "Conta não encontrada." };

  const limit = tenant.plan?.maxCampaignMessages ?? 0;
  const used = tenant.usedCampaignMessages || 0;
  const remaining = Math.max(0, limit - used);

  if (limit <= 0) {
    return {
      allowed: false,
      limit,
      used,
      remaining: 0,
      reason: `O plano ${tenant.plan?.name || "atual"} não inclui disparos em massa. Faça upgrade para liberar.`,
    };
  }
  if (recipientCount > remaining) {
    return {
      allowed: false,
      limit,
      used,
      remaining,
      reason: `Franquia insuficiente: restam ${remaining} disparos no ciclo e este envio precisa de ${recipientCount}.`,
    };
  }
  return { allowed: true, limit, used, remaining };
}

/** Contabiliza o que foi efetivamente enviado. */
export async function consumeCampaignQuota(tenantId, sent) {
  if (!sent) return;
  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { usedCampaignMessages: { increment: sent } },
    });
  } catch (e) {
    console.warn("[Pricing] Não foi possível contabilizar disparos:", e.message);
  }
}

export default { DEFAULT_RATES_USD, resolvePricing, estimateCampaign, checkCampaignQuota, consumeCampaignQuota };
