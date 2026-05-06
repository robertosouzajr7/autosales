import express from "express";
import { getProspectionStats, triggerManualHunt } from "../controllers/ProspectionStatsController.js";
import { authMiddleware } from "../middlewares/auth.js";

const router = express.Router();

router.get("/stats", authMiddleware, getProspectionStats);
router.post("/trigger-hunt", authMiddleware, triggerManualHunt);

export default router;
