import express from "express";
import * as LeadController from "../controllers/LeadController.js";
import * as BulkController from "../controllers/BulkController.js";
import * as SettingsController from "../controllers/SettingsController.js";
import * as StatsController from "../controllers/StatsController.js";
import * as UserController from "../controllers/UserController.js";
import * as PipelineController from "../controllers/PipelineController.js";
import * as ICPController from "../controllers/ICPController.js";
import * as AuthController from "../controllers/AuthController.js";
import { authMiddleware, adminMiddleware } from "../middlewares/auth.js";
import { requireActiveSubscription } from "../middlewares/subscription.js";
import * as AdminController from "../controllers/AdminController.js";
import * as GoogleCalendarController from "../controllers/GoogleCalendarController.js";
import * as MetaOAuthController from "../controllers/MetaOAuthController.js";
import * as AppointmentController from "../controllers/AppointmentController.js";
import * as WhatsAppController from "../controllers/WhatsAppController.js";
import * as AutomationController from "../controllers/AutomationController.js";
import * as SdrController from "../controllers/SdrController.js";
import * as MessageController from "../controllers/MessageController.js";
import * as AttendanceController from "../controllers/AttendanceController.js";
import * as TemplateController from "../controllers/TemplateController.js";
import * as CampaignController from "../controllers/CampaignController.js";
import * as AcademyController from "../controllers/AcademyController.js";
import * as ContactController from "../controllers/ContactController.js";
import * as FinancialController from "../controllers/FinancialController.js";
import * as BillingController from "../controllers/BillingController.js";
import BillingService from "../services/BillingService.js";
import * as ComplianceController from "../controllers/ComplianceController.js";
import * as BusinessController from "../controllers/BusinessController.js";
import * as ProductController from "../controllers/ProductController.js";
import { listVerticalTemplates } from "../services/VerticalTemplates.js";
import { listFunctions, SKILLS } from "../services/AgentFunctions.js";
import { loadUser, requirePermission, requireTenantAdmin, requireVerifiedEmail } from "../middlewares/permissions.js";
import * as PublicApiController from "../controllers/PublicApiController.js";
import * as IntegrationController from "../controllers/IntegrationController.js";
import { apiKeyMiddleware, requireScope } from "../middlewares/apiKey.js";
import {
  requireCalendar,
  requireAutomations,
  requireWebhooks,
  requireWhatsAppSlot,
  requireWhatsAppMode,
  requireUserSlot,
} from "../middlewares/planLimits.js";

import { receberArquivo } from "../middlewares/upload.js";
import * as AwayController from "../controllers/AwayController.js";

const router = express.Router();

// Public / Auth
router.post("/auth/login", AuthController.login);
router.post("/auth/register", AuthController.register);
router.post("/auth/verify-email", AuthController.verifyEmail);
router.post("/auth/resend-verification", AuthController.resendVerification);
router.post("/auth/forgot-password", AuthController.forgotPassword);
router.post("/auth/reset-password", AuthController.resetPassword);
// Endpoints legados
router.post("/auth/send-code", AuthController.sendCode);
router.post("/auth/verify-code", AuthController.verifyCode);

// Google Calendar OAuth callback — PÚBLICO (o Google redireciona sem header
// Authorization; a identidade do tenant vem no "state" assinado).
// Caminho casa com GOOGLE_REDIRECT_URI (…/api/auth/google/callback).
router.get("/auth/google/callback", GoogleCalendarController.handleCallback);

// Meta (Instagram) OAuth callbacks — PÚBLICOS, mesma lógica do Google.
// /auth/meta/callback: Facebook Login (páginas) · /auth/instagram/callback:
// Instagram Login nativo (produto "API do Instagram com login do Instagram").
router.get("/auth/meta/callback", MetaOAuthController.handleCallback);
router.get("/auth/instagram/callback", MetaOAuthController.handleInstagramCallback);

// Webhook de CRM — público: quem chama é o RD Station, não o navegador.
// A conexão é identificada pelo id na URL.
router.post("/webhooks/crm/:connectionId", IntegrationController.crmWebhook);

