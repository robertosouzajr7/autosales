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
    const sdr = await prisma.sdrBot.create({ data: { ...req.body, tenantId: tenant.id } });
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
    await prisma.whatsAppAccount.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/whatsapp/qr/:id", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  const onStatus = (msg) => {
    res.write(`data: ${msg}\n\n`);
  };

  // createSession agora coordena o envio do QR ou CONNECTED via onStatus
  WhatsAppManager.createSession(req.params.id, onStatus)
    .catch(err => {
       console.error("Erro ao abrir sessão:", err);
       res.write("data: ERROR\n\n");
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

// --- External / Webhooks ---
app.post("/api/webhook/whatsapp", async (req, res) => {
  // Simplificado para responder sempre OK e chamar o motor
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor SaaS VendAi ON: http://localhost:${PORT}`);
  WhatsAppManager.bootExistingSessions().catch(e => console.error("Err boot:", e));
});
