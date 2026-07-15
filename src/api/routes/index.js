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
import * as AppointmentController from "../controllers/AppointmentController.js";
import multer from "multer";
import * as WhatsAppController from "../controllers/WhatsAppController.js";
import * as AutomationController from "../controllers/AutomationController.js";
import * as SdrController from "../controllers/SdrController.js";
import * as MessageController from "../controllers/MessageController.js";
import * as AnalyticsController from "../controllers/AnalyticsController.js";
import * as FinancialController from "../controllers/FinancialController.js";
import * as BillingController from "../controllers/BillingController.js";
import BillingService from "../services/BillingService.js";
import * as ComplianceController from "../controllers/ComplianceController.js";
import * as BusinessController from "../controllers/BusinessController.js";
import { listVerticalTemplates } from "../services/VerticalTemplates.js";
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

// Protected Routes (Tenant context)
router.use(authMiddleware);

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
router.post("/whatsapp/accounts/meta", requireWhatsAppSlot, WhatsAppController.createMetaAccount);
router.get("/whatsapp/qr/:id", WhatsAppController.qrCodeStream);

// Automations — gate por enableAutomations
router.get("/automations", AutomationController.getAutomations);
router.post("/automations", requireAutomations, AutomationController.createAutomation);
router.put("/automations/:id", requireAutomations, AutomationController.updateAutomation);
router.delete("/automations/:id", AutomationController.deleteAutomation);
router.post("/automations/:id/duplicate", requireAutomations, AutomationController.duplicateAutomation);
router.get("/automations/executions/stats", AutomationController.getStats);
router.get("/automations/config", AutomationController.getConfig);
router.post("/automations/config", requireAutomations, AutomationController.updateConfig);

// Stats & Analytics
router.get("/stats/dashboard", StatsController.getDashboardStats);
router.get("/stats/results", StatsController.getResults);
router.get("/analytics", AnalyticsController.getAnalytics);

// Messages & Conversations (Chat/Inbox)
router.get("/messages/:leadId", MessageController.getMessages);
router.post("/messages", requireActiveSubscription, MessageController.sendMessage);
router.post("/messages/call-intent", requireActiveSubscription, MessageController.callIntent);
router.put("/conversations/:leadId/toggle-bot", MessageController.toggleBot);
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
    res.json({ success: true, message: "Faturamento mensal processado com sucesso de forma manual." });
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
router.post("/billing/upgrade", BillingController.upgradePlan);

export default router;