// ── API pública de contatos (v1) ────────────────────────────────────
// Autenticada por chave de API, não por sessão: é o CRM do cliente que
// chama. Fica ANTES do authMiddleware justamente por isso.
const v1 = express.Router();
v1.use(apiKeyMiddleware);
v1.get("/contacts", requireScope("contacts:read"), PublicApiController.listContacts);
v1.get("/contacts/:id", requireScope("contacts:read"), PublicApiController.getContact);
v1.post("/contacts", requireScope("contacts:write"), PublicApiController.upsertContact);
v1.post("/contacts/batch", requireScope("contacts:write"), PublicApiController.upsertBatch);
v1.delete("/contacts/:id", requireScope("contacts:write"), PublicApiController.optOutContact);
router.use("/v1", v1);

// Protected Routes (Tenant context)
router.use(authMiddleware);
// Carrega o colaborador, barra quem foi desativado e resolve as permissões.
router.use(loadUser);
// E-mail não confirmado: navega e lê, mas não opera.
router.use(requireVerifiedEmail);

// Google Calendar (conexão da agenda)
router.get("/google/status", GoogleCalendarController.getStatus);
router.get("/google/auth-url", GoogleCalendarController.getAuthUrl);
router.post("/google/disconnect", GoogleCalendarController.disconnect);
router.post("/google/diagnose", GoogleCalendarController.diagnose);

// Leads
router.get("/leads", requirePermission("contacts"), LeadController.getLeads);
router.post("/leads", requirePermission("contacts"), LeadController.createLead);
router.put("/leads/:id", requirePermission("contacts"), LeadController.updateLead);
router.delete("/leads/:id", requirePermission("contacts"), LeadController.deleteLead);
router.post("/contacts/bulk-delete", requirePermission("contacts"), LeadController.bulkDeleteLeads);
router.post("/leads/bulk-enrich", requirePermission("contacts"), LeadController.bulkEnrichLeads);
router.get("/contacts/export", requirePermission("contacts"), LeadController.exportContacts);
router.post("/contacts/import-bulk", requirePermission("contacts"), LeadController.importBulk);

// Appointments (integração com Google Calendar exige plano com enableCalendar)
router.get("/appointments", requirePermission("appointments"), AppointmentController.getAppointments);
router.post("/appointments", requirePermission("appointments"), requireCalendar, AppointmentController.createAppointment);
router.put("/appointments/:id", requirePermission("appointments"), requireCalendar, AppointmentController.updateAppointment);
router.delete("/appointments/:id", requirePermission("appointments"), requireCalendar, AppointmentController.deleteAppointment);

// Bulk Messaging
router.get("/bulk/campaigns", BulkController.getCampaigns);
router.post("/bulk/campaigns", BulkController.createCampaign);
router.post("/bulk/campaigns/:id/send", requireActiveSubscription, BulkController.sendCampaign);
router.post("/bulk/import-csv", BulkController.importCSV);

// Settings
router.get("/settings", SettingsController.getSettings);
router.put("/settings", requirePermission("settings"), SettingsController.updateSettings);

// WhatsApp Connections — criação bloqueada quando maxWhatsAppNumbers estoura
router.get("/whatsapp/accounts", requirePermission("connections"), WhatsAppController.getAccounts);
router.post("/whatsapp/accounts", requirePermission("connections"), requireWhatsAppSlot, requireWhatsAppMode("BAILEYS"), WhatsAppController.createAccount);
router.delete("/whatsapp/accounts/:id", requirePermission("connections"), WhatsAppController.deleteAccount);
router.post("/whatsapp/accounts/:id/reconnect", requirePermission("connections"), WhatsAppController.reconnectAccount);
router.post("/whatsapp/accounts/meta", requirePermission("connections"), requireWhatsAppSlot, requireWhatsAppMode("OFFICIAL"), WhatsAppController.createMetaAccount);
// Conexão oficial (Cloud API): editar credenciais e testar — não há QR aqui.
router.put("/whatsapp/accounts/:id/meta", requirePermission("connections"), WhatsAppController.updateMetaAccount);
router.post("/whatsapp/accounts/:id/test", requirePermission("connections"), WhatsAppController.testMetaConnection);
router.get("/whatsapp/qr/:id", WhatsAppController.qrCodeStream);

