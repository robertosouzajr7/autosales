import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import JWT_SECRET from "../config/jwt.js";

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

// Duração do trial gratuito ao cadastrar.
const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || "14", 10);

export const register = async (req, res) => {
  try {
    const { name, email, password, companyName, phone } = req.body;

    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: "Senha deve ter ao menos 8 caracteres." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "E-mail já cadastrado" });

    const hashedPassword = await bcrypt.hash(password, 10);

    // O plano NÃO é escolhido pelo cliente no cadastro. Todo signup entra em
    // TRIAL no plano de entrada (mais barato ativo). Upgrade/pagamento é feito
    // depois, pelo portal de billing.
    const trialPlan = await prisma.plan.findFirst({
      where: { active: true, priceMonthly: { gt: 0 } },
      orderBy: { priceMonthly: "asc" }
    });

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

    const tenant = await prisma.tenant.create({
      data: {
        name: companyName,
        email,
        phone,
        planId: trialPlan?.id,
        subscriptionStatus: "TRIAL",
        trialEnd,
        nextBillingDate: trialEnd,
        // Aceite de Termos/Privacidade capturado no cadastro (LGPD).
        acceptedTermsAt: new Date()
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
