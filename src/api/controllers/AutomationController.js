import prisma from "../config/prisma.js";

export const getAutomations = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const automations = await prisma.automation.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });
    res.json(automations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createAutomation = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { name, trigger, description, triggerConfig, nodes, edges } = req.body;

  try {
    const automation = await prisma.automation.create({
      data: {
        name,
        trigger,
        description,
        triggerConfig,
        nodes: nodes || "[]",
        edges: edges || "[]",
        tenantId
      }
    });
    res.json(automation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAutomation = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { id } = req.params;
  const { name, active, nodes, edges, description, triggerConfig } = req.body;

  try {
    const data = {};
    if (name !== undefined) data.name = name;
    if (active !== undefined) data.active = active;
    if (nodes !== undefined) data.nodes = nodes;
    if (edges !== undefined) data.edges = edges;
    if (description !== undefined) data.description = description;
    if (triggerConfig !== undefined) data.triggerConfig = triggerConfig;

    const automation = await prisma.automation.update({
      where: { id, tenantId },
      data
    });
    res.json(automation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAutomation = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { id } = req.params;

  try {
    await prisma.automation.delete({
      where: { id, tenantId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const duplicateAutomation = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { id } = req.params;

  try {
    const existing = await prisma.automation.findUnique({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Automation not found" });
    }

    const duplicated = await prisma.automation.create({
      data: {
        name: `${existing.name} (Cópia)`,
        trigger: existing.trigger,
        triggerConfig: existing.triggerConfig,
        description: existing.description,
        nodes: existing.nodes,
        edges: existing.edges,
        tenantId
      }
    });

    res.json(duplicated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getStats = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const automations = await prisma.automation.findMany({
      where: { tenantId },
      select: { id: true }
    });
    
    const automationIds = automations.map(a => a.id);

    const executions = await prisma.automationExecution.findMany({
      where: { automationId: { in: automationIds } }
    });

    const total = executions.length;
    const completed = executions.filter(e => e.status === "COMPLETED").length;
    const failed = executions.filter(e => e.status === "FAILED").length;

    res.json({ total, completed, failed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getConfig = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    let config = await prisma.automationConfig.findUnique({
      where: { tenantId }
    });
    
    if (!config) {
      config = await prisma.automationConfig.create({
        data: { tenantId }
      });
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateConfig = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const {
    autoConfirmHours,
    lateToleranceMin,
    postServiceHours,
    humanHandoffTags,
    confirmMsgTemplate,
    lateMsgTemplate,
    postServiceMsgTemplate
  } = req.body;

  try {
    const config = await prisma.automationConfig.upsert({
      where: { tenantId },
      update: {
        autoConfirmHours,
        lateToleranceMin,
        postServiceHours,
        humanHandoffTags,
        confirmMsgTemplate,
        lateMsgTemplate,
        postServiceMsgTemplate
      },
      create: {
        tenantId,
        autoConfirmHours,
        lateToleranceMin,
        postServiceHours,
        humanHandoffTags,
        confirmMsgTemplate,
        lateMsgTemplate,
        postServiceMsgTemplate
      }
    });
    
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