// Instagram Direct — conexão em 1 clique (OAuth Meta) e manual
router.get("/channels/instagram/oauth-url", MetaOAuthController.getOAuthUrl);
router.post("/channels/instagram", requirePermission("connections"), WhatsAppController.createInstagramAccount);
router.put("/channels/instagram/:id", requirePermission("connections"), WhatsAppController.updateInstagramAccount);
router.post("/channels/instagram/:id/test", requirePermission("connections"), WhatsAppController.testInstagramConnection);

// Automations — gate por enableAutomations
router.get("/automations", AutomationController.getAutomations);
router.post("/automations", requirePermission("flows"), requireAutomations, AutomationController.createAutomation);
router.put("/automations/:id", requirePermission("flows"), requireAutomations, AutomationController.updateAutomation);
router.delete("/automations/:id", requirePermission("flows"), AutomationController.deleteAutomation);
router.post("/automations/:id/duplicate", requirePermission("flows"), requireAutomations, AutomationController.duplicateAutomation);
router.get("/automations/executions/stats", AutomationController.getStats);
router.get("/automations/config", AutomationController.getConfig);
router.post("/automations/config", requirePermission("reminders"), requireAutomations, AutomationController.updateConfig);
// Catálogo de gatilhos: a tela do builder monta o formulário a partir dele.
router.get("/automations/triggers", AutomationController.listTriggers);
// Simulador de fluxos (execução sem efeitos) e portabilidade
router.post("/automations/:id/simulate", requireAutomations, AutomationController.simulateStart);
router.post("/automations/simulate/:sessionId/message", requireAutomations, AutomationController.simulateSend);
router.get("/automations/simulate/:sessionId", AutomationController.simulateGet);
router.delete("/automations/simulate/:sessionId", AutomationController.simulateStop);
router.get("/automations/:id/export", AutomationController.exportAutomation);
router.post("/automations/import", requirePermission("flows"), requireAutomations, AutomationController.importAutomation);

// Régua de lembretes: o que está programado, o que falhou e por quê.
router.get("/automations/reminders", AutomationController.getReminders);
router.post("/automations/reminders/:id/retry", requirePermission("reminders"), requireAutomations, AutomationController.retryReminder);

// Stats & Analytics
router.get("/stats/dashboard", StatsController.getDashboardStats);
router.get("/stats/results", StatsController.getResults);
// Números da home do painel: série, variação, IA/equipe e valores do funil.
router.get("/stats/home", StatsController.getHomeStats);
router.get("/stats/report", requirePermission("analytics"), StatsController.getReport);

// Messages & Conversations (Chat/Inbox)
router.get("/messages/:leadId", requirePermission("conversations"), MessageController.getMessages);
router.post("/messages", requirePermission("conversations"), requireActiveSubscription, MessageController.sendMessage);
router.post("/messages/call-intent", requirePermission("conversations"), requireActiveSubscription, MessageController.callIntent);
// Disparo em massa (API oficial da Meta)
// Seleção e importação de contatos (usada pelo disparo em massa)
// Integrações: chaves de API e CRMs conectados (módulo Conexões).
router.get("/integrations/api-keys", requirePermission("connections"), IntegrationController.listApiKeys);
router.post("/integrations/api-keys", requirePermission("connections"), IntegrationController.createApiKey);
router.delete("/integrations/api-keys/:id", requirePermission("connections"), IntegrationController.revokeApiKey);
router.get("/integrations/crm/providers", requirePermission("connections"), IntegrationController.listCrmProviders);
router.get("/integrations/crm", requirePermission("connections"), IntegrationController.listCrmConnections);
router.post("/integrations/crm", requirePermission("connections"), IntegrationController.saveCrmConnection);
router.post("/integrations/crm/:id/test", requirePermission("connections"), IntegrationController.testCrmConnection);
router.post("/integrations/crm/:id/sync", requirePermission("connections"), IntegrationController.syncCrmConnection);
router.get("/integrations/crm/:id/logs", requirePermission("connections"), IntegrationController.crmSyncLogs);
router.delete("/integrations/crm/:id", requirePermission("connections"), IntegrationController.deleteCrmConnection);

