import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from "googleapis";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
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
import axios from "axios";
import nodemailer from "nodemailer";
import cron from "node-cron";
import { CommandCenter } from "./command_center.js";

const upload = multer({ dest: "uploads/" });
import { EventEmitter } from "events";
const eventEmitter = new EventEmitter();

// --- In-memory verification codes store ---
const verificationCodes = new Map(); // email -> { code, expiresAt }

// --- Connect AutomationEngine to events ---
AutomationEngine.setEventEmitter(eventEmitter);

// --- Email transporter (uses Ethereal for dev, configure SMTP for production) ---
let emailTransporter = null;
async function getEmailTransporter() {
  if (emailTransporter) return emailTransporter;
  
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    console.log(`📧 Conectado ao servidor SMTP: ${process.env.SMTP_HOST}`);
  } else {
    // Use Ethereal for development (free test SMTP)
    const testAccount = await nodemailer.createTestAccount();
    emailTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    console.log(`📧 Email test account (Ethereal): ${testAccount.user}`);
  }
  return emailTransporter;
}
const app = express();
app.use(cors());
app.use(express.json());

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
          { name: "PRO", priceMonthly: 797, priceYearly: 0, maxLeads: 10000, maxSdrs: 5 },
          { name: "ENTERPRISE", priceMonthly: 997, priceYearly: 0, maxLeads: 999999, maxSdrs: 20 },
          { name: "VITALICIO", priceMonthly: 0, priceYearly: 0, maxLeads: 999999, maxSdrs: 100, features: JSON.stringify({ aiEnabled: true, webhookEnabled: true, bulkMessaging: true, calendar: true, crmIntegration: true, maxAutomations: -1, maxExecutions: -1 }) }
        ]
      });
      console.log("💎 Planos iniciais criados.");
    }

    // 2. Garantir SuperAdmin (Migração p/ Hash se necessário)
    const superAdmin = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } });
    const hashedPassword = await bcrypt.hash("admin", 10);
    
    if (!superAdmin) {
      const vitalicioPlan = await prisma.plan.findFirst({ where: { name: "VITALICIO" } });
      const systemTenant = await prisma.tenant.upsert({
        where: { email: "admin@autosales.ai" },
        update: { planId: vitalicioPlan?.id },
        create: { name: "AutoSales Global", email: "admin@autosales.ai", planId: vitalicioPlan?.id }
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

// --- Tenant Isolation Middleware ---
app.use("/api", (req, res, next) => {
  // Skip public routes
  const publicPaths = ["/api/auth/", "/api/public/", "/api/webhook/", "/api/ping"];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();
  const tenantId = req.headers["x-tenant-id"];
  if (tenantId) {
    req.tenantId = tenantId;
  }
  next();
});

// --- Leads / CRM ---
app.get("/api/leads", async (req, res) => {
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
});

app.post("/api/contacts/import-bulk", async (req, res) => {
  const { contacts, startInactive } = req.body;
  const tenantId = req.headers["x-tenant-id"];
  
  if (!tenantId) return res.status(400).json({ error: "Tenant ID missing" });
  if (!Array.isArray(contacts)) return res.status(400).json({ error: "Invalid contacts list" });

  let created = 0;
  try {
    for (const c of contacts) {
      if (!c.phone || !c.name) continue;

      // Upsert Lead
      const lead = await prisma.lead.upsert({
        where: { id: "never-match-id" }, // Using create fallback via upsert or just create
        create: {
          name: c.name,
          phone: c.phone,
          email: c.email || null,
          tenantId
        },
        update: {
          name: c.name,
          email: c.email || null
        }
      });

      // Garantir que a conversa comece DESATIVADA se solicitado
      if (startInactive) {
        await prisma.conversation.upsert({
          where: { leadId: lead.id },
          create: {
            leadId: lead.id,
            tenantId,
            botActive: false // 🔒 PROTEÇÃO: IA começa desligada
          },
          update: {
            botActive: false
          }
        });
      }
      created++;
    }
    
    res.json({ success: true, created });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/contacts/bulk-delete", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: "No tenant found" });
    const lead = await prisma.lead.create({
      data: { ...req.body, tenantId }
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
      // Check if the new stage is a "Qualified" state (Interessados, Agendados, Convertidos)
      const stage = await prisma.pipelineStage.findUnique({ where: { id: req.body.stageId } });
      const qualifiedNames = ["interessados", "agendados", "convertidos", "qualificado", "appointment", "converted"];
      
      if (stage && qualifiedNames.some(name => stage.name.toLowerCase().includes(name))) {
        await prisma.tenant.update({
          where: { id: lead.tenantId },
          data: { qualifiedLeadsCount: { increment: 1 } }
        });
        console.log(`[Leads] 🎯 Lead qualificado detectado! Contador incrementado para o tenant ${lead.tenantId}`);
      }

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
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado" });
    if (!tenantId) return res.status(401).json({ error: "Tenant não identificado" });
    
    let rows = [];
    const ext = file.originalname?.split('.').pop()?.toLowerCase();
    
    if (ext === 'xlsx' || ext === 'xls') {
      // Importação XLSX/XLS
      const XLSX = (await import('xlsx')).default;
      const workbook = XLSX.readFile(file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } else {
      // Importação CSV
      const content = fs.readFileSync(file.path, "utf-8");
      const lines = content.split("\n").filter(l => l.trim() !== "");
      const headerLine = lines.shift();
      const headers = headerLine.split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      
      for (const line of lines) {
        const values = line.split(",").map(s => s?.trim().replace(/"/g, ""));
        const row = {};
        headers.forEach((h, i) => { row[h] = values[i] || ""; });
        rows.push(row);
      }
    }
    
    fs.unlinkSync(file.path);
    
    // Auto-detect de colunas (flexível)
    const colMap = { name: null, phone: null, email: null, company: null };
    if (rows.length > 0) {
      const keys = Object.keys(rows[0]).map(k => k.toLowerCase());
      colMap.name = keys.find(k => /nome|name|razao|raz[aã]o/i.test(k));
      colMap.phone = keys.find(k => /telefone|phone|fone|celular|whatsapp|tel/i.test(k));
      colMap.email = keys.find(k => /email|e-mail|mail/i.test(k));
      colMap.company = keys.find(k => /empresa|company|org|companhia|raz[aã]o.?social/i.test(k));
    }
    
    let created = 0, duplicated = 0, errors = 0;
    
    for (const row of rows) {
      try {
        const rawName = colMap.name ? row[colMap.name] || row[Object.keys(row).find(k => k.toLowerCase() === colMap.name)] : "";
        const rawPhone = colMap.phone ? row[colMap.phone] || row[Object.keys(row).find(k => k.toLowerCase() === colMap.phone)] : "";
        const rawEmail = colMap.email ? row[colMap.email] || row[Object.keys(row).find(k => k.toLowerCase() === colMap.email)] : "";
        
        const name = (rawName || "Sem Nome").toString().trim();
        const phone = rawPhone?.toString().replace(/\D/g, "");
        const email = rawEmail?.toString().trim();
        
        if (!phone || phone.length < 8) { errors++; continue; }
        
        // Deduplicação por telefone
        const existing = await prisma.lead.findFirst({ where: { phone, tenantId } });
        if (existing) { duplicated++; continue; }
        
        const newLead = await prisma.lead.create({
          data: { name, phone, email: email || null, tenantId }
        });
        eventEmitter.emit("new_lead", { tenantId, lead: newLead });
        created++;
      } catch (rowErr) {
        errors++;
      }
    }
    
    console.log(`[Import] 📋 Tenant ${tenantId}: ${created} criados, ${duplicated} duplicados, ${errors} erros de ${rows.length} linhas`);
    res.json({ success: true, created, duplicated, errors, total: rows.length });
  } catch (e) { 
    console.error("[Import] Erro:", e);
    res.status(500).json({ error: e.message }); 
  }
});


// --- MESSAGES & CONVERSATIONS ---
app.get("/api/messages/:leadId", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const conversation = await prisma.conversation.findUnique({
      where: { leadId: req.params.leadId }
    });
    
    if (!conversation) {
      return res.json([]);
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        tenantId
      },
      orderBy: { createdAt: "asc" }
    });
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: "Erro ao carregar mensagens" });
  }
});

// Toggle bot Active for a conversation
app.put("/api/conversations/:leadId/bot", async (req, res) => {
  try {
    const { leadId } = req.params;
    const { botActive } = req.body;
    const tenantId = req.tenantId || req.headers["x-tenant-id"];

    const conv = await prisma.conversation.upsert({
      where: { leadId },
      update: { botActive },
      create: { leadId, tenantId, botActive }
    });
    
    res.json({ success: true, botActive: conv.botActive });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/messages", async (req, res) => {
  const { leadId, content, role } = req.body;
  try {
    const tenantId = req.tenantId;

    // Ensure conversation exists for lead
    let conversation = await prisma.conversation.findUnique({ where: { leadId } });
    if (!conversation) {
       conversation = await prisma.conversation.create({
         data: { leadId, tenantId }
       });
    }

    const msg = await prisma.message.create({
      data: {
        content,
        role: role || "SDR",
        conversationId: conversation.id,
        tenantId
      }
    });

    eventEmitter.emit("new_message", { tenantId, leadId, message: msg });

    // Optionally notify automation engine of manual message (stop bot)
    if (role === "SDR") {
        await prisma.conversation.update({
           where: { id: conversation.id },
           data: { botActive: false }
        });
    }

    res.json(msg);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Falha ao enviar mensagem" });
  }
});

// --- Pipeline Stages ---
app.get("/api/pipeline-stages", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.json([]);
    const stages = await prisma.pipelineStage.findMany({ 
      where: { tenantId },
      orderBy: { order: "asc" }
    });
    res.json(stages);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/pipeline-stages", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const stage = await prisma.pipelineStage.create({ data: { ...req.body, tenantId } });
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Catalog (Products / Services) ---
app.get("/api/products", async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers["x-tenant-id"];
    const items = await prisma.product.findMany({ where: { tenantId } });
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/products", async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers["x-tenant-id"];
    const item = await prisma.product.create({ data: { ...req.body, tenantId } });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const item = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ICP Profiles ---
app.get("/api/icp-profiles", async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers["x-tenant-id"];
    const items = await prisma.icpProfile.findMany({ where: { tenantId } });
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/icp-profiles", async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers["x-tenant-id"];
    const item = await prisma.icpProfile.create({ data: { ...req.body, tenantId } });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/icp-profiles/:id", async (req, res) => {
  try {
    const item = await prisma.icpProfile.update({ where: { id: req.params.id }, data: req.body });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/icp-profiles/:id", async (req, res) => {
  try {
    await prisma.icpProfile.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Public Access endpoints ---
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
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: "Tenant not found" });

    const campaign = await prisma.campaign.create({
      data: {
        name: `Campanha via ${channel} - ${new Date().toLocaleDateString()}`,
        status: "RUNNING",
        template: { create: { name: "Bulk Message Template", content: message, tenantId } },
        tenantId,
        sentCount: leadIds.length
      }
    });

    for (const leadId of leadIds) {
      const conversation = await prisma.conversation.upsert({
        where: { leadId },
        update: {},
        create: { leadId, tenantId }
      });

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: message,
          role: "SDR",
          tenantId
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
    const tenantId = req.tenantId;
    if (!tenantId) return res.json([]);
    const sdrs = await prisma.sdrBot.findMany({ where: { tenantId } });
    res.json(sdrs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sdrs", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: "No tenant found" });

    // --- Monetization Check: Max SDRs ---
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true, sdrs: { where: { active: true } } }
    });

    if (tenant && tenant.plan && tenant.sdrs.length >= tenant.plan.maxSdrs) {
      return res.status(403).json({ 
        error: `Limite de SDRs atingido para o seu plano (${tenant.plan.name}). Máximo: ${tenant.plan.maxSdrs}` 
      });
    }

    const sdr = await prisma.sdrBot.create({ data: { ...req.body, tenantId, active: true } });
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
    const tenantId = req.tenantId;
    if (!tenantId) return res.json([]);
    const accs = await prisma.whatsAppAccount.findMany({ where: { tenantId } });
    res.json(accs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/whatsapp/accounts", async (req, res) => {
  console.log("\ud83d\udce5 [WhatsApp Account] Criando nova conex\u00e3o...");
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: "No tenant found" });
    const { name } = req.body;
    const account = await prisma.whatsAppAccount.create({
      data: { name, tenantId, status: "DISCONNECTED" }
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
  const { name, email, password, companyName, plan, phone } = req.body;
  
  if (!name || !email || !password || !companyName || !phone) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios (nome, email, senha, empresa, telefone)." });
  }

  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ error: "E-mail já cadastrado." });

    // 1. Criar o Plano se não existir (ou buscar por nome)
    let planObj = await prisma.plan.findFirst({ where: { name: plan } });
    if (!planObj) {
        planObj = await prisma.plan.create({
            data: { name: plan, priceMonthly: plan === 'PRO' ? 497 : 197, priceYearly: 0, maxLeads: 1000, maxSdrs: 2 }
        });
    }

    // 2. Criar o Tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: companyName,
        email: email,
        phone: phone,
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

    // 3. Pipeline Stages iniciais
    await prisma.pipelineStage.createMany({
      data: [
        { name: "Novos", color: "#3b82f6", order: 0, tenantId: tenant.id },
        { name: "Qualificando", color: "#f59e0b", order: 1, tenantId: tenant.id },
        { name: "Interessados", color: "#10b981", order: 2, tenantId: tenant.id },
        { name: "Agendados", color: "#8b5cf6", order: 3, tenantId: tenant.id },
        { name: "Convertidos", color: "#0f172a", order: 4, tenantId: tenant.id }
      ]
    });

    // 4. Criar Configuração de Automação Inicial
    await prisma.automationConfig.create({
      data: { tenantId: tenant.id }
    });

    res.json({ success: true, tenant: { ...tenant, plan: planObj }, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.error("[Register Error]", e);
    res.status(500).json({ error: e.message });
  }
});

// --- Email Verification ---
app.post("/api/auth/send-code", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "E-mail é obrigatório" });
  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    verificationCodes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

    const transporter = await getEmailTransporter();
    const info = await transporter.sendMail({
      from: '"VendAi" <noreply@vendai.com.br>',
      to: email,
      subject: "Seu código de verificação VendAi",
      html: `<div style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>Código de Verificação</h2>
        <p style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#10b981">${code}</p>
        <p>Este código expira em 10 minutos.</p>
      </div>`
    });
    console.log(`📧 Código ${code} enviado para ${email} | Preview: ${nodemailer.getTestMessageUrl(info)}`);
    res.json({ success: true, previewUrl: nodemailer.getTestMessageUrl(info) });
  } catch (e) {
    console.error("[Send Code Error]", e);
    res.status(500).json({ error: "Falha ao enviar código." });
  }
});

