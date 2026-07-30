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
import multer from "multer";
import * as WhatsAppController from "../controllers/WhatsAppController.js";
import * as AutomationController from "../controllers/AutomationController.js";
import * as SdrController from "../controllers/SdrController.js";
import * as MessageController from "../controllers/MessageController.js";
import * as AttendanceController from "../controllers/AttendanceController.js";
import * as TemplateController from "../controllers/TemplateController.js";
import * as CampaignController from "../controllers/CampaignController.js";
import * as ContactController from "../controllers/ContactController.js";
import * as AnalyticsController from "../controllers/AnalyticsController.js";
import * as FinancialController from "../controllers/FinancialController.js";
import * as BillingController from "../controllers/BillingController.js";
import BillingService from "../services/BillingService.js";
import * as ComplianceController from "../controllers/ComplianceController.js";
import * as BusinessController from "../controllers/BusinessController.js";
import * as ProductController from "../controllers/ProductController.js";
import { listVerticalTemplates } from "../services/VerticalTemplates.js";
import { listFunctions, SKILLS } from "../services/AgentFunctions.js";
import {
  requireCalendar,
  requireAutomations,
  requireWebhooks,
  requireWhatsAppSlot,
  requireUserSlot,
} from "../middlewares/planLimits.js";

const upload = multer({ storage: multer.memoryStorage() });

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

// Protected Routes (Tenant context)
router.use(authMiddleware);

// Google Calendar (conexão da agenda)
router.get("/google/status", GoogleCalendarController.getStatus);
router.get("/google/auth-url", GoogleCalendarController.getAuthUrl);
router.post("/google/disconnect", GoogleCalendarController.disconnect);

// Leads
router.get("/leads", LeadController.getLeads);
router.post("/leads", LeadController.createLead);
router.put("/leads/:id", LeadController.updateLead);
router.delete("/leads/:id", LeadController.deleteLead);
router.post("/contacts/bulk-delete", LeadController.bulkDeleteLeads);
router.post("/leads/bulk-enrich", LeadController.bulkEnrichLeads);
router.get("/contacts/export", LeadController.exportContacts);
router.post("/contacts/import-bulk", LeadController.importBulk);

// Appointments (integração com Google Calendar exige plano com enableCalendar)
router.get("/appointments", AppointmentController.getAppointments);
router.post("/appointments", requireCalendar, AppointmentController.createAppointment);
router.put("/appointments/:id", requireCalendar, AppointmentController.updateAppointment);
router.delete("/appointments/:id", requireCalendar, AppointmentController.deleteAppointment);

// Bulk Messaging
router.get("/bulk/campaigns", BulkController.getCampaigns);
router.post("/bulk/campaigns", BulkController.createCampaign);
router.post("/bulk/campaigns/:id/send", requireActiveSubscription, BulkController.sendCampaign);
router.post("/bulk/import-csv", BulkController.importCSV);

// Settings
router.get("/settings", SettingsController.getSettings);
router.put("/settings", SettingsController.updateSettings);

// WhatsApp Connections — criação bloqueada quando maxWhatsAppNumbers estoura
router.get("/whatsapp/accounts", WhatsAppController.getAccounts);
router.post("/whatsapp/accounts", requireWhatsAppSlot, WhatsAppController.createAccount);
router.delete("/whatsapp/accounts/:id", WhatsAppController.deleteAccount);
router.post("/whatsapp/accounts/:id/reconnect", WhatsAppController.reconnectAccount);
router.post("/whatsapp/accounts/meta", requireWhatsAppSlot, WhatsAppController.createMetaAccount);
// Conexão oficial (Cloud API): editar credenciais e testar — não há QR aqui.
router.put("/whatsapp/accounts/:id/meta", WhatsAppController.updateMetaAccount);
router.post("/whatsapp/accounts/:id/test", WhatsAppController.testMetaConnection);
router.get("/whatsapp/qr/:id", WhatsAppController.qrCodeStream);

// Instagram Direct — conexão em 1 clique (OAuth Meta) e manual
router.get("/channels/instagram/oauth-url", MetaOAuthController.getOAuthUrl);
router.post("/channels/instagram", WhatsAppController.createInstagramAccount);
router.put("/channels/instagram/:id", WhatsAppController.updateInstagramAccount);
router.post("/channels/instagram/:id/test", WhatsAppController.testInstagramConnection);

