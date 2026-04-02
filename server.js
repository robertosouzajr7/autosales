import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from "googleapis";
import dotenv from "dotenv";
import { WhatsAppManager, whatsappSessions } from "./whatsapp.js";
import { MetaManager } from "./meta.js";
import AutomationEngine from "./automation_engine.js";
import ProspectorService from "./prospector_service.js";

dotenv.config();

import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
import fs from "fs";
import bcrypt from "bcryptjs";

const upload = multer({ dest: "uploads/" });
const app = express();
app.use(cors());
app.use(express.json());
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// --- Database Auto-Initialization ---
async function initDB() {
  try {
    // 1. Criar Planos Base se não existirem
    const planCount = await prisma.plan.count();
    if (planCount === 0) {
      await prisma.plan.createMany({
        data: [
          { name: "BASIC", priceMonthly: 197, priceYearly: 0, maxLeads: 300, maxSdrs: 1 },
          { name: "PRO", priceMonthly: 497, priceYearly: 0, maxLeads: 10000, maxSdrs: 5 },
          { name: "ENTERPRISE", priceMonthly: 997, priceYearly: 0, maxLeads: 999999, maxSdrs: 20 }
        ]
      });
      console.log("💎 Planos iniciais criados.");
    }

    // 2. Garantir SuperAdmin (Migração p/ Hash se necessário)
    const superAdmin = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } });
    const hashedPassword = await bcrypt.hash("admin", 10);
    
    if (!superAdmin) {
      const systemTenant = await prisma.tenant.upsert({
        where: { email: "admin@autosales.ai" },
        update: {},
        create: { name: "AutoSales Global", email: "admin@autosales.ai" }
      });

      await prisma.user.create({
        data: {
          name: "Super Administrator",
          email: "admin@autosales.ai",
          password: hashedPassword,
          role: "SUPERADMIN",
          tenantId: systemTenant.id
        }
      });
      console.log("👑 SuperAdmin criado com sucesso (admin@autosales.ai / admin)");
    } else if (superAdmin.password === "admin") {
      // Migração: Se a senha no banco ainda for texto plano "admin", atualiza para o hash
      await prisma.user.update({
        where: { id: superAdmin.id },
        data: { password: hashedPassword }
      });
      console.log("🔐 Senha do SuperAdmin migrada para Hash com sucesso.");
    }
    
    // 3. Garantir Landing Settings
    await prisma.landingPageSettings.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton" }
    });

    // 4. Garantir Pipeline Stages iniciais para todos os tenants
    const tenants = await prisma.tenant.findMany({ include: { pipelineStages: true } });
    for (const t of tenants) {
      if (t.pipelineStages.length === 0) {
        await prisma.pipelineStage.createMany({
          data: [
            { name: "Novos", color: "#3b82f6", order: 0, tenantId: t.id },
            { name: "Qualificando", color: "#f59e0b", order: 1, tenantId: t.id },
            { name: "Interessados", color: "#10b981", order: 2, tenantId: t.id },
            { name: "Agendados", color: "#8b5cf6", order: 3, tenantId: t.id },
            { name: "Convertidos", color: "#0f172a", order: 4, tenantId: t.id }
          ]
        });
        console.log(`📑 Stages iniciais criados para tenant: ${t.name}`);
      }
    }

  } catch (e) {
    console.error("❌ Erro na inicialização do banco:", e);
  }
}
initDB();

// Diagnostic routes
app.get("/ping", (req, res) => res.send("PONG"));
app.get("/api/ping", (req, res) => res.send("API PONG"));

