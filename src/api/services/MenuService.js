import prisma from "../config/prisma.js";
import { tipoDoArquivo } from "../middlewares/upload.js";

/**
 * O cardápio do negócio como arquivo.
 *
 * Restaurante, lanchonete e delivery não descrevem o cardápio linha a linha
 * na conversa — mandam a foto ou o PDF. Aqui o dono sobe esse arquivo uma vez
 * em "Meu Negócio" e o agente passa a entregá-lo quando alguém pede.
 *
 * O arquivo mora no mesmo lugar da mídia do catálogo (StorageService), então
 * vale tudo que já vale por lá: S3/R2 em produção, disco local no fallback.
 */

/** Verticais em que o cardápio faz sentido e o campo aparece na tela. */
export const NICHOS_COM_CARDAPIO = ["RESTAURANT", "FOOD"];

/** Só imagem e PDF: é o que o cliente consegue abrir no celular sem baixar app. */
export const FORMATOS_DE_CARDAPIO = ["jpg", "jpeg", "png", "webp", "pdf"];

export function ehNichoDeAlimentacao(businessType) {
  return NICHOS_COM_CARDAPIO.includes(String(businessType || "").toUpperCase());
}

/**
 * Classifica o arquivo do cardápio.
 *
 * @returns {{ ok: boolean, kind?: string, erro?: string }}
 *   kind é "image" ou "document" — o que MessagingService.sendMedia espera.
 */
export function classificar(nome, mimetype = "") {
  const ext = String(nome || "").toLowerCase().split(".").pop();
  if (!FORMATOS_DE_CARDAPIO.includes(ext)) {
    return {
      ok: false,
      erro: `"${nome}" não serve como cardápio. Envie uma imagem (JPG, PNG, WEBP) ou um PDF.`,
    };
  }
  const tipo = tipoDoArquivo(nome, mimetype);
  // A extensão manda: o navegador manda octet-stream com frequência, e um PDF
  // recusado aqui é o dono achando que o sistema não aceita PDF.
  const kind = ext === "pdf" ? "document" : tipo === "image" ? "image" : null;
  if (!kind) return { ok: false, erro: `Não reconheci "${nome}" como imagem nem como PDF.` };
  return { ok: true, kind };
}

/**
 * O cardápio publicado de um tenant, ou null quando não há nenhum.
 *
 * @returns {Promise<{ url: string, kind: string, fileName: string|null,
 *                     atualizadoEm: Date|null } | null>}
 */
export async function cardapioDe(tenantId) {
  if (!tenantId) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { menuUrl: true, menuKind: true, menuFileName: true, menuUpdatedAt: true },
  });
  if (!tenant?.menuUrl) return null;
  return {
    url: tenant.menuUrl,
    kind: tenant.menuKind === "document" ? "document" : "image",
    fileName: tenant.menuFileName || null,
    atualizadoEm: tenant.menuUpdatedAt || null,
  };
}

/** A legenda que acompanha o arquivo. Curta: o cardápio já fala por si. */
export function legenda(cardapio) {
  return cardapio?.kind === "document"
    ? "Aqui está o nosso cardápio 🙂 É só abrir o arquivo."
    : "Aqui está o nosso cardápio 🙂";
}

export default { NICHOS_COM_CARDAPIO, FORMATOS_DE_CARDAPIO, ehNichoDeAlimentacao, classificar, cardapioDe, legenda };
