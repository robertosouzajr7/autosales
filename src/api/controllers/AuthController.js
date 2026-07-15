import crypto from "crypto";
import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import JWT_SECRET from "../config/jwt.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../services/EmailService.js";

const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || "7", 10);

// ─── helpers ───────────────────────────────────────────────────
function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function issueToken(user, tenantId) {
  return jwt.sign(
    { userId: user.id, tenantId, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// ─── LOGIN ─────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password, twoFactorCode } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Credenciais inválidas" });

    // Se 2FA está ativo, exige o código TOTP antes de emitir o token.
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(200).json({
          twoFactorRequired: true,
          message: "Informe o código do seu autenticador.",
        });
      }
      const valid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: String(twoFactorCode).replace(/\s/g, ""),
        window: 1,
      });
      if (!valid) {
        return res.status(401).json({ error: "Código 2FA inválido." });
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({
      token: issueToken(user, user.tenantId),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      tenant: user.tenant,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ─── REGISTER ──────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const { name, email, password, companyName, phone, planId } = req.body;

    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: "Senha deve ter ao menos 8 caracteres." });
    }
    const emailNormalized = String(email).trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: emailNormalized } });
    if (existingUser) {
      return res.status(409).json({
        error: "Este e-mail já está cadastrado. Faça login ou recupere sua senha.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let selectedPlan = null;
    if (planId) {
      selectedPlan = await prisma.plan.findFirst({ where: { id: planId, active: true } });
    }
    if (!selectedPlan) {
      selectedPlan = await prisma.plan.findFirst({
        where: { active: true, priceMonthly: { gt: 0 } },
        orderBy: { priceMonthly: "asc" },
      });
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

    const tenant = await prisma.tenant.create({
      data: {
        name: companyName,
        email: emailNormalized,
        phone,
        planId: selectedPlan?.id,
        subscriptionStatus: "TRIAL",
        trialEnd,
        nextBillingDate: trialEnd,
        acceptedTermsAt: new Date(),
      },
    });

    const verificationToken = randomToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        name,
        email: emailNormalized,
        password: hashedPassword,
        tenantId: tenant.id,
        role: "OWNER",
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: verificationExpires,
      },
    });

    // Enviar e-mail de verificação — falhas de envio não abortam o cadastro.
    sendVerificationEmail({ to: user.email, name: user.name, token: verificationToken }).catch(
      (err) => console.warn("[Auth] Falha ao enviar verificação:", err.message)
    );

    res.json({
      token: issueToken(user, tenant.id),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: false,
      },
      tenant,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ─── EMAIL VERIFICATION ────────────────────────────────────────
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token obrigatório." });

    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (!user) return res.status(400).json({ error: "Token inválido ou expirado." });
    if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) {
      return res.status(400).json({ error: "Token expirado. Solicite um novo e-mail." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });
    res.json({ success: true, message: "E-mail confirmado." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "E-mail obrigatório." });

    const user = await prisma.user.findUnique({ where: { email } });
    // Resposta neutra pra não vazar existência de conta.
    if (!user || user.emailVerified) {
      return res.json({ success: true });
    }

    const token = randomToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: token,
        emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    sendVerificationEmail({ to: user.email, name: user.name, token }).catch(() => {});
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ─── PASSWORD RESET ────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "E-mail obrigatório." });

    const user = await prisma.user.findUnique({ where: { email } });
    // Resposta neutra sempre.
    if (!user) return res.json({ success: true });

    const token = randomToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
      },
    });
    sendPasswordResetEmail({ to: user.email, name: user.name, token }).catch(() => {});
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Dados obrigatórios." });
    if (password.length < 8) return res.status(400).json({ error: "Senha deve ter ao menos 8 caracteres." });

    const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
    if (!user) return res.status(400).json({ error: "Token inválido." });
    if (user.passwordResetExpiresAt && user.passwordResetExpiresAt < new Date()) {
      return res.status(400).json({ error: "Token expirado. Solicite um novo link." });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });
    res.json({ success: true, message: "Senha atualizada. Faça login." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Endpoints legados (sem uso mas mantidos por compatibilidade).
export const sendCode = async (_req, res) => res.json({ success: true, message: "Deprecated." });
export const verifyCode = async (_req, res) => res.json({ success: true, message: "Deprecated." });
