import prisma from "../config/prisma.js";

export const getSettings = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true }
    });
    res.json({
      companyName: tenant?.name,
      phone: tenant?.phone,
      aiProvider: tenant?.aiProvider,
      aiApiKey: tenant?.aiApiKey,
      apolloApiKey: tenant?.apolloApiKey,
      usedTokens: tenant?.usedTokens || 0,
      qualifiedLeadsCount: tenant?.qualifiedLeadsCount || 0,
      plan: tenant?.plan,
      smtpHost: tenant?.smtpHost,
      smtpPort: tenant?.smtpPort,
      smtpUser: tenant?.smtpUser,
      smtpPass: tenant?.smtpPass,
      smtpFrom: tenant?.smtpFrom,
      listmonkUrl: tenant?.listmonkUrl,
      listmonkToken: tenant?.listmonkToken,
      listmonkListId: tenant?.listmonkListId
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateSettings = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  const { name, phone, aiProvider, aiApiKey, apolloApiKey, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, listmonkUrl, listmonkToken, listmonkListId } = req.body;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name,
        phone,
        aiProvider,
        aiApiKey,
        apolloApiKey,
        smtpHost,
        smtpPort: smtpPort ? parseInt(smtpPort) : null,
        smtpUser,
        smtpPass,
        smtpFrom,
        listmonkUrl,
        listmonkToken,
        listmonkListId
      }
    });
    res.json(tenant);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
