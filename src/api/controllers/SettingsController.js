import prisma from "../config/prisma.js";

export const getSettings = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true, whatsappAccounts: true, sdrs: true }
    });
    
    const hasWhatsAppConnection = tenant?.whatsappAccounts?.some(acc => acc.status === 'CONNECTED') || false;
    const hasSdr = (tenant?.sdrs?.length || 0) > 0;
    
    let planFeatures = {};
    if (tenant?.plan?.features) {
      try {
        planFeatures = JSON.parse(tenant.plan.features);
      } catch(e) {}
    }
    res.json({
      hasWhatsAppConnection,
      hasSdr,
      planFeatures,
      companyName: tenant?.name,
      phone: tenant?.phone,
      aiProvider: tenant?.aiProvider,
      aiApiKey: tenant?.aiApiKey,
      openAiKey: tenant?.openAiKey,
      apolloApiKey: tenant?.apolloApiKey,
      snovClientId: tenant?.snovClientId,
      snovClientSecret: tenant?.snovClientSecret,
      systemPrompt: tenant?.systemPrompt,
      webChatUrl: tenant?.webChatUrl,
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
      listmonkListId: tenant?.listmonkListId,
      elevenLabsKey: tenant?.elevenLabsKey
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateSettings = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  console.log(`[Settings] Updating tenant ${tenantId}. Body:`, req.body);
  
  const { 
    name, phone, aiProvider, aiApiKey, openAiKey, 
    systemPrompt, googleRefreshToken, webChatUrl,
    apolloApiKey, snovClientId, snovClientSecret,
    smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom,
    listmonkUrl, listmonkToken, listmonkListId, elevenLabsKey
  } = req.body;
  
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name,
        phone,
        aiProvider,
        aiApiKey,
        openAiKey,
        apolloApiKey,
        snovClientId,
        snovClientSecret,
        systemPrompt,
        webChatUrl,
        smtpHost,
        smtpPort: smtpPort ? parseInt(smtpPort) : null,
        smtpUser,
        smtpPass,
        smtpFrom,
        listmonkUrl,
        listmonkToken,
        listmonkListId,
        elevenLabsKey
      }
    });
    res.json(tenant);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
