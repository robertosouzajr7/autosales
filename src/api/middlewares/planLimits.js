import prisma from "../config/prisma.js";

/**
 * Gate de plano por recurso.
 *
 * Cada função lê o plano do tenant e verifica se o recurso está
 * habilitado ou se o limite ainda tem folga. Retorna { ok, reason, plan }.
 * Use como middleware Express ou chame direto (útil no cron/bot).
 *
 * Limites hard (bloqueio):
 *   - maxSdrs, maxUsers, maxWhatsAppNumbers, maxLeads
 *   - maxKnowledgeBaseChars (tamanho do treino)
 *   - maxTokens (créditos mensais de IA)
 *
 * Toggles (feature ON/OFF):
 *   - enableSdr, enableCalendar, enableAutomations, enableWebhooks
 *   - enableTokens (essencialmente parte do core)
 */

async function loadTenantWithPlan(tenantId) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });
}

// Helpers ─────────────────────────────────────────────────────────

function block(res, code, reason) {
  return res.status(code).json({ error: reason });
}

// Middlewares ─────────────────────────────────────────────────────

/** Bloqueia se a feature está OFF no plano. Ex.: requireFeature("enableCalendar") */
export function requireFeature(field, label) {
  return async (req, res, next) => {
    const tenant = await loadTenantWithPlan(req.tenantId);
    if (!tenant?.plan) return block(res, 403, "Nenhum plano ativo.");
    if (tenant.plan[field] === false) {
      return block(
        res,
        403,
        `O recurso "${label || field}" não está incluído no seu plano.`
      );
    }
    return next();
  };
}

/** Verifica limite de contagem antes de criar recurso. */
export function requireCountUnder({ field, count, label }) {
  return async (req, res, next) => {
    const tenant = await loadTenantWithPlan(req.tenantId);
    if (!tenant?.plan) return block(res, 403, "Nenhum plano ativo.");
    const max = Number(tenant.plan[field] || 0);
    const current = await count(tenant.id);
    if (current >= max) {
      return block(
        res,
        403,
        `Limite do seu plano atingido: máximo de ${max} ${label} (você tem ${current}).`
      );
    }
    return next();
  };
}

// Middlewares prontos para uso ────────────────────────────────────

export const requireCalendar = requireFeature("enableCalendar", "Agenda integrada");
export const requireAutomations = requireFeature("enableAutomations", "Automações e lembretes");
export const requireWebhooks = requireFeature("enableWebhooks", "Webhooks / API");

export const requireWhatsAppSlot = requireCountUnder({
  field: "maxWhatsAppNumbers",
  count: (tenantId) => prisma.whatsAppAccount.count({ where: { tenantId } }),
  label: "números WhatsApp",
});

/**
 * O canal pedido cabe no plano?
 *
 * O plano é quem define o canal porque é quem carrega o custo: no oficial a
 * Meta cobra por mensagem, no QR Code não. Deixar o cliente trocar de canal
 * por fora do plano quebraria a conta de margem inteira.
 *
 * @param canal "OFFICIAL" (Cloud API) ou "BAILEYS" (QR Code)
 */
export function requireWhatsAppMode(canal) {
  return async (req, res, next) => {
    try {
      const tenant = await loadTenantWithPlan(req.tenantId);
      const modo = String(tenant?.plan?.whatsappMode || "BOTH").toUpperCase();
      if (modo === "BOTH" || modo === canal) return next();

      const nomes = { OFFICIAL: "API oficial da Meta", BAILEYS: "QR Code" };
      return res.status(403).json({
        error:
          `O plano ${tenant?.plan?.name || "atual"} usa ${nomes[modo] || modo}. ` +
          `Para conectar por ${nomes[canal] || canal}, troque de plano.`,
        whatsappMode: modo,
        requested: canal,
      });
    } catch (e) {
      next();
    }
  };
}

export const requireUserSlot = requireCountUnder({
  field: "maxUsers",
  count: (tenantId) => prisma.user.count({ where: { tenantId } }),
  label: "usuários",
});

// Funções auxiliares ─────────────────────────────────────────────

/**
 * Retorna quantos caracteres cabem no treino do SDR informado.
 * knowledgeBase soma-se por SDR — o limite é por tenant.
 */
export async function knowledgeBaseHeadroom(tenantId, extraChars = 0) {
  const tenant = await loadTenantWithPlan(tenantId);
  if (!tenant?.plan) return { ok: false, max: 0, used: 0, remaining: 0 };
  const sdrs = await prisma.sdrBot.findMany({
    where: { tenantId },
    select: { knowledgeBase: true },
  });
  const used = sdrs.reduce((acc, s) => acc + (s.knowledgeBase?.length || 0), 0);
  const max = Number(tenant.plan.maxKnowledgeBaseChars || 0);
  const remaining = Math.max(0, max - used);
  return {
    ok: extraChars <= remaining,
    max,
    used,
    remaining,
  };
}

/** Verifica se o tenant ainda tem cota de tokens/mês. */
export async function tokensHeadroom(tenantId) {
  const tenant = await loadTenantWithPlan(tenantId);
  if (!tenant?.plan) return { ok: false, max: 0, used: 0, remaining: 0 };
  if (tenant.plan.enableTokens === false) {
    return { ok: false, max: 0, used: tenant.usedTokens || 0, remaining: 0 };
  }
  // A recarga entra no limite: quem comprou tokens extras não pode ser
  // barrado por ter estourado só a franquia do plano.
  const max = Number(tenant.plan.maxTokens || 0) + Number(tenant.extraTokens || 0);
  const used = Number(tenant.usedTokens || 0);
  return { ok: used < max, max, used, remaining: Math.max(0, max - used) };
}
