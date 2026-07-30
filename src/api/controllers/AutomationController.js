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
    const { TRIGGER_IDS } = await import("../services/TriggerCatalog.js");
    if (trigger && !TRIGGER_IDS.includes(trigger)) {
      return res.status(400).json({ error: `Gatilho desconhecido: ${trigger}` });
    }
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
  const { name, active, nodes, edges, description, triggerConfig, trigger } = req.body;

  try {
    const data = {};
    if (name !== undefined) data.name = name;
    // O gatilho podia ser escolhido só na criação: mudar de ideia obrigava a
    // refazer o fluxo inteiro.
    if (trigger !== undefined) {
      const { TRIGGER_IDS } = await import("../services/TriggerCatalog.js");
      if (!TRIGGER_IDS.includes(trigger)) return res.status(400).json({ error: `Gatilho desconhecido: ${trigger}` });
      data.trigger = trigger;
    }
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

// ── Simulador de fluxos ──────────────────────────────────────────

/**
 * Roda o fluxo como se um lead estivesse conversando, sem enviar nada e sem
 * gravar tag/etapa/agendamento. Devolve a trilha de execução para a tela
 * mostrar o passo a passo, as variáveis e os erros de ligação.
 */
export const simulateStart = async (req, res) => {
  try {
    const { default: FlowSimulator } = await import("../services/FlowSimulator.js");
    const estado = await FlowSimulator.start(req.tenantId, req.params.id, {
      // Rascunho da tela tem prioridade: dá para testar antes de salvar.
      nodes: req.body?.nodes,
      edges: req.body?.edges,
      lead: req.body?.lead,
    });
    res.json(estado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const simulateSend = async (req, res) => {
  try {
    const { default: FlowSimulator } = await import("../services/FlowSimulator.js");
    const estado = await FlowSimulator.send(req.params.sessionId, req.body?.text || "", req.body?.replyId || null);
    res.json(estado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const simulateGet = async (req, res) => {
  const { default: FlowSimulator } = await import("../services/FlowSimulator.js");
  const estado = FlowSimulator.get(req.params.sessionId);
  if (!estado) return res.status(404).json({ error: "Sessão de simulação expirada." });
  res.json(estado);
};

export const simulateStop = async (req, res) => {
  const { default: FlowSimulator } = await import("../services/FlowSimulator.js");
  res.json(FlowSimulator.stop(req.params.sessionId));
};

/** Fluxo em JSON, para levar de uma conta para outra. */
export const exportAutomation = async (req, res) => {
  try {
    const auto = await prisma.automation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!auto) return res.status(404).json({ error: "Fluxo não encontrado." });

    let nodes = [];
    let edges = [];
    try { nodes = JSON.parse(auto.nodes || "[]"); } catch { nodes = []; }
    try { edges = JSON.parse(auto.edges || "[]"); } catch { edges = []; }

    res.json({
      formato: "agentesvirtuais.fluxo",
      versao: 1,
      exportadoEm: new Date().toISOString(),
      fluxo: {
        name: auto.name,
        description: auto.description,
        trigger: auto.trigger,
        triggerConfig: auto.triggerConfig,
        nodes,
        edges,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Cria um fluxo a partir de um JSON exportado. */
export const importAutomation = async (req, res) => {
  try {
    const pacote = req.body?.fluxo ? req.body : { fluxo: req.body };
    const fluxo = pacote.fluxo || {};
    if (!fluxo.name) return res.status(400).json({ error: "Arquivo inválido: falta o nome do fluxo." });
    if (!Array.isArray(fluxo.nodes)) return res.status(400).json({ error: "Arquivo inválido: lista de blocos ausente." });

    // Ids de bloco são reescritos: dois fluxos importados no mesmo negócio
    // não podem colidir, e o arquivo pode vir de outra conta.
    const mapa = new Map();
    const nodes = fluxo.nodes.map((n, i) => {
      const novo = `node_${Date.now()}_${i}`;
      mapa.set(n.id, novo);
      // Arquivo sem posição empilharia todos os blocos no mesmo ponto do
      // canvas — o fluxo viraria uma pilha ilegível. Distribui em coluna.
      const position = n.position && Number.isFinite(n.position.x)
        ? n.position
        : { x: 250, y: i * 180 };
      return { ...n, id: novo, position };
    });
    const edges = (Array.isArray(fluxo.edges) ? fluxo.edges : [])
      .filter((e) => mapa.has(e.source) && mapa.has(e.target))
      .map((e, i) => ({
        ...e,
        id: `edge_${Date.now()}_${i}`,
        source: mapa.get(e.source),
        target: mapa.get(e.target),
      }));

    const criado = await prisma.automation.create({
      data: {
        tenantId: req.tenantId,
        name: req.body?.name || `${fluxo.name} (importado)`,
        description: fluxo.description || null,
        trigger: fluxo.trigger || "NEW_LEAD",
        triggerConfig: fluxo.triggerConfig || "{}",
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        active: false, // importado nasce desligado: revise antes de valer.
      },
    });

    res.json({
      automation: criado,
      blocos: nodes.length,
      ligacoes: edges.length,
      ligacoesDescartadas: (fluxo.edges?.length || 0) - edges.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Catálogo de gatilhos ─────────────────────────────────────────

/** Lista de gatilhos e a configuração de cada um, para a tela montar o form. */
export const listTriggers = async (req, res) => {
  const { TRIGGERS, CATEGORIAS } = await import("../services/TriggerCatalog.js");
  res.json({ triggers: TRIGGERS, categorias: CATEGORIAS });
};

/**
 * Dispara um fluxo a partir de um sistema externo.
 *
 * Rota pública (o chamador não tem login): a autenticação é a chave que o
 * dono do fluxo definiu no gatilho, enviada em X-Flow-Secret. Sem lead
 * identificável o fluxo não roda — toda automação age sobre um contato.
 */
export const webhookTrigger = async (req, res) => {
  try {
    const automation = await prisma.automation.findUnique({ where: { id: req.params.id } });
    if (!automation || !automation.active) return res.status(404).json({ error: "Fluxo não encontrado ou desligado." });

    const { normalizeTrigger } = await import("../services/TriggerCatalog.js");
    if (normalizeTrigger(automation.trigger) !== "WEBHOOK") {
      return res.status(400).json({ error: "Este fluxo não é acionado por webhook." });
    }

    let config = {};
    try { config = JSON.parse(automation.triggerConfig || "{}"); } catch { config = {}; }
    const enviada = req.get("X-Flow-Secret") || req.body?.secret;
    if (!config.secret || enviada !== config.secret) {
      return res.status(401).json({ error: "Chave de segurança inválida." });
    }

    const { phone, email, leadId, name } = req.body || {};
    const { normalizePhone } = await import("../services/ContactIdentity.js");
    const telefone = normalizePhone(phone);

    let lead = null;
    if (leadId) lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId: automation.tenantId } });
    if (!lead && telefone) lead = await prisma.lead.findFirst({ where: { phone: telefone, tenantId: automation.tenantId } });
    if (!lead && email) lead = await prisma.lead.findFirst({ where: { email, tenantId: automation.tenantId } });

    if (!lead && telefone) {
      lead = await prisma.lead.create({
        data: { tenantId: automation.tenantId, name: name || `Contato ${telefone.slice(-4)}`, phone: telefone, source: "WEBHOOK" },
      });
    }
    if (!lead) {
      return res.status(400).json({ error: "Informe leadId, phone ou email de um contato existente." });
    }

    const { default: AutomationEngine } = await import("../../../automation_engine.js");
    await AutomationEngine.dispatchTrigger("WEBHOOK", {
      lead,
      tenantId: automation.tenantId,
      channel: lead.channel,
      payload: req.body || {},
    });

    res.json({ success: true, leadId: lead.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