// Automations — gate por enableAutomations
router.get("/automations", AutomationController.getAutomations);
router.post("/automations", requireAutomations, AutomationController.createAutomation);
router.put("/automations/:id", requireAutomations, AutomationController.updateAutomation);
router.delete("/automations/:id", AutomationController.deleteAutomation);
router.post("/automations/:id/duplicate", requireAutomations, AutomationController.duplicateAutomation);
router.get("/automations/executions/stats", AutomationController.getStats);
router.get("/automations/config", AutomationController.getConfig);
router.post("/automations/config", requireAutomations, AutomationController.updateConfig);
// Simulador de fluxos (execução sem efeitos) e portabilidade
router.post("/automations/:id/simulate", requireAutomations, AutomationController.simulateStart);
router.post("/automations/simulate/:sessionId/message", requireAutomations, AutomationController.simulateSend);
router.get("/automations/simulate/:sessionId", AutomationController.simulateGet);
router.delete("/automations/simulate/:sessionId", AutomationController.simulateStop);
router.get("/automations/:id/export", AutomationController.exportAutomation);
router.post("/automations/import", requireAutomations, AutomationController.importAutomation);

// Régua de lembretes: o que está programado, o que falhou e por quê.
router.get("/automations/reminders", AutomationController.getReminders);
router.post("/automations/reminders/:id/retry", requireAutomations, AutomationController.retryReminder);

// Stats & Analytics
router.get("/stats/dashboard", StatsController.getDashboardStats);
router.get("/stats/results", StatsController.getResults);
router.get("/analytics", AnalyticsController.getAnalytics);

// Messages & Conversations (Chat/Inbox)
router.get("/messages/:leadId", MessageController.getMessages);
router.post("/messages", requireActiveSubscription, MessageController.sendMessage);
router.post("/messages/call-intent", requireActiveSubscription, MessageController.callIntent);
// Disparo em massa (API oficial da Meta)
// Seleção e importação de contatos (usada pelo disparo em massa)
router.get("/contacts/search", ContactController.searchContacts);
router.get("/contacts/search-ids", ContactController.searchContactIds);
router.get("/contacts/tags", ContactController.listTags);
router.post("/contacts/import-csv", upload.single("file"), ContactController.importContactsCsv);
router.get("/campaigns/:id/report", CampaignController.campaignReport);

router.get("/campaigns", CampaignController.listCampaigns);
router.get("/campaigns/quota", CampaignController.getCampaignQuota);
router.post("/campaigns/preview", CampaignController.previewCampaign);
router.post("/campaigns", CampaignController.createCampaign);
router.post("/campaigns/:id/start", CampaignController.startCampaign);
router.post("/campaigns/:id/pause", CampaignController.pauseCampaign);
router.delete("/campaigns/:id", CampaignController.deleteCampaign);

// Templates de mensagem (WhatsApp Business / Meta)
router.get("/templates", TemplateController.listTemplates);
router.post("/templates", TemplateController.createTemplate);
router.post("/templates/sync", TemplateController.syncTemplates);
router.post("/templates/header-media", upload.single("file"), TemplateController.uploadHeaderMedia);
router.put("/templates/:id", TemplateController.updateTemplate);
router.post("/templates/:id/duplicate", TemplateController.duplicateTemplate);
router.delete("/templates/:id", TemplateController.deleteTemplate);

router.post("/messages/upload", upload.single("file"), MessageController.uploadAttachment);
router.post("/messages/template", MessageController.sendTemplateToLead);
router.get("/conversations", MessageController.getConversations);
router.put("/conversations/:leadId/read", MessageController.markRead);
router.put("/conversations/:leadId/toggle-bot", MessageController.toggleBot);
// Filas de atendimento e fases da conversa
router.get("/queues", AttendanceController.listQueues);
router.post("/queues", AttendanceController.createQueue);
router.put("/queues/:id", AttendanceController.updateQueue);
router.delete("/queues/:id", AttendanceController.deleteQueue);
router.get("/attendance/agents", AttendanceController.listAgents);
router.get("/attendance/queue", AttendanceController.getQueue);
router.get("/conversations/:id/status", AttendanceController.getConversationStatus);
router.post("/conversations/:id/enqueue", AttendanceController.enqueueConversation);
router.post("/conversations/:id/assign", AttendanceController.assignConversation);
router.post("/conversations/:id/transfer", AttendanceController.transferConversation);
router.post("/conversations/:id/return-bot", AttendanceController.returnToBot);
router.post("/conversations/:id/close", AttendanceController.closeConversation);
router.post("/conversations/:id/reopen", AttendanceController.reopenConversation);

