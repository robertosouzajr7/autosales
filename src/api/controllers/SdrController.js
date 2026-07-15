import prisma from "../config/prisma.js";
import { knowledgeBaseHeadroom } from "../middlewares/planLimits.js";

export const getSdrs = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const sdrs = await prisma.sdrBot.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });
    res.json(sdrs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createSdr = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const {
    name, role, agentFunction, skills, prompt, knowledgeBase, trainingUrls,
    responseDelay, voiceTone, escalationKeywords,
    followUpInterval, preConfirmationHours, noShowGraceMinutes,
    postServiceCheckHours, enableWaitlist, active,
    voiceId, responseMode
  } = req.body;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true }
    });

    if (tenant && tenant.plan) {
      if (!tenant.plan.enableSdr) {
        return res.status(403).json({ error: "O recurso de SDRs não está habilitado no seu plano." });
      }

      const sdrCount = await prisma.sdrBot.count({
        where: { tenantId, active: true }
      });

      if (sdrCount >= tenant.plan.maxSdrs && active !== false) {
        return res.status(403).json({ error: `Você atingiu o limite máximo de SDRs ativos do seu plano (${tenant.plan.maxSdrs}).` });
      }
    }

    const sdr = await prisma.sdrBot.create({
      data: {
        name,
        role: role || "SDR",
        agentFunction: agentFunction || "SCHEDULER",
        skills: skills ? (typeof skills === "string" ? skills : JSON.stringify(skills)) : null,
        prompt,
        knowledgeBase,
        trainingUrls,
        responseDelay: responseDelay ? parseInt(responseDelay) : 2000,
        voiceTone: voiceTone || "PROFESSIONAL",
        escalationKeywords,
        followUpInterval: followUpInterval ? parseInt(followUpInterval) : 120,
        preConfirmationHours: preConfirmationHours ? parseInt(preConfirmationHours) : 12,
        noShowGraceMinutes: noShowGraceMinutes ? parseInt(noShowGraceMinutes) : 15,
        postServiceCheckHours: postServiceCheckHours ? parseInt(postServiceCheckHours) : 24,
        enableWaitlist: enableWaitlist !== undefined ? enableWaitlist : true,
        active: active !== undefined ? active : true,
        voiceId: voiceId || "21m00Tcm4TlvDq8ikWAM",
        responseMode: responseMode || "TEXT",
        tenantId
      }
    });
    res.json(sdr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSdr = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { id } = req.params;
  const {
    name, role, agentFunction, skills, prompt, knowledgeBase, trainingUrls,
    responseDelay, voiceTone, escalationKeywords,
    followUpInterval, preConfirmationHours, noShowGraceMinutes,
    postServiceCheckHours, enableWaitlist, active,
    voiceId, responseMode
  } = req.body;

  try {
    if (active === true) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true }
      });

      if (tenant && tenant.plan) {
        if (!tenant.plan.enableSdr) {
          return res.status(403).json({ error: "O recurso de SDRs não está habilitado no seu plano." });
        }
        
        const sdrCount = await prisma.sdrBot.count({
          where: { tenantId, active: true, id: { not: id } }
        });

        if (sdrCount >= tenant.plan.maxSdrs) {
          return res.status(403).json({ error: `Você atingiu o limite máximo de SDRs ativos do seu plano (${tenant.plan.maxSdrs}).` });
        }
      }
    }

    const sdr = await prisma.sdrBot.update({
      where: { id, tenantId },
      data: {
        name,
        role,
        agentFunction: agentFunction || undefined,
        skills: skills !== undefined ? (typeof skills === "string" ? skills : JSON.stringify(skills)) : undefined,
        prompt,
        knowledgeBase,
        trainingUrls,
        responseDelay: responseDelay ? parseInt(responseDelay) : undefined,
        voiceTone,
        escalationKeywords,
        followUpInterval: followUpInterval ? parseInt(followUpInterval) : undefined,
        preConfirmationHours: preConfirmationHours ? parseInt(preConfirmationHours) : undefined,
        noShowGraceMinutes: noShowGraceMinutes ? parseInt(noShowGraceMinutes) : undefined,
        postServiceCheckHours: postServiceCheckHours ? parseInt(postServiceCheckHours) : undefined,
        enableWaitlist,
        active,
        voiceId,
        responseMode
      }
    });
    res.json(sdr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteSdr = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { id } = req.params;

  try {
    await prisma.sdrBot.delete({
      where: { id, tenantId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const trainSdr = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  }

  const file = req.file;

  try {
    const sdr = await prisma.sdrBot.findFirst({ where: { id, tenantId } });
    if (!sdr) return res.status(404).json({ error: "SDR not found" });

    // Extração REAL do conteúdo do documento (PDF/DOCX/XLSX/CSV/TXT)
    const { extractText } = await import("../services/DocumentExtractor.js");
    let extractedText;
    try {
      extractedText = await extractText(file.buffer, file.originalname, file.mimetype);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    if (!extractedText || extractedText.length < 10) {
      return res.status(400).json({ error: "Não consegui extrair texto legível deste arquivo. Ele pode ser um PDF só de imagem (escaneado)." });
    }

    const header = `\n\n===== ${file.originalname || "documento"} =====\n`;
    const chunkToAppend = header + extractedText;

    // Gate: tamanho total da base de conhecimento do tenant (soma de todos os SDRs).
    const headroom = await knowledgeBaseHeadroom(tenantId, chunkToAppend.length);
    if (!headroom.ok) {
      return res.status(403).json({
        error: `Limite de treino do seu plano atingido: ${headroom.max.toLocaleString("pt-BR")} caracteres. Já em uso: ${headroom.used.toLocaleString("pt-BR")}. Este arquivo tem ${chunkToAppend.length.toLocaleString("pt-BR")} caracteres — faça upgrade do plano ou remova outros treinos.`,
      });
    }

    const newKb = sdr.knowledgeBase ? sdr.knowledgeBase + chunkToAppend : extractedText;

    const updated = await prisma.sdrBot.update({
      where: { id, tenantId },
      data: { knowledgeBase: newKb }
    });

    res.json({ success: true, sdr: updated, extractedChars: extractedText.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
