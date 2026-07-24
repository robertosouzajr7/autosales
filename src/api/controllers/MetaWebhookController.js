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
  // Um mesmo app da Meta tem DUAS chaves secretas:
  //  - META_APP_SECRET     → chave do app Facebook (Configurações → Básico).
  //    Assina webhooks de WhatsApp (object: "whatsapp_business_account").
  //  - META_IG_APP_SECRET  → chave do app Instagram (Produtos → Instagram →
  //    configurações da API). Assina webhooks de Instagram (object: "instagram").
  // Aceitamos qualquer uma que confira, então não é preciso ramificar por tipo.
  const secrets = [process.env.META_APP_SECRET, process.env.META_IG_APP_SECRET].filter(Boolean);
  if (!secrets.length) {
    console.error("[Meta Webhook] Nenhum secret configurado (META_APP_SECRET / META_IG_APP_SECRET) — rejeitando.");
    return false;
  }

  const signature = req.get("x-hub-signature-256");
  if (!signature || !signature.startsWith("sha256=")) {
    console.warn("[Meta Webhook] Requisição sem cabeçalho X-Hub-Signature-256 — rejeitando.");
    return false;
  }

  // req.rawBody é preenchido pelo verify callback do express.json (ver app.js).
  const rawBody = req.rawBody;
  if (!rawBody) {
    console.warn("[Meta Webhook] rawBody ausente — não é possível validar a assinatura.");
    return false;
  }

  const sigBuf = Buffer.from(signature);
  for (const secret of secrets) {
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const expBuf = Buffer.from(expected);
    if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
      return true;
    }
  }

  console.warn(
    `[Meta Webhook] Assinatura NÃO confere com nenhum secret (object=${req.body?.object}). ` +
    "Webhooks de Instagram são assinados com a CHAVE DO APP INSTAGRAM (Produtos → Instagram → " +
    "config. da API) — defina META_IG_APP_SECRET com esse valor."
  );
  return false;
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

    // Diagnóstico: mostra o formato cru do payload (o Instagram tem variações
    // de estrutura conforme o tipo de integração). Ajuda a depurar "recebe mas
    // não responde". Ative/desative com META_WEBHOOK_DEBUG.
    if (process.env.META_WEBHOOK_DEBUG !== "false") {
      console.log(`[Meta Webhook] 📥 payload object=${body.object} entries=${entries.length}: ${JSON.stringify(body).slice(0, 1500)}`);
    }

    for (const entry of entries) {
      // ── entry.changes[] ────────────────────────────────────────
      for (const change of entry.changes || []) {
        const value = change.value || {};

        // Instagram (Instagram API with Instagram login): field "messages",
        // value = { sender:{id}, recipient:{id}, message:{mid,text} } — objeto
        // singular (NÃO uma lista como o WhatsApp). É o formato real das DMs.
        if (change.field === "messages" && value.message && !value.metadata?.phone_number_id) {
          const senderId = value.sender?.id;
          const text = value.message?.text;
          const igIdC = value.recipient?.id || entry.id; // conta que recebeu
          const isEcho = !!value.message?.is_echo;
          console.log(`[Meta Webhook] IG(changes) igId=${igIdC} sender=${senderId} text=${text ? "sim" : "não"} echo=${isEcho}`);
          if (senderId && text && !isEcho && igIdC && igIdC !== "0") {
            await MetaManager.handleIncomingInstagram(igIdC, senderId, null, text);
          }
          continue;
        }

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

      // ── Instagram Direct: entry.messaging[] (Messenger/Facebook Login) ─
      // O igId da conta é o entry.id (Instagram Business Account ID).
      const igId = entry.id;
      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        const msg = event.message;

        // Mensagem normal (com conteúdo).
        if (msg && !msg.is_echo && msg.text) {
          console.log(`[Meta Webhook] IG(messaging) igId=${igId} sender=${senderId} text=sim`);
          if (igId && senderId) await MetaManager.handleIncomingInstagram(igId, senderId, null, msg.text);
          continue;
        }

        // Fallback: alguns apps entregam a DM como "message_edit" (sem texto e
        // sem sender no payload). Buscamos o conteúdo pela Graph API via mid.
        const mid = event.message_edit?.mid;
        if (mid && igId) {
          console.log(`[Meta Webhook] IG(message_edit) igId=${igId} mid=${mid.slice(0, 12)}… — buscando conteúdo pela API`);
          const fetched = await fetchInstagramMessageByMid(igId, mid).catch((e) => {
            console.warn(`[Meta Webhook] ❌ Falha ao buscar mensagem: ${e.response?.status || ""} ${JSON.stringify(e.response?.data || e.message)}`);
            return null;
          });
          if (fetched) {
            console.log(`[Meta Webhook] Resposta da API para o mid: ${JSON.stringify(fetched.raw).slice(0, 500)}`);
            if (fetched.senderId && fetched.text) {
              console.log(`[Meta Webhook] ✅ IG(message_edit) resolvido: sender=${fetched.senderId} text=sim`);
              await MetaManager.handleIncomingInstagram(igId, fetched.senderId, null, fetched.text);
            } else {
              console.warn(`[Meta Webhook] ⚠️ mid buscado, mas sem sender/text utilizáveis (from=${fetched.senderId}, text=${fetched.text ? "sim" : "não"}).`);
            }
          }
          continue;
        }

        console.log(`[Meta Webhook] IG(messaging) igId=${igId} sender=${senderId} — evento sem texto, ignorado`);
      }
    }
  } catch (err) {
    console.error("[Meta Webhook] Erro ao processar evento:", err.message);
  }
};

/**
 * Busca o conteúdo e o remetente de uma mensagem do Instagram pelo message id
 * (mid). Usado quando a Meta entrega só um evento "message_edit" sem texto.
 * Usa o token da própria conta conectada (igId).
 */
async function fetchInstagramMessageByMid(igId, mid) {
  const prisma = (await import("../config/prisma.js")).default;
  const axios = (await import("axios")).default;
  const account = await prisma.whatsAppAccount.findFirst({
    where: { igId, channel: "INSTAGRAM" },
    select: { accessToken: true },
  });
  if (!account?.accessToken) return null;

  const version = process.env.META_GRAPH_VERSION || "v21.0";
  // Token IGAA… (Instagram Login) consulta graph.instagram.com; Page token,
  // graph.facebook.com.
  const host = account.accessToken.startsWith("IG")
    ? "graph.instagram.com"
    : "graph.facebook.com";
  const r = await axios.get(`https://${host}/${version}/${mid}`, {
    params: { fields: "id,from,to,message,created_time", access_token: account.accessToken },
    timeout: 15000,
  });
  const senderId = r.data?.from?.id;
  const text = typeof r.data?.message === "string" ? r.data.message : r.data?.message?.text;
  return { senderId, text, raw: r.data };
}
