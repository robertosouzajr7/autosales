import crypto from "crypto";
import prisma from "../config/prisma.js";

/**
 * Autenticação da API pública (`/api/v1`).
 *
 * O CRM do cliente não faz login com e-mail e senha: ele manda uma chave.
 * A chave inteira só existe no momento em que é criada — o banco guarda o
 * hash, então um vazamento do banco não entrega acesso a ninguém.
 */

const PREFIXO = "av_live_";

/** Gera uma chave nova. Devolve o texto (mostrado uma vez) e o que salvar. */
export function gerarChave() {
  const segredo = crypto.randomBytes(24).toString("base64url");
  const texto = `${PREFIXO}${segredo}`;
  return { texto, prefix: texto.slice(0, 16), hash: hashChave(texto) };
}

export function hashChave(texto) {
  return crypto.createHash("sha256").update(String(texto)).digest("hex");
}

function extrair(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  if (req.headers["x-api-key"]) return String(req.headers["x-api-key"]).trim();
  return null;
}

/** Exige uma chave válida e coloca tenantId/scopes na requisição. */
export async function apiKeyMiddleware(req, res, next) {
  try {
    const texto = extrair(req);
    if (!texto) {
      return res.status(401).json({
        error: "Chave de API ausente. Envie o header Authorization: Bearer <sua-chave>.",
      });
    }

    const chave = await prisma.apiKey.findUnique({
      where: { hash: hashChave(texto) },
      include: { tenant: { select: { id: true, active: true } } },
    });
    if (!chave || chave.revokedAt) return res.status(401).json({ error: "Chave de API inválida ou revogada." });
    if (chave.tenant?.active === false) return res.status(403).json({ error: "Conta suspensa." });

    req.tenantId = chave.tenantId;
    req.apiKey = chave;
    req.scopes = String(chave.scopes || "").split(",").map((s) => s.trim()).filter(Boolean);

    // Data de último uso ajuda o cliente a saber qual chave pode revogar.
    // Não bloqueia a requisição, e só grava uma vez por minuto.
    if (!chave.lastUsedAt || Date.now() - new Date(chave.lastUsedAt).getTime() > 60_000) {
      prisma.apiKey.update({ where: { id: chave.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    }

    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/** Exige um escopo específico ("contacts:write"). */
export function requireScope(escopo) {
  return (req, res, next) => {
    if (req.scopes?.includes(escopo)) return next();
    return res.status(403).json({ error: `Esta chave não tem o escopo "${escopo}".`, missingScope: escopo });
  };
}

export default { apiKeyMiddleware, requireScope, gerarChave, hashChave };
