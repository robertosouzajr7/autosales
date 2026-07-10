import prisma from "../config/prisma.js";

/**
 * Registro de auditoria best-effort. Nunca deve derrubar a operação
 * principal — falha de log é engolida (mas reportada).
 */
export async function audit({ tenantId = null, actorId = null, action, entity = null, entityId = null, metadata = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorId,
        action,
        entity,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
  } catch (e) {
    console.error(`[Audit] Falha ao registrar '${action}':`, e.message);
  }
}

export default { audit };
