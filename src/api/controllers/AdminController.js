import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { audit } from "../services/AuditService.js";

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

export const updateTenant = async (req, res) => {
  try {
    const { name, email, planId, active, subscriptionStatus } = req.body;
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { name, email, planId, active, subscriptionStatus }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createTenantUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    // Usuários de tenant nunca recebem SUPERADMIN, nem por rota administrativa.
    const safeRole = ["OWNER", "ADMIN", "AGENT"].includes(role) ? role : "AGENT";
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: safeRole, tenantId: req.params.id }
    });
    res.json(user);
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