// Middleware de Log para Debug
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// --- Leads / CRM ---
app.get("/api/leads", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.json([]);
    const leads = await prisma.lead.findMany({
      where: { tenantId: tenant.id },
      include: { conversations: { include: { messages: true } } }
    });
    res.json(leads);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/leads", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.status(400).json({ error: "No tenant found" });
    const lead = await prisma.lead.create({
      data: { ...req.body, tenantId: tenant.id }
    });
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/leads/:id", async (req, res) => {
  try {
    // Track stage change for PIPELINE_MOVE trigger
    const oldLead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: req.body });

    if (oldLead && req.body.stageId && oldLead.stageId !== req.body.stageId) {
      AutomationEngine.dispatchTrigger("PIPELINE_MOVE", {
        lead, tenantId: lead.tenantId,
        oldStageId: oldLead.stageId, newStageId: req.body.stageId
      }).catch(e => console.error("[Leads] PIPELINE_MOVE trigger error:", e));
    }
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/leads/:id", async (req, res) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Bulk Contacts / Import ---
app.post("/api/contacts/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/contacts/import-csv", upload.single("file"), async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided" });
    
    const content = fs.readFileSync(file.path, "utf-8");
    fs.unlinkSync(file.path);
    
    // Parse CSV extremamente simples (Nome, Telefone, Email)
    const lines = content.split("\n").filter(l => l.trim() !== "");
    const header = lines.shift(); 
    
    let created = 0;
    for (const line of lines) {
      const [name, phone, email] = line.split(",").map(s => s?.trim());
      if (name && phone) {
        await prisma.lead.create({
          data: { name, phone: phone.replace(/\D/g, ""), email, tenantId: tenant.id }
        });
        created++;
      }
    }
    res.json({ success: true, created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- MESSAGES & CONVERSATIONS ---
app.get("/api/messages/:leadId", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    const messages = await prisma.message.findMany({
      where: {
        leadId: req.params.leadId,
        tenantId: tenant.id
      },
      orderBy: { createdAt: "asc" }
    });
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: "Erro ao carregar mensagens" });
  }
});

app.post("/api/messages", async (req, res) => {
  const { leadId, content, role } = req.body;
  try {
    const tenant = await prisma.tenant.findFirst();
    const msg = await prisma.message.create({
      data: {
        content,
        role: role || "SDR",
        leadId,
        tenantId: tenant.id
      }
    });
    res.json(msg);
  } catch (e) {
    res.status(500).json({ error: "Falha ao enviar mensagem" });
  }
});

