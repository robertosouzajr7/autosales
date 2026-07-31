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

    // Motor de IA é GLOBAL: a chave e o provedor são definidos pelo admin do
    // SaaS. O cliente só enxerga qual modelo está ativo — nunca a chave.
    const { DEFAULT_MODEL } = await import("../services/AIProviderService.js");
    const settings = await prisma.platformSettings
      .findUnique({ where: { id: "singleton" } })
      .catch(() => null);
    const activeProvider = (settings?.aiProvider || "GEMINI").toUpperCase();
    const activeModel = settings?.aiModel || DEFAULT_MODEL[activeProvider] || DEFAULT_MODEL.GEMINI;

    res.json({
      hasWhatsAppConnection,
      hasSdr,
      planFeatures,
      // Canal de WhatsApp do plano: a tela de Conexões esconde o que este
      // plano não permite, em vez de deixar o cliente tentar e tomar 403.
      whatsappMode: (tenant?.plan?.whatsappMode || "BOTH").toUpperCase(),
      companyName: tenant?.name,
      phone: tenant?.phone,
      // Modelo global ativo (somente leitura para o cliente).
      aiProvider: activeProvider,
      aiModel: activeModel,
      subscriptionStatus: tenant?.subscriptionStatus,
      trialEnd: tenant?.trialEnd,
      stripeSubscriptionId: tenant?.stripeSubscriptionId,
      planId: tenant?.planId,
      systemPrompt: tenant?.systemPrompt,
      webChatUrl: tenant?.webChatUrl,
      usedTokens: tenant?.usedTokens || 0,
      extraTokens: tenant?.extraTokens || 0,
      qualifiedLeadsCount: tenant?.qualifiedLeadsCount || 0,
      plan: tenant?.plan,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateSettings = async (req, res) => {
  const tenantId = req.tenantId;
  
  // A chave/provedor de IA são GLOBAIS (definidos pelo admin do SaaS), então
  // não aceitamos mais aiProvider/aiApiKey/openAiKey/elevenLabsKey do tenant.
  const {
    name, phone, systemPrompt, googleRefreshToken, webChatUrl,
  } = req.body;

  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name,
        phone,
        systemPrompt,
        webChatUrl,
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
