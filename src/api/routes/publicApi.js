import express from "express";
import * as PublicController from "../controllers/PublicController.js";
import { receiveWhatsappWebhook } from "../controllers/LeadController.js";
import { webhookTrigger } from "../controllers/AutomationController.js";

const router = express.Router();

router.get("/landing", PublicController.getLandingPage);
// Questionário de contratação: perguntas, recomendação e planos de entrada.
router.get("/plan-questions", PublicController.getPlanQuestions);
router.post("/plan-advisor", PublicController.recommendPlan);
router.get("/entry-plans", PublicController.getEntryPlans);
router.get("/plans", PublicController.getAllPlans);

router.get("/webchat/:id", PublicController.getWebchat);
router.post("/chat", PublicController.submitChat);
router.post("/book", PublicController.bookAppointment);
router.post("/waitlist", PublicController.addToWaitlist);

// Webhook interno do WhatsApp (chamado pelo Baileys em whatsapp.js)
router.post("/webhook/whatsapp", receiveWhatsappWebhook);

// Gatilho externo de fluxo. Público de propósito (quem chama é outro
// sistema); a autenticação é a chave configurada no gatilho.
router.post("/flows/:id/trigger", webhookTrigger);

export default router;
