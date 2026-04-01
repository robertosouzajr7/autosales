import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from "googleapis";
import dotenv from "dotenv";
import { WhatsAppManager, whatsappSessions } from "./whatsapp.js";
import AutomationEngine from "./automation_engine.js";
import ProspectorService from "./prospector_service.js";

dotenv.config();

import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
import fs from "fs";

const upload = multer({ dest: "uploads/" });
const app = express();
app.use(cors());
app.use(express.json());
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

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
    const leads = await prisma.lead.findMany({
      where: { tenantId: tenant?.id },
      include: { conversations: { include: { messages: true } } }
    });
    res.json(leads);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/leads", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    const lead = await prisma.lead.create({
      data: { ...req.body, tenantId: tenant.id }
    });
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/leads/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: { status } });
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SDRs ---
app.get("/api/sdrs", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    const sdrs = await prisma.sdrBot.findMany({ where: { tenantId: tenant.id } });
    res.json(sdrs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sdrs", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
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
    const accs = await prisma.whatsAppAccount.findMany({ where: { tenantId: tenant.id } });
    res.json(accs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/whatsapp/accounts", async (req, res) => {
  console.log("📥 [WhatsApp Account] Criando nova conexão...");
  try {
    const tenant = await prisma.tenant.findFirst();
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

// --- Automations ---
app.get("/api/automations", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    const auts = await prisma.automation.findMany({ where: { tenantId: tenant.id } });
    res.json(auts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/automations", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    const aut = await prisma.automation.create({ data: { ...req.body, tenantId: tenant.id } });
    res.json(aut);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/automations/:id", async (req, res) => {
  try {
    const aut = await prisma.automation.update({ where: { id: req.params.id }, data: req.body });
    res.json(aut);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/automations/:id", async (req, res) => {
  try {
    await prisma.automation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Automation Global Config ---
app.get("/api/automations/config", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
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
app.get("/api/dashboard", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    const leads = await prisma.lead.count({ where: { tenantId: tenant.id } });
    const appts = await prisma.appointment.count({ where: { tenantId: tenant.id } });
    const sdrs = await prisma.sdrBot.count({ where: { tenantId: tenant.id, active: true } });
    res.json({ stats: { totalLeads: leads, appointments: appts, activeSdrs: sdrs, conversionRate: 0 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
      } 
    });
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

// --- AI Generative Service ---
async function generateSdrResponse(tenantId, phone, leadName, userMessage) {
  try {
    const sdr = await prisma.sdrBot.findFirst({ where: { tenantId, active: true } });
    if (!sdr) return null;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `
      NOME DO AGENTE: ${sdr.name}
      FUNÇÃO: ${sdr.role} (SDR de Alta Performance)
      TOM DE VOZ: ${sdr.voiceTone}
      
      DIRETRIZES:
      ${sdr.prompt}
      
      BASE DE CONHECIMENTO (ESTRITAMENTE USE ISSO):
      ${sdr.knowledgeBase}

      OBJETIVOS E SKILLS:
      1. Venda Consultiva: Não seja um robô de tabela. Use o 'Conhecimento' acima para explicar benefícios e tirar dúvidas.
      2. Foco em Conversão: Sempre tente conduzir a conversa para um agendamento ou compromisso. Termine com perguntas.
      3. Gestão de Escassez: Mencione que as vagas/horários são limitados para incentivar a decisão rápida.
      4. Pix e Pagamento: Se o cliente falar que pagou, oriente-o a enviar o comprovante para confirmação no sistema.
      
      
      DADOS DO LEAD:
      Nome: ${leadName}
      Início da Mensagem: ${userMessage}
    `;

    const result = await model.generateContent(systemPrompt);
    return result.response.text();
  } catch (e) {
    console.error("[SDR-AI] Erro ao gerar resposta:", e);
    return "Desculpe, tive um pequeno problema técnico. Pode repetir?";
  }
}

// --- External / Webhooks ---
app.post("/api/webhook/whatsapp", async (req, res) => {
  const { tenantId, phone, name, content } = req.body;
  if (!tenantId || !phone) return res.status(400).json({ error: "Missing data" });

  try {
    // 1. Verificar se é um Lead existente ou criar novo
    let lead = await prisma.lead.findFirst({ where: { phone, tenantId } });
    if (!lead) {
      lead = await prisma.lead.create({ data: { name, phone, tenantId, source: "WHATSAPP" } });
    }

    // 2. Chamar o Motor de Automação para Triagem de Crise / Workflows
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

app.listen(PORT, () => {
  console.log(`🚀 Servidor SaaS VendAi ON: http://localhost:${PORT}`);
  WhatsAppManager.bootExistingSessions().catch(e => console.error("Err boot:", e));
});