router.get("/events", MessageController.sseEvents);

// (Rotas de prospecção outbound removidas — produto é inbound)

// Users — criação bloqueada quando maxUsers estoura
router.get("/users", UserController.getUsers);
router.post("/users", requireUserSlot, UserController.createUser);
router.delete("/users/:id", UserController.deleteUser);

// Conta do usuário logado (perfil, senha, 2FA)
router.get("/users/me", UserController.getMe);
router.post("/users/me/password", UserController.changePassword);
router.post("/users/me/2fa/setup", UserController.setup2FA);
router.post("/users/me/2fa/enable", UserController.enable2FA);
router.post("/users/me/2fa/disable", UserController.disable2FA);

// Pipeline Stages
router.get("/pipeline-stages", PipelineController.getStages);
router.post("/pipeline-stages", PipelineController.createStage);
router.put("/pipeline-stages/:id", PipelineController.updateStage);
router.delete("/pipeline-stages/:id", PipelineController.deleteStage);

// ICP Profiles
router.get("/icp-profiles", ICPController.getProfiles);
router.post("/icp-profiles", ICPController.createProfile);
router.put("/icp-profiles/:id", ICPController.updateProfile);
router.delete("/icp-profiles/:id", ICPController.deleteProfile);

// SDRs
router.get("/sdrs", SdrController.getSdrs);
router.post("/sdrs", SdrController.createSdr);
router.put("/sdrs/:id", SdrController.updateSdr);
router.delete("/sdrs/:id", SdrController.deleteSdr);
router.post("/sdrs/:id/training", upload.single("file"), SdrController.trainSdr);

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
router.post("/products", ProductController.createProduct);
router.put("/products/:id", ProductController.updateProduct);
router.delete("/products/:id", ProductController.deleteProduct);
router.post("/products/upload", upload.single("file"), ProductController.uploadMedia);

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
router.post("/admin/tenants/:id/users", adminMiddleware, AdminController.createTenantUser);
router.delete("/admin/tenants/:id/users/:userId", adminMiddleware, AdminController.deleteTenantUser);

// Vozes do provedor ativo (admin escolhe quais liberar para as contas)
router.get("/admin/voices", adminMiddleware, AdminController.getProviderVoices);

// Precificação de tokens — custo real por modelo (base do cálculo automático)
router.get("/admin/token-pricing", adminMiddleware, AdminController.getTokenPricing);

// Pacotes de recarga de tokens — o admin do SaaS define nome, tokens e preço
router.get("/admin/token-packages", adminMiddleware, AdminController.getTokenPackages);
router.post("/admin/token-packages", adminMiddleware, AdminController.createTokenPackage);
router.put("/admin/token-packages/:id", adminMiddleware, AdminController.updateTokenPackage);
router.delete("/admin/token-packages/:id", adminMiddleware, AdminController.deleteTokenPackage);

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
router.put("/business/profile", BusinessController.updateProfile);
router.put("/business/hours", BusinessController.updateBusinessHours);
router.post("/business/apply-template", BusinessController.applyTemplate);
router.get("/business/verticals", (_req, res) => res.json(listVerticalTemplates()));

router.post("/business/team", BusinessController.teamMember.create);
router.put("/business/team/:id", BusinessController.teamMember.update);
router.delete("/business/team/:id", BusinessController.teamMember.remove);

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
router.get("/billing/plans", BillingController.getActivePlans);
router.post("/billing/checkout/:invoiceId", BillingController.createCheckoutSession);
router.post("/billing/subscribe", BillingController.createSubscriptionCheckout);
router.post("/billing/cancel", BillingController.cancelSubscription);
router.post("/billing/resume", BillingController.resumeSubscription);
router.post("/billing/upgrade", BillingController.upgradePlan);

// Recarga de tokens (pacotes definidos pelo admin) — cliente compra saldo extra
router.get("/billing/token-packages", BillingController.getTokenPackages);
router.post("/billing/token-packages/:id/checkout", BillingController.buyTokenPackage);

export default router;
