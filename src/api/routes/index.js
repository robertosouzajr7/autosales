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
import * as AdminController from "../controllers/AdminController.js";
import * as AppointmentController from "../controllers/AppointmentController.js";
import multer from "multer";
import * as WhatsAppController from "../controllers/WhatsAppController.js";
import * as AutomationController from "../controllers/AutomationController.js";
import * as SdrController from "../controllers/SdrController.js";
import * as MessageController from "../controllers/MessageController.js";
import * as ProspectController from "../controllers/ProspectController.js";
import * as AnalyticsController from "../controllers/AnalyticsController.js";

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Public / Auth
router.post("/auth/login", AuthController.login);
router.post("/auth/register", AuthController.register);
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
router.get("/contacts/export", LeadController.exportContacts);
router.post("/contacts/import-bulk", LeadController.importBulk);

// Appointments
router.get("/appointments", AppointmentController.getAppointments);
router.post("/appointments", AppointmentController.createAppointment);
router.put("/appointments/:id", AppointmentController.updateAppointment);
router.delete("/appointments/:id", AppointmentController.deleteAppointment);

// Bulk Messaging
router.get("/bulk/campaigns", BulkController.getCampaigns);
router.post("/bulk/campaigns", BulkController.createCampaign);
router.post("/bulk/campaigns/:id/send", BulkController.sendCampaign);
router.post("/bulk/import-csv", BulkController.importCSV);

// Settings
router.get("/settings", SettingsController.getSettings);
router.put("/settings", SettingsController.updateSettings);

// WhatsApp Connections
router.get("/whatsapp/accounts", WhatsAppController.getAccounts);
router.post("/whatsapp/accounts", WhatsAppController.createAccount);
router.delete("/whatsapp/accounts/:id", WhatsAppController.deleteAccount);
router.post("/whatsapp/accounts/meta", WhatsAppController.createMetaAccount);
router.get("/whatsapp/qr/:id", WhatsAppController.qrCodeStream);

// Automations
router.get("/automations", AutomationController.getAutomations);
router.post("/automations", AutomationController.createAutomation);
router.put("/automations/:id", AutomationController.updateAutomation);
router.delete("/automations/:id", AutomationController.deleteAutomation);
router.post("/automations/:id/duplicate", AutomationController.duplicateAutomation);
router.get("/automations/executions/stats", AutomationController.getStats);
router.get("/automations/config", AutomationController.getConfig);
router.post("/automations/config", AutomationController.updateConfig);

// Stats & Analytics
router.get("/stats/dashboard", StatsController.getDashboardStats);
router.get("/analytics", AnalyticsController.getAnalytics);

// Messages & Conversations (Chat/Inbox)
router.get("/messages/:leadId", MessageController.getMessages);
router.post("/messages", MessageController.sendMessage);
router.post("/messages/call-intent", MessageController.callIntent);
router.put("/conversations/:leadId/toggle-bot", MessageController.toggleBot);
router.get("/events", MessageController.sseEvents);

// Prospecting (B2B)
router.post("/prospect", ProspectController.prospectGeneric);
router.post("/apollo/search", ProspectController.searchApollo);
router.post("/prospect/linkedin", ProspectController.prospectLinkedIn);
router.post("/prospect/enrich", ProspectController.enrichData);

// Users
router.get("/users", UserController.getUsers);
router.post("/users", UserController.createUser);
router.delete("/users/:id", UserController.deleteUser);

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
router.get("/admin/tenants/:id", adminMiddleware, AdminController.getTenantDetail);
router.put("/admin/tenants/:id", adminMiddleware, AdminController.updateTenant);
router.delete("/admin/tenants/:id", adminMiddleware, AdminController.deleteTenant);
router.post("/admin/tenants/:id/users", adminMiddleware, AdminController.createTenantUser);
router.delete("/admin/tenants/:id/users/:userId", adminMiddleware, AdminController.deleteTenantUser);

router.get("/admin/plans", adminMiddleware, AdminController.getPlans);
router.post("/admin/plans", adminMiddleware, AdminController.createPlan);
router.put("/admin/plans/:id", adminMiddleware, AdminController.updatePlan);
router.delete("/admin/plans/:id", adminMiddleware, AdminController.deletePlan);

router.get("/admin/landing-settings", adminMiddleware, AdminController.getLandingSettings);
router.put("/admin/landing-settings", adminMiddleware, AdminController.updateLandingSettings);

export default router;
