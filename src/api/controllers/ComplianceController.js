import prisma from "../config/prisma.js";
import { audit } from "../services/AuditService.js";

/**
 * Direitos do titular (LGPD art. 18): acesso/portabilidade e eliminação.
 * Tudo escopado por tenant — um tenant só exporta/apaga dados próprios.
 */

// GET /api/compliance/leads/:id/export
// Portabilidade: devolve todos os dados que temos sobre um lead.
export const exportLeadData = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  try {
    const lead = await prisma.lead.findFirst({
      where: { id, tenantId },
      include: {
        conversations: { include: { messages: { orderBy: { createdAt: "asc" } } } },
        appointments: true,
        tags: true
      }
    });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

    await audit({
      tenantId, actorId: req.userId, action: "LEAD_DATA_EXPORTED",
      entity: "Lead", entityId: id
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=lead-${id}.json`);
    res.send(JSON.stringify({ exportedAt: new Date().toISOString(), lead }, null, 2));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// DELETE /api/compliance/leads/:id
// Direito ao esquecimento: elimina o lead e todo o histórico associado.
// Mensagens/conversas/agendamentos caem por cascade (onDelete: Cascade).
export const deleteLeadData = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  try {
    const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

    await prisma.lead.delete({ where: { id } });

    await audit({
      tenantId, actorId: req.userId, action: "LEAD_DATA_ERASED",
      entity: "Lead", entityId: id, metadata: { phone: lead.phone }
    });

    res.json({ success: true, message: "Dados do titular eliminados definitivamente." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET /api/compliance/account/export
// Exporta os dados da conta (tenant) e um resumo agregado — portabilidade.
export const exportAccountData = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true, name: true, email: true, phone: true,
        subscriptionStatus: true, trialEnd: true, acceptedTermsAt: true,
        createdAt: true
      }
    });
    if (!tenant) return res.status(404).json({ error: "Conta não encontrada" });

    const [leadCount, messageCount, appointmentCount] = await Promise.all([
      prisma.lead.count({ where: { tenantId } }),
      prisma.message.count({ where: { tenantId } }),
      prisma.appointment.count({ where: { tenantId } })
    ]);

    await audit({ tenantId, actorId: req.userId, action: "ACCOUNT_DATA_EXPORTED", entity: "Tenant", entityId: tenantId });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=account-${tenantId}.json`);
    res.send(JSON.stringify({
      exportedAt: new Date().toISOString(),
      account: tenant,
      summary: { leads: leadCount, messages: messageCount, appointments: appointmentCount }
    }, null, 2));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
