import prisma from "../config/prisma.js";

export const getProfiles = async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const profiles = await prisma.icpProfile.findMany({ where: { tenantId } });
    res.json(profiles);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createProfile = async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const { name, niche, role, location, isAutoHunterEnabled, dailyLimit } = req.body;
    const profile = await prisma.icpProfile.create({
      data: { name, niche, role, location, isAutoHunterEnabled, dailyLimit, tenantId }
    });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updateProfile = async (req, res) => {
  try {
    const profile = await prisma.icpProfile.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteProfile = async (req, res) => {
  try {
    await prisma.icpProfile.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
