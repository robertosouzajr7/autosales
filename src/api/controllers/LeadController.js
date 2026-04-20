import prisma from "../config/prisma.js";
import AutomationEngine from "../../../automation_engine.js";

export const getLeads = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.json([]);
    const leads = await prisma.lead.findMany({
      where: { tenantId },
      include: { conversations: { include: { messages: true } } }
    });
    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createLead = async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const lead = await prisma.lead.create({
      data: { ...req.body, tenantId }
    });
    AutomationEngine.dispatchTrigger("NEW_LEAD", { lead, tenantId }).catch(console.error);
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updateLead = async (req, res) => {
  try {
    const oldLead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: req.body });

    if (oldLead && req.body.stageId && oldLead.stageId !== req.body.stageId) {
      const stage = await prisma.pipelineStage.findUnique({ where: { id: req.body.stageId } });
      const qualifiedNames = ["interessados", "agendados", "convertidos", "qualificado", "appointment", "converted"];
      
      if (stage && qualifiedNames.some(name => stage.name.toLowerCase().includes(name))) {
        await prisma.tenant.update({
          where: { id: lead.tenantId },
          data: { qualifiedLeadsCount: { increment: 1 } }
        });
      }

      AutomationEngine.dispatchTrigger("PIPELINE_MOVE", {
        lead, tenantId: lead.tenantId,
        oldStageId: oldLead.stageId, newStageId: req.body.stageId
      }).catch(e => console.error("[Leads] PIPELINE_MOVE trigger error:", e));
    }
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteLead = async (req, res) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const bulkDeleteLeads = async (req, res) => {
  try {
    const { ids } = req.body;
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
