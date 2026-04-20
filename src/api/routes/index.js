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

// Stats
router.get("/stats/dashboard", StatsController.getDashboardStats);

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