app.post("/api/auth/verify-code", async (req, res) => {
  const { email, code } = req.body;
  const stored = verificationCodes.get(email);
  if (!stored) return res.status(400).json({ error: "Nenhum código enviado para este e-mail." });
  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(email);
    return res.status(400).json({ error: "Código expirado. Solicite um novo." });
  }
  if (stored.code !== code) return res.status(400).json({ error: "Código inválido." });
  verificationCodes.delete(email);
  res.json({ success: true, verified: true });
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

// --- Current User Profile ---
app.get("/api/auth/me", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"];
    const userId = req.headers["x-user-id"];
    if (!tenantId) return res.status(401).json({ error: "Não autenticado" });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true }
    });
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });

    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    } else {
      user = await prisma.user.findFirst({ where: { tenantId } });
    }

    const leadsCount = await prisma.lead.count({ where: { tenantId } });
    const sdrsCount = await prisma.sdrBot.count({ where: { tenantId } });

    res.json({
      user: user ? { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } : null,
      tenant: {
        id: tenant.id, name: tenant.name, email: tenant.email, phone: tenant.phone,
        subscriptionStatus: tenant.subscriptionStatus, trialEnd: tenant.trialEnd, createdAt: tenant.createdAt,
        aiProvider: tenant.aiProvider, googleRefreshToken: tenant.googleRefreshToken
      },
      plan: tenant.plan ? {
        id: tenant.plan.id, name: tenant.plan.name, priceMonthly: tenant.plan.priceMonthly,
        maxLeads: tenant.plan.maxLeads, maxSdrs: tenant.plan.maxSdrs
      } : null,
      usage: { leads: leadsCount, sdrs: sdrsCount }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Atualizar telefone do admin (WhatsApp Command Center) ---
app.put("/api/user/phone", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"];
    const userId = req.headers["x-user-id"];
    const { phone } = req.body;
    
    if (!tenantId) return res.status(401).json({ error: "Não autenticado" });
    
    let user;
    if (userId) {
      user = await prisma.user.update({ where: { id: userId }, data: { phone } });
    } else {
      user = await prisma.user.findFirst({ where: { tenantId } });
      if (user) {
        user = await prisma.user.update({ where: { id: user.id }, data: { phone } });
      }
    }
    
    console.log(`[CommandCenter] 📱 Admin ${user?.name} registrou WhatsApp: ${phone}`);
    res.json({ success: true, phone: user?.phone });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Salvar configurações de IA do tenant ---
app.put("/api/tenant/ai-settings", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"];
    const { aiProvider, aiApiKey } = req.body;
    if (!tenantId) return res.status(401).json({ error: "Não autenticado" });
    
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { aiProvider, aiApiKey }
    });
    res.json({ success: true, aiProvider: updated.aiProvider });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// --- Current Tenant & Plan Limits ---
app.get("/api/tenant/current", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"];
    if (!tenantId) return res.status(401).json({ error: "Missing tenant header" });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true }
    });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const leadsCount = await prisma.lead.count({ where: { tenantId } });
    const sdrsCount = await prisma.sdrBot.count({ where: { tenantId } });

    res.json({
      tenant: {
        id: tenant.id, name: tenant.name, email: tenant.email, phone: tenant.phone,
        subscriptionStatus: tenant.subscriptionStatus, trialEnd: tenant.trialEnd, createdAt: tenant.createdAt
      },
      plan: tenant.plan ? {
        id: tenant.plan.id, name: tenant.plan.name, priceMonthly: tenant.plan.priceMonthly,
        maxLeads: tenant.plan.maxLeads, maxSdrs: tenant.plan.maxSdrs
      } : null,
      usage: { leads: leadsCount, sdrs: sdrsCount }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


app.get("/api/auth/google", (req, res) => {
  const tenantId = req.query.tenantId;
  if (!tenantId) return res.status(400).send("Tenant ID obrigatório");

  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: tenantId,
    prompt: 'consent'
  });

  res.redirect(url);
});