// Contatos (CDP)
router.post("/contacts/merge", requirePermission("contacts"), ContactController.mergeContacts);
router.get("/contacts/duplicates", requirePermission("contacts"), ContactController.listDuplicates);
router.post("/contacts/deduplicate", requirePermission("contacts"), ContactController.deduplicateNow);
router.get("/contacts/:id/identities", requirePermission("contacts"), ContactController.contactIdentities);
router.get("/contacts/search", ContactController.searchContacts);
router.get("/contacts/search-ids", ContactController.searchContactIds);
router.get("/contacts/tags", ContactController.listTags);
router.post("/contacts/import-csv", receberArquivo("file", "planilha"), ContactController.importContactsCsv);
router.get("/campaigns/:id/report", CampaignController.campaignReport);

router.get("/campaigns", requirePermission("campaigns"), CampaignController.listCampaigns);
router.get("/campaigns/quota", CampaignController.getCampaignQuota);
router.post("/campaigns/preview", requirePermission("campaigns"), CampaignController.previewCampaign);
router.post("/campaigns", requirePermission("campaigns"), CampaignController.createCampaign);
router.post("/campaigns/:id/start", CampaignController.startCampaign);
router.post("/campaigns/:id/schedule", requirePermission("campaigns"), CampaignController.scheduleCampaign);
router.post("/campaigns/:id/pause", CampaignController.pauseCampaign);
router.delete("/campaigns/:id", CampaignController.deleteCampaign);

// Templates de mensagem (WhatsApp Business / Meta)
router.get("/templates", TemplateController.listTemplates);
router.post("/templates", requirePermission("templates"), TemplateController.createTemplate);
router.post("/templates/sync", TemplateController.syncTemplates);
router.post("/templates/header-media", receberArquivo("file", "midia"), TemplateController.uploadHeaderMedia);
router.put("/templates/:id", requirePermission("templates"), TemplateController.updateTemplate);
router.post("/templates/:id/duplicate", TemplateController.duplicateTemplate);
router.delete("/templates/:id", requirePermission("templates"), TemplateController.deleteTemplate);

router.post("/messages/upload", requirePermission("conversations"), receberArquivo("file", "midia"), MessageController.uploadAttachment);
router.post("/messages/template", requirePermission("conversations"), MessageController.sendTemplateToLead);
router.get("/conversations", requirePermission("conversations"), MessageController.getConversations);
router.put("/conversations/:leadId/read", requirePermission("conversations"), MessageController.markRead);
router.put("/conversations/:leadId/toggle-bot", requirePermission("conversations"), MessageController.toggleBot);
// Badge do menu: quantas conversas esperam atenção humana.
router.get("/conversations/pending-count", requirePermission("conversations"), MessageController.getPendingCount);
router.post("/conversations/start", requirePermission("conversations"), MessageController.startConversation);
// Ficha do contato, ao lado da conversa aberta.
router.get("/conversations/:leadId/contact", requirePermission("conversations"), MessageController.getConversationContact);
router.put("/conversations/:leadId/contact", requirePermission("conversations"), MessageController.updateConversationContact);
// Filas de atendimento e fases da conversa
// Períodos de ausência: feriado, recesso, plantão. Ficam com "automations"
// porque é onde a tela vive (Lembretes).
router.get("/away-periods", requirePermission("reminders"), AwayController.listAwayPeriods);
router.post("/away-periods", requirePermission("reminders"), AwayController.createAwayPeriod);
router.put("/away-periods/:id", requirePermission("reminders"), AwayController.updateAwayPeriod);
router.delete("/away-periods/:id", requirePermission("reminders"), AwayController.deleteAwayPeriod);

