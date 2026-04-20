import express from "express";
import prisma from "../config/prisma.js";

const router = express.Router();

router.get("/ping", (req, res) => res.send("PONG"));

export default router;
