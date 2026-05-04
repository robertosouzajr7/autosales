import express from "express";
import * as PublicController from "../controllers/PublicController.js";

const router = express.Router();

router.get("/landing", PublicController.getLandingPage);
router.get("/webchat/:id", PublicController.getWebchat);
router.post("/chat", PublicController.submitChat);
router.post("/book", PublicController.bookAppointment);

export default router;
