import prisma from "../config/prisma.js";

export const getSettings = async (req, res) => {
  const tenantId = req.tenantId;
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
      subscriptionStatus: tenant?.subscriptionStatus,
      trialEnd: tenant?.trialEnd,
      stripeSubscriptionId: tenant?.stripeSubscriptionId,
      planId: tenant?.planId,
      systemPrompt: tenant?.systemPrompt,
      webChatUrl: tenant?.webChatUrl,
      usedTokens: tenant?.usedTokens || 0,
      qualifiedLeadsCount: tenant?.qualifiedLeadsCount || 0,
      plan: tenant?.plan,
      elevenLabsKey: tenant?.elevenLabsKey,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateSettings = async (req, res) => {
  const tenantId = req.tenantId;
  
  const {
    name, phone, aiProvider, aiApiKey, openAiKey,
    systemPrompt, googleRefreshToken, webChatUrl, elevenLabsKey,
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
        systemPrompt,
        webChatUrl,
        elevenLabsKey,
        // Só grava se veio um valor (o fluxo normal é via OAuth em /google/*).
        ...(typeof googleRefreshToken === "string" && googleRefreshToken.trim()
          ? { googleRefreshToken: googleRefreshToken.trim() }
          : {}),
      },
    });
    res.json(tenant);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
