import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";

export const getUsers = async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });
    const users = await prisma.user.findMany({ where: { tenantId } });
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createUser = async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role, tenantId }
    });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteUser = async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