app.get("/api/auth/google/callback", async (req, res) => {
  const { code, state: tenantId } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    if (tokens.refresh_token) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { googleRefreshToken: tokens.refresh_token }
      });
    }

    res.send(`
      <html>
        <head><title>Conectado</title></head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column;">
          <h1 style="color: #10b981;">Calendário Conectado com Sucesso!</h1>
          <p>Você já pode fechar esta aba e voltar para o AutoSales.</p>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(500).send("Erro ao sincronizar calendário.");
  }
});

app.put("/api/tenant/settings", async (req, res) => {

  try {
    const tenant = await prisma.tenant.findFirst({
      include: { plan: true }
    });
    if (!tenant) return res.status(404).json({ error: "No tenant found" });
    
    let planFeatures = {
      aiEnabled: false,
      webhookEnabled: false,
      maxAutomations: 3,
      maxExecutions: 1000
    };

    if (tenant.plan && tenant.plan.features) {
       try {
         planFeatures = { ...planFeatures, ...JSON.parse(tenant.plan.features) };
       } catch (e) {}
    }
    
    res.json({ id: tenant.id, name: tenant.name, planFeatures });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Automations ---
app.get("/api/automations", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.json([]);
    const auts = await prisma.automation.findMany({
      where: { tenantId: tenantId },
      orderBy: { createdAt: "desc" }
    });
    res.json(auts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/automations", async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers["x-tenant-id"];
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { automations: true, plan: true }
    });
    if (!tenant) return res.status(400).json({ error: "No tenant found" });

    // --- Monetization Check: Max Automations ---
    let maxAutomations = 3; 
    if (tenant.plan && tenant.plan.features) {
       try {
         const planFeatures = JSON.parse(tenant.plan.features);
         if (planFeatures.maxAutomations !== undefined) {
           maxAutomations = planFeatures.maxAutomations;
         }
       } catch(e) {}
    }
    
    if (maxAutomations !== -1 && tenant.automations.length >= maxAutomations) {
      return res.status(403).json({ 
        error: "Limite de automações atingido. Faça upgrade do seu plano para criar mais automações."
      });
    }

    const { name, trigger, triggerConfig, description, nodes, edges } = req.body;
    const aut = await prisma.automation.create({
      data: { name, trigger, triggerConfig, description, nodes, edges, tenantId: tenantId }
    });
    AutomationEngine.reloadSchedulers().catch(console.error);
    res.json(aut);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Bulk Messaging (Enforcement) ---
app.post("/api/bulk-send", async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers["x-tenant-id"];
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    let bulkEnabled = false;
    if (tenant.plan && tenant.plan.features) {
       try { bulkEnabled = JSON.parse(tenant.plan.features).bulkMessaging === true; } catch(e){}
    }
    if (!bulkEnabled) return res.status(403).json({ error: "O plano atual não permite disparos em massa. Faça upgrade para o Pro." });

    const { leadIds, message, channel } = req.body;
    console.log(`[BulkSend] 🚀 Iniciando disparo para ${leadIds.length} leads via ${channel} (Tenant: ${tenantId})`);
    
    // Implementação simplificada (v1)
    for (const leadId of leadIds) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (lead && lead.phone) {
        if (channel === "WHATSAPP") {
          await WhatsAppManager.sendMessage(tenantId, lead.phone, message.replace("[nome]", lead.name));
        } else {
          // Placeholder para e-mail
          console.log(`[Bulk] E-mail simulado para ${lead.email}`);
        }
      }
    }

    res.json({ success: true, count: leadIds.length });
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
    AutomationEngine.reloadSchedulers().catch(console.error);
    res.json(aut);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/automations/:id/duplicate", async (req, res) => {
  try {
    const original = await prisma.automation.findUnique({ where: { id: req.params.id }, include: { tenant: { include: { automations: true, plan: true } } } });
    if (!original) return res.status(404).json({ error: "Not found" });

    // --- Monetization Check ---
    let maxAutomations = 3;
    if (original.tenant.plan && original.tenant.plan.features) {
       try {
         const planFeatures = JSON.parse(original.tenant.plan.features);
         if (planFeatures.maxAutomations !== undefined) maxAutomations = planFeatures.maxAutomations;
       } catch(e) {}
    }
    if (maxAutomations !== -1 && original.tenant.automations.length >= maxAutomations) {
      return res.status(403).json({ error: "Limite de automações atingido. Faça upgrade." });
    }

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
    AutomationEngine.reloadSchedulers().catch(console.error);
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
    AutomationEngine.reloadSchedulers().catch(console.error);
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
    const tenantId = req.tenantId;
    if (!tenantId) return res.json({});
    const total = await prisma.automationExecution.count({
      where: { automation: { tenantId: tenantId } }
    });
    const running = await prisma.automationExecution.count({
      where: { automation: { tenantId: tenantId }, status: "RUNNING" }
    });
    const completed = await prisma.automationExecution.count({
      where: { automation: { tenantId: tenantId }, status: "COMPLETED" }
    });
    const failed = await prisma.automationExecution.count({
      where: { automation: { tenantId: tenantId }, status: "FAILED" }
    });
    const activeAutomations = await prisma.automation.count({
      where: { tenantId: tenantId, active: true }
    });
    const draftAutomations = await prisma.automation.count({
      where: { tenantId: tenantId, active: false }
    });
    res.json({ total, running, completed, failed, activeAutomations, draftAutomations });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Automation Global Config ---
app.get("/api/automations/config", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.json({});
    let config = await prisma.automationConfig.findUnique({ where: { tenantId: tenantId } });
    if (!config) {
      config = await prisma.automationConfig.create({ data: { tenantId: tenantId } });
    }
    res.json(config);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/automations/config", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const config = await prisma.automationConfig.upsert({
      where: { tenantId },
      update: req.body,
      create: { ...req.body, tenantId }
    });
    res.json(config);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Webhook Trigger (Fase 4) ---
app.post("/api/webhook/:tenantId/:automationId", async (req, res) => {
  try {
    const { tenantId, automationId } = req.params;

    // --- Monetization Check: Webhooks ---
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } });
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });
    let webhookEnabled = false;
    if (tenant.plan && tenant.plan.features) {
       try { webhookEnabled = JSON.parse(tenant.plan.features).webhookEnabled === true; } catch(e){}
    }
    if (!webhookEnabled) return res.status(403).json({ error: "O plano atual do Tenant não permite Webhooks. Faça upgrade." });

    const { leadId, phone, data: webhookData } = req.body;
    const automation = await prisma.automation.findFirst({ where: { id: automationId, tenantId, active: true } });
    if (!automation) return res.status(404).json({ error: "Automação não encontrada" });
    let lead;
    if (leadId) {
      lead = await prisma.lead.findUnique({ where: { id: leadId } });
    } else if (phone) {
      lead = await prisma.lead.findFirst({ where: { phone, tenantId } });
      if (!lead) lead = await prisma.lead.create({ data: { name: webhookData?.name || phone, phone, tenantId, source: "WEBHOOK" } });
    }
    if (!lead) return res.status(400).json({ error: "leadId ou phone obrigatório" });
    const AutoEngine = (await import("./automation_engine.js")).default;
    AutoEngine.enqueueExecution(automation, lead);
    res.json({ success: true, message: `Automação "${automation.name}" enfileirada para lead ${lead.name}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Funnel Analytics (Fase 4) ---
app.get("/api/automations/:id/funnel", async (req, res) => {
  try {
    const automation = await prisma.automation.findUnique({ where: { id: req.params.id } });
    if (!automation) return res.status(404).json({ error: "Automação não encontrada" });
    const nodes = JSON.parse(automation.nodes || "[]");
    const executions = await prisma.automationExecution.findMany({
      where: { automationId: req.params.id },
      include: { steps: true }
    });
    const totalExecutions = executions.length;
    const completedExecutions = executions.filter(e => e.status === "COMPLETED").length;
    const failedExecutions = executions.filter(e => e.status === "FAILED").length;
    const nodeStats = nodes.map(node => {
      const nodeSteps = executions.flatMap(e => e.steps).filter(s => s.nodeId === node.id);
      const successes = nodeSteps.filter(s => s.status === "SUCCESS").length;
      const failures = nodeSteps.filter(s => s.status === "FAILED").length;
      const avgDuration = nodeSteps.length > 0 ? Math.round(nodeSteps.reduce((sum, s) => sum + (s.duration || 0), 0) / nodeSteps.length) : 0;
      return {
        nodeId: node.id, nodeType: node.type || node.data?.nodeType, label: node.data?.label || node.type,
        reached: nodeSteps.length, successes, failures,
        completionRate: totalExecutions > 0 ? Math.round((nodeSteps.length / totalExecutions) * 100) : 0,
        avgDurationMs: avgDuration
      };
    });
    const dropOffNodes = nodeStats.filter(n => n.reached > 0 && n.completionRate < 100).sort((a, b) => b.reached - a.reached);
    res.json({
      automationId: req.params.id, automationName: automation.name,
      totalExecutions, completedExecutions, failedExecutions,
      completionRate: totalExecutions > 0 ? Math.round((completedExecutions / totalExecutions) * 100) : 0,
      nodeStats, dropOffNodes: dropOffNodes.slice(0, 5)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Engine Queue Status (Fase 4) ---
app.get("/api/automations/queue/status", async (req, res) => {
  try {
    const AutoEngine = (await import("./automation_engine.js")).default;
    res.json({
      queueLength: AutoEngine.executionQueue?.length || 0, runningCount: AutoEngine.runningCount || 0,
      maxConcurrent: 10, rateLimit: 20
    });
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
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    if (!tenantId) return res.status(404).json({ error: "Tenant not found" });

    const totalLeads = await prisma.lead.count({ where: { tenantId } });
    const appointments = await prisma.appointment.count({ where: { tenantId } });
    const activeSdrs = await prisma.sdrBot.count({ where: { tenantId, active: true } });
    
    // Métricas de Prospecção (Fase 1 e 2)
    const emailsSent = await prisma.message.count({
      where: { tenantId, role: "ASSISTANT", content: { contains: "📧 [EMAIL ENVIADO]" } }
    });

    const whatsappFollowups = await prisma.message.count({
      where: { 
        tenantId, 
        role: "ASSISTANT", 
        content: { not: { contains: "📧 [EMAIL ENVIADO]" } },
        conversation: { lead: { createdAt: { lt: new Date(Date.now() - 3600000) } } } // Simplificação: msgs para leads com mais de 1h
      }
    });

    // Calcula conversão com base em leads que chegaram nas etapas finais
    const convertedLeads = await prisma.lead.count({
      where: { 
        tenantId,
        stage: { name: { in: ["Convertidos", "Agendados", "CONVERTED", "APPOINTMENT"] } }
      }
    });
    
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    // Dados do Funil (Pipeline Stages)
    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId },
      include: { _count: { select: { leads: true } } },
      orderBy: { order: "asc" }
    });

    const funnelData = stages.map(s => ({
      name: s.name,
      value: s._count.leads
    }));

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true }
    });

    res.json({ 
      stats: { 
        totalLeads, 
        appointments, 
        activeSdrs, 
        conversionRate,
        emailsSent,
        whatsappFollowups,
        // Consumption Stats
        usedTokens: tenant?.usedTokens || 0,
        qualifiedLeadsCount: tenant?.qualifiedLeadsCount || 0,
        maxTokens: tenant?.plan?.maxTokens || 0,
        maxSdrs: tenant?.plan?.maxSdrs || 0,
        planName: tenant?.plan?.name || "Nenhum"
      },
      funnelData,
      activityHistory: [] 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Appointments ---
app.get("/api/appointments", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const appts = await prisma.appointment.findMany({ where: { tenantId }, include: { lead: true } });
    res.json(appts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/appointments", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const appt = await prisma.appointment.create({
      data: {
        title: req.body.title,
        date: new Date(req.body.date),
        notes: req.body.notes,
        leadId: req.body.leadId,
        tenantId
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
app.get("/api/tenant/settings", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Não autenticado" });
    const tenant = await prisma.tenant.findUnique({ 
      where: { id: tenantId }, 
      include: { plan: true } 
    });
    
    let planFeatures = {};
    if (tenant?.plan?.features) {
       try { planFeatures = JSON.parse(tenant.plan.features); } catch(e){}
    }
    
    // Check for active WhatsApp session
    const hasWhatsAppConnection = Array.from(whatsappSessions.values())
      .some(s => s.tenantId === tenantId && s.status === 'CONNECTED');

    // Check for existing SDRs
    const sdrCount = await prisma.sDR.count({ where: { tenantId } });

    res.json({
      id: tenant?.id,
      name: tenant?.name,
      email: tenant?.email,
      usedTokens: tenant?.usedTokens || 0,
      qualifiedLeadsCount: tenant?.qualifiedLeadsCount || 0,
      plan: tenant?.plan || { name: "Básico", maxTokens: 1000 },
      planFeatures,
      hasWhatsAppConnection,
      hasSdr: sdrCount > 0
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/settings", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Não autenticado" });
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } });
    res.json(tenant);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/settings", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Não autenticado" });
    const updated = await prisma.tenant.update({ where: { id: tenantId }, data: req.body });
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

app.put("/api/admin/plans/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await prisma.plan.update({
      where: { id },
      data: req.body
    });
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
    const tenants = await prisma.tenant.findMany({ 
      include: { 
        plan: true,
        users: { select: { id: true, name: true, email: true, role: true } }
      } 
    });
    res.json(tenants);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/tenants/:id", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ 
      where: { id: req.params.id },
      include: { 
        plan: true,
        users: { select: { id: true, name: true, email: true, role: true } }
      } 
    });
    res.json(tenant);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/admin/tenants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, planId, subscriptionStatus, active, maxTokensExtra, maxLeadsExtra, address, phone, cnpj } = req.body;
    
    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        name,
        email,
        planId,
        subscriptionStatus,
        active: active !== undefined ? active : undefined,
        address,
        phone,
        cnpj
      }
    });
    res.json(tenant);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/tenants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Deletar relações que podem não ter cascade configurado ou precisam de limpeza manual
    try {
      await prisma.automationConfig.deleteMany({ where: { tenantId: id } });
    } catch (e) { console.warn("Erro ao deletar automationConfig:", e.message); }

    await prisma.tenant.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) { 
    console.error("Erro ao deletar tenant:", e);
    res.status(500).json({ error: e.message }); 
  }
});

