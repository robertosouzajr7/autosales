import prisma from "../config/prisma.js";

export const getStages = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });
    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId },
      orderBy: { order: "asc" }
    });
    res.json(stages);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createStage = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { name, color, order } = req.body;
    const stage = await prisma.pipelineStage.create({
      data: { name, color: color || "#3b82f6", order: order || 0, tenantId }
    });
    res.json(stage);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updateStage = async (req, res) => {
  try {
    const { name, color, order } = req.body;
    const stage = await prisma.pipelineStage.update({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { name, color, order }
    });
    res.json(stage);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteStage = async (req, res) => {
  try {
    await prisma.pipelineStage.delete({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
