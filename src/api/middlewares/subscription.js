import prisma from "../config/prisma.js";

/**
 * Decide se um tenant pode consumir recursos pagos (mensagens, IA,
 * agendamento). Fonte única de verdade, usada tanto pelo middleware HTTP
 * quanto pelo gate do bot inbound.
 *
 * Regras:
 * - ACTIVE  → liberado.
 * - TRIAL   → liberado enquanto trialEnd estiver no futuro (ou nulo).
 * - PAST_DUE / CANCELED / trial expirado → bloqueado.
 */
export async function isTenantEntitled(tenantId) {
  if (!tenantId) return { entitled: false, reason: "NO_TENANT" };
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionStatus: true, trialEnd: true, active: true }
  });
  if (!tenant) return { entitled: false, reason: "NO_TENANT" };
  if (!tenant.active) return { entitled: false, reason: "SUSPENDED" };

  const status = tenant.subscriptionStatus || "TRIAL";
  if (status === "ACTIVE") return { entitled: true };
  if (status === "TRIAL") {
    if (!tenant.trialEnd || new Date(tenant.trialEnd) > new Date()) {
      return { entitled: true };
    }
    return { entitled: false, reason: "TRIAL_EXPIRED" };
  }
  return { entitled: false, reason: status }; // PAST_DUE, CANCELED
}

/**
 * Middleware Express: bloqueia a rota (HTTP 402) se a assinatura não estiver
 * em dia. Use nos endpoints que geram custo ou entregam o produto.
 */
export async function requireActiveSubscription(req, res, next) {
  try {
    const { entitled, reason } = await isTenantEntitled(req.tenantId);
    if (entitled) return next();
    return res.status(402).json({
      error: "Assinatura inativa. Regularize o pagamento para continuar usando o produto.",
      reason
    });
  } catch (e) {
    console.error("[Subscription] Erro ao verificar assinatura:", e.message);
    return res.status(500).json({ error: "Erro ao verificar assinatura" });
  }
}