app.post("/api/admin/tenants", async (req, res) => {
  try {
    const { name, email, planId, adminName, adminPassword } = req.body;
    
    // 1. Criar o Tenant
    const tenant = await prisma.tenant.create({ 
      data: { name, email, planId } 
    });

    // 2. Hash Password e Criar Admin do Tenant
    if (adminName && adminPassword) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await prisma.user.create({
        data: {
          name: adminName,
          email: email, // Usando o email do tenant/admin como login
          password: hashedPassword,
          role: "ADMIN",
          tenantId: tenant.id
        }
      });
    }

    // 3. Criar Pipeline Stages Iniciais
    await prisma.pipelineStage.createMany({
      data: [
        { name: "Novos", color: "#3b82f6", order: 0, tenantId: tenant.id },
        { name: "Qualificando", color: "#f59e0b", order: 1, tenantId: tenant.id },
        { name: "Interessados", color: "#10b981", order: 2, tenantId: tenant.id },
        { name: "Agendados", color: "#8b5cf6", order: 3, tenantId: tenant.id },
        { name: "Convertidos", color: "#0f172a", order: 4, tenantId: tenant.id }
      ]
    });

    res.json(tenant);
  } catch (e) { 
    console.error("Erro criando tenant:", e);
    res.status(500).json({ error: e.message }); 
  }
});