router.get("/queues", requirePermission("queues"), AttendanceController.listQueues);
router.post("/queues", requirePermission("queues"), AttendanceController.createQueue);
router.put("/queues/:id", requirePermission("queues"), AttendanceController.updateQueue);
router.delete("/queues/:id", requirePermission("queues"), AttendanceController.deleteQueue);
router.get("/attendance/agents", requirePermission("queues"), AttendanceController.listAgents);
router.get("/attendance/queue", requirePermission("queues"), AttendanceController.getQueue);
router.get("/conversations/:id/status", requirePermission("conversations"), AttendanceController.getConversationStatus);
router.post("/conversations/:id/enqueue", requirePermission("conversations"), AttendanceController.enqueueConversation);
router.post("/conversations/:id/assign", requirePermission("conversations"), AttendanceController.assignConversation);
router.post("/conversations/:id/transfer", requirePermission("conversations"), AttendanceController.transferConversation);
router.post("/conversations/:id/return-bot", requirePermission("conversations"), AttendanceController.returnToBot);
router.post("/conversations/:id/close", requirePermission("conversations"), AttendanceController.closeConversation);
router.post("/conversations/:id/reopen", requirePermission("conversations"), AttendanceController.reopenConversation);

router.get("/events", MessageController.sseEvents);

// (Rotas de prospecção outbound removidas — produto é inbound)

// Users — criação bloqueada quando maxUsers estoura
// Conta do próprio usuário. Precisa vir ANTES de /users/:id — senão
// "me" seria lido como id e cairia nas rotas de administração.
router.get("/users/me", UserController.getMe);
router.post("/users/me/password", UserController.changePassword);
router.post("/users/me/2fa/setup", UserController.setup2FA);
router.post("/users/me/2fa/enable", UserController.enable2FA);
router.post("/users/me/2fa/disable", UserController.disable2FA);

// Colaboradores — só quem administra a conta mexe aqui.
router.get("/users", requireTenantAdmin, UserController.getUsers);
router.get("/users/access-catalog", requireTenantAdmin, UserController.getAccessCatalog);
router.post("/users", requireTenantAdmin, requireUserSlot, UserController.createUser);
router.put("/users/:id", requireTenantAdmin, UserController.updateUser);
router.post("/users/:id/active", requireTenantAdmin, UserController.setUserActive);
router.post("/users/:id/password", requireTenantAdmin, UserController.resetUserPassword);
router.delete("/users/:id", requireTenantAdmin, UserController.deleteUser);

// Conta do usuário logado (perfil, senha, 2FA)

// Pipeline Stages
router.get("/pipeline-stages", PipelineController.getStages);
router.post("/pipeline-stages", requirePermission("crm"), PipelineController.createStage);
router.put("/pipeline-stages/:id", requirePermission("crm"), PipelineController.updateStage);
router.delete("/pipeline-stages/:id", requirePermission("crm"), PipelineController.deleteStage);

// ICP Profiles
router.get("/icp-profiles", ICPController.getProfiles);
router.post("/icp-profiles", ICPController.createProfile);
router.put("/icp-profiles/:id", ICPController.updateProfile);
router.delete("/icp-profiles/:id", ICPController.deleteProfile);

// SDRs
router.get("/sdrs", SdrController.getSdrs);
router.post("/sdrs", requirePermission("agents"), SdrController.createSdr);
router.put("/sdrs/:id", requirePermission("agents"), SdrController.updateSdr);
router.delete("/sdrs/:id", requirePermission("agents"), SdrController.deleteSdr);
router.post("/sdrs/:id/training", requirePermission("agents"), receberArquivo("file", "documento"), SdrController.trainSdr);
// Simulador: conversa de teste com o agente, sem gravar nada na conta.
router.post("/sdrs/:id/simulate", requirePermission("agents"), SdrController.simulateSdr);
router.get("/sdrs/prompt/questionario", requirePermission("agents"), SdrController.getPromptQuestionario);
router.post("/sdrs/prompt/gerar", requirePermission("agents"), SdrController.gerarPrompt);

