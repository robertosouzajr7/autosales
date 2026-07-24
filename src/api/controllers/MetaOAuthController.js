import jwt from "jsonwebtoken";
import axios from "axios";
import prisma from "../config/prisma.js";
import JWT_SECRET from "../config/jwt.js";

/**
 * Conexão do Instagram em 1 clique via OAuth da Meta (Facebook Login).
 *
 * Fluxo:
 *  1. Painel chama GET /channels/instagram/oauth-url → devolve a URL do
 *     diálogo de login da Meta (tenant embutido no "state" assinado).
 *  2. Usuário autoriza → Meta redireciona para GET /api/auth/meta/callback
 *     (rota pública) com ?code&state.
 *  3. Trocamos o code por um user token → token de longa duração → listamos
 *     as Páginas do usuário e detectamos as que têm Instagram Business
 *     vinculado. Para cada uma: salvamos igId/pageId/page token e assinamos
 *     a página no app (subscribed_apps: messages) — sem isso a Meta não
 *     entrega o conteúdo das DMs.
 *  4. Redireciona de volta para /connections com o resultado.
 *
 * Requer no ambiente:
 *  - META_APP_ID e META_APP_SECRET (app da Meta)
 *  - META_REDIRECT_URI (= {URL_PUBLICA}/api/auth/meta/callback), registrada
 *    em Facebook Login → Valid OAuth Redirect URIs no app da Meta.
 */

const SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_manage_metadata",
  "pages_messaging",
].join(",");

// Escopos do fluxo nativo "API do Instagram com login do Instagram".
const IG_LOGIN_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
].join(",");

const version = () => process.env.META_GRAPH_VERSION || "v21.0";

function redirectUri() {
  if (process.env.META_REDIRECT_URI) return process.env.META_REDIRECT_URI;
  const base = process.env.FRONTEND_URL || "http://localhost:8080";
  return `${base.replace(/\/$/, "")}/api/auth/meta/callback`;
}

function igRedirectUri() {
  if (process.env.META_IG_REDIRECT_URI) return process.env.META_IG_REDIRECT_URI;
  const base = process.env.FRONTEND_URL || "http://localhost:8080";
  return `${base.replace(/\/$/, "")}/api/auth/instagram/callback`;
}