// --- User Management (Admin Side) ---
app.post("/api/admin/tenants/:tenantId/users", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const { tenantId } = req.params;
    console.log(`[Admin] Criando usuário para tenant ${tenantId}: ${email}`);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role, tenantId }
    });
    res.json(user);
  } catch (e) { 
    console.error("Erro ao criar usuário (admin):", e);
    res.status(500).json({ error: e.message }); 
  }
});

app.put("/api/admin/tenants/:tenantId/users/:userId", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const { userId } = req.params;
    const data = { name, email, role };
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data
    });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/tenants/:tenantId/users/:userId", async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.userId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- User Management (Tenant Side) ---
app.get("/api/users", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const users = await prisma.user.findMany({ 
      where: { tenantId },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/users", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role, tenantId }
    });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const { name, email, password, role } = req.body;
    const data = { name, email, role };
    if (password) data.password = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({
      where: { id: req.params.id, tenantId },
      data
    });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    await prisma.user.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
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
      ? await prisma.sdrBot.findFirst({ where: { id: sdrId, active: true }})
      : await prisma.sdrBot.findFirst({ where: { tenantId, active: true } });
    
    if (!sdr) {
      console.log(`[SDR] Nenhum SDR ativo encontrado para o tenant ${tenantId}. Ignorando resposta.`);
      return null;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

    // 🧠 BUSCAR HISTÓRICO DA CONVERSA PARA DAR MEMÓRIA AO ROBÔ
    const lead = await prisma.lead.findFirst({ where: { phone, tenantId } });
    let historyText = "Nenhuma mensagem anterior.";
    let longTermMemory = lead?.aiContactSummary || "Este lead é novo, ainda não temos um perfil comportamental traçado.";
    
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

        const stage = await prisma.pipelineStage.findFirst({
          where: { tenantId, name: { contains: "Agendado" } }
        });
        if (stage) {
          await prisma.lead.update({
             where: { id: lead.id },
             data: { stageId: stage.id }
          });
        }

        return { status: "SUCCESS", message: "Agendamento criado com sucesso no banco de dados. Confirme ao usuário com entusiasmo!", id: appointment.id };
      },
      get_account_details: async () => {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } });
        return { company_name: tenant?.name, plan: tenant?.plan?.name };
      }
    };


    // 🛍️ BUSCAR CATÁLOGO DE PRODUTOS E SERVIÇOS DO TENANT
    let catalogText = "Nenhum produto cadastrado no momento.";
    try {
      if (prisma.product) {
        const products = await prisma.product.findMany({ where: { tenantId, isActive: true } });
        if (products.length > 0) {
          catalogText = products.map(p => `- [${p.type}] ${p.name}: R$ ${p.price || 'Sob Consulta'} | Tamanho/Detalhes: ${p.size || p.description || ''} | Comprar: ${p.buyUrl || 'Indisponível'}`).join("\n");
        }
      }
    } catch (e) {
      console.warn(`[PRISMA] Tabela 'Product' indisponível localmente: ${e.message}`);
      // Fallback para manter o SDR online
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const provider = tenant?.aiProvider || "GEMINI";
    const apiKey = tenant?.aiApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) throw new Error("Chave de API de IA não configurada para este tenant.");

    // 🔥 Emitindo evento em tempo real para o Front-end (Iniciando Digitação/Processamento)
    eventEmitter.emit("sdr_action", { tenantId, action: "typing", leadPhone: phone, leadName, timestamp: Date.now() });

    const isOngoingConversation = historyText !== "Nenhuma mensagem anterior." && historyText.split("\n").length > 2;


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
      1. NÃO REPITA SAUDAÇÕES EM CONVERSAS EM ANDAMENTO: Avalie o Histórico da Conversa. O histórico demonstra que esta é uma conversa ativa? STATUS_CONVERSA_ATIVA: ${isOngoingConversation}. Se for verdadeiro, NUNCA inicie mensagens com "Olá Fulano", "Oi de novo", "Bom dia". Simplesmente continue a conversa de onde parou respondendo à pergunta diretamente de forma natural. Somente faça saudação se for o começo da interação com um lead novo.
      2. WORKFLOW DE AGENDAMENTO: 
         - Se o cliente demonstrar interesse em agendar, NÃO peça horários nem sugira datas.
         - ENVIE IMEDIATAMENTE este link ÚNICO de agendamento: http://localhost:8080/p/${tenantId}/book
         - Diga algo como: "Para facilitar, você pode escolher o melhor dia e horário diretamente em nosso calendário oficial aqui: [LINK]"
      3. OBJETIVIDADE E FLUÍDEZ: Seja conversacional mas conciso.
      
      # CATÁLOGO DE PRODUTOS/SERVIÇOS:
      Você pode apresentar e sugerir estes itens do nosso catálogo oficial caso o cliente pergunte:
      ${catalogText}

      # BASE DE CONHECIMENTO (ESTRITAMENTE USE ISSO):
      ${sdr.knowledgeBase}

      # MEMÓRIA DE LONGO PRAZO (PERFIL DO LEAD):
      Use este resumo para entender quem é o lead e o que já foi conversado anteriormente:
      ${longTermMemory}
      
      # HISTÓRICO DA CONVERSA (ÚLTIMAS 10 MENSAGENS):
      ${historyText}

      # DADOS DO LEAD ATUAL:
      Nome: ${leadName}
      Nova Mensagem (Texto ou Áudio transcrito): ${userMessage}
    `;

    let finalResponse = "";

    if (provider === "GEMINI") {
      const customGenAI = new GoogleGenerativeAI(apiKey);
      const modelName = "gemini-1.5-flash";
      const targetAiModel = customGenAI.getGenerativeModel({ model: modelName, tools });
      
      const chat = targetAiModel.startChat({
        history: [ { role: "user", parts: [{ text: "Considere as regras e memórias abaixo antes de prosseguir:\n" + systemPrompt }] } ]
      });

      let result = await chat.sendMessage(userMessage);
      let responseBody = result.response;

      // Loop para Tool Calls (Gemini Nativo)
      while (responseBody.candidates[0].content.parts.some(p => p.functionCall)) {
        const call = responseBody.candidates[0].content.parts.find(p => p.functionCall);
        const toolResponse = await executableTools[call.functionCall.name](call.functionCall.args);
        
        result = await chat.sendMessage([{
          functionResponse: {
            name: call.functionCall.name,
            response: { content: toolResponse }
          }
        }]);
        responseBody = result.response;
      }
      finalResponse = responseBody.text();

      // Track usage
      const tokens = Math.ceil((userMessage.length + finalResponse.length + 1000) / 4); // +1000 for prompt context
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { usedTokens: { increment: tokens } }
      });

    } else {
      // 🚀 IMPLEMENTAÇÃO PARA OPENAI, CLAUDE, DEEPSEEK, QWEN (OpenAI Compatible Format)
      const baseUrlMap = {
        "OPENAI": "https://api.openai.com/v1/chat/completions",
        "DEEPSEEK": "https://api.deepseek.com/chat/completions",
        "QWEN": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        "CLAUDE": "https://api.anthropic.com/v1/messages" // Anthropic uses different structure
      };

      const modelMap = {
        "OPENAI": "gpt-4o",
        "DEEPSEEK": "deepseek-chat",
        "QWEN": "qwen-max",
        "CLAUDE": "claude-3-5-sonnet-20240620"
      };

      // Simplificação do SDK forçado via Axios para manter compatibilidade máxima
      const aiResponse = await axios.post(baseUrlMap[provider] || baseUrlMap["OPENAI"], {
        model: modelMap[provider] || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7
      }, {
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'x-api-key': apiKey // For Anthropic/Claude
        }
      });

      finalResponse = aiResponse.data.choices?.[0]?.message?.content || aiResponse.data.content?.[0]?.text || "Erro na IA";
    }

    // 🔥 Emitindo evento de conclusão para o Front-end
    eventEmitter.emit("sdr_action", { tenantId, action: "idle", leadPhone: phone, timestamp: Date.now() });


    // 🧠 ATUALIZAÇÃO ASSÍNCRONA DA MEMÓRIA DE LONGO PRAZO 
    // (A memória é atualizada em background para não travar a resposta do WhatsApp)
    if (lead) {
      (async () => {
        try {
          const messageCount = historyText.split("\n").length;
          // Atualiza se for a primeira vez ou a cada 5 interações (econômico)
          if (!lead.aiContactSummary || messageCount % 5 === 0) {
            const summaryModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const summaryPrompt = `
              Analise esta conversa curta e o resumo anterior e gere um NOVO resumo conciso (máximo 3 frases) do perfil deste lead.
              RESUMO ANTERIOR: ${lead.aiContactSummary || "Vazio"}
              ÚLTIMAS MENSAGENS: ${historyText}\nSDR: ${finalResponse}
              Foque em: Intenção de compra, dores, cargo/empresa e objeções.
            `;
            const summaryResult = await summaryModel.generateContent(summaryPrompt);
            const newSummary = summaryResult.response.text();
            
            await prisma.lead.update({
              where: { id: lead.id },
              data: { aiContactSummary: newSummary }
            });
            console.log(`[MEMÓRIA] Contexto do lead ${lead.name} atualizado com sucesso.`);
          }
        } catch (sumErr) {
          console.error("Erro ao atualizar sumário do lead:", sumErr);
        }
      })();
    }
    
    return finalResponse;
  } catch (e) {
    console.error("[SDR-AI] Erro ao gerar resposta:", e);
    return "Desculpe, tive um pequeno problema técnico. Pode repetir?";
  }
}

// --- External / Webhooks ---
// --- Official Meta WhatsApp Cloud API Webhooks ---
app.get("/api/webhook/whatsapp/meta", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe") {
      // 🕵️ Busca se algum canal no banco usa esse token de verificação
      const account = await prisma.whatsAppAccount.findFirst({ where: { verifyToken: token } });
      
      if (account || token === process.env.META_VERIFY_TOKEN) {
        console.log(`💎 Meta Webhook Verificado para conta: ${account?.name || 'Sistema (Global)'}`);
        return res.status(200).send(challenge);
      }
    }
  }
  res.sendStatus(403);
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
  const { name, phoneId, accessToken, wabaId, phone, verifyToken } = req.body;
  try {
    const tenantId = req.tenantId || req.headers["x-tenant-id"];
    const account = await prisma.whatsAppAccount.create({
      data: {
        name,
        phoneId,
        accessToken,
        wabaId,
        phone,
        verifyToken,
        status: "CONNECTED", // Meta conta-se como conectado se configurada
        tenantId: tenantId
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

    // 2a. Dispatch NEW_LEAD trigger if lead was just created AND not in direct chat mode
    const { skipNewLeadTrigger } = req.body;
    if (isNewLead && !skipNewLeadTrigger) {
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
      create: { leadId: lead.id, botActive: true, tenantId }
    });

    if (!conv.botActive) {
      console.log(`[SDR] Robô pausado para ${phone} (Transbordo Humano ativo).`);
      return res.json({ success: true, handled: "human" });
    }

    // 4. Gerar Resposta Consultiva usando Gemini + Skills do SDR
    const aiResponse = await generateSdrResponse(tenantId, phone, name, content);
    
    // 5. Registrar Mensagens
    const userMsg = await prisma.message.create({
      data: { conversationId: conv.id, content, role: "USER", tenantId }
    });
    eventEmitter.emit("new_message", { tenantId, leadId: lead.id, message: userMsg });
    
    if (aiResponse) {
      const assistantMsg = await prisma.message.create({
        data: { conversationId: conv.id, content: aiResponse, role: "ASSISTANT", tenantId }
      });
      eventEmitter.emit("new_message", { tenantId, leadId: lead.id, message: assistantMsg });
      
      // ⚡ Otimização: A resposta já vai para o robô, o resto (Score, etc) fica em background
      res.json({ success: true, ai_response: aiResponse });
      return;
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

  // --- Monetization Check: Calendar ---
  const tenantObj = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } });
  let calendarEnabled = false;
  if (tenantObj?.plan?.features) {
     try { calendarEnabled = JSON.parse(tenantObj.plan.features).calendar === true; } catch(e){}
  }
  if (!calendarEnabled) return res.status(403).json({ error: "Recurso de agendamento não disponível neste plano." });

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

    // 2.5 Mover Lead para fase de "Agendados"
    const stage = await prisma.pipelineStage.findFirst({
      where: { tenantId, name: { contains: "Agendado" } }
    });
    if (stage) {
      await prisma.lead.update({
         where: { id: lead.id },
         data: { stageId: stage.id }
      });
    }

    // 3. (EXTRA) Enviar Confirmação Pró-ativa no WhatsApp via Jarvis
    const formattedDate = new Date(date).toLocaleString('pt-BR', { 
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
    });
    
    const confirmationText = `Opa ${name}, vi que vc conseguiu fazer o agendamento pro dia ${formattedDate}, tudo certo.. agendamento confirmado! ✅`;

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
          data: { conversationId: conv.id, content: confirmationText, role: "ASSISTANT", tenantId }
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

// --- Real-time Events (SSE) ---
app.get("/api/events", (req, res) => {
  const tenantId = req.query.tenantId;
  if (!tenantId) return res.status(400).end();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const onNewMessage = (data) => {
    if (data.tenantId === tenantId) {
      res.write(`data: ${JSON.stringify({ type: "new_message", ...data })}\n\n`);
    }
  };

  const onNewLead = (data) => {
    if (data.tenantId === tenantId) {
      res.write(`data: ${JSON.stringify({ type: "new_lead", ...data })}\n\n`);
    }
  };

  const onSdrAction = (data) => {
    if (data.tenantId === tenantId) {
      res.write(`data: ${JSON.stringify({ type: "sdr_action", ...data })}\n\n`);
    }
  };

  eventEmitter.on("new_message", onNewMessage);
  eventEmitter.on("new_lead", onNewLead);
  eventEmitter.on("sdr_action", onSdrAction);

  req.on("close", () => {
    eventEmitter.off("new_message", onNewMessage);
    eventEmitter.off("new_lead", onNewLead);
    eventEmitter.off("sdr_action", onSdrAction);
  });
});

// ═══════════════════════════════════════════════
// 🕕 RELATÓRIO DIÁRIO AUTOMÁTICO (Cron 18h)
// ═══════════════════════════════════════════════
cron.schedule('0 18 * * *', async () => {
  console.log('[DailyReport] 📊 Gerando relatórios diários...');
  try {
    const tenants = await prisma.tenant.findMany({ where: { active: true } });
    
    for (const tenant of tenants) {
      // Buscar admin com telefone cadastrado
      const admin = await prisma.user.findFirst({
        where: { tenantId: tenant.id, phone: { not: null }, role: { in: ['ADMIN', 'OWNER'] } }
      });
      
      if (!admin || !admin.phone) continue;
      
      // Gerar relatório
      const report = await CommandCenter.generateDailyReport(tenant.id);
      if (!report) continue;
      
      // Encontrar sessão WhatsApp ativa para esse tenant
      const sessions = Array.from(whatsappSessions.entries())
        .filter(([_, s]) => s.tenantId === tenant.id && s.status === 'CONNECTED');
      
      if (sessions.length === 0) continue;
      
      const [_, session] = sessions[0];
      const jid = `${admin.phone}@s.whatsapp.net`;
      
      try {
        await session.sock.sendMessage(jid, { text: report });
        console.log(`[DailyReport] ✅ Relatório enviado para ${admin.name} (${tenant.name})`);
      } catch (sendErr) {
        console.error(`[DailyReport] ❌ Erro ao enviar para ${admin.phone}:`, sendErr.message);
      }
    }
  } catch (err) {
    console.error('[DailyReport] Erro geral:', err);
  }
}, { timezone: 'America/Sao_Paulo' });

console.log('[DailyReport] ⏰ Cron agendado: relatório diário às 18h (America/Sao_Paulo)');

// ═══════════════════════════════════════════════
// 🔔 ENDPOINT: Forçar relatório (para testar)
// ═══════════════════════════════════════════════
app.post("/api/report/daily", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"];
    if (!tenantId) return res.status(401).json({ error: "Não autenticado" });
    
    const report = await CommandCenter.generateDailyReport(tenantId);
    if (!report) return res.status(500).json({ error: "Erro ao gerar relatório" });
    
    // Tentar enviar via WhatsApp
    const admin = await prisma.user.findFirst({
      where: { tenantId, phone: { not: null }, role: { in: ['ADMIN', 'OWNER'] } }
    });
    
    if (admin?.phone) {
      const sessions = Array.from(whatsappSessions.entries())
        .filter(([_, s]) => s.tenantId === tenantId && s.status === 'CONNECTED');
      
      if (sessions.length > 0) {
        const [_, session] = sessions[0];
        await session.sock.sendMessage(`${admin.phone}@s.whatsapp.net`, { text: report });
      }
    }
    
    res.json({ success: true, report });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🚀 INTEGRATION: APOLLO.IO SEARCH PROXY
app.post("/api/apollo/search", async (req, res) => {
  const { query, location, title, limit } = req.body;
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  
  console.log(`[Apollo] 🔍 Busca para Tenant: ${tenantId}`);

  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    console.log(`[Apollo] 🔑 Key encontrada: ${tenant?.apolloApiKey ? 'SIM ✅' : 'NÃO ❌'}`);
    if (!tenant?.apolloApiKey) {
      return res.status(400).json({ error: "Apollo API Key não configurada. Vá em Configurações > Integrações." });
    }

    // Chamada oficial para o Apollo.io (Nova Regra: API Key via Header)
    const response = await axios.post('https://api.apollo.io/v1/people/search', {
      q_keywords: query || "",
      person_locations: location ? [location] : [],
      person_titles: title ? [title] : [],
      page: 1,
      display_mode: "regular"
    }, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'X-Api-Key': tenant.apolloApiKey
      }
    });

    // Mapear para o formato AutoSales
    const leads = response.data.people.map((p) => ({
      name: p.name,
      phone: p.phone_numbers?.[0]?.sanitized_number || p.organization?.primary_phone?.sanitized_number || "",
      email: p.email,
      title: p.title,
      company: p.organization?.name || "",
      source: "Apollo.io",
      id: `ap-${p.id}`
    }));

    res.json(leads);
  } catch (error) {
    console.error("Apollo Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Erro na base Apollo. Verifique sua chave API no menu Configurações." });
  }
});

// 🦁 SEARCH: LINKEDIN PROFILE MINER (VIA GOOGLE HACK)
app.post("/api/prospect/linkedin", async (req, res) => {
  const { title, location } = req.body;
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;

  if (!title) return res.status(400).json({ error: "O cargo é obrigatório para a busca no LinkedIn." });

  try {
    const query = `site:linkedin.com/in "${title}" "${location || ''}"`;
    const serperKey = process.env.SERPER_API_KEY || "SEM_CHAVE";

    if (serperKey !== "SEM_CHAVE") {
      console.log(`[LinkedIn Miner] 🔎 BUSCA REAL: ${query}`);
      const response = await axios.post('https://google.serper.dev/search', {
        q: query,
        num: 15
      }, {
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' }
      });

      const leads = response.data.organic
        .filter((item) => item.link.includes('linkedin.com/in/'))
        .map((item, index) => ({
          id: `li-real-${index}`,
          name: item.title.split(' - ')[0].split(' | ')[0],
          title: item.snippet.split('...')[0] || title,
          displayPhone: 'Aguardando Enriquecimento',
          phone: '',
          source: 'LinkedIn Pro',
          url: item.link
        }));

      return res.json(leads);
    }

    // 🔄 MOCK DINÂMICO (Variar resultados quando sem chave)
    const variations = ["Santos", "Oliveira", "Costa", "Almeida", "Rodrigues", "Pereira"];
    const mockProfiles = variations.map((name, i) => ({
      id: `li-mock-${i}-${Date.now()}`, 
      name: `${name} ${variations[(i+2) % variations.length]}`,
      title: `${title} na ${variations[(i+1)%variations.length]} Corp`,
      displayPhone: 'Aguardando Enriquecimento',
      phone: '',
      source: 'LinkedIn Search',
      url: `https://linkedin.com/in/perfil-${i}`
    }));

    res.json(mockProfiles);
  } catch (error) {
    console.error("LinkedIn Search Error:", error.message);
    res.status(500).json({ error: "Ocorreu um erro na varredura do LinkedIn." });
  }
});

