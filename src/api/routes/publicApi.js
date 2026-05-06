import express from "express";
import * as PublicController from "../controllers/PublicController.js";
import { receiveWhatsappWebhook } from "../controllers/LeadController.js";

const router = express.Router();

router.get("/landing", PublicController.getLandingPage);
router.get("/webchat/:id", PublicController.getWebchat);
router.post("/chat", PublicController.submitChat);
router.post("/book", PublicController.bookAppointment);
router.post("/waitlist", PublicController.addToWaitlist);

// Webhook interno do WhatsApp (chamado pelo Baileys em whatsapp.js)
router.post("/webhook/whatsapp", receiveWhatsappWebhook);

export default router;
