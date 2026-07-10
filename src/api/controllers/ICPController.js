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
    // id/tenantId nunca vêm do body — impediria reatribuir o perfil a outro tenant
    const { id: _id, tenantId: _tenantId, ...data } = req.body;
    const profile = await prisma.icpProfile.update({
      where: { id: req.params.id, tenantId },
      data
    });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteProfile = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    await prisma.icpProfile.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