// ✨ ENRICH: FIND CONTACT INFO BY LINKEDIN PROFILE (APOLLO + SNOV.IO FALLBACK)
app.post("/api/prospect/enrich", async (req, res) => {
  const { url } = req.body;
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;

  if (!url) return res.status(400).json({ error: "URL do LinkedIn necessária para enriquecimento." });

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    
    // 🟠 TENTA 1: APOLLO.IO
    if (tenant?.apolloApiKey) {
      try {
        console.log(`[Enrich] 🚀 Tentando Apollo para: ${url}`);
        const response = await axios.post('https://api.apollo.io/v1/people/match', {
           linkedin_url: url
        }, {
           headers: { 'X-Api-Key': tenant.apolloApiKey, 'Content-Type': 'application/json' }
        });

        const person = response.data.person;
        if (person?.email || person?.phone_numbers?.length > 0) {
          return res.json({
            phone: person?.phone_numbers?.[0]?.sanitized_number || person?.organization?.primary_phone?.sanitized_number || "",
            email: person?.email || "",
            company: person?.organization?.name || "",
            success: true,
            provider: 'Apollo'
          });
        }
      } catch (err) {
        console.warn("[Enrich] Apollo failed or restricted.");
      }
    }

    // 🔵 TENTA 2: SNOV.IO (FALLBACK SE CONFIGURADO)
    const snovId = process.env.SNOV_CLIENT_ID;
    const snovSecret = process.env.SNOV_CLIENT_SECRET;

    if (snovId && snovSecret) {
      try {
        console.log(`[Enrich] 🛡️ Tentando Snov.io para: ${url}`);
        
        // 1. Obter Token do Snov (OAuth2)
        const tokenRes = await axios.post('https://api.snov.io/v1/oauth/access_token', {
          grant_type: 'client_credentials',
          client_id: snovId,
          client_secret: snovSecret
        });
        const accessToken = tokenRes.data.access_token;

        // 2. Buscar e-mails pela URL do LinkedIn
        const snovRes = await axios.post('https://api.snov.io/v1/get-emails-from-url', {
          url: url
        }, {
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
        });

        if (snovRes.data.success && snovRes.data.data) {
          const lead = snovRes.data.data;
          return res.json({
            phone: lead.phones?.[0]?.phone || "",
            email: lead.emails?.[0]?.email || "",
            company: lead.currentJobs?.[0]?.companyName || "",
            success: true,
            provider: 'Snov.io'
          });
        }
      } catch (err) {
        console.error("[Enrich] Snov.io Error:", err.response?.data || err.message);
      }
    }

    res.status(400).json({ 
      error: "Não foi possível encontrar dados reais com os planos atuais de Apollo e Snov.io.",
      success: false 
    });

  } catch (error) {
    res.status(500).json({ error: "Erro no motor de enriquecimento." });
  }
});

