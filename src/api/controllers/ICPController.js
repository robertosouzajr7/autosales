import prisma from "../config/prisma.js";

export const getProfiles = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const profiles = await prisma.icpProfile.findMany({ where: { tenantId } });
    res.json(profiles);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createProfile = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { 
      name, niche, role, location, 
      isAutoHunterEnabled, isProspectingActive, isActive, 
      dailyLimit, relevantInfo, searchKeywords, dailyResearchLimit,
      industry, companySize, painPoints, goals, sdrId
    } = req.body;
    const profile = await prisma.icpProfile.create({
      data: { 
        name, niche, role, location, 
        isAutoHunterEnabled, isProspectingActive, isActive, 
        dailyLimit, relevantInfo, searchKeywords, dailyResearchLimit,
        industry, companySize, painPoints, goals, sdrId,
        tenantId 
      }
    });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updateProfile = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    // update() não aceita filtro composto: confirma posse e evita mass-assignment
    const existing = await prisma.icpProfile.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: "Perfil não encontrado" });
    const { id, tenantId: _t, ...data } = req.body;
    const profile = await prisma.icpProfile.update({ where: { id: req.params.id }, data });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteProfile = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    // deleteMany aceita filtro composto e escopa por tenant; delete/findUnique não
    const result = await prisma.icpProfile.deleteMany({ where: { id: req.params.id, tenantId } });
    if (result.count === 0) return res.status(404).json({ error: "Perfil não encontrado" });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
