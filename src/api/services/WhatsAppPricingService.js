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
export async function estimateCampaign(recipientCount, category = "UTILITY", opts = {}) {
  const { rates, usdToBrl, markup } = await resolvePricing();
  const cat = String(category || "UTILITY").toUpperCase();
  // Plano de QR Code não passa pela Meta: nenhuma mensagem é cobrada.
  const unitUsd = opts.cobraPorMensagem === false ? 0 : (rates[cat] ?? rates.UTILITY);

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
    cobraPorMensagem: opts.cobraPorMensagem !== false,
  };
}

/**
 * Preço unitário por categoria — a base que o admin usa para montar plano.
 * @returns { MARKETING: { unitUsd, unitCostBrl, unitPriceBrl }, ... }
 */
export async function unitPricing() {
  const { rates, usdToBrl, markup } = await resolvePricing();
  const saida = {};
  for (const [cat, unitUsd] of Object.entries(rates)) {
    saida[cat] = {
      unitUsd,
      unitCostBrl: unitUsd * usdToBrl,
      unitPriceBrl: unitUsd * usdToBrl * markup,
    };
  }
  return { categorias: saida, usdToBrl, markup };
}

export const WHATSAPP_MODES = {
  OFFICIAL: "OFFICIAL",
  BAILEYS: "BAILEYS",
  BOTH: "BOTH",
};

/** O plano tem custo por mensagem na Meta? Só o canal oficial tem. */
export function cobraPorMensagem(plano) {
  const modo = String(plano?.whatsappMode || WHATSAPP_MODES.BOTH).toUpperCase();
  return modo !== WHATSAPP_MODES.BAILEYS;
}

/** Custo mensal por número no QR Code, definido na administração. */
export async function baileysNumberCost() {
  const s = await prisma.platformSettings
    .findUnique({ where: { id: "singleton" }, select: { baileysNumberCost: true } })
    .catch(() => null);
  return Number(s?.baileysNumberCost || 0);
}

/**
 * Custo de WhatsApp do plano inteiro, pelo canal que ele usa.
 *
 * No oficial o custo vem das mensagens (disparo + serviço). No QR Code não
 * existe custo por mensagem — existe o custo de manter cada número de pé,
 * que é fixo e some da conta se ninguém somar.
 */
export async function planWhatsappCost(plano) {
  const modo = String(plano?.whatsappMode || WHATSAPP_MODES.BOTH).toUpperCase();

  if (modo === WHATSAPP_MODES.BAILEYS) {
    const unit = await baileysNumberCost();
    const numeros = Math.max(1, Number(plano?.maxWhatsAppNumbers) || 1);
    return {
      modo,
      porMensagem: false,
      custoBrl: unit * numeros,
      detalhe: `${numeros} número(s) × ${unit.toFixed(2)}/mês de infraestrutura`,
    };
  }

  const disparo = await planCampaignCost(plano?.maxCampaignMessages, plano?.campaignCategory);
  return {
    modo,
    porMensagem: true,
    custoBrl: disparo.custoBrl,
    detalhe: `${disparo.quantidade} disparo(s) ${String(disparo.category).toLowerCase()}`,
  };
}

/**
 * Quanto custa (e quanto deveria valer) a franquia de disparos de um plano.
 *
 * Sem isto o plano era precificado só pelo custo de IA, e uma franquia de
 * 5.000 disparos de marketing — que custa caro na Meta — passava batida:
 * dava para vender um plano abaixo do próprio custo sem perceber.
 */
export async function planCampaignCost(maxCampaignMessages, category = "MARKETING") {
  const { categorias, usdToBrl, markup } = await unitPricing();
  const cat = String(category || "MARKETING").toUpperCase();
  const unit = categorias[cat] || categorias.MARKETING;
  const qtd = Math.max(0, Number(maxCampaignMessages) || 0);

  return {
    category: cat,
    quantidade: qtd,
    unitCostBrl: unit.unitCostBrl,
    unitPriceBrl: unit.unitPriceBrl,
    // Custo se o cliente usar a franquia inteira — é o pior caso, e é o que
    // precisa caber no preço do plano.
    custoBrl: unit.unitCostBrl * qtd,
    precoSugeridoBrl: unit.unitPriceBrl * qtd,
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
    select: {
      usedCampaignMessages: true,
      plan: {
        select: {
          maxCampaignMessages: true, name: true, campaignCategory: true,
          whatsappMode: true,
        },
      },
    },
  });
  if (!tenant) return { allowed: false, reason: "Conta não encontrada." };

  const limit = tenant.plan?.maxCampaignMessages ?? 0;
  const used = tenant.usedCampaignMessages || 0;
  const remaining = Math.max(0, limit - used);
  // A categoria da franquia e o preço unitário viajam junto: a tela mostra
  // quanto vale cada disparo do plano sem precisar de outra chamada.
  const categoria = tenant.plan?.campaignCategory || "MARKETING";
  const { categorias } = await unitPricing();
  const unitPriceBrl = categorias[categoria]?.unitPriceBrl ?? 0;
  // Em plano de QR Code a Meta não cobra: o preço unitário é zero e a
  // franquia vira limite de volume, não de custo. A tela precisa saber a
  // diferença, senão mostra "R$ 0,00" sem explicar por quê.
  const modo = String(tenant.plan?.whatsappMode || "BOTH").toUpperCase();
  const cobra = modo !== "BAILEYS";
  const extras = {
    category: categoria,
    unitPriceBrl: cobra ? unitPriceBrl : 0,
    whatsappMode: modo,
    cobraPorMensagem: cobra,
    planName: tenant.plan?.name || null,
  };

  if (limit <= 0) {
    return {
      allowed: false,
      limit,
      used,
      remaining: 0,
      ...extras,
      reason: `O plano ${tenant.plan?.name || "atual"} não inclui disparos em massa. Faça upgrade para liberar.`,
    };
  }
  if (recipientCount > remaining) {
    return {
      allowed: false,
      limit,
      used,
      remaining,
      ...extras,
      reason: `Franquia insuficiente: restam ${remaining} disparos no ciclo e este envio precisa de ${recipientCount}.`,
    };
  }
  return { allowed: true, limit, used, remaining, ...extras };
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

export default {
  DEFAULT_RATES_USD, WHATSAPP_MODES, resolvePricing, estimateCampaign, unitPricing,
  planCampaignCost, planWhatsappCost, baileysNumberCost, cobraPorMensagem,
  checkCampaignQuota, consumeCampaignQuota,
};
