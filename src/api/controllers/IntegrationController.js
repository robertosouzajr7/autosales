import prisma from "../config/prisma.js";
import { gerarChave } from "../middlewares/apiKey.js";
import { getProvider, catalogoProvedores } from "../services/CrmProviders.js";
import { pullConnection, importarContatos } from "../services/CrmSyncService.js";

/**
 * Integrações da conta: chaves de API e conexões com CRM.
 *
 * Tudo aqui é do administrador da conta (módulo `connections`).
 */

// ── Chaves de API ─────────────────────────────────────────────────

export const listApiKeys = async (req, res) => {
  try {
    const chaves = await prisma.apiKey.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, revokedAt: true, createdAt: true },
    });
    res.json(chaves);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** A chave completa aparece nesta resposta e nunca mais. */
export const createApiKey = async (req, res) => {
  try {
    const { name, scopes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Dê um nome para a chave." });

    const { texto, prefix, hash } = gerarChave();
    const chave = await prisma.apiKey.create({
      data: {
        tenantId: req.tenantId,
        name: String(name).trim(),
        prefix,
        hash,
        scopes: Array.isArray(scopes) && scopes.length ? scopes.join(",") : "contacts:read,contacts:write",
      },
    });
    res.json({
      id: chave.id, name: chave.name, prefix: chave.prefix, scopes: chave.scopes, createdAt: chave.createdAt,
      key: texto,
      aviso: "Guarde esta chave agora. Ela não será mostrada de novo.",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const revokeApiKey = async (req, res) => {
  try {
    const chave = await prisma.apiKey.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!chave) return res.status(404).json({ error: "Chave não encontrada." });
    await prisma.apiKey.update({ where: { id: chave.id }, data: { revokedAt: new Date() } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── Conexões com CRM ──────────────────────────────────────────────

/** Catálogo dos CRMs suportados, para a tela montar o formulário. */
export const listCrmProviders = async (_req, res) => {
  res.json(catalogoProvedores());
};

function apresentarConexao(conn) {
  return {
    id: conn.id,
    provider: conn.provider,
    name: conn.name,
    direction: conn.direction,
    active: conn.active,
    // Credencial nunca volta para a tela; só a ponta, para reconhecer qual é.
    tokenPreview: conn.accessToken ? `••••${String(conn.accessToken).slice(-4)}` : null,
    config: seguro(conn.config),
    lastSyncAt: conn.lastSyncAt,
    lastStatus: conn.lastStatus,
    lastError: conn.lastError,
    syncedCount: conn.syncedCount,
    createdAt: conn.createdAt,
  };
}

function seguro(json) {
  try { return json ? JSON.parse(json) : {}; } catch { return {}; }
}

export const listCrmConnections = async (req, res) => {
  try {
    const conexoes = await prisma.crmConnection.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "asc" },
    });
    res.json(conexoes.map(apresentarConexao));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** Cria ou atualiza a conexão com um CRM (uma por provedor). */
export const saveCrmConnection = async (req, res) => {
  try {
    const { provider, accessToken, refreshToken, direction, active, config, fieldMap, name } = req.body || {};
    const adaptador = getProvider(provider);
    if (!adaptador) return res.status(400).json({ error: "CRM não suportado." });

    const existente = await prisma.crmConnection.findFirst({
      where: { tenantId: req.tenantId, provider: adaptador.id },
    });
    // Salvar sem mandar o token de novo mantém o que já estava guardado.
    const token = accessToken || existente?.accessToken;
    if (!token) return res.status(400).json({ error: "Informe o token de acesso do CRM." });

    const dados = {
      provider: adaptador.id,
      name: name || adaptador.label,
      accessToken: token,
      refreshToken: refreshToken ?? existente?.refreshToken ?? null,
      direction: ["IN", "OUT", "BOTH"].includes(direction) ? direction : existente?.direction || "BOTH",
      active: active === undefined ? existente?.active ?? true : !!active,
      config: config ? JSON.stringify(config) : existente?.config ?? null,
      fieldMap: fieldMap ? JSON.stringify(fieldMap) : existente?.fieldMap ?? null,
    };

    // Só grava depois de provar que a credencial funciona: conexão salva e
    // quebrada é pior do que conexão não salva.
    try {
      await adaptador.testar({ ...dados, config: dados.config });
    } catch (e) {
      return res.status(400).json({ error: `Não consegui conectar: ${e.message}` });
    }

    const conn = existente
      ? await prisma.crmConnection.update({
          where: { id: existente.id },
          data: { ...dados, lastStatus: "OK", lastError: null },
        })
      : await prisma.crmConnection.create({
          data: { ...dados, tenantId: req.tenantId, lastStatus: "OK" },
        });

    res.json(apresentarConexao(conn));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const testCrmConnection = async (req, res) => {
  try {
    const conn = await prisma.crmConnection.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!conn) return res.status(404).json({ error: "Conexão não encontrada." });
    const adaptador = getProvider(conn.provider);
    const r = await adaptador.testar(conn);
    await prisma.crmConnection.update({ where: { id: conn.id }, data: { lastStatus: "OK", lastError: null } });
    res.json({ success: true, ...r });
  } catch (e) {
    await prisma.crmConnection
      .update({ where: { id: req.params.id }, data: { lastStatus: "ERROR", lastError: e.message } })
      .catch(() => {});
    res.status(400).json({ error: e.message });
  }
};

/** Puxa agora, sem esperar o próximo ciclo automático. */
export const syncCrmConnection = async (req, res) => {
  try {
    const conn = await prisma.crmConnection.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!conn) return res.status(404).json({ error: "Conexão não encontrada." });
    const r = await pullConnection(conn);
    if (r.erro) return res.status(400).json({ error: r.erro });
    res.json({ success: true, ...r });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteCrmConnection = async (req, res) => {
  try {
    const conn = await prisma.crmConnection.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!conn) return res.status(404).json({ error: "Conexão não encontrada." });
    await prisma.crmConnection.delete({ where: { id: conn.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const crmSyncLogs = async (req, res) => {
  try {
    const conn = await prisma.crmConnection.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!conn) return res.status(404).json({ error: "Conexão não encontrada." });
    const logs = await prisma.crmSyncLog.findMany({
      where: { connectionId: conn.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Webhook do RD Station. Sem autenticação de sessão — a conexão é
 * identificada pelo id na URL e validada pelo token compartilhado.
 */
export const crmWebhook = async (req, res) => {
  try {
    const conn = await prisma.crmConnection.findUnique({ where: { id: req.params.connectionId } });
    if (!conn || !conn.active) return res.status(404).json({ error: "Conexão não encontrada." });

    const adaptador = getProvider(conn.provider);
    if (!adaptador?.doWebhook) return res.status(400).json({ error: "Este CRM não envia webhook." });

    const contatos = adaptador.doWebhook(req.body || {});
    const r = await importarContatos(conn, contatos);
    await prisma.crmConnection.update({ where: { id: conn.id }, data: { lastSyncAt: new Date(), lastStatus: "OK" } });
    res.json({ success: true, ...r });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export default {
  listApiKeys, createApiKey, revokeApiKey,
  listCrmProviders, listCrmConnections, saveCrmConnection,
  testCrmConnection, syncCrmConnection, deleteCrmConnection, crmSyncLogs, crmWebhook,
};
