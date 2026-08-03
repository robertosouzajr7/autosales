import prisma from "../config/prisma.js";
import { DEFAULT_RATES_USD, unitPricing, planCampaignCost } from "../services/WhatsAppPricingService.js";

function safeJson(v) { try { return JSON.parse(v); } catch { return null; } }

/** Tarifas efetivas: padrão da Meta sobrescrito pelo que o admin definiu. */
function waRatesOf(s) {
  const custom = safeJson(s?.waRates) || {};
  const out = {};
  // SERVICE entra na lista porque a Meta passa a cobrar a partir de
  // outubro/2026: o campo já existe zerado, e no dia é só preencher.
  for (const k of ["MARKETING", "UTILITY", "AUTHENTICATION", "SERVICE"]) {
    out[k] = typeof custom[k] === "number" ? custom[k] : DEFAULT_RATES_USD[k];
  }
  return out;
}
import bcrypt from "bcryptjs";
import { audit } from "../services/AuditService.js";
import {
  MODEL_CATALOG, DEFAULT_MODEL, estimateCostBRL,
  modelCostBRLPer1M, buildPricingCatalog, DEFAULT_USD_BRL,
} from "../services/AIProviderService.js";

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
      include: {
        // Nunca devolver o hash da senha para a tela — nem para o superadmin.
        users: {
          select: { id: true, name: true, email: true, role: true, active: true, jobTitle: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
        plan: true,
      },
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
        // Conta aberta pela equipe da plataforma: não há e-mail de
        // confirmação neste caminho, então já nasce liberada.
        data: { name: adminName, email: emailNormalized, password: hashed, role: "OWNER", tenantId: tenant.id, emailVerified: true },
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

/**
 * Acesso de emergência para o suporte.
 *
 * A gestão de colaboradores é do próprio cliente (tela Colaboradores) — ter
 * o mesmo cadastro aqui só criava dois lugares para a mesma coisa, com
 * regras diferentes. O que sobra é o caso que o cliente não consegue
 * resolver sozinho: a conta ficou sem nenhum administrador ativo. Fora
 * disso, a rota recusa.
 */
export const createTenantUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Senha deve ter ao menos 8 caracteres." });
    }

    const admins = await prisma.user.count({
      where: { tenantId: req.params.id, role: { in: ["OWNER", "ADMIN"] }, active: true },
    });
    if (admins > 0) {
      return res.status(409).json({
        error: "Este cliente já tem administrador ativo. Os colaboradores são cadastrados pelo próprio cliente, em Colaboradores.",
      });
    }

    const emailNormalized = String(email).trim().toLowerCase();
    const dup = await prisma.user.findUnique({ where: { email: emailNormalized } });
    if (dup) return res.status(409).json({ error: "Este e-mail já está cadastrado em outra conta." });

    // Usuários de tenant nunca recebem SUPERADMIN, nem por rota administrativa.
    const safeRole = role === "OWNER" ? "OWNER" : "ADMIN";
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email: emailNormalized, password: hashedPassword, role: safeRole, tenantId: req.params.id, emailVerified: true }
    });
    await audit({
      tenantId: req.params.id, actorId: req.userId,
      action: "TENANT_ADMIN_RESTORED", entity: "User", entityId: user.id,
    });
    const { password: _pw, ...safe } = user;
    res.json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// Plan Management
export const getPlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany();
    res.json(plans);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/** Categoria de disparo válida — é ela que define a tarifa da franquia. */
const CATEGORIAS_DISPARO = ["MARKETING", "UTILITY", "AUTHENTICATION"];
const MODOS_WHATSAPP = ["OFFICIAL", "BAILEYS", "BOTH"];
function normalizarPlano(body) {
  const data = { ...body };
  if (data.whatsappMode !== undefined) {
    const m = String(data.whatsappMode).toUpperCase();
    if (!MODOS_WHATSAPP.includes(m)) delete data.whatsappMode;
    else data.whatsappMode = m;
  }
  return data;
}

