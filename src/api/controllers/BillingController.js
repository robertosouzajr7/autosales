import prisma from "../config/prisma.js";

// GET /api/billing/portal
export const getBillingPortalData = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
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
        usedProspects: tenant.usedProspects,
        usedResearch: tenant.usedResearch,
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

// POST /api/billing/pay-invoice/:invoiceId
export const payInvoiceMock = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  const { invoiceId } = req.params;
  const { cardHolder, cardNumber, cvv, expiry } = req.body;

  if (!cardHolder || !cardNumber || !cvv || !expiry) {
    return res.status(400).json({ error: "Dados do cartão incompletos" });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId }
    });

    if (!invoice) return res.status(404).json({ error: "Fatura não encontrada" });
    if (invoice.status === "PAID") return res.status(400).json({ error: "Fatura já está paga" });

    // Mock successful payment
    const paidInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "PAID",
        paidAt: new Date()
      }
    });

    // Update tenant subscription status and set next billing date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 30);

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: "ACTIVE",
        nextBillingDate: nextDate,
        // Reset monthly consumptions on billing cycle start
        usedTokens: 0,
        usedProspects: 0,
        usedResearch: 0,
        usedMessages: 0,
        lastUsageReset: new Date()
      },
      include: { plan: true }
    });

    // Create a financial record (Revenue) for the cash flow tracking
    await prisma.financialRecord.create({
      data: {
        description: `Mensalidade Plano ${tenant.plan?.name || "SaaS"} - Ref: Fatura #${invoiceId.slice(0,8)}`,
        amount: invoice.amount,
        type: "REVENUE",
        category: "Plano SaaS",
        dueDate: invoice.dueDate,
        paidAt: new Date(),
        tenantId: tenant.id
      }
    });

    res.json({ 
      success: true, 
      invoice: paidInvoice, 
      tenant: {
        subscriptionStatus: tenant.subscriptionStatus,
        nextBillingDate: tenant.nextBillingDate
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/billing/upgrade
export const upgradePlan = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
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
        usedProspects: 0,
        usedResearch: 0,
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