// --- Pipeline Stages ---
app.get("/api/pipeline-stages", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.json([]);
    const stages = await prisma.pipelineStage.findMany({ 
      where: { tenantId: tenant.id },
      orderBy: { order: "asc" }
    });
    res.json(stages);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/pipeline-stages", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    const stage = await prisma.pipelineStage.create({ data: { ...req.body, tenantId: tenant.id } });
    res.json(stage);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/pipeline-stages/:id", async (req, res) => {
  try {
    const stage = await prisma.pipelineStage.update({ where: { id: req.params.id }, data: req.body });
    res.json(stage);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/pipeline-stages/:id", async (req, res) => {
  try {
    await prisma.pipelineStage.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Dashboard Stats ---
// (Rotas /api/stats/dashboard e /api/public/landing definidas mais abaixo com implementação completa)

app.get("/api/public/webchat/:tenantId", async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true, sdrs: { where: { active: true }, take: 1 } }
    });
    if (!tenant) return res.status(404).json({ error: "Portal não encontrado." });
    
    // Verificação de Recurso Premium (Plano PRO)
    const isPro = tenant.plan?.name?.toUpperCase().includes("PRO") || tenant.plan?.name?.toUpperCase().includes("PREMIUM");
    if (!isPro) return res.status(403).json({ error: "O Webchat Premium é um recurso exclusivo do plano Pro." });

    const hostSdr = tenant.sdrs[0];
    res.json({
      tenantName: tenant.name,
      logo: tenant.webChatUrl,
      sdr: hostSdr ? { id: hostSdr.id, name: hostSdr.name, role: hostSdr.role } : null
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// NOVO: Disparo em Massa (Campaigns)
app.post("/api/bulk-send", async (req, res) => {
  try {
    const { leadIds, message, channel } = req.body;
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.status(400).json({ error: "Tenant not found" });

    // 1. Criar Campanha
    const campaign = await prisma.campaign.create({
      data: {
        name: `Campanha via ${channel} - ${new Date().toLocaleDateString()}`,
        status: "RUNNING",
        template: { create: { name: "Bulk Message Template", content: message, tenantId: tenant.id } },
        tenantId: tenant.id,
        sentCount: leadIds.length
      }
    });

    // 2. Registrar mensagens no histórico de cada lead
    // Em um cenário real, aqui dispararíamos os webhooks para WhatsApp ou E-mail
    for (const leadId of leadIds) {
      const conversation = await prisma.conversation.upsert({
        where: { leadId },
        update: {},
        create: { leadId, tenantId: tenant.id }
      });

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: message,
          role: "SDR",
          tenantId: tenant.id
        }
      });
    }

    res.json({ success: true, campaignId: campaign.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// (Rota /api/public/chat definida mais abaixo com integração Gemini real)

// --- SDRs ---
app.get("/api/sdrs", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.json([]);
    const sdrs = await prisma.sdrBot.findMany({ where: { tenantId: tenant.id } });
    res.json(sdrs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sdrs", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.status(400).json({ error: "No tenant found" });
    const sdr = await prisma.sdrBot.create({ data: { ...req.body, tenantId: tenant.id, active: true } });
    res.json(sdr);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/sdrs/:id", async (req, res) => {
  try {
    const sdr = await prisma.sdrBot.update({ where: { id: req.params.id }, data: req.body });
    res.json(sdr);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/sdrs/:id", async (req, res) => {
  try {
    await prisma.sdrBot.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// NOVO: Upload de Arquivos para Especialização (Especialização Neural)
app.post("/api/sdrs/:id/training", upload.single("file"), async (req, res) => {
  console.log(`📡 [Neural-Training] Recebendo arquivo para SDR (ID: ${req.params.id})`);
  try {
    const sdrId = req.params.id;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    let extractedText = "";

    // 1. Identificar tipo e extrair
    if (file.mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(file.path);
      // Garantir compatibilidade com pdf-parse em ambiente ESM/Hybrid
      const parsePdf = typeof pdf === "function" ? pdf : pdf.default;
      const pdfData = await parsePdf(dataBuffer);
      extractedText = pdfData.text;
    } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ path: file.path });
      extractedText = result.value;
    } else if (file.mimetype === "text/plain") {
      extractedText = fs.readFileSync(file.path, "utf-8");
    } else {
      return res.status(400).json({ error: "Formato não suportado: PDF, DOCX ou TXT." });
    }

    // 2. Limpar arquivo temporário
    fs.unlinkSync(file.path);

    // 3. Atualizar Knowledge Base do SDR (Concatena)
    const sdr = await prisma.sdrBot.findUnique({ where: {id: sdrId }});
    if (!sdr) return res.status(404).json({ error: "SDR não encontrado." });

    const updatedKnowledge = (sdr.knowledgeBase || "") + "\n\n--- CONTEÚDO DO ARQUIVO (" + file.originalname + ") ---\n" + extractedText;

    const updatedSdr = await prisma.sdrBot.update({
      where: { id: sdrId },
      data: { knowledgeBase: updatedKnowledge }
    });

    res.json({ success: true, sdr: updatedSdr });
  } catch (e) {
    console.error("[Training-Upload] Erro:", e);
    res.status(500).json({ error: "Falha ao processar o arquivo de treinamento neural." });
  }
});


// --- WhatsApp Accounts (Requirement 6) ---
app.get("/api/whatsapp/accounts", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.json([]);
    const accs = await prisma.whatsAppAccount.findMany({ where: { tenantId: tenant.id } });
    res.json(accs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/whatsapp/accounts", async (req, res) => {
  console.log("📥 [WhatsApp Account] Criando nova conexão...");
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.status(400).json({ error: "No tenant found" });
    const { name } = req.body;
    const account = await prisma.whatsAppAccount.create({
      data: { name, tenantId: tenant.id, status: "DISCONNECTED" }
    });
    res.json(account);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/whatsapp/accounts/:id", async (req, res) => {
  try {
    // Desconecta sessão ativa antes de deletar do banco
    await WhatsAppManager.disconnectSession(req.params.id);
    await prisma.whatsAppAccount.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Desconectar uma conta sem deletar
app.post("/api/whatsapp/accounts/:id/disconnect", async (req, res) => {
  try {
    await WhatsAppManager.disconnectSession(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Status em tempo real de todas as sessões
app.get("/api/whatsapp/sessions/status", (req, res) => {
  res.json(WhatsAppManager.getSessionsStatus());
});

app.get("/api/whatsapp/qr/:id", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Envia um heartbeat imediato para confirmar que o stream está vivo
  res.write(`data: ${JSON.stringify({ status: "WAITING" })}\n\n`);

  const onStatus = (msg) => {
    // msg já vem como JSON string do WhatsAppManager
    res.write(`data: ${msg}\n\n`);
  };

  WhatsAppManager.createSession(req.params.id, onStatus)
    .catch(err => {
       console.error("Erro ao abrir sessão:", err);
       res.write(`data: ${JSON.stringify({ status: "ERROR", message: err.message })}\n\n`);
    });

  req.on("close", () => {
     console.log(`[Stream] SSE FECHADO para conta: ${req.params.id}`);
  });
});

// --- Auth / Register ---
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, companyName, plan } = req.body;
  
  try {
    // 1. Criar o Plano se não existir (ou buscar por nome)
    let planObj = await prisma.plan.findFirst({ where: { name: plan } });
    if (!planObj) {
        // Fallback pra criar um plano básico se não houver no banco
        planObj = await prisma.plan.create({
            data: { name: plan, priceMonthly: plan === 'PRO' ? 497 : 197, priceYearly: 0, maxLeads: 1000, maxSdrs: 2 }
        });
    }

    // 2. Criar o Tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: companyName,
        email: email,
        planId: planObj.id,
        subscriptionStatus: "TRIAL",
        trialEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name,
        email: email,
        password: hashedPassword,
        role: "OWNER",
        tenantId: tenant.id
      }
    });

    // 4. Criar Configuração de Automação Inicial
    await prisma.automationConfig.create({
      data: { tenantId: tenant.id }
    });

    res.json({ success: true, tenant, user });
  } catch (e) {
    console.error("[Register Error]", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    res.json({ success: true, user, tenant: user.tenant });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Automations ---
app.get("/api/automations", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.json([]);
    const auts = await prisma.automation.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" }
    });
    res.json(auts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/automations", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.status(400).json({ error: "No tenant found" });
    const { name, trigger, triggerConfig, description, nodes, edges } = req.body;
    const aut = await prisma.automation.create({
      data: { name, trigger, triggerConfig, description, nodes, edges, tenantId: tenant.id }
    });
    res.json(aut);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/automations/:id", async (req, res) => {
  try {
    const { name, trigger, triggerConfig, description, nodes, edges, active } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (trigger !== undefined) data.trigger = trigger;
    if (triggerConfig !== undefined) data.triggerConfig = triggerConfig;
    if (description !== undefined) data.description = description;
    if (nodes !== undefined) data.nodes = nodes;
    if (edges !== undefined) data.edges = edges;
    if (active !== undefined) data.active = active;
    const aut = await prisma.automation.update({ where: { id: req.params.id }, data });
    res.json(aut);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/automations/:id/duplicate", async (req, res) => {
  try {
    const original = await prisma.automation.findUnique({ where: { id: req.params.id } });
    if (!original) return res.status(404).json({ error: "Not found" });
    const copy = await prisma.automation.create({
      data: {
        name: `${original.name} (cópia)`,
        trigger: original.trigger,
        triggerConfig: original.triggerConfig,
        description: original.description,
        nodes: original.nodes,
        edges: original.edges,
        tenantId: original.tenantId
      }
    });
    res.json(copy);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/automations/:id", async (req, res) => {
  try {
    // Delete related executions first
    await prisma.automationStepLog.deleteMany({
      where: { execution: { automationId: req.params.id } }
    });
    await prisma.automationExecution.deleteMany({ where: { automationId: req.params.id } });
    await prisma.automationProgress.deleteMany({ where: { automationId: req.params.id } });
    await prisma.automation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Automation Executions (Logs) ---
app.get("/api/automations/:id/executions", async (req, res) => {
  try {
    const execs = await prisma.automationExecution.findMany({
      where: { automationId: req.params.id },
      include: { lead: true, steps: { orderBy: { createdAt: "asc" } } },
      orderBy: { startedAt: "desc" },
      take: 50
    });
    res.json(execs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/automations/executions/stats", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.json({});
    const total = await prisma.automationExecution.count({
      where: { automation: { tenantId: tenant.id } }
    });
    const running = await prisma.automationExecution.count({
      where: { automation: { tenantId: tenant.id }, status: "RUNNING" }
    });
    const completed = await prisma.automationExecution.count({
      where: { automation: { tenantId: tenant.id }, status: "COMPLETED" }
    });
    const failed = await prisma.automationExecution.count({
      where: { automation: { tenantId: tenant.id }, status: "FAILED" }
    });
    const activeAutomations = await prisma.automation.count({
      where: { tenantId: tenant.id, active: true }
    });
    const draftAutomations = await prisma.automation.count({
      where: { tenantId: tenant.id, active: false }
    });
    res.json({ total, running, completed, failed, activeAutomations, draftAutomations });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Automation Global Config ---
app.get("/api/automations/config", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.json({});
    let config = await prisma.automationConfig.findUnique({ where: { tenantId: tenant.id } });
    if (!config) {
      config = await prisma.automationConfig.create({ data: { tenantId: tenant.id } });
    }
    res.json(config);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/automations/config", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    const config = await prisma.automationConfig.upsert({
      where: { tenantId: tenant.id },
      update: req.body,
      create: { ...req.body, tenantId: tenant.id }
    });
    res.json(config);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Prospector ---
app.post("/api/prospect", async (req, res) => {
  try {
    const { niche, location } = req.body;
    const leads = await ProspectorService.search(niche, location);
    res.json(leads);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Dashboard & Analytics ---
app.get("/api/stats/dashboard", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const totalLeads = await prisma.lead.count({ where: { tenantId: tenant.id } });
    const appointments = await prisma.appointment.count({ where: { tenantId: tenant.id } });
    const activeSdrs = await prisma.sdrBot.count({ where: { tenantId: tenant.id, active: true } });
    
    // Calcula conversão com base em leads que chegaram nas etapas finais
    const convertedLeads = await prisma.lead.count({
      where: { 
        tenantId: tenant.id,
        stage: { name: { in: ["Convertidos", "Agendados"] } }
      }
    });
    
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    // Dados do Funil (Pipeline Stages)
    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId: tenant.id },
      include: { _count: { select: { leads: true } } },
      orderBy: { order: "asc" }
    });

    const funnelData = stages.map(s => ({
      name: s.name,
      value: s._count.leads
    }));

    res.json({ 
      stats: { totalLeads, appointments, activeSdrs, conversionRate },
      funnelData,
      activityHistory: [] // Pode ser implementado com log de eventos no futuro
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Appointments ---
app.get("/api/appointments", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    const appts = await prisma.appointment.findMany({ where: { tenantId: tenant.id }, include: { lead: true } });
    res.json(appts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/appointments", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    const appt = await prisma.appointment.create({
      data: {
        title: req.body.title,
        date: new Date(req.body.date),
        notes: req.body.notes,
        leadId: req.body.leadId,
        tenantId: tenant.id
      },
      include: { lead: true }
    });

    // Dispatch APPOINTMENT_CREATED trigger
    AutomationEngine.dispatchTrigger("APPOINTMENT_CREATED", {
      lead: appt.lead, tenantId: tenant.id, appointment: appt
    }).catch(e => console.error("[Appointments] trigger error:", e));

    res.json(appt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/appointments/:id", async (req, res) => {
  try {
    const appt = await prisma.appointment.update({ 
      where: { id: req.params.id }, 
      data: { ...req.body, date: req.body.date ? new Date(req.body.date) : undefined } 
    });
    res.json(appt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/appointments/:id", async (req, res) => {
  try {
    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Settings ---
app.get("/api/settings", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    res.json(tenant);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/settings", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    const updated = await prisma.tenant.update({ where: { id: tenant.id }, data: req.body });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Admin / SaaS Management ---
app.get("/api/admin/plans", async (req, res) => {
  try {
    const plans = await prisma.plan.findMany();
    res.json(plans);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/plans", async (req, res) => {
  try {
    const plan = await prisma.plan.create({ data: req.body });
    res.json(plan);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/plans/:id", async (req, res) => {
  try {
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/tenants", async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({ include: { plan: true } });
    res.json(tenants);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/tenants", async (req, res) => {
  try {
    const tenant = await prisma.tenant.create({ data: req.body });
    res.json(tenant);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/tenants/:id", async (req, res) => {
  try {
    await prisma.tenant.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Landing Page CMS ---
app.get("/api/public/landing", async (req, res) => {
  try {
    const settings = await prisma.landingPageSettings.findUnique({ where: { id: "singleton" } });
    
    // Buscar planos visíveis se houver IDs setados
    let plans = [];
    if (settings?.visiblePlanIds) {
      const ids = settings.visiblePlanIds.split(",").filter(id => id.trim() !== "");
      if (ids.length > 0) {
        plans = await prisma.plan.findMany({ where: { id: { in: ids } } });
      }
    } else {
      // Se não houver filtros, pega os 3 primeiros ativos
      plans = await prisma.plan.findMany({ where: { active: true }, take: 3 });
    }

    res.json({ settings, plans });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/landing-settings", async (req, res) => {
  try {
    let settings = await prisma.landingPageSettings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
      settings = await prisma.landingPageSettings.create({ data: { id: "singleton" } });
    }
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/landing-settings", async (req, res) => {
  try {
    const settings = await prisma.landingPageSettings.upsert({
      where: { id: "singleton" },
      update: req.body,
      create: { ...req.body, id: "singleton" }
    });
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SaaS Public Chat ---
app.post("/api/public/chat", async (req, res) => {
  const { sdrId, message, history } = req.body;
  if (!sdrId || !message) return res.status(400).json({ error: "Missing data" });

  try {
    const sdr = await prisma.sdrBot.findUnique({ 
      where: { id: sdrId },
      include: { tenant: true }
    });
    if (!sdr) return res.status(404).json({ error: "SDR not found" });

    // Reusar a lógica de geração de resposta, mas adaptada
    const aiResponse = await generateSdrResponse(sdr.tenantId, "LANDING_PAGEUSER", "Visitante", message, sdrId);
    res.json({ response: aiResponse });
  } catch (e) {
    console.error("[Public Chat] Erro:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- AI Generative Service ---
async function generateSdrResponse(tenantId, phone, leadName, userMessage, sdrId = null) {
  try {
    const sdr = sdrId 
      ? await prisma.sdrBot.findUnique({ where: { id: sdrId }})
      : await prisma.sdrBot.findFirst({ where: { tenantId, active: true } });
    if (!sdr) return null;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

    // 🧠 BUSCAR HISTÓRICO DA CONVERSA PARA DAR MEMÓRIA AO ROBÔ
    const lead = await prisma.lead.findFirst({ where: { phone, tenantId } });
    let historyText = "Nenhuma mensagem anterior.";
    
    if (lead) {
      const conv = await prisma.conversation.findUnique({
        where: { leadId: lead.id },
        include: { messages: { take: 10, orderBy: { createdAt: 'desc' } } }
      });
      
      if (conv?.messages?.length > 0) {
        // Inverte para ficar em ordem cronológica (Antiga -> Nova) para a IA entender o fluxo
        historyText = conv.messages.reverse().map(m => `${m.role === 'USER' ? 'CLIENTE' : 'SDR'}: ${m.content}`).join('\n');
      }
    }

    // 🧰 DEFINIÇÃO DE FERRAMENTAS DO SDR (O "MCP" DO BANCO)
    const tools = [
      {
        functionDeclarations: [
          {
            name: "get_calendar_availability",
            description: "Consulta as próximas vagas disponíveis numeradas na agenda (ex: 1. Hoje 14:00).",
          },
          {
            name: "book_appointment",
            description: "Cria um agendamento real e oficial no banco de dados para o lead atual.",
            parameters: {
              type: "object",
              properties: {
                slot_id: { type: "string", description: "O número da vaga escolhido pelo lead (ex: 1)" },
                details: { type: "string", description: "Descrição do agendamento (ex: Demonstração AutoSales)" },
                iso_date: { type: "string", description: "A data e hora final convertida para ISO 8601 (ex: 2026-04-01T14:30:00Z)" }
              },
              required: ["slot_id", "details", "iso_date"]
            }
          },
          {
            name: "get_account_details",
            description: "Consulta detalhes do plano e nome da empresa.",
          }
        ]
      }
    ];

    // Implementação real das funções que acessam o Prisma
    const executableTools = {
      get_calendar_availability: async () => {
        // Gerador de Slots Numerados
        const slots = [
          { id: "1", label: "Quarta-feira (Amanhã) às 10:30", iso: "2026-04-01T10:30:00Z" },
          { id: "2", label: "Quarta-feira (Amanhã) às 15:00", iso: "2026-04-01T15:00:00Z" },
          { id: "3", label: "Quinta-feira às 09:00", iso: "2026-04-02T09:00:00Z" },
          { id: "4", label: "Quinta-feira às 14:00", iso: "2026-04-02T14:00:00Z" },
          { id: "5", label: "Sexta-feira às 11:30", iso: "2026-04-03T11:30:00Z" }
        ];

        return {
          business_hours: "Seg-Sex (09h-18h), Sáb (09h-13h)",
          options_list: slots.map(s => `${s.id}. ${s.label}`).join("\n"),
          raw_slots: slots,
          instruction: "APRESENTE a lista numerada ao lead e peça para ele enviar APENAS o número da opção desejada."
        };
      },
      book_appointment: async ({ iso_date, details }) => {
        const lead = await prisma.lead.findFirst({ where: { phone, tenantId } });
        if (!lead) return { status: "ERROR", message: "Lead não encontrado." };

        const appointment = await prisma.appointment.create({
          data: {
            leadId: lead.id,
            tenantId: tenantId,
            title: details,
            date: new Date(iso_date),
            status: "SCHEDULED"
          }
        });

        return { status: "SUCCESS", message: "Agendamento criado com sucesso no banco de dados!", id: appointment.id };
      },
      get_account_details: async () => {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } });
        return { company_name: tenant.name, plan: tenant.plan?.name };
      }
    };

    // Usamos a geração mais estável e moderna disponível (2.5 Flash) 🦾
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: tools
    });

    const systemPrompt = `
      # IDENTIDADE E PERSONALIDADE
      NOME DO AGENTE: ${sdr.name}
      FUNÇÃO: ${sdr.role} (Consultor Estratégico AutoSales)
      TOM DE VOZ: ${sdr.voiceTone}
      
      # CAPACIDADES ESPECIAIS (CONEXÃO COM BANCO):
      Você tem acesso ao Banco de Dados da conta via ferramentas. 
      Sempre que precisar de informações reais sobre AGENDAMENTOS ou DADOS DA EMPRESA, CHAME UMA FUNÇÃO. 
      Não adivinhe horários, consulte a agenda real via get_calendar_availability.
      
      # DIRETRIZES MESTRES:
      ${sdr.prompt}
      
      # REGRAS DE CONTEXTO (EXTREMA IMPORTÂNCIA):
      1. NÃO SE APRESENTE: Se houver mais de 2 mensagens no histórico, você já é conhecido. Pule a saudação. Vá direto ao ponto.
      2. WORKFLOW DE AGENDAMENTO: 
         - Se o cliente demonstrar interesse em agendar, NÃO peça horários nem sugira datas.
         - ENVIE IMEDIATAMENTE este link ÚNICO de agendamento: http://localhost:8080/p/${tenantId}/book
         - Diga algo como: "Para facilitar, você pode escolher o melhor dia e horário diretamente em nosso calendário oficial aqui: [LINK]"
      3. OBJETIVIDADE: Suas mensagens devem ser curtas, diretas e focadas em converter o lead para o agendamento via link.
      
      # BASE DE CONHECIMENTO (ESTRITAMENTE USE ISSO):
      ${sdr.knowledgeBase}
      
      # HISTÓRICO DA CONVERSA (MEMÓRIA):
      ${historyText}

      # DADOS DO LEAD ATUAL:
      Nome: ${leadName}
      Nova Mensagem do Lead: ${userMessage}
    `;

    // Inicia o Chat com o modelo 2.5 que suporta Tools e Conversão Neural
    const chat = model.startChat();
    let result;
    try {
      result = await chat.sendMessage(systemPrompt);
    } catch (chatErr) {
      console.warn("[SDR-AI] Falha no 2.5 Flash, tentando 2.5 Pro...");
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro", tools });
      const fallbackChat = fallbackModel.startChat();
      result = await fallbackChat.sendMessage(systemPrompt);
    }
    let response = result.response;

    // Loop para lidar com Tool Calls (o robô decide usar o banco)
    while (response.candidates[0].content.parts.some(p => p.functionCall)) {
      const call = response.candidates[0].content.parts.find(p => p.functionCall);
      const toolResponse = await executableTools[call.functionCall.name](call.functionCall.args);
      
      result = await chat.sendMessage([{
        functionResponse: {
          name: call.functionCall.name,
          response: { content: toolResponse }
        }
      }]);
      response = result.response;
    }
    
    return response.text();
  } catch (e) {
    console.error("[SDR-AI] Erro ao gerar resposta:", e);
    return "Desculpe, tive um pequeno problema técnico. Pode repetir?";
  }
}

// --- External / Webhooks ---
// --- Official Meta WhatsApp Cloud API Webhooks ---
app.get("/api/webhook/whatsapp/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
      console.log("💎 Meta Webhook Verificado!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

app.post("/api/webhook/whatsapp/meta", async (req, res) => {
  const body = req.body;
  
  if (body.object === "whatsapp_business_account") {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    
    if (value?.messages?.[0]) {
      const msg = value.messages[0];
      const from = msg.from; // Número do Lead
      const content = msg.text?.body || "";
      const phoneId = value.metadata?.phone_number_id; 
      const name = value.contacts?.[0]?.profile?.name || "Lead (Meta)";

      if (content && phoneId) {
        console.log(`[Meta Webhook] Msg de ${from} p/ foneID ${phoneId}: ${content}`);
        // Delega o processamento pro-ativo (Gemini etc) para o MetaManager
        await MetaManager.handleIncoming(phoneId, from, name, content);
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

app.post("/api/whatsapp/accounts/meta", async (req, res) => {
  const { name, phoneId, accessToken, wabaId, phone } = req.body;
  try {
    const tenant = await prisma.tenant.findFirst();
    const account = await prisma.whatsAppAccount.create({
      data: {
        name,
        phoneId,
        accessToken,
        wabaId,
        phone,
        status: "CONNECTED", // Meta conta-se como conectado se configurada
        tenantId: tenant.id
      }
    });
    res.json(account);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/webhook/whatsapp", async (req, res) => {
  const { tenantId, phone, name, content } = req.body;
  if (!tenantId || !phone) return res.status(400).json({ error: "Missing data" });

  try {
    // 1. Verificar se é um Lead existente ou criar novo
    let lead = await prisma.lead.findFirst({ where: { phone, tenantId } });
    let isNewLead = false;
    if (!lead) {
      lead = await prisma.lead.create({ data: { name, phone, tenantId, source: "WHATSAPP" } });
      isNewLead = true;
    }

    // 2a. Dispatch NEW_LEAD trigger if lead was just created
    if (isNewLead) {
      AutomationEngine.dispatchTrigger("NEW_LEAD", { lead, tenantId }).catch(e =>
        console.error("[Webhook] NEW_LEAD trigger error:", e)
      );
    }

    // 2b. Chamar o Motor de Automação para Triagem de Crise / Workflows / Input collection
    const handledByEngine = await AutomationEngine.handleIncoming(phone, content, tenantId);
    if (handledByEngine) {
      return res.json({ success: true, handled: "engine" });
    }

    // 3. Verificar se o Robô está ativo para esta conversa
    const conv = await prisma.conversation.upsert({
      where: { leadId: lead.id },
      update: {},
      create: { leadId: lead.id, botActive: true }
    });

    if (!conv.botActive) {
      console.log(`[SDR] Robô pausado para ${phone} (Transbordo Humano ativo).`);
      return res.json({ success: true, handled: "human" });
    }

    // 4. Gerar Resposta Consultiva usando Gemini + Skills do SDR
    const aiResponse = await generateSdrResponse(tenantId, phone, name, content);
    
    // 5. Registrar Mensagens
    await prisma.message.create({
      data: { conversationId: conv.id, content, role: "USER" }
    });
    
    if (aiResponse) {
      await prisma.message.create({
        data: { conversationId: conv.id, content: aiResponse, role: "ASSISTANT" }
      });
      return res.json({ success: true, ai_response: aiResponse });
    }

    res.json({ success: true });
  } catch (e) {
    console.error("[Webhook] Erro:", e);
    res.status(500).json({ error: e.message });
  }
});

// Agendamento via Link Público (Calendly-style)
app.post("/api/public/book", async (req, res) => {
  let { tenantId, name, phone, date, title } = req.body;
  if (!tenantId || !date) return res.status(400).json({ error: "Dados incompletos" });

  // Normalização de Telefone (Somente números e prefixo 55)
  phone = phone.replace(/\D/g, '');
  if (phone.length === 11 && !phone.startsWith('55')) {
    phone = '55' + phone;
  }

  try {
    // 1. Garantir que o Lead exista
    let lead = await prisma.lead.findFirst({ where: { phone, tenantId } });
    if (!lead) {
      lead = await prisma.lead.create({ data: { name, phone, tenantId, source: "PUBLIC_LINK" } });
    }

    // 2. Criar Agendamento no Banco
    const appointment = await prisma.appointment.create({
      data: {
        leadId: lead.id,
        tenantId,
        title: title || `Agendamento via Link: ${name}`,
        date: new Date(date),
        status: "SCHEDULED"
      }
    });

    // 3. (EXTRA) Enviar Confirmação Pró-ativa no WhatsApp via Jarvis
    const formattedDate = new Date(date).toLocaleString('pt-BR', { 
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
    });
    
    const confirmationText = `Olá, ${name}! ✨ Vi que você acaba de reservar seu horário para o dia **${formattedDate}**. Já está registrado aqui em nosso sistema! Mal posso esperar para conversarmos. Até breve! 🚀`;

    // Dispara no WhatsApp e no Banco (Memória do SDR)
    // Usando as instâncias já carregadas no topo do arquivo
    const sessions = Array.from(whatsappSessions.values()).filter(s => s.tenantId === tenantId && s.status === 'CONNECTED');
    if (sessions.length > 0) {
      const sock = sessions[0].sock;
      // 🕵️ EXTRA: Busca o JID Real
      try {
        const [result] = await sock.onWhatsApp(phone);
        const jid = result?.exists ? result.jid : `${phone}@s.whatsapp.net`;

        let conv = await prisma.conversation.findUnique({ where: { leadId: lead.id } });
        if (!conv) {
          conv = await prisma.conversation.create({ data: { leadId: lead.id, tenantId } });
        }
        
        await prisma.message.create({
          data: { conversationId: conv.id, content: confirmationText, role: "SDR", tenantId }
        });
        
        await WhatsAppManager.sendMessage(tenantId, jid, confirmationText);
      } catch (err) { console.error("WhatsApp Send Error:", err); }
    }

    res.json({ success: true, id: appointment.id });
  } catch (e) {
    console.error("[Public Book] Erro:", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor SaaS VendAi ON: http://localhost:${PORT}`);
  WhatsAppManager.bootExistingSessions().catch(e => console.error("Err boot:", e));
});
