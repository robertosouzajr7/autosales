import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";

export const getUsers = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });
    const users = await prisma.user.findMany({ where: { tenantId } });
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// Papéis que um tenant pode atribuir. SUPERADMIN nunca pode ser criado por rota de tenant.
const TENANT_ROLES = ["OWNER", "ADMIN", "AGENT"];

export const createUser = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { name, email, password, role } = req.body;
    const safeRole = TENANT_ROLES.includes(role) ? role : "AGENT";
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: safeRole, tenantId }
    });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: "Você não pode excluir o próprio usuário" });
    }
    await prisma.user.delete({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
