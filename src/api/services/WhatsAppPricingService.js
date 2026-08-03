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

  const disparo = await planCampaignCost(plano?.campaignCreditsBrl);
  return {
    modo,
    porMensagem: true,
    custoBrl: disparo.custoBrl,
    detalhe: disparo.detalhe,
  };
}

/**
 * Quanto custa a você o crédito de disparo que o plano dá de graça.
 *
 * Com franquia em dinheiro a conta fica direta: o crédito é preço de venda,
 * e preço de venda é custo × margem — logo o seu custo é o crédito dividido
 * pela margem. Não importa mais em que categoria o cliente vai gastar, porque
 * cada mensagem é debitada pelo preço da própria categoria.
 */
export async function planCampaignCost(campaignCreditsBrl) {
  const { usdToBrl, markup } = await unitPricing();
  const credito = Math.max(0, Number(campaignCreditsBrl) || 0);
  const custoBrl = markup > 0 ? credito / markup : credito;

  return {
    creditoBrl: credito,
    custoBrl,
    precoSugeridoBrl: credito,
    detalhe: credito > 0
      ? `R$ ${credito.toFixed(2)} de crédito (margem ${markup}x)`
      : "sem crédito de disparo",
    usdToBrl,
    markup,
  };
}




export default {
  DEFAULT_RATES_USD, WHATSAPP_MODES, resolvePricing, estimateCampaign, unitPricing,
  planCampaignCost, planWhatsappCost, baileysNumberCost, cobraPorMensagem,
};