// Vozes LIBERADAS pelo admin — o cliente escolhe entre estas no agente.
// A chave do provedor é global e nunca é exposta.
router.get("/voices", async (req, res) => {
  try {
    const { default: VoiceService } = await import("../services/VoiceService.js");
    // Passa o tenant para marcar as vozes premium como bloqueadas quando o
    // plano não dá direito (a UI mostra, deixa ouvir e oferece o upgrade).
    res.json(await VoiceService.listEnabledVoices(req.tenantId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Amostra da voz (alguns segundos) para o cliente ouvir antes de escolher.
// Vozes premium já vêm com preview_url da ElevenLabs; aqui geramos a do Gemini.
router.get("/voices/:id/preview", async (req, res) => {
  try {
    const { default: VoiceService } = await import("../services/VoiceService.js");
    const url = await VoiceService.previewVoice(req.params.id);
    if (!url) return res.status(404).json({ error: "Não foi possível gerar a amostra." });
    res.json({ url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Funções e skills disponíveis para os agentes (catálogo estático)
router.get("/agent-functions", (_req, res) => {
  res.json({ functions: listFunctions(), skills: SKILLS });
});

// Catálogo de produtos/serviços (com mídia)
router.get("/products", ProductController.getProducts);
router.post("/products", requirePermission("catalog"), ProductController.createProduct);
router.put("/products/:id", requirePermission("catalog"), ProductController.updateProduct);
router.delete("/products/:id", requirePermission("catalog"), ProductController.deleteProduct);
router.post("/products/upload", receberArquivo("file", "midia"), ProductController.uploadMedia);
router.get("/products/import/modelo", requirePermission("catalog"), ProductController.importTemplate);
router.post(
  "/products/import",
  requirePermission("catalog"),
  receberArquivo("file", "planilha"),
  ProductController.importProducts
);

// Admin / SaaS Central (Required for AdminDashboard.tsx)
router.get("/admin/tenants", adminMiddleware, AdminController.getTenants);
router.post("/admin/tenants", adminMiddleware, AdminController.createTenant);
router.get("/admin/tenants/:id", adminMiddleware, AdminController.getTenantDetail);
router.put("/admin/tenants/:id", adminMiddleware, AdminController.updateTenant);
router.delete("/admin/tenants/:id", adminMiddleware, AdminController.deleteTenant);

// Configurações da plataforma (gateway de pagamento etc.)
router.get("/admin/platform-settings", adminMiddleware, AdminController.getPlatformSettings);
router.put("/admin/platform-settings", adminMiddleware, AdminController.updatePlatformSettings);

// Relatórios do SaaS
router.get("/admin/reports", adminMiddleware, AdminController.getReports);
// Acesso de emergência: só cria administrador quando o cliente ficou sem
// nenhum. A gestão normal de colaboradores é do próprio cliente, em /equipe.
router.post("/admin/tenants/:id/users", adminMiddleware, AdminController.createTenantUser);

// Vozes do provedor ativo (admin escolhe quais liberar para as contas)
router.get("/admin/voices", adminMiddleware, AdminController.getProviderVoices);

// Precificação de tokens — custo real por modelo (base do cálculo automático)
router.get("/admin/token-pricing", adminMiddleware, AdminController.getTokenPricing);

// Pacotes de recarga de tokens — o admin do SaaS define nome, tokens e preço
router.get("/admin/token-packages", adminMiddleware, AdminController.getTokenPackages);
router.post("/admin/token-packages", adminMiddleware, AdminController.createTokenPackage);
router.put("/admin/token-packages/:id", adminMiddleware, AdminController.updateTokenPackage);
router.delete("/admin/token-packages/:id", adminMiddleware, AdminController.deleteTokenPackage);

// Academy: qualquer cliente logado assiste; só o admin publica.
router.get("/academy/videos", AcademyController.listVideos);
router.get("/admin/academy/videos", adminMiddleware, AcademyController.adminListVideos);
router.post("/admin/academy/videos", adminMiddleware, AcademyController.createVideo);
router.put("/admin/academy/videos/:id", adminMiddleware, AcademyController.updateVideo);
router.delete("/admin/academy/videos/:id", adminMiddleware, AcademyController.deleteVideo);

// Leads do diagnóstico da landing (pertencem ao SaaS, não a um tenant).
router.get("/admin/leads", adminMiddleware, AdminController.getPlatformLeads);
router.put("/admin/leads/:id", adminMiddleware, AdminController.updatePlatformLead);
router.post("/admin/leads/:id/import", adminMiddleware, AdminController.importPlatformLead);
router.delete("/admin/leads/:id", adminMiddleware, AdminController.deletePlatformLead);

router.get("/admin/plans", adminMiddleware, AdminController.getPlans);
router.post("/admin/plans", adminMiddleware, AdminController.createPlan);
router.put("/admin/plans/:id", adminMiddleware, AdminController.updatePlan);
router.delete("/admin/plans/:id", adminMiddleware, AdminController.deletePlan);

router.get("/admin/landing-settings", adminMiddleware, AdminController.getLandingSettings);
router.put("/admin/landing-settings", adminMiddleware, AdminController.updateLandingSettings);

// SaaS Financial Admin Dashboard
router.get("/admin/financial/summary", adminMiddleware, FinancialController.getSummary);
router.get("/admin/financial/transactions", adminMiddleware, FinancialController.getTransactions);
router.post("/admin/financial/transactions", adminMiddleware, FinancialController.createTransaction);
router.put("/admin/financial/transactions/:id", adminMiddleware, FinancialController.updateTransaction);
router.delete("/admin/financial/transactions/:id", adminMiddleware, FinancialController.deleteTransaction);
router.post("/admin/financial/trigger-billing", adminMiddleware, async (req, res) => {
  try {
    await BillingService.runBillingCheck();
    await BillingService.runTrialReminders();
    res.json({ success: true, message: "Faturamento e lembretes de trial processados manualmente." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Meu Negócio (base de conhecimento do agente) — vocabulário genérico
router.get("/business", BusinessController.getBusiness);
router.put("/business/profile", requirePermission("business"), BusinessController.updateProfile);
router.put("/business/hours", requirePermission("business"), BusinessController.updateBusinessHours);
router.post("/business/apply-template", requirePermission("business"), BusinessController.applyTemplate);
router.get("/business/verticals", (_req, res) => res.json(listVerticalTemplates()));

router.post("/business/team", requirePermission("business"), BusinessController.teamMember.create);
router.put("/business/team/:id", requirePermission("business"), BusinessController.teamMember.update);
router.delete("/business/team/:id", requirePermission("business"), BusinessController.teamMember.remove);

router.post("/business/services", BusinessController.service.create);
router.put("/business/services/:id", BusinessController.service.update);
router.delete("/business/services/:id", BusinessController.service.remove);

router.post("/business/payments", BusinessController.paymentMethod.create);
router.put("/business/payments/:id", BusinessController.paymentMethod.update);
router.delete("/business/payments/:id", BusinessController.paymentMethod.remove);

router.post("/business/faqs", BusinessController.faq.create);
router.put("/business/faqs/:id", BusinessController.faq.update);
router.delete("/business/faqs/:id", BusinessController.faq.remove);

// Compliance / Direitos do titular (LGPD)
router.get("/compliance/account/export", ComplianceController.exportAccountData);
router.get("/compliance/leads/:id/export", ComplianceController.exportLeadData);
router.delete("/compliance/leads/:id", ComplianceController.deleteLeadData);

router.get("/billing/portal", BillingController.getBillingPortalData);
// Consumo do ciclo e o extrato por trás dele.
router.get("/billing/usage", BillingController.getUsage);
router.get("/billing/usage/events", BillingController.getUsageEvents);
router.get("/billing/plans", BillingController.getActivePlans);
router.post("/billing/checkout/:invoiceId", requirePermission("billing"), BillingController.createCheckoutSession);
router.post("/billing/subscribe", requirePermission("billing"), BillingController.createSubscriptionCheckout);
router.post("/billing/cancel", requirePermission("billing"), BillingController.cancelSubscription);
router.post("/billing/resume", requirePermission("billing"), BillingController.resumeSubscription);
router.post("/billing/upgrade", requirePermission("billing"), BillingController.upgradePlan);

// Recarga de valor livre: o cliente digita quanto quer, confere o resumo e vai
// para o checkout. A cota é refeita no servidor antes de cobrar.
router.post("/billing/recharge/quote", requirePermission("billing"), BillingController.quoteRecharge);
router.post("/billing/recharge/checkout", requirePermission("billing"), BillingController.createRechargeCheckout);

// Recarga de tokens (pacotes definidos pelo admin) — cliente compra saldo extra
router.get("/billing/token-packages", BillingController.getTokenPackages);
router.post("/billing/token-packages/:id/checkout", BillingController.buyTokenPackage);

export default router;
