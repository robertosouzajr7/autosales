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

const version = () => process.env.META_GRAPH_VERSION || "v21.0";

function redirectUri() {
  if (process.env.META_REDIRECT_URI) return process.env.META_REDIRECT_URI;
  const base = process.env.FRONTEND_URL || "http://localhost:8080";
  return `${base.replace(/\/$/, "")}/api/auth/meta/callback`;
}

function isConfigured() {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

// GET /channels/instagram/oauth-url (autenticada)
export const getOAuthUrl = async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({
        error: "Login com a Meta não configurado no servidor (META_APP_ID/META_APP_SECRET).",
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
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
