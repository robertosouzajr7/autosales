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

// Papéis que um usuário de tenant pode atribuir. SUPERADMIN nunca é atribuível
// por esta rota (evita escalação de privilégio para admin da plataforma).
const ASSIGNABLE_ROLES = ["OWNER", "ADMIN", "AGENT"];

export const createUser = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    // Só OWNER/ADMIN (ou SUPERADMIN) podem criar usuários
    if (!["OWNER", "ADMIN", "SUPERADMIN"].includes(req.userRole)) {
      return res.status(403).json({ error: "Sem permissão para criar usuários" });
    }
    const { name, email, password, role } = req.body;
    const safeRole = ASSIGNABLE_ROLES.includes(role) ? role : "AGENT";
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: safeRole, tenantId }
    });
    const { password: _pw, ...safeUser } = user; // nunca retornar o hash de senha
    res.json(safeUser);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteUser = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const result = await prisma.user.deleteMany({ where: { id: req.params.id, tenantId } });
    if (result.count === 0) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
