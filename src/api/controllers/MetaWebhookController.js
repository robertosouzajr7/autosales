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
          const from = message.from;
          const name = contacts.find(c => c.wa_id === from)?.profile?.name || null;
          if (!phoneId || !from) continue;

          // Texto simples
          if (message.type === "text") {
            const content = message.text?.body || "";
            if (!content) continue;
            await MetaManager.handleIncoming(phoneId, from, name, content);
            continue;
          }

          // Mídia: áudio (nota de voz), imagem e documento — o agente
          // transcreve/lê o conteúdo, igual ao canal via QR.
          const MEDIA_MAP = {
            audio: { kind: "audio", messageType: "AUDIO" },
            voice: { kind: "audio", messageType: "AUDIO" },
            image: { kind: "img", messageType: "IMAGE" },
            document: { kind: "doc", messageType: "DOCUMENT" },
          };
          const meta = MEDIA_MAP[message.type];
          if (meta) {
            const payload = message[message.type] || {};
            if (!payload.id) continue;
            await MetaManager.handleIncoming(phoneId, from, name, null, {
              id: payload.id,
              kind: meta.kind,
              messageType: meta.messageType,
              caption: payload.caption || null,
              fileName: payload.filename || null,
            });
            continue;
          }

          console.log(`[Meta Webhook] Ignorando mensagem tipo '${message.type}'.`);
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
          if (msg.mid && wasProcessed(msg.mid)) {
            console.log(`[Meta Webhook] mid já processado — ignorando duplicata (${msg.mid.slice(0, 12)}…)`);
            continue;
          }
          console.log(`[Meta Webhook] IG(messaging) igId=${igId} sender=${senderId} text=sim`);
          if (igId && senderId) {
            if (msg.mid) markProcessed(msg.mid);
            await MetaManager.handleIncomingInstagram(igId, senderId, null, msg.text);
          }
          continue;
        }

        // Fallback: alguns apps entregam a DM como "message_edit" (sem texto e
        // sem sender no payload). Buscamos o conteúdo pela Graph API via mid.
        // Obs.: quando o remetente TAMBÉM autorizou o app, o mesmo mid chega
        // duas vezes (um evento por conta) — o dedupe evita resposta dupla.
        const mid = event.message_edit?.mid;
        if (mid && igId) {
          if (wasProcessed(mid)) {
            console.log(`[Meta Webhook] mid já processado — ignorando duplicata (${mid.slice(0, 12)}…)`);
            continue;
          }
          console.log(`[Meta Webhook] IG(message_edit) igId=${igId} mid=${mid.slice(0, 12)}… — buscando conteúdo pela API`);
          const fetched = await fetchInstagramMessageByMid(igId, mid).catch((e) => {
            console.warn(`[Meta Webhook] ❌ Falha ao buscar mensagem: ${e.response?.status || ""} ${JSON.stringify(e.response?.data || e.message)}`);
            return null;
          });
          if (fetched) {
            console.log(`[Meta Webhook] Conteúdo resolvido (${fetched.via}): ${JSON.stringify(fetched.raw).slice(0, 400)}`);
            if (fetched.senderId && fetched.text) {
              if (fetched.senderId === igId) {
                console.log(`[Meta Webhook] Mensagem é da própria conta (${igId}) — eco, ignorando.`);
              } else {
                console.log(`[Meta Webhook] ✅ IG(message_edit) resolvido: sender=${fetched.senderId} text=sim`);
                markProcessed(mid);
                await MetaManager.handleIncomingInstagram(igId, fetched.senderId, null, fetched.text);
              }
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

// ── Dedupe de mensagens por mid ─────────────────────────────────────
// Quando remetente e destinatário autorizaram o app, a Meta entrega o MESMO
// mid uma vez por conta assinada — sem dedupe o agente responderia em dobro.
const processedMids = new Map(); // mid -> timestamp
const MID_TTL_MS = 10 * 60 * 1000;

function wasProcessed(mid) {
  const ts = processedMids.get(mid);
  return !!ts && Date.now() - ts < MID_TTL_MS;
}

function markProcessed(mid) {
  processedMids.set(mid, Date.now());
  if (processedMids.size > 500) {
    const cutoff = Date.now() - MID_TTL_MS;
    for (const [k, v] of processedMids) if (v < cutoff) processedMids.delete(k);
  }
}

/**
 * Busca o conteúdo e o remetente de uma mensagem do Instagram pelo mid.
 * 1º tenta GET /{mid} direto; se falhar/vier vazio (comum no pipeline do
 * Instagram Login), varre as conversas recentes via Conversations API e
 * localiza a mensagem pelo mid.
 */
async function fetchInstagramMessageByMid(igId, mid) {
  const prisma = (await import("../config/prisma.js")).default;
  const axios = (await import("axios")).default;
  const account = await prisma.whatsAppAccount.findFirst({
    where: { igId, channel: "INSTAGRAM" },
    select: { accessToken: true, pageId: true, enabled: true },
  });
  if (!account?.accessToken) {
    console.log(`[Meta Webhook] igId ${igId} não está conectado neste servidor — evento ignorado.`);
    return null;
  }
  if (account.enabled === false) {
    console.log(`[Meta Webhook] Conexão ${igId} desabilitada — ignorando.`);
    return null;
  }

  const version = process.env.META_GRAPH_VERSION || "v21.0";
  const isIg = account.accessToken.startsWith("IG");
  const host = isIg ? "graph.instagram.com" : "graph.facebook.com";
  const token = account.accessToken;

  // Tentativa 1: objeto da mensagem direto.
  try {
    const r = await axios.get(`https://${host}/${version}/${mid}`, {
      params: { fields: "id,from,message,created_time", access_token: token },
      timeout: 15000,
    });
    const senderId = r.data?.from?.id;
    const text = typeof r.data?.message === "string" ? r.data.message : r.data?.message?.text;
    if (senderId && text) return { senderId, text, raw: r.data, via: "mid" };
  } catch (e) {
    console.warn(`[Meta Webhook] GET /{mid} falhou (${e.response?.status || e.message}) — tentando Conversations API`);
  }

  // Tentativa 2: Conversations API — conversas recentes com mensagens.
  const convUrl = isIg
    ? `https://graph.instagram.com/${version}/me/conversations`
    : `https://graph.facebook.com/${version}/${account.pageId}/conversations`;
  const conv = await axios.get(convUrl, {
    params: {
      platform: "instagram",
      fields: "messages.limit(10){id,from,message,created_time}",
      limit: 10,
      access_token: token,
    },
    timeout: 15000,
  });

  const convs = conv.data?.data || [];

  // 2a. Match exato pelo mid.
  for (const c of convs) {
    for (const m of c.messages?.data || []) {
      if (m.id === mid && m.from?.id && m.from.id !== igId) {
        return { senderId: m.from.id, text: m.message, raw: m, via: "conversations(mid)" };
      }
    }
  }

  // 2b. Fallback: o webhook acabou de disparar por uma mensagem nova; se o mid
  // não casou (codificações diferentes), pega a mensagem RECEBIDA mais recente
  // (from ≠ conta) dentre as conversas, desde que seja bem recente (~2 min).
  let newest = null;
  const cutoff = Date.now() - 2 * 60 * 1000;
  for (const c of convs) {
    for (const m of c.messages?.data || []) {
      if (!m.from?.id || m.from.id === igId || !m.message) continue;
      const t = m.created_time ? new Date(m.created_time).getTime() : Date.now();
      if (t < cutoff) continue;
      if (!newest || t > newest.t) newest = { t, senderId: m.from.id, text: m.message, raw: m };
    }
  }
  if (newest) {
    return { senderId: newest.senderId, text: newest.text, raw: newest.raw, via: "conversations(recente)" };
  }

  console.warn(`[Meta Webhook] mensagem não encontrada nas conversas recentes (${convs.length} conversas varridas).`);
  return null;
}