function isConfigured() {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

// Fluxo nativo Instagram Login: usa o ID e a chave do APP INSTAGRAM
// (Produtos → Instagram → configurações da API), não os do app Facebook.
function isIgLoginConfigured() {
  return !!(process.env.META_IG_APP_ID && process.env.META_IG_APP_SECRET);
}

// GET /channels/instagram/oauth-url (autenticada)
// Preferência: fluxo nativo Instagram Login (casa com o produto "API do
// Instagram com login do Instagram" — o mesmo cujo secret assina os webhooks).
// Fallback: Facebook Login (páginas vinculadas).
export const getOAuthUrl = async (req, res) => {
  try {
    if (isIgLoginConfigured()) {
      const state = jwt.sign({ tenantId: req.tenantId, kind: "ig_login" }, JWT_SECRET, { expiresIn: "15m" });
      const url =
        `https://www.instagram.com/oauth/authorize` +
        `?client_id=${encodeURIComponent(process.env.META_IG_APP_ID)}` +
        `&redirect_uri=${encodeURIComponent(igRedirectUri())}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(IG_LOGIN_SCOPES)}` +
        `&state=${encodeURIComponent(state)}`;
      return res.json({ url, flow: "instagram_login" });
    }

    if (!isConfigured()) {
      return res.status(400).json({
        error: "Login não configurado no servidor (defina META_IG_APP_ID/META_IG_APP_SECRET ou META_APP_ID/META_APP_SECRET).",
      });
    }
    const state = jwt.sign({ tenantId: req.tenantId, kind: "meta_ig" }, JWT_SECRET, { expiresIn: "15m" });
    const url =
      `https://www.facebook.com/${version()}/dialog/oauth` +
      `?client_id=${encodeURIComponent(process.env.META_APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri())}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&response_type=code`;
    res.json({ url, flow: "facebook_login" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Assina a conta Instagram no app (pipeline Instagram Login) para receber os
 * webhooks de mensagem com conteúdo. Usa o token de usuário Instagram (IGAA…).
 */
export async function subscribeInstagramAccount(igToken) {
  const r = await axios.post(
    `https://graph.instagram.com/${version()}/me/subscribed_apps`,
    null,
    { params: { subscribed_fields: "messages", access_token: igToken }, timeout: 15000 }
  );
  return r.data?.success === true;
}

// GET /api/auth/instagram/callback — ROTA PÚBLICA (Instagram Login).
export const handleInstagramCallback = async (req, res) => {
  const frontend = process.env.FRONTEND_URL || "http://localhost:8080";
  const back = (status, extra = "") =>
    res.redirect(`${frontend}/connections?instagram=${status}${extra}`);

  try {
    const { code, state, error } = req.query;
    if (error) return back("denied");
    if (!code || !state) return back("error");

    let tenantId;
    try {
      const decoded = jwt.verify(String(state), JWT_SECRET);
      if (decoded.kind !== "ig_login") return back("error");
      tenantId = decoded.tenantId;
    } catch {
      return back("expired");
    }

    // 1. code → token de curta duração (form-urlencoded; o Instagram anexa
    // "#_" ao code no redirect — removemos).
    const form = new URLSearchParams({
      client_id: process.env.META_IG_APP_ID,
      client_secret: process.env.META_IG_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: igRedirectUri(),
      code: String(code).replace(/#_$/, ""),
    });
    const tok = await axios.post("https://api.instagram.com/oauth/access_token", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    });
    let igToken = tok.data?.access_token;
    const shortUserId = tok.data?.user_id;
    if (!igToken) return back("error", "&reason=sem%20access_token");

    // 2. curta → longa duração (60 dias, renovável)
    try {
      const long = await axios.get("https://graph.instagram.com/access_token", {
        params: {
          grant_type: "ig_exchange_token",
          client_secret: process.env.META_IG_APP_SECRET,
          access_token: igToken,
        },
        timeout: 15000,
      });
      if (long.data?.access_token) igToken = long.data.access_token;
    } catch (e) {
      console.warn("[IG OAuth] Falha ao alongar token (seguindo com o curto):", e.response?.data?.error?.message || e.message);
    }

    // 3. Perfil — user_id é o ID da conta profissional (mesmo id dos webhooks)
    const me = await axios.get(`https://graph.instagram.com/${version()}/me`, {
      params: { fields: "user_id,username", access_token: igToken },
      timeout: 15000,
    });
    const igId = String(me.data?.user_id || shortUserId || "");
    const username = me.data?.username;
    if (!igId) return back("error", "&reason=sem%20user_id");

    // 4. Salva a conta (upsert por igId)
    const data = {
      name: username ? `@${username}` : `Instagram ${igId.slice(-6)}`,
      igId,
      pageId: null, // fluxo Instagram Login não usa Página
      accessToken: igToken,
      channel: "INSTAGRAM",
      status: "CONNECTED",
      enabled: true,
      tenantId,
    };
    const existing = await prisma.whatsAppAccount.findFirst({ where: { igId, channel: "INSTAGRAM" } });
    if (existing && existing.tenantId !== tenantId) {
      console.warn(`[IG OAuth] igId ${igId} já pertence a outro tenant.`);
      return back("error", "&reason=conta%20j%C3%A1%20conectada%20em%20outro%20cliente");
    }
    if (existing) await prisma.whatsAppAccount.update({ where: { id: existing.id }, data });
    else await prisma.whatsAppAccount.create({ data });

    // 5. Assina a conta no app (é isso que faz os webhooks de mensagem
    // chegarem COM conteúdo pelo pipeline do Instagram Login)
    try {
      const ok = await subscribeInstagramAccount(igToken);
      console.log(`[IG OAuth] ✅ @${username || igId} conectado; subscribed_apps=${ok}`);
    } catch (e) {
      console.warn("[IG OAuth] Falha ao assinar a conta no app:", e.response?.data?.error?.message || e.message);
    }

    return back("connected", "&n=1");
  } catch (e) {
    const metaMsg = e.response?.data?.error_message || e.response?.data?.error?.message || e.message;
    console.error("[IG OAuth] callback falhou:", metaMsg, JSON.stringify(e.response?.data || {}).slice(0, 300));
    return back("error", `&reason=${encodeURIComponent(String(metaMsg).slice(0, 160))}`);
  }
};

/**
 * Assina a Página no app para receber eventos de mensagem. Idempotente.
 * Sem esta assinatura a Meta não entrega o conteúdo das DMs do Instagram.
 */
export async function subscribePageToApp(pageId, pageToken) {
  const r = await axios.post(
    `https://graph.facebook.com/${version()}/${pageId}/subscribed_apps`,
    null,
    { params: { subscribed_fields: "messages", access_token: pageToken }, timeout: 15000 }
  );
  return r.data?.success === true;
}

// GET /api/auth/meta/callback — ROTA PÚBLICA (Meta redireciona para cá).
export const handleCallback = async (req, res) => {
  const frontend = process.env.FRONTEND_URL || "http://localhost:8080";
  const back = (status, extra = "") =>
    res.redirect(`${frontend}/connections?instagram=${status}${extra}`);

  try {
    const { code, state, error } = req.query;
    if (error) return back("denied");
    if (!code || !state) return back("error");

    let tenantId;
    try {
      const decoded = jwt.verify(String(state), JWT_SECRET);
      if (decoded.kind !== "meta_ig") return back("error");
      tenantId = decoded.tenantId;
    } catch {
      return back("expired");
    }

    // 1. code → user access token (curta duração)
    const tokenRes = await axios.get(
      `https://graph.facebook.com/${version()}/oauth/access_token`,
      {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri: redirectUri(),
          code: String(code),
        },
        timeout: 15000,
      }
    );
    let userToken = tokenRes.data?.access_token;
    if (!userToken) return back("error");

    // 2. user token → longa duração (page tokens herdados não expiram)
    try {
      const longRes = await axios.get(
        `https://graph.facebook.com/${version()}/oauth/access_token`,
        {
          params: {
            grant_type: "fb_exchange_token",
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            fb_exchange_token: userToken,
          },
          timeout: 15000,
        }
      );
      if (longRes.data?.access_token) userToken = longRes.data.access_token;
    } catch (e) {
      console.warn("[Meta OAuth] Falha ao alongar token (seguindo com o curto):", e.message);
    }

    // 3. Páginas do usuário + Instagram Business vinculado
    const pagesRes = await axios.get(
      `https://graph.facebook.com/${version()}/me/accounts`,
      {
        params: {
          fields: "id,name,access_token,instagram_business_account{id,username}",
          access_token: userToken,
          limit: 50,
        },
        timeout: 15000,
      }
    );
    const pages = (pagesRes.data?.data || []).filter((p) => p.instagram_business_account?.id);
    if (!pages.length) return back("nopage");

    // 4. Salva cada conta (upsert por igId) e assina a página no app
    let connected = 0;
    for (const page of pages) {
      const ig = page.instagram_business_account;
      const data = {
        name: ig.username ? `@${ig.username}` : page.name,
        igId: ig.id,
        pageId: page.id,
        accessToken: page.access_token,
        channel: "INSTAGRAM",
        status: "CONNECTED",
        enabled: true,
        tenantId,
      };

      const existing = await prisma.whatsAppAccount.findFirst({
        where: { igId: ig.id, channel: "INSTAGRAM" },
      });
      if (existing && existing.tenantId !== tenantId) {
        console.warn(`[Meta OAuth] igId ${ig.id} já pertence a outro tenant — ignorando.`);
        continue;
      }
      if (existing) {
        await prisma.whatsAppAccount.update({ where: { id: existing.id }, data });
      } else {
        await prisma.whatsAppAccount.create({ data });
      }

      try {
        await subscribePageToApp(page.id, page.access_token);
      } catch (e) {
        console.warn(`[Meta OAuth] Falha ao assinar página ${page.id} no app:`, e.response?.data?.error?.message || e.message);
      }
      connected++;
    }

    if (!connected) return back("error");
    return back("connected", `&n=${connected}`);
  } catch (e) {
    const metaMsg = e.response?.data?.error?.message || e.message;
    console.error("[Meta OAuth] callback falhou:", metaMsg);
    return back("error", `&reason=${encodeURIComponent(metaMsg.slice(0, 160))}`);
  }
};
