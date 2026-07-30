import prisma from "../config/prisma.js";
import { resolvePermissions, isAdminProfile } from "../services/AccessProfiles.js";

/**
 * Permissão por módulo, checada no servidor.
 *
 * Esconder o menu no frontend não protege nada: quem souber a URL da API
 * continua chamando. Aqui a rota só passa se o usuário tiver o módulo, e
 * colaborador desativado é barrado antes de qualquer coisa.
 */

// Cache curto do usuário: uma consulta por requisição seria desperdício num
// inbox que faz várias chamadas por segundo. 30s é curto o bastante para
// desativar alguém e o efeito aparecer quase na hora.
const CACHE_MS = 30 * 1000;
const cache = new Map();

export function invalidateUserCache(userId) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

async function carregarUsuario(userId) {
  const agora = Date.now();
  const guardado = cache.get(userId);
  if (guardado && guardado.expira > agora) return guardado.user;

  const user = await prisma.user
    .findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, active: true, permissions: true, tenantId: true },
    })
    .catch(() => null);

  cache.set(userId, { user, expira: agora + CACHE_MS });
  return user;
}

/**
 * Carrega o usuário da requisição e barra quem foi desativado.
 * Roda depois do authMiddleware, para todas as rotas do tenant.
 */
export async function loadUser(req, res, next) {
  try {
    // Rotas de admin da plataforma não têm usuário de tenant.
    if (!req.userId) return next();

    const user = await carregarUsuario(req.userId);
    if (!user) return res.status(401).json({ error: "Usuário não encontrado." });
    if (user.active === false) {
      return res.status(403).json({
        error: "Seu acesso foi desativado. Fale com o administrador da conta.",
        deactivated: true,
      });
    }

    req.user = user;
    req.userRole = user.role;
    req.permissions = resolvePermissions(user);
    req.isTenantAdmin = isAdminProfile(user.role);
    next();
  } catch (e) {
    console.error("[Permissões] Falha ao carregar o usuário:", e.message);
    next();
  }
}

/** Exige um módulo específico. */
export function requirePermission(modulo) {
  return (req, res, next) => {
    // Sem usuário resolvido (token de serviço, admin da plataforma) segue.
    if (!req.user) return next();
    if (req.permissions?.includes(modulo)) return next();
    return res.status(403).json({
      error: "Você não tem acesso a esta área. Peça ao administrador da conta.",
      missingPermission: modulo,
    });
  };
}

/** Exige que o usuário administre a conta (gestão de colaboradores). */
export function requireTenantAdmin(req, res, next) {
  if (!req.user) return next();
  if (req.isTenantAdmin) return next();
  return res.status(403).json({ error: "Apenas administradores da conta podem fazer isso." });
}
