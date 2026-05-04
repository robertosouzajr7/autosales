import express from "express";

const router = express.Router();

router.get("/ping", (req, res) => res.send("PONG"));

export default router;
