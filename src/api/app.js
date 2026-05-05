import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import prisma from "./config/prisma.js";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import apiRouter from "./routes/index.js";
import publicRouter from "./routes/public.js";
import publicApiRouter from "./routes/publicApi.js";
import { WhatsAppManager } from "../../whatsapp.js";
import AutomationEngine from "../../automation_engine.js";
import { receiveWhatsappWebhook } from "./controllers/LeadController.js";
import bcrypt from "bcryptjs";
import { EventEmitter } from "events";

dotenv.config();

const app = express();
app.set("trust proxy", 1); // Necessário para o rateLimit funcionar atrás do Nginx/Easypanel proxy
const eventEmitter = new EventEmitter();
AutomationEngine.setEventEmitter(eventEmitter);

// Security
// app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id"]
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Muitas requisições. Tente novamente mais tarde." }
});

// app.use("/api/", limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

if (process.env.NODE_ENV === "development") {
    app.use((req, res, next) => {
        console.log(`[REQ] ${req.method} ${req.url}`);
        next();
    });
}

// ⚡ Webhook WhatsApp (DEVE ser antes dos routers com authMiddleware)
app.post("/api/webhook/whatsapp", receiveWhatsappWebhook);

// Routes
app.use("/api/public", publicApiRouter);
app.use("/api", apiRouter);
app.use("/api/v2", apiRouter);
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));
app.use("/", publicRouter);

// Database Initialization
export async function initDB() {
  try {
    const planCount = await prisma.plan.count();
    if (planCount === 0) {
      await prisma.plan.createMany({
        data: [
          { name: "BASIC", priceMonthly: 197, priceYearly: 0, maxLeads: 300, maxSdrs: 1, maxTokens: 50000, maxProspects: 100, maxResearch: 10, maxMessages: 1000 },
          { name: "PRO", priceMonthly: 797, priceYearly: 0, maxLeads: 10000, maxSdrs: 5, maxTokens: 500000, maxProspects: 1000, maxResearch: 100, maxMessages: 10000 },
          { name: "ENTERPRISE", priceMonthly: 997, priceYearly: 0, maxLeads: 999999, maxSdrs: 20, maxTokens: 2000000, maxProspects: 10000, maxResearch: 500, maxMessages: 50000 },
          { name: "VITALICIO", priceMonthly: 0, priceYearly: 0, maxLeads: 9999999, maxSdrs: 999, maxTokens: 999999999, maxProspects: 9999999, maxResearch: 9999999, maxMessages: 9999999, features: JSON.stringify({ aiEnabled: true, webhookEnabled: true, bulkMessaging: true, calendar: true, crmIntegration: true, maxAutomations: -1, maxExecutions: -1 }) }
        ]
      });
      console.log("💎 Planos iniciais criados.");
    }

    const superAdmin = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } });
    if (!superAdmin) {
      const hashedPassword = await bcrypt.hash("admin", 10);
      const vitalicioPlan = await prisma.plan.findFirst({ where: { name: "VITALICIO" } });
      const systemTenant = await prisma.tenant.upsert({
        where: { email: "admin@agentesvirtuais.com" },
        update: { planId: vitalicioPlan?.id },
        create: { name: "Agentes Virtuais Global", email: "admin@agentesvirtuais.com", planId: vitalicioPlan?.id }
      });

      await prisma.user.create({
        data: {
          name: "Super Administrator",
          email: "admin@agentesvirtuais.com",
          password: hashedPassword,
          role: "SUPERADMIN",
          tenantId: systemTenant.id
        }
      });
      console.log("👑 SuperAdmin criado com sucesso (admin@agentesvirtuais.com / admin)");
    }
  } catch (e) {
    console.error("❌ Erro na inicialização do banco:", e);
  }
}

export default app;
