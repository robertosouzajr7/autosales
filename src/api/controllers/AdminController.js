import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { audit } from "../services/AuditService.js";
import { MODEL_CATALOG } from "../services/AIProviderService.js";

export const getTenants = async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: { plan: true, _count: { select: { users: true } } }
    });
    res.json(tenants);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const getTenantDetail = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: { users: true, plan: true }
    });
    res.json(tenant);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// Criação de cliente pelo admin (a rota POST não existia — o botão
// "Novo Cliente" do painel apontava pro vazio).
export const createTenant = async (req, res) => {
  try {
    const { name, email, phone, cnpj, address, planId, adminName, adminPassword, trialDays } = req.body;
    if (!name || !email) return res.status(400).json({ error: "Nome e e-mail são obrigatórios." });

    const emailNormalized = String(email).trim().toLowerCase();
    const dupTenant = await prisma.tenant.findUnique({ where: { email: emailNormalized } });
    if (dupTenant) return res.status(409).json({ error: "Já existe um cliente com este e-mail." });

    const days = Number.isFinite(parseInt(trialDays)) ? parseInt(trialDays) : 7;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + days);

    const tenant = await prisma.tenant.create({
      data: {
        name,
        email: emailNormalized,
        phone,
        cnpj,
        address,
        planId: planId || null,
        subscriptionStatus: "TRIAL",
        trialEnd,
        nextBillingDate: trialEnd,
        acceptedTermsAt: new Date(),
      },
    });

    // Usuário OWNER inicial (opcional).
    let owner = null;
    if (adminName && adminPassword) {
      if (adminPassword.length < 8) {
        return res.status(400).json({ error: "Senha do administrador deve ter ao menos 8 caracteres." });
      }
      const dupUser = await prisma.user.findUnique({ where: { email: emailNormalized } });
      if (dupUser) return res.status(409).json({ error: "Já existe um usuário com este e-mail." });
      const hashed = await bcrypt.hash(adminPassword, 10);
      owner = await prisma.user.create({
        data: { name: adminName, email: emailNormalized, password: hashed, role: "OWNER", tenantId: tenant.id },
      });
    }

    await audit({ tenantId: tenant.id, actorId: req.userId, action: "TENANT_CREATED", entity: "Tenant", entityId: tenant.id });
    res.json({ tenant, owner: owner ? { id: owner.id, email: owner.email } : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updateTenant = async (req, res) => {
  try {
    const { name, email, phone, cnpj, address, planId, active, subscriptionStatus, trialEnd } = req.body;
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        name,
        email: email ? String(email).trim().toLowerCase() : undefined,
        phone,
        cnpj,
        address,
        planId,
        active,
        subscriptionStatus,
        trialEnd: trialEnd ? new Date(trialEnd) : undefined,
      },
    });
    await audit({
      tenantId: tenant.id, actorId: req.userId, action: "TENANT_UPDATED",
      entity: "Tenant", entityId: tenant.id, metadata: { planId, active, subscriptionStatus }
    });
    res.json(tenant);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteTenant = async (req, res) => {
  try {
    await prisma.tenant.delete({ where: { id: req.params.id } });
    await audit({ actorId: req.userId, action: "TENANT_DELETED", entity: "Tenant", entityId: req.params.id });
    res.json({ success: true });
  } catch (e) {
    if (e.code === "P2003" || e.code === "P2014") {
      return res.status(409).json({ error: "Não foi possível excluir: há dados vinculados a este cliente." });
    }
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }
    res.status(500).json({ error: e.message });
  }
};

export const createTenantUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Senha deve ter ao menos 8 caracteres." });
    }
    const emailNormalized = String(email).trim().toLowerCase();
    const dup = await prisma.user.findUnique({ where: { email: emailNormalized } });
    if (dup) return res.status(409).json({ error: "Este e-mail já está cadastrado em outra conta." });

    // Usuários de tenant nunca recebem SUPERADMIN, nem por rota administrativa.
    const safeRole = ["OWNER", "ADMIN", "AGENT"].includes(role) ? role : "AGENT";
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email: emailNormalized, password: hashedPassword, role: safeRole, tenantId: req.params.id }
    });
    const { password: _pw, ...safe } = user;
    res.json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteTenantUser = async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.userId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// Plan Management
