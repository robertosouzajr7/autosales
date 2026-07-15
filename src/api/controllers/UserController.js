import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

// Papéis que um tenant pode atribuir. SUPERADMIN nunca pode ser criado por rota de tenant.
const TENANT_ROLES = ["OWNER", "ADMIN", "AGENT"];

// Campo que nunca deve ser retornado no JSON.
function sanitize(user) {
  if (!user) return user;
  const { password, twoFactorSecret, twoFactorBackupCodes,
          emailVerificationToken, passwordResetToken, ...safe } = user;
  return safe;
}

export const getUsers = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });
    const users = await prisma.user.findMany({ where: { tenantId } });
    res.json(users.map(sanitize));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { name, email, password, role } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Senha deve ter ao menos 8 caracteres." });
    }
    const emailNormalized = String(email || "").trim().toLowerCase();

    const dup = await prisma.user.findUnique({ where: { email: emailNormalized } });
    if (dup) return res.status(409).json({ error: "Este e-mail já está cadastrado." });

    const safeRole = TENANT_ROLES.includes(role) ? role : "AGENT";
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: emailNormalized,
        password: hashedPassword,
        role: safeRole,
        tenantId,
      },
    });
    res.json(sanitize(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: "Você não pode excluir o próprio usuário" });
    }
    await prisma.user.delete({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ─── Conta do usuário logado ───────────────────────────────────

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(sanitize(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** Alterar senha do usuário logado. Requer senha atual. */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Senha atual e nova são obrigatórias." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Nova senha deve ter ao menos 8 caracteres." });
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: "Senha atual incorreta." });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ─── 2FA (TOTP) ────────────────────────────────────────────────

/**
 * Passo 1: gera segredo e retorna QR Code (data URL) pro app authenticator.
 * O segredo fica salvo no banco mas 2FA ainda não é considerado ativo até
 * o cliente confirmar com um código válido.
 */
export const setup2FA = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: "2FA já está ativo." });
    }

    const secret = speakeasy.generateSecret({
      name: `Agentes Virtuais (${user.email})`,
      length: 20,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret.base32 },
    });

    const otpauthUrl = secret.otpauth_url;
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    res.json({
      secret: secret.base32,
      otpauthUrl,
      qrDataUrl,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Passo 2: cliente envia código do app pra confirmar. Se válido,
 * ativa 2FA e retorna 10 códigos de backup (mostrados uma vez só).
 */
export const enable2FA = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Código obrigatório." });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.twoFactorSecret) {
      return res.status(400).json({ error: "Configure o 2FA antes." });
    }
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: "2FA já está ativo." });
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: String(code).replace(/\s/g, ""),
      window: 1,
    });
    if (!valid) return res.status(400).json({ error: "Código inválido." });

    // Gera 10 códigos de backup de uso único.
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase()
    );
    const hashedCodes = await Promise.all(
      backupCodes.map(async (c) => ({ code: await bcrypt.hash(c, 8), used: false }))
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
      },
    });
    res.json({ success: true, backupCodes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** Desativa 2FA — requer senha atual + código atual (ou de backup). */
export const disable2FA = async (req, res) => {
  try {
    const { password, code } = req.body;
    if (!password || !code) {
      return res.status(400).json({ error: "Senha e código são obrigatórios." });
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.twoFactorEnabled) {
      return res.status(400).json({ error: "2FA não está ativo." });
    }

    const okPass = await bcrypt.compare(password, user.password);
    if (!okPass) return res.status(401).json({ error: "Senha incorreta." });

    const okTotp = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: String(code).replace(/\s/g, ""),
      window: 1,
    });
    if (!okTotp) return res.status(400).json({ error: "Código inválido." });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      },
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

