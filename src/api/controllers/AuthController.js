import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "vendai-secret-key-2026";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true }
    });

    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      tenant: user.tenant
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password, companyName, phone, plan } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "E-mail já cadastrado" });

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Find plan
    const planDoc = await prisma.plan.findFirst({ where: { name: plan } });

    const tenant = await prisma.tenant.create({
      data: {
        name: companyName,
        email,
        phone,
        planId: planDoc?.id
      }
    });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        tenantId: tenant.id,
        role: "OWNER"
      }
    });

    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user, tenant });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Simplified verification for now
export const sendCode = async (req, res) => {
  res.json({ success: true, message: "Código enviado (simulado)" });
};

export const verifyCode = async (req, res) => {
  res.json({ success: true });
};