export const getPlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany();
    res.json(plans);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createPlan = async (req, res) => {
  try {
    const plan = await prisma.plan.create({ data: req.body });
    res.json(plan);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updatePlan = async (req, res) => {
  try {
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data: req.body });
    await audit({ actorId: req.userId, action: "PLAN_UPDATED", entity: "Plan", entityId: plan.id });
    res.json(plan);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deletePlan = async (req, res) => {
  try {
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// Landing Page CMS
export const getLandingSettings = async (req, res) => {
  try {
    const settings = await prisma.landingPageSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" }
    });
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updateLandingSettings = async (req, res) => {
  try {
    const settings = await prisma.landingPageSettings.upsert({
      where: { id: "singleton" },
      update: req.body,
      create: { ...req.body, id: "singleton" }
    });
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ─── Configurações da plataforma (gateway de pagamento etc.) ────

function maskSecret(v) {
  if (!v) return null;
  return v.length <= 8 ? "••••" : `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

export const getPlatformSettings = async (_req, res) => {
  try {
    const s = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    res.json({
      paymentProvider: s.paymentProvider || "MERCADO_PAGO",
      defaultTrialDays: s.defaultTrialDays,
      // Segredos nunca voltam em claro — só máscara + flag de configurado.
      mpAccessTokenMasked: maskSecret(s.mpAccessToken || process.env.MP_ACCESS_TOKEN),
      mpConfigured: !!(s.mpAccessToken || process.env.MP_ACCESS_TOKEN),
      webhookSecretMasked: maskSecret(s.paymentWebhookSecret || process.env.PAYMENT_WEBHOOK_SECRET),
      webhookConfigured: !!(s.paymentWebhookSecret || process.env.PAYMENT_WEBHOOK_SECRET),
      stripeSecretMasked: maskSecret(s.stripeSecretKey || process.env.STRIPE_SECRET_KEY),
      stripeConfigured: !!(s.stripeSecretKey || process.env.STRIPE_SECRET_KEY),
      stripeWebhookMasked: maskSecret(s.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET),
      stripeWebhookConfigured: !!(s.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET),
      stripePublishableMasked: maskSecret(s.stripePublishableKey || process.env.STRIPE_PUBLISHABLE_KEY),
      stripePublishableConfigured: !!(s.stripePublishableKey || process.env.STRIPE_PUBLISHABLE_KEY),
      // Motor de IA (multi-provedor)
      aiProvider: s.aiProvider || "GEMINI",
      aiModel: s.aiModel || null,
      aiModelCatalog: MODEL_CATALOG,
      geminiKeyMasked: maskSecret(s.geminiApiKey || process.env.GEMINI_API_KEY),
      geminiKeyConfigured: !!(s.geminiApiKey || process.env.GEMINI_API_KEY),
      openaiKeyMasked: maskSecret(s.openaiApiKey || process.env.OPENAI_API_KEY),
      openaiKeyConfigured: !!(s.openaiApiKey || process.env.OPENAI_API_KEY),
      anthropicKeyMasked: maskSecret(s.anthropicApiKey || process.env.ANTHROPIC_API_KEY),
      anthropicKeyConfigured: !!(s.anthropicApiKey || process.env.ANTHROPIC_API_KEY),
      updatedAt: s.updatedAt,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updatePlatformSettings = async (req, res) => {
  try {
    const {
      paymentProvider, defaultTrialDays,
      mpAccessToken, paymentWebhookSecret,
      stripeSecretKey, stripeWebhookSecret, stripePublishableKey,
      aiProvider, aiModel, geminiApiKey, openaiApiKey, anthropicApiKey,
    } = req.body;
    const data = {};

    if (paymentProvider === "STRIPE" || paymentProvider === "MERCADO_PAGO") {
      data.paymentProvider = paymentProvider;
    }

    // Motor de IA: provedor precisa ser um dos suportados; modelo precisa
    // pertencer ao catálogo do provedor escolhido (ou vazio = default).
    if (["GEMINI", "OPENAI", "ANTHROPIC"].includes(aiProvider)) {
      data.aiProvider = aiProvider;
    }
    if (typeof aiModel === "string") {
      const prov = data.aiProvider || undefined;
      const catalog = prov ? MODEL_CATALOG[prov] : Object.values(MODEL_CATALOG).flat();
      if (aiModel.trim() === "") data.aiModel = null; // volta ao default
      else if (catalog.includes(aiModel.trim())) data.aiModel = aiModel.trim();
    }
    if (typeof geminiApiKey === "string" && geminiApiKey.trim()) data.geminiApiKey = geminiApiKey.trim();
    if (typeof openaiApiKey === "string" && openaiApiKey.trim()) data.openaiApiKey = openaiApiKey.trim();
    if (typeof anthropicApiKey === "string" && anthropicApiKey.trim()) data.anthropicApiKey = anthropicApiKey.trim();
    // Só sobrescreve segredo se veio valor novo (string não vazia).
    if (typeof mpAccessToken === "string" && mpAccessToken.trim()) data.mpAccessToken = mpAccessToken.trim();
    if (typeof paymentWebhookSecret === "string" && paymentWebhookSecret.trim()) data.paymentWebhookSecret = paymentWebhookSecret.trim();
    if (typeof stripeSecretKey === "string" && stripeSecretKey.trim()) data.stripeSecretKey = stripeSecretKey.trim();
    if (typeof stripeWebhookSecret === "string" && stripeWebhookSecret.trim()) data.stripeWebhookSecret = stripeWebhookSecret.trim();
    if (typeof stripePublishableKey === "string" && stripePublishableKey.trim()) data.stripePublishableKey = stripePublishableKey.trim();
    if (Number.isFinite(parseInt(defaultTrialDays))) data.defaultTrialDays = parseInt(defaultTrialDays);

    await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });
    await audit({ actorId: req.userId, action: "PLATFORM_SETTINGS_UPDATED", entity: "PlatformSettings", entityId: "singleton" });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ─── Relatórios do SaaS ─────────────────────────────────────────

export const getReports = async (_req, res) => {
  try {
    const now = new Date();

    const [tenants, invoices] = await Promise.all([
      prisma.tenant.findMany({
        select: {
          id: true, name: true, createdAt: true, active: true,
          subscriptionStatus: true, trialEnd: true,
          usedTokens: true, usedMessages: true,
          plan: { select: { name: true, priceMonthly: true } },
        },
      }),
      prisma.invoice.findMany({
        where: { status: "PAID" },
        select: { amount: true, paidAt: true },
      }),
    ]);

    // MRR: soma dos planos de tenants ATIVOS.
    const mrr = tenants
      .filter((t) => t.active && t.subscriptionStatus === "ACTIVE")
      .reduce((acc, t) => acc + (t.plan?.priceMonthly || 0), 0);

    // Contagem por status de assinatura.
    const byStatus = {};
    for (const t of tenants) {
      const s = t.active === false ? "SUSPENDED" : (t.subscriptionStatus || "TRIAL");
      byStatus[s] = (byStatus[s] || 0) + 1;
    }

    // Cadastros e receita paga por mês (últimos 6 meses).
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        month: key,
        signups: tenants.filter((t) => {
          const c = new Date(t.createdAt);
          return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
        }).length,
        revenue: invoices
          .filter((inv) => {
            if (!inv.paidAt) return false;
            const p = new Date(inv.paidAt);
            return p.getFullYear() === d.getFullYear() && p.getMonth() === d.getMonth();
          })
          .reduce((acc, inv) => acc + inv.amount, 0),
      });
    }

    // Trials expirando nos próximos 7 dias (oportunidade de conversão).
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringTrials = tenants
      .filter((t) => t.subscriptionStatus === "TRIAL" && t.trialEnd && new Date(t.trialEnd) > now && new Date(t.trialEnd) <= in7days)
      .map((t) => ({ id: t.id, name: t.name, trialEnd: t.trialEnd, plan: t.plan?.name }));

    // Top consumidores (tokens) — sinal de engajamento ou de custo.
    const topUsage = [...tenants]
      .sort((a, b) => (b.usedTokens || 0) - (a.usedTokens || 0))
      .slice(0, 5)
      .map((t) => ({ id: t.id, name: t.name, usedTokens: t.usedTokens || 0, usedMessages: t.usedMessages || 0, plan: t.plan?.name }));

    const totalPaidRevenue = invoices.reduce((acc, inv) => acc + inv.amount, 0);

    res.json({ mrr, byStatus, months, expiringTrials, topUsage, totalPaidRevenue, totalTenants: tenants.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
