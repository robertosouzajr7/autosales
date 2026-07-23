import { google } from "googleapis";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import JWT_SECRET from "../config/jwt.js";

/**
 * Conexão do Google Calendar via OAuth 2.0 (Authorization Code + refresh token).
 *
 * Fluxo:
 *  1. Painel chama GET /google/auth-url → devolve a URL de consentimento do
 *     Google. O tenant é embutido num "state" assinado (JWT curto), porque o
 *     callback do Google volta sem o header Authorization.
 *  2. Usuário autoriza no Google → Google redireciona para GET /google/callback
 *     (rota pública) com ?code&state. Trocamos o code por tokens e salvamos o
 *     refresh_token em tenant.googleRefreshToken.
 *  3. calendar_service.js usa esse refresh_token para ler/gravar eventos.
 *
 * Requer no ambiente: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e
 * GOOGLE_REDIRECT_URI (= {URL_DA_API}/api/google/callback), configurados num
 * projeto do Google Cloud com a Google Calendar API habilitada.
 */

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function isConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
}

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// GET /google/status — o painel usa para decidir o que mostrar.
export const getStatus = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { googleRefreshToken: true },
    });
    res.json({ configured: isConfigured(), connected: !!tenant?.googleRefreshToken });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET /google/auth-url — devolve a URL de consentimento.
export const getAuthUrl = async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({
        error: "Integração Google não configurada no servidor (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI).",
      });
    }
    // state = tenant assinado, validade curta, só para o callback confiar.
    const state = jwt.sign({ tenantId: req.tenantId }, JWT_SECRET, { expiresIn: "15m" });
    const url = oauthClient().generateAuthUrl({
      access_type: "offline",     // necessário para receber refresh_token
      prompt: "consent",          // força refresh_token mesmo em re-conexões
      scope: SCOPES,
      state,
    });
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET /google/callback — ROTA PÚBLICA (Google redireciona para cá).
export const handleCallback = async (req, res) => {
  const frontend = process.env.FRONTEND_URL || "http://localhost:8080";
  const back = (status) => res.redirect(`${frontend}/connections?google=${status}`);
  try {
    const { code, state, error } = req.query;
    if (error) return back("denied");
    if (!code || !state) return back("error");

    let tenantId;
    try {
      ({ tenantId } = jwt.verify(String(state), JWT_SECRET));
    } catch {
      return back("expired");
    }
    if (!tenantId) return back("error");

    const client = oauthClient();
    const { tokens } = await client.getToken(String(code));

    // O refresh_token só vem quando access_type=offline + prompt=consent. Se
    // não veio (usuário já autorizara antes), mantemos o que já existe.
    const data = {};
    if (tokens.refresh_token) data.googleRefreshToken = tokens.refresh_token;

    if (Object.keys(data).length) {
      await prisma.tenant.update({ where: { id: tenantId }, data });
    } else {
      // Sem refresh_token novo e sem token salvo antes = não conectou de fato.
      const t = await prisma.tenant.findUnique({
        where: { id: tenantId }, select: { googleRefreshToken: true },
      });
      if (!t?.googleRefreshToken) return back("notoken");
    }

    return back("connected");
  } catch (e) {
    console.error("[GoogleCalendar] callback falhou:", e.message);
    return back("error");
  }
};

// POST /google/disconnect — remove o vínculo.
export const disconnect = async (req, res) => {
  try {
    await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { googleRefreshToken: null },
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
