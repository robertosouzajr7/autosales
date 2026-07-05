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
    const tenantId = req.tenantId;
    // Verifica posse dentro do tenant e evita mass-assignment (ex.: trocar tenantId)
    const existing = await prisma.pipelineStage.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: "Etapa não encontrada" });
    const { name, color, order } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (color !== undefined) data.color = color;
    if (order !== undefined) data.order = order;
    const stage = await prisma.pipelineStage.update({ where: { id: req.params.id }, data });
    res.json(stage);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteStage = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const result = await prisma.pipelineStage.deleteMany({ where: { id: req.params.id, tenantId } });
    if (result.count === 0) return res.status(404).json({ error: "Etapa não encontrada" });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
