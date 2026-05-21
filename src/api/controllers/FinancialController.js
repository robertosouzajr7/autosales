import prisma from "../config/prisma.js";

// GET /api/admin/financial/summary
export const getSummary = async (req, res) => {
  try {
    // Calculate MRR from active subscriptions
    const tenantsWithPlans = await prisma.tenant.findMany({
      where: { active: true, subscriptionStatus: "ACTIVE" },
      include: { plan: true }
    });
    
    const mrr = tenantsWithPlans.reduce((acc, tenant) => {
      return acc + (tenant.plan?.priceMonthly || 0);
    }, 0);

    // Sum of all paid revenues and expenses
    const records = await prisma.financialRecord.findMany();
    
    let totalRevenues = 0;
    let totalExpenses = 0;

    records.forEach(r => {
      // If it's paid, count it
      if (r.paidAt || r.type === "REVENUE") { // revenues count, expenses only if paid (or all for simple accounting)
        if (r.type === "REVENUE") {
          totalRevenues += r.amount;
        } else if (r.type === "EXPENSE") {
          totalExpenses += r.amount;
        }
      }
    });

    // Calculate actual operational costs for all clients
    const activeTenants = await prisma.tenant.findMany({
      include: { 
        plan: true,
        sdrs: { where: { active: true } }
      }
    });

    let totalClientOperationalCosts = 0;
    const clientCostsList = activeTenants.map(tenant => {
      if (!tenant.plan) return { tenantId: tenant.id, name: tenant.name, cost: 0 };
      
      const plan = tenant.plan;
      const sdrCost = tenant.sdrs.length * plan.sdrUnitCost;
      const tokenCost = (tenant.usedTokens / 1000) * plan.tokenUnitCost;
      const prospectCost = tenant.usedProspects * plan.prospectUnitCost;
      const researchCost = tenant.usedResearch * plan.researchUnitCost;
      const messageCost = tenant.usedMessages * plan.messageUnitCost;
      
      const totalCost = sdrCost + tokenCost + prospectCost + researchCost + messageCost;
      totalClientOperationalCosts += totalCost;

      return {
        tenantId: tenant.id,
        name: tenant.name,
        planName: plan.name,
        planPrice: plan.priceMonthly,
        usage: {
          sdrs: tenant.sdrs.length,
          tokens: tenant.usedTokens,
          prospects: tenant.usedProspects,
          research: tenant.usedResearch,
          messages: tenant.usedMessages
        },
        costs: {
          sdrs: sdrCost,
          tokens: tokenCost,
          prospects: prospectCost,
          research: researchCost,
          messages: messageCost
        },
        totalCost
      };
    });

    const netProfit = totalRevenues - totalExpenses - totalClientOperationalCosts;

    res.json({
      mrr,
      totalRevenues,
      totalExpenses,
      totalClientOperationalCosts,
      netProfit,
      clientCosts: clientCostsList
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/admin/financial/transactions
export const getTransactions = async (req, res) => {
  try {
    const transactions = await prisma.financialRecord.findMany({
      orderBy: { createdAt: "desc" },
      include: { tenant: { select: { name: true } } }
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/admin/financial/transactions
export const createTransaction = async (req, res) => {
  const { description, amount, type, category, isRecurring, frequency, dueDate, paidAt, tenantId } = req.body;
  
  if (!description || !amount || !type || !category) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes: description, amount, type, category" });
  }

  try {
    const record = await prisma.financialRecord.create({
      data: {
        description,
        amount: parseFloat(amount),
        type,
        category,
        isRecurring: isRecurring || false,
        frequency: isRecurring ? (frequency || "MONTHLY") : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        paidAt: paidAt ? new Date(paidAt) : null,
        tenantId: tenantId || null
      }
    });
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/admin/financial/transactions/:id
export const updateTransaction = async (req, res) => {
  const { id } = req.params;
  const { description, amount, type, category, isRecurring, frequency, dueDate, paidAt, tenantId } = req.body;

  try {
    const record = await prisma.financialRecord.update({
      where: { id },
      data: {
        description,
        amount: amount ? parseFloat(amount) : undefined,
        type,
        category,
        isRecurring,
        frequency: isRecurring ? frequency : null,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        paidAt: paidAt ? new Date(paidAt) : (paidAt === null ? null : undefined),
        tenantId: tenantId || undefined
      }
    });
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/admin/financial/transactions/:id
export const deleteTransaction = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.financialRecord.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