// 🦁 THE HUNTER ROUTINE: AUTOMATED DAILY PROSPECTING
cron.schedule('0 3 * * *', async () => {
  console.log("[Hunter Routine] 🚀 Iniciando prospecção automática diária...");
  
  try {
    const activeIcps = await prisma.icpProfile.findMany({
      where: { isAutoHunterEnabled: true },
      include: { tenant: true }
    });

    for (const icp of activeIcps) {
      console.log(`[Hunter] 🎯 Processando ICP: ${icp.name} (Tenant: ${icp.tenantId})`);
      
      const query = `site:linkedin.com/in "${icp.role}" "${icp.location}"`;
      const serperKey = process.env.SERPER_API_KEY;

      if (!serperKey) continue;

      try {
        // 1. Busca real
        const response = await axios.post('https://google.serper.dev/search', {
          q: query,
          num: icp.dailyLimit || 200
        }, {
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' }
        });

        const profiles = response.data.organic.filter((item) => item.link.includes('linkedin.com/in/'));
        
        let importedCount = 0;
        for (const profile of profiles) {
           // 2. Tentar Enriquecimento Automático
           // (Lógica similar ao /api/prospect/enrich)
           // Para fins de rotina automática, focaremos em quem já tem dados ou buscar via Apollo/Snov se tiver chaves.
           
           // Se tiver dados válidos, importar para o Lead
           const name = profile.title.split(' - ')[0].split(' | ')[0];
           
           const newLead = await prisma.lead.create({
              data: {
                name,
                source: "AUTO_HUNTER",
                tenantId: icp.tenantId,
                status: "NEW",
                notes: `Linkedin: ${profile.link}`
              }
           });

           // 3. SE O WHATSAPP FOR IDENTIFICADO -> DISPARAR AUTOMAÇÃO
           // TODO: Lógica de verificação de número real via API
           importedCount++;
        }
        
        console.log(`[Hunter] ✅ Sucesso! ${importedCount} leads proscpectados para ${icp.tenantId}`);
      } catch (e) {
        console.error(`[Hunter] Falha na busca para ${icp.name}:`, e.message);
      }
    }
  } catch (err) {
    console.error("[Hunter Routine] Critical Failure:", err.message);
  }
});

