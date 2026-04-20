import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import prisma from "./config/prisma.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import apiRouter from "./routes/index.js";
import publicRouter from "./routes/public.js";
import { WhatsAppManager } from "../../whatsapp.js";
import AutomationEngine from "../../automation_engine.js";
import bcrypt from "bcryptjs";
import { EventEmitter } from "events";

dotenv.config();

const app = express();
const eventEmitter = new EventEmitter();
AutomationEngine.setEventEmitter(eventEmitter);

// Security
app.use(helmet());
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

app.use("/api/", limiter);
app.use(express.json());

if (process.env.NODE_ENV === "development") {
    app.use((req, res, next) => {
        console.log(`[REQ] ${req.method} ${req.url}`);
        next();
    });
}

// Routes
app.use("/api", apiRouter);
app.use("/api/v2", apiRouter);
app.use("/", publicRouter);

// Database Initialization
export async function initDB() {
  try {
    const planCount = await prisma.plan.count();
    if (planCount === 0) {
      await prisma.plan.createMany({
        data: [
          { name: "BASIC", priceMonthly: 197, priceYearly: 0, maxLeads: 300, maxSdrs: 1, maxTokens: 50000 },
          { name: "PRO", priceMonthly: 797, priceYearly: 0, maxLeads: 10000, maxSdrs: 5, maxTokens: 500000 },
          { name: "ENTERPRISE", priceMonthly: 997, priceYearly: 0, maxLeads: 999999, maxSdrs: 20, maxTokens: 2000000 },
          { name: "VITALICIO", priceMonthly: 0, priceYearly: 0, maxLeads: 9999999, maxSdrs: 999, maxTokens: 999999999, features: JSON.stringify({ aiEnabled: true, webhookEnabled: true, bulkMessaging: true, calendar: true, crmIntegration: true, maxAutomations: -1, maxExecutions: -1 }) }
        ]
      });
      console.log("💎 Planos iniciais criados.");
    }

    const superAdmin = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } });
    if (!superAdmin) {
      const hashedPassword = await bcrypt.hash("admin", 10);
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
    }
  } catch (e) {
    console.error("❌ Erro na inicialização do banco:", e);
  }
}

export default app;
