import prisma from "../config/prisma.js";
import { unitPricing } from "./WhatsAppPricingService.js";
import { modelCostBRLPer1M, DEFAULT_MODEL, DEFAULT_USD_BRL } from "./AIProviderService.js";
import { saldoDisparo } from "./CampaignCreditService.js";

/**
 * Cotação de recarga com valor livre.
 *
 * Pacote fechado obrigava o cliente a comprar o que o admin tinha imaginado:
 * quem precisava de R$ 30 comprava R$ 100, e quem precisava de R$ 300 comprava
 * três vezes. Aqui ele digita o quanto quer e o preço sai da mesma tabela que
 * cobra o consumo — recarga e gasto nunca discordam sobre quanto vale um real
 * de crédito ou mil tokens.
 *
 * A cotação é feita no servidor e refeita no checkout. O que a tela mostra é
 * conferência, não fonte: preço que chega do navegador não vira cobrança.
 */

/** Compra mínima de IA. Abaixo disso o pedido não cobre nem o processamento. */
export const MINIMO_TOKENS = 1_000_000;

/**
 * Compra mínima de disparo. A taxa fixa do gateway come uma recarga pequena
 * inteira — R$ 5 de crédito custaria mais para processar do que rende.
 */
export const MINIMO_DISPARO_BRL = 20;

/** Tokens são vendidos em passos de mil: número redondo na tela e na nota. */
const PASSO_TOKENS = 1_000;

const arredCent = (v) => Math.round((Number(v) || 0) * 100) / 100;
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Preços vigentes da recarga. Mesma origem que o consumo usa: mexeu no câmbio
 * ou no markup do admin, a recarga acompanha sem ninguém reeditar pacote.
 */
export async function tabela() {
  const s = await prisma.platformSettings.findUnique({ where: { id: "singleton" } }).catch(() => null);
  const provedor = (s?.aiProvider || "GEMINI").toUpperCase();
  const modelo = s?.aiModel || DEFAULT_MODEL[provedor] || DEFAULT_MODEL.GEMINI;
  const usdToBrl = s?.usdToBrl ?? DEFAULT_USD_BRL;
  const markup = s?.tokenMarkup ?? 5.0;

  const custoPor1M = modelCostBRLPer1M(modelo, usdToBrl);
  const precoPor1M = arredCent(custoPor1M * markup);

  const { categorias } = await unitPricing();
  return {
    precoPor1MTokens: precoPor1M,
    precosDisparo: {
      MARKETING: categorias.MARKETING?.unitPriceBrl ?? 0,
      UTILITY: categorias.UTILITY?.unitPriceBrl ?? 0,
      AUTHENTICATION: categorias.AUTHENTICATION?.unitPriceBrl ?? 0,
    },
    minimoTokens: MINIMO_TOKENS,
    minimoDisparoBrl: MINIMO_DISPARO_BRL,
    passoTokens: PASSO_TOKENS,
  };
}

/**
 * Cota uma recarga.
 *
 * O cliente digita de um lado só — reais OU quantidade — e recebe os dois,
 * porque as duas perguntas aparecem na hora de decidir: "quanto vou pagar" e
 * "quanto isso rende". Devolve `ok: false` com motivo em vez de lançar: a
 * tela precisa mostrar o mínimo enquanto ele ainda está digitando.
 *
 * @param {string} tenantId
 * @param {{tipo: string, valorBrl?: number, tokens?: number}} pedido
 */
export async function cotar(tenantId, pedido = {}) {
  const t = await tabela();
  const tipo = String(pedido.tipo || "").toUpperCase() === "DISPARO" ? "DISPARO" : "TOKENS";

  return tipo === "DISPARO"
    ? cotarDisparo(tenantId, pedido, t)
    : cotarTokens(tenantId, pedido, t);
}

/**
 * Disparo: um real pago é um real de crédito. A margem já está no preço de
 * cada mensagem (o markup do WhatsApp), então vender crédito com ágio cobraria
 * a mesma margem duas vezes.
 */
async function cotarDisparo(tenantId, pedido, t) {
  const valorBrl = arredCent(pedido.valorBrl);
  const base = {
    tipo: "DISPARO",
    minimoBrl: t.minimoDisparoBrl,
    precos: t.precosDisparo,
  };

  if (!Number.isFinite(valorBrl) || valorBrl <= 0) {
    return { ...base, ok: false, motivo: "Informe quanto deseja recarregar." };
  }
  if (valorBrl < t.minimoDisparoBrl) {
    return { ...base, ok: false, valorBrl, motivo: `A recarga mínima é de ${brl(t.minimoDisparoBrl)}.` };
  }

  // Quantas mensagens o valor compra, por categoria. É o que transforma
  // "R$ 150" numa decisão: dá para a campanha de sexta ou não dá.
  const equivale = {};
  for (const [cat, preco] of Object.entries(t.precosDisparo)) {
    equivale[cat] = preco > 0 ? Math.floor(valorBrl / preco) : null;
  }

  const saldo = await saldoDisparo(tenantId).catch(() => null);
  return {
    ...base,
    ok: true,
    valorBrl,
    creditsBrl: valorBrl,
    equivale,
    saldoAtual: saldo?.saldo ?? 0,
    saldoDepois: arredCent((saldo?.saldo ?? 0) + valorBrl),
    resumo: `${brl(valorBrl)} de crédito de disparo`,
  };
}

/** IA: o preço do milhão sai do custo real do modelo ativo vezes o markup. */
async function cotarTokens(tenantId, pedido, t) {
  const preco1M = t.precoPor1MTokens;
  const base = {
    tipo: "TOKENS",
    minimoTokens: t.minimoTokens,
    precoPor1MTokens: preco1M,
    // O mínimo em reais é derivado, não configurado: preço muda, mínimo muda.
    minimoBrl: arredCent((t.minimoTokens / 1_000_000) * preco1M),
  };

  if (preco1M <= 0) {
    return { ...base, ok: false, motivo: "A recarga de IA não está disponível no momento." };
  }

  let tokens;
  if (Number(pedido.tokens) > 0) {
    tokens = Math.floor(Number(pedido.tokens) / PASSO_TOKENS) * PASSO_TOKENS;
  } else if (Number(pedido.valorBrl) > 0) {
    // Vindo de reais, arredonda os tokens PARA BAIXO: o cliente nunca recebe
    // menos do que pagou, e a diferença fica com ele em centavos de desconto.
    const bruto = (Number(pedido.valorBrl) / preco1M) * 1_000_000;
    tokens = Math.floor(bruto / PASSO_TOKENS) * PASSO_TOKENS;
  } else {
    return { ...base, ok: false, motivo: "Informe quanto deseja recarregar." };
  }

  if (tokens < t.minimoTokens) {
    return {
      ...base, ok: false, tokens,
      motivo: `A compra mínima é de ${(t.minimoTokens / 1_000_000).toLocaleString("pt-BR")} milhão de tokens (${brl(base.minimoBrl)}).`,
    };
  }

  const valorBrl = arredCent((tokens / 1_000_000) * preco1M);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { extraTokens: true },
  }).catch(() => null);

  return {
    ...base,
    ok: true,
    tokens,
    valorBrl,
    saldoAtual: tenant?.extraTokens ?? 0,
    saldoDepois: (tenant?.extraTokens ?? 0) + tokens,
    resumo: `${tokens.toLocaleString("pt-BR")} tokens de IA`,
  };
}

export default { cotar, tabela, MINIMO_TOKENS, MINIMO_DISPARO_BRL };
