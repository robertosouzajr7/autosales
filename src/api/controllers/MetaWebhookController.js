import crypto from "crypto";

/**
 * Webhook oficial da Meta WhatsApp Cloud API.
 *
 * Segurança:
 * - GET  /api/webhook/meta  → handshake de verificação (hub.challenge).
 * - POST /api/webhook/meta  → eventos de mensagem, autenticados por
 *   assinatura HMAC-SHA256 (X-Hub-Signature-256) sobre o corpo cru.
 *
 * O verify token e o app secret pertencem ao App da Meta (globais), então
 * vêm do ambiente — não do banco por tenant. O roteamento para o tenant é
 * feito pelo phone_number_id presente no payload.
 */

// GET: a Meta valida a URL do webhook uma única vez no cadastro.
export const verifyMetaWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = process.env.META_VERIFY_TOKEN;

  if (!expected) {
    console.error("[Meta Webhook] META_VERIFY_TOKEN não configurado.");
    return res.sendStatus(500);
  }

  if (mode === "subscribe" && token === expected) {
    console.log("[Meta Webhook] ✅ Verificação de webhook bem-sucedida.");
    return res.status(200).send(challenge);
  }

  console.warn("[Meta Webhook] ❌ Verificação falhou (token/mode inválidos).");
  return res.sendStatus(403);
};

/**
 * Confere a assinatura HMAC do corpo cru contra o META_APP_SECRET.
 * Retorna true se válida. Usa comparação em tempo constante.
 */
export function isValidMetaSignature(req) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error("[Meta Webhook] META_APP_SECRET não configurado — rejeitando.");
    return false;
  }

  const signature = req.get("x-hub-signature-256");
  if (!signature || !signature.startsWith("sha256=")) return false;

  // req.rawBody é preenchido pelo verify callback do express.json (ver app.js).
  const rawBody = req.rawBody;
  if (!rawBody) return false;

  const expected = "sha256=" + crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// POST: eventos de mensagem recebida.
export const receiveMetaWebhook = async (req, res) => {
  if (!isValidMetaSignature(req)) {
    return res.sendStatus(403);
  }

  // Responde 200 imediatamente: a Meta reenvia se demorar, então o
  // processamento pesado (IA) roda depois do ack.
  res.sendStatus(200);

  try {
    const { MetaManager } = await import("../../../meta.js");
    const body = req.body || {};
    const entries = body.entry || [];

    for (const entry of entries) {
      // ── WhatsApp: entry.changes[].value.messages ──────────────
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const phoneId = value.metadata?.phone_number_id;
        const contacts = value.contacts || [];
        const messages = value.messages || [];

        for (const message of messages) {
          if (message.type !== "text") {
            console.log(`[Meta Webhook] Ignorando mensagem tipo '${message.type}'.`);
            continue;
          }
          const from = message.from;
          const content = message.text?.body || "";
          const name = contacts.find(c => c.wa_id === from)?.profile?.name || null;
          if (!phoneId || !from || !content) continue;
          await MetaManager.handleIncoming(phoneId, from, name, content);
        }
      }

      // ── Instagram Direct: entry.messaging[] (Messenger format) ─
      // O igId da conta é o entry.id (Instagram Business Account ID).
      const igId = entry.id;
      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        const msg = event.message;
        // Ignora echoes (mensagens que a própria página enviou) e não-texto.
        if (!msg || msg.is_echo || !msg.text) continue;
        if (!igId || !senderId) continue;
        await MetaManager.handleIncomingInstagram(igId, senderId, null, msg.text);
      }
    }
  } catch (err) {
    console.error("[Meta Webhook] Erro ao processar evento:", err.message);
  }
};