export const createPlan = async (req, res) => {
  try {
    const plan = await prisma.plan.create({ data: normalizarPlano(req.body) });
    res.json(plan);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updatePlan = async (req, res) => {
  try {
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data: normalizarPlano(req.body) });
    await audit({ actorId: req.userId, action: "PLAN_UPDATED", entity: "Plan", entityId: plan.id });
    res.json(plan);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Leads da plataforma (quem pediu o diagnóstico na landing) ──────────

const STATUS_LEAD = ["NOVO", "EM_CONTATO", "CONVERTIDO", "DESCARTADO"];

export const getPlatformLeads = async (req, res) => {
  try {
    const { status, q } = req.query || {};
    const where = {};
    if (STATUS_LEAD.includes(String(status || "").toUpperCase())) {
      where.status = String(status).toUpperCase();
    }
    if (q) {
      const busca = String(q).trim();
      where.OR = [
        { name: { contains: busca, mode: "insensitive" } },
        { email: { contains: busca, mode: "insensitive" } },
        { phone: { contains: busca } },
      ];
    }

    const leads = await prisma.platformLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    // O que ele respondeu vale mais que o registro cru: o vendedor abre a
    // conversa sabendo o volume e a equipe do cliente.
    const enriquecidos = leads.map((l) => ({
      ...l,
      respostas: (() => { try { return l.respostas ? JSON.parse(l.respostas) : null; } catch { return null; } })(),
    }));

    const porStatus = await prisma.platformLead.groupBy({ by: ["status"], _count: true });
    res.json({
      leads: enriquecidos,
      total: leads.length,
      resumo: Object.fromEntries(porStatus.map((r) => [r.status, r._count])),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updatePlatformLead = async (req, res) => {
  try {
    const data = {};
    if (req.body?.status !== undefined) {
      const st = String(req.body.status).toUpperCase();
      if (!STATUS_LEAD.includes(st)) return res.status(400).json({ error: "Status inválido." });
      data.status = st;
    }
    if (req.body?.notes !== undefined) data.notes = String(req.body.notes).slice(0, 2000);

    const lead = await prisma.platformLead.update({ where: { id: req.params.id }, data });
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deletePlatformLead = async (req, res) => {
  try {
    await prisma.platformLead.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/**
 * Leva o lead para a base de contatos do próprio SaaS — e, se vier um
 * estágio, para o funil também.
 *
 * Passa pelo CDP (resolveContact) de propósito: se esse e-mail ou telefone já
 * existe na base, ele atualiza em vez de criar um segundo contato, exatamente
 * como qualquer outra entrada.
 */
export const importPlatformLead = async (req, res) => {
  try {
    const { resolveContact } = await import("../services/ContactIdentity.js");
    const { stageId } = req.body || {};
    const platformLead = await prisma.platformLead.findUnique({ where: { id: req.params.id } });
    if (!platformLead) return res.status(404).json({ error: "Lead não encontrado." });

    // O tenant vem do token, mas token antigo pode não trazê-lo; o usuário
    // carregado sempre traz. Sem isto o import morria com "exige tenantId".
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Sua conta de administrador não está ligada a nenhum negócio — entre de novo para importar." });
    }

    const { lead, criado } = await resolveContact(tenantId, {
      name: platformLead.name,
      email: platformLead.email,
      phone: platformLead.phone,
      source: "LANDING_DIAGNOSTICO",
    });

    // O que ele respondeu vira anotação do contato: quem for atender já abre
    // a conversa sabendo o volume, a equipe e o canal que ele usa.
    // Reimportar não pode empilhar a mesma anotação: quem clica duas vezes
    // (ou reimporta depois de atualizar o status) merece o mesmo resultado.
    const anotacao = montarAnotacao(platformLead);
    const dados = {};
    if (!String(lead.notes || "").includes(anotacao)) {
      dados.notes = [lead.notes, anotacao].filter(Boolean).join("\n\n").slice(0, 4000);
    }
    if (stageId) dados.stageId = stageId;
    if (Object.keys(dados).length) await prisma.lead.update({ where: { id: lead.id }, data: dados });

    await prisma.platformLead.update({
      where: { id: platformLead.id },
      data: { importedLeadId: lead.id, importedAt: new Date(), status: platformLead.status === "NOVO" ? "EM_CONTATO" : platformLead.status },
    });

    res.json({ success: true, leadId: lead.id, criado, noFunil: !!stageId });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

function montarAnotacao(pl) {
  const linhas = [`Veio do diagnóstico da landing em ${new Date(pl.createdAt).toLocaleDateString("pt-BR")}.`];
  let r = null;
  try { r = pl.respostas ? JSON.parse(pl.respostas) : null; } catch { /* sem respostas */ }
  if (r) {
    if (r.conversas) linhas.push(`Volume declarado: ~${Number(r.conversas).toLocaleString("pt-BR")} conversas/mês.`);
    if (r.colaboradores) linhas.push(`Equipe: ${r.colaboradores} pessoa(s).`);
    if (Array.isArray(r.canais) && r.canais.length) linhas.push(`Canais: ${r.canais.join(", ")}.`);
    if (r.numeros) linhas.push(`Números: ${r.numeros}.`);
    if (r.disparos) linhas.push(`Disparos: ${Number(r.disparos).toLocaleString("pt-BR")}/mês.`);
  }
  if (pl.planoQrCode || pl.planoOficial) {
    linhas.push(`Recomendado: ${[pl.planoQrCode && `QR Code — ${pl.planoQrCode}`, pl.planoOficial && `oficial — ${pl.planoOficial}`].filter(Boolean).join(" | ")}.`);
  }
  return linhas.join("\n");
}

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
      // Precificação de tokens
      usdToBrl: s.usdToBrl ?? DEFAULT_USD_BRL,
      tokenMarkup: s.tokenMarkup ?? 5.0,
      // Tarifas do WhatsApp: devolve o efetivo (padrão + override do admin).
      waRates: waRatesOf(s),
      waMarkup: s.waMarkup ?? 2.0,
      baileysNumberCost: s.baileysNumberCost ?? 0,
      // Motor de VOZ (global): provedor, chave mascarada e vozes liberadas
      voiceProvider: s.voiceProvider || "GEMINI",
      elevenLabsKeyMasked: maskSecret(s.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY),
      elevenLabsKeyConfigured: !!(s.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY),
      enabledVoices: (() => { try { return s.enabledVoices ? JSON.parse(s.enabledVoices) : []; } catch { return []; } })(),
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
      usdToBrl, tokenMarkup, waRates, waMarkup, baileysNumberCost,
      voiceProvider, elevenLabsApiKey, enabledVoices,
    } = req.body;
    const data = {};

    // Motor de VOZ (global, igual à LLM): provedor, chave e vozes liberadas.
    if (["GEMINI", "ELEVENLABS"].includes(voiceProvider)) data.voiceProvider = voiceProvider;
    if (typeof elevenLabsApiKey === "string" && elevenLabsApiKey.trim()) {
      data.elevenLabsApiKey = elevenLabsApiKey.trim();
    }
    if (Array.isArray(enabledVoices)) {
      // Guarda só {id, name} — o cliente escolhe entre estas.
      const clean = enabledVoices
        .filter((v) => v && v.id)
        .map((v) => ({ id: String(v.id), name: String(v.name || v.id) }));
      data.enabledVoices = JSON.stringify(clean);
    }

    // Precificação: câmbio > 0 e markup >= 1 (não vender abaixo do custo).
    if (usdToBrl !== undefined && Number.isFinite(parseFloat(usdToBrl)) && parseFloat(usdToBrl) > 0) {
      data.usdToBrl = parseFloat(usdToBrl);
    }
    if (waMarkup !== undefined && Number.isFinite(parseFloat(waMarkup)) && parseFloat(waMarkup) >= 1) {
      data.waMarkup = parseFloat(waMarkup);
    }
    if (baileysNumberCost !== undefined && Number.isFinite(parseFloat(baileysNumberCost)) && parseFloat(baileysNumberCost) >= 0) {
      data.baileysNumberCost = parseFloat(baileysNumberCost);
    }
    if (waRates !== undefined) {
      // Guarda só as categorias conhecidas com número válido — evita gravar
      // lixo que depois derrubaria a projeção de custo. E parte do que já
      // estava salvo: mandar só uma categoria não pode apagar as outras,
      // que é o que acontecia e devolvia a tarifa padrão sem ninguém pedir.
      const atual = safeJson((await prisma.platformSettings.findUnique({
        where: { id: "singleton" }, select: { waRates: true },
      }).catch(() => null))?.waRates) || {};

      const limpo = { ...atual };
      const origem = typeof waRates === "string" ? safeJson(waRates) : waRates;
      for (const k of ["MARKETING", "UTILITY", "AUTHENTICATION", "SERVICE"]) {
        const v = parseFloat(origem?.[k]);
        if (Number.isFinite(v) && v >= 0) limpo[k] = v;
      }
      data.waRates = Object.keys(limpo).length ? JSON.stringify(limpo) : null;
    }
    if (tokenMarkup !== undefined && Number.isFinite(parseFloat(tokenMarkup)) && parseFloat(tokenMarkup) >= 1) {
      data.tokenMarkup = parseFloat(tokenMarkup);
    }

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

// GET /api/admin/voices
// Lista as vozes do provedor de voz ativo (ElevenLabs via chave global, ou o
// catálogo do Gemini) para o admin escolher quais liberar às contas.
export const getProviderVoices = async (_req, res) => {
  try {
    const { default: VoiceService } = await import("../services/VoiceService.js");
    const result = await VoiceService.listProviderVoices();
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ─── Precificação de tokens (custo real por modelo) ─────────────

// GET /api/admin/token-pricing
// Base para o cálculo automático de custo em planos e pacotes: modelo ativo,
// câmbio, markup padrão, custo do modelo ativo (BRL/1M) e catálogo completo.
export const getTokenPricing = async (_req, res) => {
  try {
    const s = await prisma.platformSettings.findUnique({ where: { id: "singleton" } }).catch(() => null);
    const activeProvider = (s?.aiProvider || "GEMINI").toUpperCase();
    const activeModel = s?.aiModel || DEFAULT_MODEL[activeProvider] || DEFAULT_MODEL.GEMINI;
    const usdToBrl = s?.usdToBrl ?? DEFAULT_USD_BRL;
    const tokenMarkup = s?.tokenMarkup ?? 5.0;

    // O custo de disparo vai junto: a tela de planos precisa somar IA +
    // WhatsApp para saber se o preço cobre o custo da franquia inteira.
    const disparo = await unitPricing();

    res.json({
      activeProvider,
      activeModel,
      usdToBrl,
      tokenMarkup,
      activeModelCostBRLPer1M: Number(modelCostBRLPer1M(activeModel, usdToBrl).toFixed(4)),
      catalog: buildPricingCatalog(usdToBrl),
      // Disparo em massa (WhatsApp): tarifa por categoria e margem aplicada.
      waMarkup: disparo.markup,
      waUnit: disparo.categorias,
      // Canal QR Code: não tem custo por mensagem, tem custo por número.
      baileysNumberCost: s?.baileysNumberCost ?? 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ─── Pacotes de tokens (recarga) ────────────────────────────────

export const getTokenPackages = async (_req, res) => {
  try {
    const packages = await prisma.tokenPackage.findMany({ orderBy: { price: "asc" } });
    res.json(packages);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const TIPOS_PACOTE = ["TOKENS", "DISPARO"];

export const createTokenPackage = async (req, res) => {
  try {
    const { name, tokens, creditsBrl, price, active } = req.body;
    const tipo = TIPOS_PACOTE.includes(String(req.body?.tipo).toUpperCase())
      ? String(req.body.tipo).toUpperCase()
      : "TOKENS";
    if (!name || !Number.isFinite(parseFloat(price))) {
      return res.status(400).json({ error: "Nome e preço são obrigatórios." });
    }
    // Pacote que não concede nada é pacote que o cliente compra e não recebe.
    const qtdTokens = parseInt(tokens) || 0;
    const qtdCredito = parseFloat(creditsBrl) || 0;
    if (tipo === "TOKENS" && qtdTokens <= 0) {
      return res.status(400).json({ error: "Informe quantos tokens o pacote concede." });
    }
    if (tipo === "DISPARO" && qtdCredito <= 0) {
      return res.status(400).json({ error: "Informe quanto de crédito de disparo o pacote concede." });
    }

    const pack = await prisma.tokenPackage.create({
      data: {
        name: String(name).trim(),
        tipo,
        tokens: tipo === "TOKENS" ? qtdTokens : 0,
        creditsBrl: tipo === "DISPARO" ? qtdCredito : 0,
        price: parseFloat(price),
        active: active !== false,
      },
    });
    res.json(pack);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updateTokenPackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, tokens, creditsBrl, price, active } = req.body;
    const data = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (TIPOS_PACOTE.includes(String(req.body?.tipo).toUpperCase())) {
      data.tipo = String(req.body.tipo).toUpperCase();
    }
    if (Number.isFinite(parseInt(tokens))) data.tokens = parseInt(tokens);
    if (Number.isFinite(parseFloat(creditsBrl))) data.creditsBrl = parseFloat(creditsBrl);
    if (Number.isFinite(parseFloat(price))) data.price = parseFloat(price);
    if (typeof active === "boolean") data.active = active;
    const pack = await prisma.tokenPackage.update({ where: { id }, data });
    res.json(pack);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteTokenPackage = async (req, res) => {
  try {
    await prisma.tokenPackage.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ─── Relatórios do SaaS ─────────────────────────────────────────

export const getReports = async (_req, res) => {
  try {
    const now = new Date();

    const [tenants, invoices, settings] = await Promise.all([
      prisma.tenant.findMany({
        select: {
          id: true, name: true, email: true, createdAt: true, active: true,
          subscriptionStatus: true, trialEnd: true,
          usedTokens: true, extraTokens: true, usedMessages: true,
          usedConversations: true, usedCampaignMessages: true,
          usedServiceMessages: true, usedCostBrl: true,
          plan: {
            select: {
              name: true, priceMonthly: true, maxTokens: true,
              maxConversations: true, campaignCreditsBrl: true,
            },
          },
        },
      }),
      prisma.invoice.findMany({
        where: { status: "PAID" },
        select: { amount: true, paidAt: true },
      }),
      prisma.platformSettings.findUnique({ where: { id: "singleton" } }).catch(() => null),
    ]);

    // Modelo de IA ativo (global) → base do custo estimado por conta.
    const activeProvider = (settings?.aiProvider || "GEMINI").toUpperCase();
    const activeModel = settings?.aiModel || DEFAULT_MODEL[activeProvider] || DEFAULT_MODEL.GEMINI;
    const usdToBrl = settings?.usdToBrl ?? DEFAULT_USD_BRL;
    const tokenCost = (tokens) => estimateCostBRL(tokens || 0, activeModel, usdToBrl);

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

    // Consumo de IA por conta (tokens usados no ciclo + custo estimado em BRL).
    const accountsUsage = [...tenants]
      .map((t) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        plan: t.plan?.name || "—",
        status: t.active === false ? "SUSPENDED" : (t.subscriptionStatus || "TRIAL"),
        usedTokens: t.usedTokens || 0,
        planTokens: t.plan?.maxTokens || 0,
        extraTokens: t.extraTokens || 0,
        usedMessages: t.usedMessages || 0,
        // Consumo que o plano limita, para ver quem está perto do teto.
        usedConversations: t.usedConversations || 0,
        planConversations: t.plan?.maxConversations || 0,
        usedCampaignMessages: t.usedCampaignMessages || 0,
        planCampaignCreditsBrl: t.plan?.campaignCreditsBrl || 0,
        usedServiceMessages: t.usedServiceMessages || 0,
        // Custo total = IA (calculado dos tokens) + o que foi medido em
        // disparo e serviço. Sem somar os dois, a margem por conta mentia.
        costBRL: Number((tokenCost(t.usedTokens) + (t.usedCostBrl || 0)).toFixed(2)),
        costAiBRL: Number(tokenCost(t.usedTokens).toFixed(2)),
        costWhatsappBRL: Number((t.usedCostBrl || 0).toFixed(2)),
        priceBRL: Number(t.plan?.priceMonthly || 0),
      }))
      .map((a) => ({
        ...a,
        // Margem da conta no ciclo: o que ela paga menos o que ela custa.
        marginBRL: Number((a.priceBRL - a.costBRL).toFixed(2)),
        marginPct: a.priceBRL > 0 ? Math.round(((a.priceBRL - a.costBRL) / a.priceBRL) * 100) : 0,
      }))
      .sort((a, b) => b.costBRL - a.costBRL);

    const topUsage = accountsUsage.slice(0, 5);
    const totalTokenCostBRL = Number(
      accountsUsage.reduce((acc, a) => acc + a.costBRL, 0).toFixed(2)
    );

    const totalPaidRevenue = invoices.reduce((acc, inv) => acc + inv.amount, 0);

    res.json({
      mrr, byStatus, months, expiringTrials, topUsage, totalPaidRevenue,
      totalTenants: tenants.length,
      aiModel: activeModel, aiProvider: activeProvider,
      totalTokenCostBRL, accountsUsage,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
