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
import prospectionRoutes from "./routes/prospection.js";
import { WhatsAppManager } from "../../whatsapp.js";
import AutomationEngine from "../../automation_engine.js";
import { receiveWhatsappWebhook } from "./controllers/LeadController.js";
import { verifyMetaWebhook, receiveMetaWebhook } from "./controllers/MetaWebhookController.js";
import { receivePaymentWebhook } from "./controllers/PaymentWebhookController.js";
import { receiveStripeWebhook } from "./controllers/StripeWebhookController.js";
import { serveWidget } from "./controllers/WidgetController.js";
import { logger } from "./config/logger.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { EventEmitter } from "events";

dotenv.config();

const app = express();
app.set("trust proxy", 1); // Necessário para o rateLimit funcionar atrás do Nginx/Easypanel proxy
const eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(100);
AutomationEngine.setEventEmitter(eventEmitter);

// Health checks — sem auth, sem rate limit. Devem vir ANTES de tudo.
// /healthz = liveness (o processo está de pé). /readyz = readiness (o banco
// responde), usado pelo orquestrador para decidir se manda tráfego.
app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok", uptime: process.uptime() }));
app.get("/readyz", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready" });
  } catch (e) {
    res.status(503).json({ status: "not_ready", error: "database" });
  }
});

// requestId + log estruturado por requisição (com tenantId quando autenticado).
app.use((req, res, next) => {
  req.id = req.get("x-request-id") || crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      reqId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
      tenantId: req.tenantId || null
    }, "request");
  });
  next();
});

// Security
// CSP desativado porque o mesmo Express serve a SPA/landing com scripts inline.
app.use(helmet({ contentSecurityPolicy: false }));

if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
  console.warn("⚠️  ALLOWED_ORIGINS não definido — CORS aberto para qualquer origem.");
}
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // uso normal do painel (polling de conversas/stats)
  message: { error: "Muitas requisições. Tente novamente mais tarde." },
  // Webhooks são chamados por origem única (loop interno localhost, ou a
  // infra da Meta em rajada) — limitá-los por IP estrangularia todos os
  // tenants de uma vez. O webhook da Meta é autenticado por HMAC.
  skip: (req) => ["/webhook/whatsapp", "/webhook/meta", "/webhook/payment", "/webhook/stripe"].includes(req.path)
});

// Login/registro: janela pequena contra força bruta e enumeração de contas
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Muitas tentativas de autenticação. Aguarde alguns minutos." }
});

app.use("/api/auth/", authLimiter);
app.use("/api/", apiLimiter);
// Guarda o corpo cru p/ validar a assinatura HMAC do webhook da Meta.
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ⚡ Webhook WhatsApp (DEVE ser antes dos routers com authMiddleware)
app.post("/api/webhook/whatsapp", receiveWhatsappWebhook);

// ⚡ Webhook oficial da Meta Cloud API (verificação + eventos assinados)
app.get("/api/webhook/meta", verifyMetaWebhook);
app.post("/api/webhook/meta", receiveMetaWebhook);

// ⚡ Webhook de pagamento Mercado Pago (confirma fatura; assinado por HMAC)
app.post("/api/webhook/payment", receivePaymentWebhook);

// ⚡ Webhook do Stripe (assinatura verificada pelo SDK do Stripe)
app.post("/api/webhook/stripe", receiveStripeWebhook);

// ⚡ Widget de chat público (embed em site de cliente)
app.get("/widget.js", serveWidget);

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
          { name: "Starter",    priceMonthly: 297,  priceYearly: 2970,  maxLeads: 500,     maxSdrs: 1,   maxUsers: 2,  maxWhatsAppNumbers: 1,  maxKnowledgeBaseChars: 50000,   maxTokens: 100000,   maxMessages: 2000,  enableCalendar: true,  enableAutomations: true,  enableWebhooks: false },
          { name: "Pro",        priceMonthly: 797,  priceYearly: 7970,  maxLeads: 3000,    maxSdrs: 3,   maxUsers: 5,  maxWhatsAppNumbers: 2,  maxKnowledgeBaseChars: 150000,  maxTokens: 500000,   maxMessages: 10000, enableCalendar: true,  enableAutomations: true,  enableWebhooks: true },
          { name: "Enterprise", priceMonthly: 1997, priceYearly: 19970, maxLeads: 20000,   maxSdrs: 10,  maxUsers: 20, maxWhatsAppNumbers: 10, maxKnowledgeBaseChars: 500000,  maxTokens: 2500000,  maxMessages: 50000, enableCalendar: true,  enableAutomations: true,  enableWebhooks: true },
          { name: "VITALICIO",  priceMonthly: 0,    priceYearly: 0,     maxLeads: 9999999, maxSdrs: 999, maxUsers: 999, maxWhatsAppNumbers: 999, maxKnowledgeBaseChars: 9999999, maxTokens: 999999999, maxMessages: 9999999, enableCalendar: true, enableAutomations: true, enableWebhooks: true, features: JSON.stringify({ support: "Dedicado", rag: true, priority: true }) }
        ]
      });
      console.log("💎 Planos iniciais criados.");
    }

    const superAdmin = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } });
    if (!superAdmin) {
      const email = process.env.SUPERADMIN_EMAIL;
      const password = process.env.SUPERADMIN_PASSWORD;
      if (!email || !password || password.length < 12) {
        console.warn(
          "⚠️  Nenhum SUPERADMIN existe. Defina SUPERADMIN_EMAIL e SUPERADMIN_PASSWORD " +
          "(mínimo 12 caracteres) no ambiente para criá-lo no próximo boot."
        );
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        const vitalicioPlan = await prisma.plan.findFirst({ where: { name: "VITALICIO" } });
        const systemTenant = await prisma.tenant.upsert({
          where: { email },
          update: { planId: vitalicioPlan?.id },
          create: { name: "Agentes Virtuais Global", email, planId: vitalicioPlan?.id }
        });

        await prisma.user.create({
          data: {
            name: "Super Administrator",
            email,
            password: hashedPassword,
            role: "SUPERADMIN",
            tenantId: systemTenant.id
          }
        });
        console.log(`👑 SuperAdmin criado com sucesso (${email})`);
      }
    }
  } catch (e) {
    console.error("❌ Erro na inicialização do banco:", e);
  }
}

export default app;
