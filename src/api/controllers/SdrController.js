import prisma from "../config/prisma.js";

export const getSdrs = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
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
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const {
    name, role, prompt, knowledgeBase, trainingUrls,
    responseDelay, voiceTone, escalationKeywords,
    followUpInterval, preConfirmationHours, noShowGraceMinutes,
    postServiceCheckHours, enableWaitlist, active
  } = req.body;

  try {
    const sdr = await prisma.sdrBot.create({
      data: {
        name,
        role: role || "SDR",
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
        tenantId
      }
    });
    res.json(sdr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSdr = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { id } = req.params;
  const {
    name, role, prompt, knowledgeBase, trainingUrls,
    responseDelay, voiceTone, escalationKeywords,
    followUpInterval, preConfirmationHours, noShowGraceMinutes,
    postServiceCheckHours, enableWaitlist, active
  } = req.body;

  try {
    const sdr = await prisma.sdrBot.update({
      where: { id, tenantId },
      data: {
        name,
        role,
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
        active
      }
    });
    res.json(sdr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteSdr = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
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
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  }

  const file = req.file;
  
  // Basic mock extractor. In a real scenario, use pdf-parse or similar
  const extractedText = `Conteúdo extraído do arquivo: ${file.originalname || "documento"}\n\nEste é um conhecimento processado pela IA.`;

  try {
    const sdr = await prisma.sdrBot.findUnique({ where: { id, tenantId } });
    if (!sdr) return res.status(404).json({ error: "SDR not found" });

    const newKb = sdr.knowledgeBase ? sdr.knowledgeBase + "\n\n" + extractedText : extractedText;

    const updated = await prisma.sdrBot.update({
      where: { id, tenantId },
      data: { knowledgeBase: newKb }
    });

    res.json({ success: true, sdr: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
