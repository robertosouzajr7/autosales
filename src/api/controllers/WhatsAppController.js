import prisma from "../config/prisma.js";
import { WhatsAppManager } from "../../../whatsapp.js";

export const getAccounts = async (req, res) => {
  try {
    // Filtro opcional por canal (?channel=WHATSAPP|INSTAGRAM).
    const channel = req.query.channel;
    const where = { tenantId: req.tenantId };
    if (channel === "WHATSAPP" || channel === "INSTAGRAM") where.channel = channel;

    const accounts = await prisma.whatsAppAccount.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const formatted = accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      phone: acc.phone || "",
      status: acc.status,
      channel: acc.channel || "WHATSAPP",
      enabled: acc.enabled !== false,
      handle: acc.igId ? `@${acc.name}` : (acc.phone || ""),
      instance: acc.id.substring(0, 8),
      lastActive: acc.updatedAt.toLocaleString(),
      // Dados da conexão Instagram — visíveis para o dono da conta (a UI
      // mostra o token oculto por padrão, com opção de revelar).
      igId: acc.igId || null,
      pageId: acc.pageId || null,
      accessToken: acc.channel === "INSTAGRAM" ? (acc.accessToken || null) : undefined,
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createAccount = async (req, res) => {
  try {
    const { name } = req.body;
    const account = await prisma.whatsAppAccount.create({
      data: {
        name,
        tenantId: req.tenantId,
        status: "DISCONNECTED"
      }
    });
    res.json({ id: account.id, name: account.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;

    // Disconnect session if running
    await WhatsAppManager.disconnectSession(id);

    await prisma.whatsAppAccount.delete({
      where: { id, tenantId: req.tenantId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /whatsapp/accounts/:id/reconnect
// Reconecta/atualiza uma conexão travada: limpa cooldown + sessão presa e
// deixa pronta para reabrir o QR (ou reconectar direto se as credenciais
// ainda valem). O front deve, em seguida, abrir o stream de QR.
export const reconnectAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id, tenantId: req.tenantId },
    });
    if (!account) return res.status(404).json({ error: "Conexão não encontrada." });

    await WhatsAppManager.forceReconnect(id);
    res.json({ success: true, message: "Reconexão iniciada. Abrindo QR se necessário." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createMetaAccount = async (req, res) => {
  try {
    const { name, phone, phoneId, wabaId, accessToken } = req.body;
    const account = await prisma.whatsAppAccount.create({
      data: {
        name,
        phone,
        phoneId,
        wabaId,
        accessToken,
        channel: "WHATSAPP",
        status: "CONNECTED", // Meta is immediately "connected" if token is valid
        tenantId: req.tenantId
      }
    });
    res.json({ id: account.id, name: account.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Conecta uma conta do Instagram Direct (via Meta). Dois modos:
//  A) Instagram Login (token IGAA… gerado no painel da Meta): basta o token;
//     o igId e o nome são descobertos por graph.instagram.com/me. Sem Page ID.
//  B) Via Página do Facebook: exige IG Account ID + Page ID + Page Access Token.
export const createInstagramAccount = async (req, res) => {
  try {
    let { name, igId, pageId, accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "O token de acesso é obrigatório." });
    }

    const isIgToken = accessToken.startsWith("IG"); // Instagram Login
    const version = process.env.META_GRAPH_VERSION || "v21.0";
    const axios = (await import("axios")).default;

    if (isIgToken) {
      // Descobre igId/username pelo próprio token — o usuário só cola o token.
      try {
        const me = await axios.get(`https://graph.instagram.com/${version}/me`, {
          params: { fields: "user_id,username", access_token: accessToken }, timeout: 15000,
        });
        igId = String(me.data?.user_id || igId || "");
        if (!name) name = me.data?.username ? `@${me.data.username}` : `Instagram ${igId.slice(-6)}`;
      } catch (e) {
        return res.status(400).json({ error: `Token inválido: ${e.response?.data?.error?.message || e.message}` });
      }
      if (!igId) return res.status(400).json({ error: "Não foi possível descobrir o ID da conta a partir do token." });
      pageId = null;
    } else {
      // Fluxo via Página: exige os três campos.
      if (!name || !igId || !pageId) {
        return res.status(400).json({ error: "Para token de Página, informe Nome, IG Account ID e Page ID." });
      }
    }

    const dup = await prisma.whatsAppAccount.findFirst({ where: { igId, channel: "INSTAGRAM" } });
    if (dup) return res.status(409).json({ error: "Esta conta do Instagram já está conectada." });

    // Assina a conta no app para receber webhooks de mensagem com conteúdo.
    try {
      if (isIgToken) {
        const { subscribeInstagramAccount } = await import("./MetaOAuthController.js");
        await subscribeInstagramAccount(accessToken);
      } else {
        const { subscribePageToApp } = await import("./MetaOAuthController.js");
        await subscribePageToApp(pageId, accessToken);
      }
    } catch (e) {
      console.warn("[Instagram] Falha ao assinar no app:", e.response?.data?.error?.message || e.message);
    }

    const account = await prisma.whatsAppAccount.create({
      data: {
        name,
        igId,
        pageId,
        accessToken,
        channel: "INSTAGRAM",
        status: "CONNECTED",
        tenantId: req.tenantId
      }
    });
    res.json({ id: account.id, name: account.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Edita uma conexão Instagram (dados e/ou toggle habilitado).
// Campos ausentes/vazios são mantidos como estão.
export const updateInstagramAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, igId, pageId, accessToken, enabled } = req.body;

    const account = await prisma.whatsAppAccount.findFirst({
      where: { id, tenantId: req.tenantId, channel: "INSTAGRAM" }
    });
    if (!account) return res.status(404).json({ error: "Conexão não encontrada." });

    const data = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (typeof igId === "string" && igId.trim()) data.igId = igId.trim();
    if (typeof pageId === "string" && pageId.trim()) data.pageId = pageId.trim();
    if (typeof accessToken === "string" && accessToken.trim()) data.accessToken = accessToken.trim();
    if (typeof enabled === "boolean") data.enabled = enabled;

    // igId é a chave de roteamento do webhook — não pode colidir com outra conta.
    if (data.igId && data.igId !== account.igId) {
      const dup = await prisma.whatsAppAccount.findFirst({
        where: { igId: data.igId, channel: "INSTAGRAM", NOT: { id } }
      });
      if (dup) return res.status(409).json({ error: "Este Instagram já está conectado em outra conta." });
    }

    const updated = await prisma.whatsAppAccount.update({ where: { id }, data });
    res.json({ success: true, id: updated.id, enabled: updated.enabled });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Testa a conexão Instagram contra a Graph API e atualiza o status.
// Valida o token consultando o próprio IG Business Account.
export const testInstagramConnection = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id, tenantId: req.tenantId, channel: "INSTAGRAM" }
    });
    if (!account) return res.status(404).json({ error: "Conexão não encontrada." });
    if (!account.igId || !account.accessToken) {
      return res.status(400).json({ error: "Conexão incompleta: IG Account ID e Access Token são obrigatórios." });
    }

    const version = process.env.META_GRAPH_VERSION || "v21.0";
    const axios = (await import("axios")).default;
    const isIgToken = account.accessToken.startsWith("IG"); // Instagram Login (IGAA…)
    try {
      // Valida o token no pipeline correto.
      const r = isIgToken
        ? await axios.get(`https://graph.instagram.com/${version}/me`, {
            params: { fields: "user_id,username", access_token: account.accessToken }, timeout: 15000 })
        : await axios.get(`https://graph.facebook.com/${version}/${account.igId}`, {
            params: { fields: "id,username", access_token: account.accessToken }, timeout: 15000 });

      // Garante a assinatura no app (sem isso a Meta não entrega o conteúdo
      // das DMs — chegam só eventos parciais como message_edit).
      let subscribed = false;
      try {
        if (isIgToken) {
          const { subscribeInstagramAccount } = await import("./MetaOAuthController.js");
          subscribed = await subscribeInstagramAccount(account.accessToken);
        } else if (account.pageId) {
          const { subscribePageToApp } = await import("./MetaOAuthController.js");
          subscribed = await subscribePageToApp(account.pageId, account.accessToken);
        }
      } catch (subErr) {
        console.warn(`[Instagram Test] Falha ao assinar no app:`, subErr.response?.data?.error?.message || subErr.message);
      }

      await prisma.whatsAppAccount.update({ where: { id }, data: { status: "CONNECTED" } });
      return res.json({
        success: true,
        status: "CONNECTED",
        username: r.data?.username || null,
        subscribed,
        message: `${r.data?.username ? `Conectado como @${r.data.username}.` : "Token válido — conexão OK."}${subscribed ? " Conta assinada para receber mensagens." : ""}`,
      });
    } catch (e) {
      const metaError = e.response?.data?.error;
      await prisma.whatsAppAccount.update({ where: { id }, data: { status: "DISCONNECTED" } });
      return res.status(400).json({
        success: false,
        status: "DISCONNECTED",
        error: metaError
          ? `Meta: ${metaError.message} (código ${metaError.code})`
          : `Falha ao contatar a Graph API: ${e.message}`,
        hint: metaError?.code === 190
          ? "Token inválido ou expirado — gere um novo Page Access Token e salve na conexão."
          : "Confira o IG Account ID e o token. Veja o guia de conexão do Instagram.",
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const qrCodeStream = async (req, res) => {
  const { id } = req.params;
  
  // SSE Setup
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendEvent = (data) => {
    res.write(`data: ${data}\n\n`);
  };

  sendEvent(JSON.stringify({ status: "WAITING" }));

  try {
    // Check if account belongs to user
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id, tenantId: req.tenantId }
    });
    if (!account) {
      sendEvent(JSON.stringify({ status: "ERROR", message: "Conta não encontrada" }));
      return res.end();
    }

    // Attempt to connect and emit QR codes
    WhatsAppManager.createSession(id, (dataStr) => {
      sendEvent(dataStr);
    });

    req.on('close', () => {
      // Don't disconnect session just because SSE closed, they might just close modal
    });

  } catch (error) {
    sendEvent(JSON.stringify({ status: "ERROR", message: error.message }));
    res.end();
  }
};
