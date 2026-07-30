import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import {
  MODULES, MODULE_IDS, PROFILES, PROFILE_IDS,
  resolvePermissions, getProfile, isAdminProfile,
} from "../services/AccessProfiles.js";
import { invalidateUserCache } from "../middlewares/permissions.js";

// Perfis que um tenant pode atribuir. SUPERADMIN nunca sai de rota de tenant.
const TENANT_ROLES = PROFILE_IDS;

// Campo que nunca deve ser retornado no JSON.
function sanitize(user) {
  if (!user) return user;
  const { password, twoFactorSecret, twoFactorBackupCodes,
          emailVerificationToken, passwordResetToken, ...safe } = user;
  return safe;
}

/** Colaborador com o que a tela precisa: perfil, permissões e filas. */
function apresentar(user) {
  const limpo = sanitize(user);
  return {
    ...limpo,
    profileLabel: getProfile(user.role).label,
    isAdmin: isAdminProfile(user.role),
    permissions: resolvePermissions(user),
    // Diferencia "o admin escolheu estes módulos" de "está herdando do perfil".
    permissionsCustom: !!user.permissions,
    queues: (user.queueMemberships || []).map((m) => ({ id: m.queue.id, name: m.queue.name })),
  };
}

export const getUsers = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });
    const users = await prisma.user.findMany({
      // O suporte da plataforma (SUPERADMIN) pode estar vinculado a um tenant
      // por herança do cadastro antigo: ele não é colaborador do cliente e
      // não aparece — nem para listar, nem para o admin mexer.
      where: { tenantId, role: { not: "SUPERADMIN" } },
      include: { queueMemberships: { include: { queue: { select: { id: true, name: true } } } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    res.json(users.map(apresentar));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** Catálogo de perfis e módulos, para a tela montar o formulário. */
export const getAccessCatalog = async (_req, res) => {
  res.json({ profiles: PROFILES, modules: MODULES });
};

export const createUser = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { name, email, password, role, permissions, queueIds, jobTitle } = req.body;
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
        jobTitle: jobTitle || null,
        // Sem escolha explícita, valem os módulos do perfil.
        permissions: normalizarPermissoes(permissions),
        tenantId,
      },
    });
    await sincronizarFilas(user.id, tenantId, queueIds);

    const completo = await prisma.user.findUnique({
      where: { id: user.id },
      include: { queueMemberships: { include: { queue: { select: { id: true, name: true } } } } },
    });
    res.json(apresentar(completo));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** Só grava a lista quando ela vem de fato — e só módulos que existem. */
function normalizarPermissoes(permissions) {
  if (!Array.isArray(permissions)) return undefined;
  const limpa = [...new Set(permissions.filter((m) => MODULE_IDS.includes(m)))];
  return JSON.stringify(limpa);
}

async function sincronizarFilas(userId, tenantId, queueIds) {
  if (!Array.isArray(queueIds)) return;
  const validas = await prisma.serviceQueue.findMany({
    where: { id: { in: queueIds }, tenantId },
    select: { id: true },
  });
  await prisma.queueMember.deleteMany({ where: { userId } });
  if (validas.length) {
    await prisma.queueMember.createMany({
      data: validas.map((q) => ({ queueId: q.id, userId })),
      skipDuplicates: true,
    });
  }
}

/**
 * Edita o colaborador: dados, perfil, módulos liberados e filas.
 * O admin não pode rebaixar nem desativar a si mesmo — é o jeito mais comum
 * de uma conta ficar sem ninguém para administrar.
 */
export const updateUser = async (req, res) => {
  try {
    const alvo = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId, role: { not: "SUPERADMIN" } } });
    if (!alvo) return res.status(404).json({ error: "Colaborador não encontrado." });

    const { name, email, role, permissions, queueIds, jobTitle, active } = req.body;
    const proprio = alvo.id === req.userId;

    if (proprio && role && role !== alvo.role && !isAdminProfile(role)) {
      return res.status(400).json({ error: "Você não pode tirar o seu próprio acesso de administrador." });
    }
    if (proprio && active === false) {
      return res.status(400).json({ error: "Você não pode desativar o próprio acesso." });
    }
    if (alvo.role === "OWNER" && !proprio && (active === false || (role && role !== "OWNER"))) {
      return res.status(403).json({ error: "O proprietário da conta não pode ser desativado nem rebaixado." });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (jobTitle !== undefined) data.jobTitle = jobTitle || null;
    if (role !== undefined) {
      if (!TENANT_ROLES.includes(role)) return res.status(400).json({ error: `Perfil desconhecido: ${role}` });
      data.role = role;
      // Trocar de perfil sem mandar permissões volta para o padrão da função.
      if (permissions === undefined) data.permissions = null;
    }
    if (permissions !== undefined) data.permissions = normalizarPermissoes(permissions) ?? null;
    if (active !== undefined) {
      data.active = !!active;
      data.deactivatedAt = active ? null : new Date();
    }
    if (email !== undefined) {
      const normalizado = String(email).trim().toLowerCase();
      if (normalizado !== alvo.email) {
        const dup = await prisma.user.findUnique({ where: { email: normalizado } });
        if (dup) return res.status(409).json({ error: "Este e-mail já está em uso." });
        data.email = normalizado;
      }
    }

    await prisma.user.update({ where: { id: alvo.id }, data });
    await sincronizarFilas(alvo.id, req.tenantId, queueIds);
    // O cache de permissões precisa cair: senão a mudança só valeria em 30s.
    invalidateUserCache(alvo.id);

    const atualizado = await prisma.user.findUnique({
      where: { id: alvo.id },
      include: { queueMemberships: { include: { queue: { select: { id: true, name: true } } } } },
    });
    res.json(apresentar(atualizado));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** Liga/desliga o acesso sem apagar histórico de atendimento. */
export const setUserActive = async (req, res) => {
  req.body = { active: !!req.body?.active };
  return updateUser(req, res);
};

/** Admin define uma nova senha para o colaborador (esqueceu, trocou de pessoa). */
export const resetUserPassword = async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "A nova senha precisa de ao menos 8 caracteres." });
    }
    const alvo = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId, role: { not: "SUPERADMIN" } } });
    if (!alvo) return res.status(404).json({ error: "Colaborador não encontrado." });

    await prisma.user.update({
      where: { id: alvo.id },
      data: { password: await bcrypt.hash(password, 10), passwordResetToken: null, passwordResetExpiresAt: null },
    });
    invalidateUserCache(alvo.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: "Você não pode excluir o próprio usuário" });
    }
    const alvo = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId, role: { not: "SUPERADMIN" } } });
    if (!alvo) return res.status(404).json({ error: "Colaborador não encontrado." });
    if (alvo.role === "OWNER") {
      return res.status(403).json({ error: "O proprietário da conta não pode ser excluído. Transfira a conta antes." });
    }

    await prisma.user.delete({ where: { id: alvo.id } });
    invalidateUserCache(alvo.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ─── Conta do usuário logado ───────────────────────────────────

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { queueMemberships: { include: { queue: { select: { id: true, name: true } } } } },
    });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    // A tela usa isto para montar o menu: sem as permissões aqui, o frontend
    // mostraria áreas que a API vai recusar.
    res.json(apresentar(user));
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

