import prisma from "../config/prisma.js";

export const getAutomations = async (req, res) => {
  const tenantId = req.tenantId;
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
  const tenantId = req.tenantId;
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
  const tenantId = req.tenantId;
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
  const tenantId = req.tenantId;
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
  const tenantId = req.tenantId;
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
  const tenantId = req.tenantId;
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
  const tenantId = req.tenantId;
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

// Campos que a tela de lembretes controla. Lista explícita: o corpo da
// requisição não pode escolher o que grava no banco.
const CAMPOS_CONFIG = [
  "autoConfirmHours", "lateToleranceMin", "postServiceHours", "humanHandoffTags",
  "confirmMsgTemplate", "lateMsgTemplate", "postServiceMsgTemplate",
  "remindersEnabled", "bookedEnabled", "confirmEnabled", "meetLinkEnabled",
  "finalEnabled", "noShowEnabled", "postServiceEnabled", "pipelineAutoEnabled",
  "meetLinkMinutes", "confirmTemplateId", "bookedMsgTemplate", "meetMsgTemplate",
  "finalMsgTemplate", "stageMap",
];

const NUMERICOS = new Set(["autoConfirmHours", "lateToleranceMin", "postServiceHours", "meetLinkMinutes"]);

export const updateConfig = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const data = {};
    for (const campo of CAMPOS_CONFIG) {
      const valor = req.body[campo];
      if (valor === undefined) continue;
      if (NUMERICOS.has(campo)) {
        const n = Number(valor);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ error: `Valor inválido para ${campo}.` });
        }
        data[campo] = Math.round(n);
      } else {
        data[campo] = valor;
      }
    }

    const config = await prisma.automationConfig.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data },
    });

    // Mudou a antecedência? Os agendamentos futuros precisam da régua
    // recalculada — senão a configuração só valeria para o próximo cliente.
    if (data.autoConfirmHours !== undefined || data.meetLinkMinutes !== undefined ||
        data.lateToleranceMin !== undefined || data.postServiceHours !== undefined) {
      reprogramarFuturos(tenantId).catch((e) =>
        console.error("[Lembretes] Falha ao reprogramar a régua:", e.message)
      );
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Recalcula a régua dos agendamentos que ainda não aconteceram. */
async function reprogramarFuturos(tenantId) {
  const { default: ReminderService } = await import("../services/ReminderService.js");
  const futuros = await prisma.appointment.findMany({
    where: { tenantId, status: "SCHEDULED", date: { gte: new Date() } },
    select: { id: true },
    take: 500,
  });
  for (const appt of futuros) {
    await ReminderService.scheduleForAppointment(appt.id, { skipBooked: true });
  }
}

/**
 * Régua dos próximos agendamentos + o que falhou. É a tela de diagnóstico:
 * sem ela, "o lembrete não chegou" não tem resposta.
 */
export const getReminders = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [proximos, falhas, enviados] = await Promise.all([
      prisma.appointmentReminder.findMany({
        where: { tenantId, status: "PENDING" },
        orderBy: { runAt: "asc" },
        take: 50,
        include: { appointment: { select: { title: true, date: true, lead: { select: { name: true, phone: true } } } } },
      }),
      prisma.appointmentReminder.findMany({
        where: { tenantId, status: "FAILED", updatedAt: { gte: desde } },
        orderBy: { updatedAt: "desc" },
        take: 30,
        include: { appointment: { select: { title: true, date: true, lead: { select: { name: true, phone: true } } } } },
      }),
      prisma.appointmentReminder.count({ where: { tenantId, status: "SENT", sentAt: { gte: desde } } }),
    ]);

    res.json({ proximos, falhas, enviadosNaSemana: enviados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Recoloca um lembrete que falhou na fila. */
export const retryReminder = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const lembrete = await prisma.appointmentReminder.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!lembrete) return res.status(404).json({ error: "Lembrete não encontrado." });

    await prisma.appointmentReminder.update({
      where: { id: lembrete.id },
      data: { status: "PENDING", runAt: new Date(), error: null },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