// 🎯 ICP PROFILES: CRUD
app.get("/api/icp-profiles", async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  const profiles = await prisma.icpProfile.findMany({ where: { tenantId } });
  res.json(profiles);
});

app.post("/api/icp-profiles", async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  const { name, niche, role, location, isAutoHunterEnabled, dailyLimit } = req.body;
  
  const profile = await prisma.icpProfile.create({
    data: { name, niche, role, location, isAutoHunterEnabled, dailyLimit, tenantId }
  });
  res.json(profile);
});

app.put("/api/icp-profiles/:id", async (req, res) => {
  const { name, niche, role, location, isAutoHunterEnabled, dailyLimit } = req.body;
  const profile = await prisma.icpProfile.update({
    where: { id: req.params.id },
    data: { name, niche, role, location, isAutoHunterEnabled, dailyLimit }
  });
  res.json(profile);
});

app.delete("/api/icp-profiles/:id", async (req, res) => {
  await prisma.icpProfile.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ⚙️ SETTINGS: GET & SAVE
app.get("/api/settings", async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    res.json({
      companyName: tenant?.name,
      phone: tenant?.phone,
      aiProvider: tenant?.aiProvider,
      aiApiKey: tenant?.aiApiKey,
      apolloApiKey: tenant?.apolloApiKey
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/settings", async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  const { name, phone, aiProvider, aiApiKey, apolloApiKey } = req.body;
  
  console.log(`[Settings] 💾 Salvando para Tenant: ${tenantId}, ApolloKey: ${apolloApiKey ? 'Informada' : 'Vazia'}`);

  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name,
        phone,
        aiProvider,
        aiApiKey,
        apolloApiKey
      }
    });
    res.json(tenant);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor SaaS VendAi ON: http://localhost:${PORT}`);
  WhatsAppManager.bootExistingSessions().catch(e => console.error("Err boot:", e));
});
