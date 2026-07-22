import prisma from "../config/prisma.js";
import PaymentService from "../services/PaymentService.js";

// GET /api/billing/portal
export const getBillingPortalData = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { 
        plan: true,
        invoices: { orderBy: { createdAt: "desc" } }
      }
    });

    if (!tenant) return res.status(404).json({ error: "Tenant não localizado" });

    // Active SDR count
    const activeSdrs = await prisma.sdrBot.count({
      where: { tenantId, active: true }
    });

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        subscriptionStatus: tenant.subscriptionStatus,
        nextBillingDate: tenant.nextBillingDate,
        usedTokens: tenant.usedTokens,
        usedMessages: tenant.usedMessages,
        activeSdrs
      },
      plan: tenant.plan,
      invoices: tenant.invoices
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/billing/plans
export const getActivePlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { priceMonthly: "asc" }
    });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/billing/checkout/:invoiceId
// Inicia o checkout HOSPEDADO do gateway e devolve a URL. O backend nunca
// recebe dados de cartão; a fatura só vira PAID pelo webhook do gateway.
export const createCheckoutSession = async (req, res) => {
  const tenantId = req.tenantId;
  const { invoiceId } = req.params;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId }
    });

    if (!invoice) return res.status(404).json({ error: "Fatura não encontrada" });
    if (invoice.status === "PAID") return res.status(400).json({ error: "Fatura já está paga" });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const { checkoutUrl, gatewayId } = await PaymentService.createCheckout(tenant, invoice);

    res.json({ success: true, checkoutUrl, gatewayId });
  } catch (error) {
    console.error("[Billing] Erro ao criar checkout:", error.message);
    res.status(500).json({ error: "Não foi possível iniciar o pagamento." });
  }
};

// POST /api/billing/subscribe
// Cria uma sessão de checkout EMBUTIDO (assinatura + trial). Devolve o
// clientSecret e a publishable key para o Stripe montar o formulário na
// própria página (checkout transparente). Autenticado.
export const createSubscriptionCheckout = async (req, res) => {
  const tenantId = req.tenantId;
  const { planId } = req.body;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID ausente" });
  if (!planId) return res.status(400).json({ error: "ID do plano é obrigatório" });

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: "Tenant não localizado" });

    const plan = await prisma.plan.findFirst({ where: { id: planId, active: true } });
    if (!plan) return res.status(404).json({ error: "Plano não localizado" });

    const frontend = process.env.FRONTEND_URL || "http://localhost:8080";
    const { clientSecret, publishableKey } = await PaymentService.createSubscriptionCheckout(
      tenant,
      plan,
      frontend
    );
    res.json({ clientSecret, publishableKey });
  } catch (error) {
    console.error("[Billing] Erro ao criar assinatura:", error.message);
    res.status(500).json({ error: error.message || "Não foi possível iniciar o checkout." });
  }
};

// POST /api/billing/upgrade
export const upgradePlan = async (req, res) => {
  const tenantId = req.tenantId;
  const { planId } = req.body;

  if (!planId) return res.status(400).json({ error: "ID do plano é obrigatório" });

  try {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ error: "Plano não localizado" });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true }
    });

    if (!tenant) return res.status(404).json({ error: "Tenant não localizado" });

    // Validate active SDRs count doesn't exceed new plan limits (in case of downgrade or tight limits)
    const activeSdrs = await prisma.sdrBot.count({
      where: { tenantId, active: true }
    });

    if (activeSdrs > plan.maxSdrs) {
      return res.status(400).json({ 
        error: `Você possui ${activeSdrs} SDRs ativos, mas o novo plano permite no máximo ${plan.maxSdrs}. Desative alguns SDRs antes de prosseguir.` 
      });
    }

    // Immediately change the plan
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId: plan.id,
        subscriptionStatus: "ACTIVE",
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        // Reset usage stats for the new billing cycle
        usedTokens: 0,
        usedMessages: 0,
        lastUsageReset: new Date()
      }
    });

    // Generate immediate invoice for the new plan
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: tenantId,
        amount: plan.priceMonthly,
        status: "PENDING",
        dueDate: new Date() // due today
      }
    });

    res.json({
      success: true,
      message: `Plano atualizado para ${plan.name} com sucesso. Uma fatura foi gerada para pagamento.`,
      tenant: updatedTenant,
      invoice
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
