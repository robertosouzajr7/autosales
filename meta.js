import axios from 'axios';
import fs from 'fs';
import path from 'path';
import prisma from './src/api/config/prisma.js';
import { stopwatch } from './src/api/utils/timing.js';

// Versão da Graph API configurável — Meta descontinua versões antigas.
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
// Porta interna do próprio processo, para o loop do webhook.
const INTERNAL_PORT = process.env.PORT || 3000;
// Mesmo diretório de uploads do StorageService (volume persistente).
const MEDIA_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');

/**
 * Confere se o buffer é mesmo um OGG com stream Opus. A primeira página do
 * container começa em "OggS" e traz o cabeçalho "OpusHead" logo em seguida
 * (num OGG/Vorbis viria "\x01vorbis"). Só esse formato vira nota de voz.
 */
function isOpusOgg(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 36) return false;
    if (buffer.subarray(0, 4).toString('latin1') !== 'OggS') return false;
    return buffer.subarray(0, 64).includes('OpusHead');
}

/** Corta no limite da Meta; passar do tamanho faz a API rejeitar a mensagem. */
function truncate(text, max) {
    const t = String(text ?? '');
    return t.length <= max ? t : t.slice(0, max - 1) + '…';
}

export class MetaManager {
    /**
     * Baixa uma mídia recebida pela Cloud API. São 2 passos: resolver o
     * media_id numa URL temporária e então baixar o binário — ambos exigem o
     * access token da conta.
     * @returns {Promise<{buffer: Buffer, mimeType: string}|null>}
     */
    static async downloadMedia(mediaId, accessToken) {
        try {
            const meta = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 30000,
            });
            const url = meta.data?.url;
            const mimeType = meta.data?.mime_type || 'application/octet-stream';
            if (!url) return null;
            const bin = await axios.get(url, {
                headers: { Authorization: `Bearer ${accessToken}` },
                responseType: 'arraybuffer',
                timeout: 60000,
            });
            return { buffer: Buffer.from(bin.data), mimeType };
        } catch (e) {
            console.error('[Meta API] Erro ao baixar mídia:', e.response?.data?.error?.message || e.message);
            return null;
        }
    }

    /**
     * Sobe um arquivo para a Cloud API e devolve o media_id (necessário para
     * enviar áudio/imagem sem depender de URL pública).
     */
    static async uploadMedia(phoneId, accessToken, buffer, mimeType, filename) {
        try {
            // O campo `type` aceita só o mime base; os parâmetros (ex.:
            // "; codecs=opus") vão no Content-Type da parte do arquivo — é ele
            // que faz o WhatsApp tratar o OGG como nota de voz e não como
            // arquivo de música.
            const baseType = String(mimeType).split(';')[0].trim();
            const form = new FormData();
            form.append('messaging_product', 'whatsapp');
            form.append('type', baseType);
            form.append('file', new Blob([buffer], { type: mimeType }), filename);
            const { data } = await axios.post(
                `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/media`,
                form,
                { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 60000 }
            );
            return data?.id || null;
        } catch (e) {
            console.error('[Meta API] Erro ao subir mídia:', e.response?.data?.error?.message || e.message);
            return null;
        }
    }

    /**
     * Envia nota de voz pela Cloud API. O arquivo precisa ser OGG/Opus para o
     * WhatsApp exibir como áudio gravado.
     */
    static async sendWhatsAppAudio(phoneId, accessToken, to, filePath) {
        if (!fs.existsSync(filePath)) {
            console.warn(`[Meta API] Áudio não encontrado: ${filePath}`);
            return false;
        }
        const buffer = fs.readFileSync(filePath);
        if (!isOpusOgg(buffer)) {
            console.warn(`[Meta API] ${path.basename(filePath)} não é OGG/Opus — o WhatsApp exibiria como arquivo de áudio. Não enviado.`);
            return false;
        }
        // O upload precisa declarar o perfil Opus; o ";codecs=opus" é
        // pré-requisito para o flag `voice` abaixo valer.
        const sw = stopwatch('meta-audio');
        const mediaId = await this.uploadMedia(phoneId, accessToken, buffer, 'audio/ogg; codecs=opus', path.basename(filePath));
        sw.lap('upload');
        if (!mediaId) return false;

        const send = (audio) => axios.post(
            `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`,
            { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'audio', audio },
            { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 30000 }
        );

        // `voice: true` é o equivalente ao `ptt` do Baileys: sem ele a Cloud API
        // entrega como arquivo de áudio mesmo estando em OGG/Opus.
        try {
            await send({ id: mediaId, voice: true });
            sw.lap('send');
            sw.done();
            console.log(`[Meta API] 🔊 Nota de voz enviada para ${to}`);
            return true;
        } catch (e) {
            const err = e.response?.data?.error?.message || e.message;
            // O flag ainda é beta: se a conta não estiver habilitada, reenvia
            // como áudio comum em vez de deixar o lead sem resposta falada.
            console.warn(`[Meta API] Envio como nota de voz falhou (${err}). Tentando como áudio comum…`);
            try {
                await send({ id: mediaId });
                console.log(`[Meta API] 🔊 Áudio enviado para ${to} (sem flag de nota de voz).`);
                return true;
            } catch (e2) {
                console.error('[Meta API] Erro ao enviar áudio:', e2.response?.data?.error?.message || e2.message);
                return false;
            }
        }
    }

    /**
     * Envia botões de resposta rápida. Limites da Meta: no máximo 3 botões,
     * título de 20 caracteres e corpo de 1024 — truncamos em vez de deixar a
     * API rejeitar a mensagem inteira.
     *
     * Só funciona DENTRO da janela de 24h; fora dela, use template com botões.
     * @param buttons [{ id, title }]
     */
    static async sendButtons(phoneId, accessToken, to, { body, buttons, header = null, footer = null }) {
        const opcoes = (buttons || []).filter(b => b?.title).slice(0, 3);
        if (!opcoes.length) {
            console.warn('[Meta API] Nenhum botão válido — nada enviado.');
            return { ok: false, error: 'Nenhum botão válido.' };
        }
        const interactive = {
            type: 'button',
            body: { text: truncate(body || '', 1024) },
            action: {
                buttons: opcoes.map((b, i) => ({
                    type: 'reply',
                    reply: { id: String(b.id || `btn_${i + 1}`).slice(0, 256), title: truncate(b.title, 20) },
                })),
            },
        };
        if (header) interactive.header = { type: 'text', text: truncate(header, 60) };
        if (footer) interactive.footer = { text: truncate(footer, 60) };
        return this._sendInteractive(phoneId, accessToken, to, interactive, `${opcoes.length} botão(ões)`);
    }

    /**
     * Envia menu em lista. A Meta aceita até 10 opções no total, distribuídas
     * em seções — passamos do limite e a mensagem inteira é rejeitada.
     * @param sections [{ title, rows: [{ id, title, description }] }]
     */
    static async sendList(phoneId, accessToken, to, { body, sections, buttonText = 'Ver opções', header = null, footer = null }) {
        let restantes = 10;
        const secoes = [];
        for (const sec of sections || []) {
            if (restantes <= 0) break;
            const rows = (sec.rows || []).filter(r => r?.title).slice(0, restantes).map((r, i) => ({
                id: String(r.id || `op_${i + 1}`).slice(0, 200),
                title: truncate(r.title, 24),
                ...(r.description ? { description: truncate(r.description, 72) } : {}),
            }));
            if (!rows.length) continue;
            restantes -= rows.length;
            secoes.push({ title: truncate(sec.title || 'Opções', 24), rows });
        }
        if (!secoes.length) {
            console.warn('[Meta API] Lista sem opções válidas — nada enviado.');
            return { ok: false, error: 'Lista sem opções válidas.' };
        }
        const interactive = {
            type: 'list',
            body: { text: truncate(body || '', 1024) },
            action: { button: truncate(buttonText, 20), sections: secoes },
        };
        if (header) interactive.header = { type: 'text', text: truncate(header, 60) };
        if (footer) interactive.footer = { text: truncate(footer, 60) };
        const total = secoes.reduce((n, s) => n + s.rows.length, 0);
        return this._sendInteractive(phoneId, accessToken, to, interactive, `lista com ${total} opção(ões)`);
    }

    static async _sendInteractive(phoneId, accessToken, to, interactive, descricao) {
        try {
            const { data } = await axios.post(
                `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`,
                { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'interactive', interactive },
                { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 30000 }
            );
            console.log(`[Meta API] 🔘 Interativo enviado para ${to} (${descricao}).`);
            return { ok: true, messageId: data?.messages?.[0]?.id || null };
        } catch (e) {
            const error = e.response?.data?.error;
            console.error('[Meta API] Erro ao enviar interativo:', error?.message || e.message);
            return { ok: false, error: error?.error_user_msg || error?.message || e.message };
        }
    }

    /**
     * Lista os templates da WABA. Templates vivem na conta (WABA), não no
     * número — por isso a chamada usa wabaId, e não phoneId.
     */
    static async listTemplates(wabaId, accessToken) {
        try {
            const { data } = await axios.get(
                `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    params: { limit: 200, fields: 'id,name,language,category,status,components,rejected_reason' },
                    timeout: 30000,
                }
            );
            return data?.data || [];
        } catch (e) {
            console.error('[Meta API] Erro ao listar templates:', e.response?.data?.error?.message || e.message);
            return null;
        }
    }

    /**
     * Cria um template na Meta. Nasce PENDING e só pode ser disparado depois
     * de aprovado — a aprovação é assíncrona e leva de minutos a horas.
     * @returns {Promise<{id: string, status: string}|{error: string}>}
     */
    static async createTemplate(wabaId, accessToken, { name, language, category, components }) {
        try {
            const { data } = await axios.post(
                `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`,
                {
                    name,
                    language,
                    category,
                    components,
                    // Deixa a Meta recategorizar em vez de rejeitar quando
                    // discorda da categoria escolhida.
                    allow_category_change: true,
                },
                { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 30000 }
            );
            return { id: data?.id, status: data?.status || 'PENDING', category: data?.category };
        } catch (e) {
            const error = e.response?.data?.error;
            console.error('[Meta API] Erro ao criar template:', error?.message || e.message);
            return { error: error?.error_user_msg || error?.message || e.message };
        }
    }

    /** Remove um template da WABA (por nome, como a Meta exige). */
    static async deleteTemplate(wabaId, accessToken, name) {
        try {
            await axios.delete(
                `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`,
                { headers: { Authorization: `Bearer ${accessToken}` }, params: { name }, timeout: 30000 }
            );
            return true;
        } catch (e) {
            console.error('[Meta API] Erro ao remover template:', e.response?.data?.error?.message || e.message);
            return false;
        }
    }

    /**
     * Dispara um template. É o único jeito de iniciar conversa fora da janela
     * de 24h. `variables` preenche os {{1}}, {{2}}… do corpo, na ordem.
     */
    static async sendTemplate(phoneId, accessToken, to, { name, language = 'pt_BR', variables = [], headerMediaUrl = null }) {
        const components = [];
        if (headerMediaUrl) {
            components.push({
                type: 'header',
                parameters: [{ type: 'image', image: { link: headerMediaUrl } }],
            });
        }
        if (variables.length) {
            components.push({
                type: 'body',
                parameters: variables.map((v) => ({ type: 'text', text: String(v ?? '') })),
            });
        }
        try {
            const { data } = await axios.post(
                `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to,
                    type: 'template',
                    template: {
                        name,
                        language: { code: language },
                        ...(components.length ? { components } : {}),
                    },
                },
                { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 30000 }
            );
            return { ok: true, messageId: data?.messages?.[0]?.id || null };
        } catch (e) {
            const error = e.response?.data?.error;
            console.error('[Meta API] Erro ao enviar template:', error?.message || e.message);
            return { ok: false, error: error?.error_user_msg || error?.message || e.message };
        }
    }

    /**
     * Envia mídia genérica (image | video | audio | document) pela Cloud API.
     * Aceita caminho local (/api/uploads/…) — sobe o arquivo e envia por
     * media_id — ou URL pública (envia por link).
     */
    static async sendWhatsAppMedia(phoneId, accessToken, to, mediaUrl, type = 'image', caption = '') {
        try {
            const kind = ['image', 'video', 'audio', 'document'].includes(type) ? type : 'image';
            const payload = { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: kind };

            const { localPathFor } = await import('./src/api/services/StorageService.js');
            const localPath = localPathFor(mediaUrl);

            if (localPath && fs.existsSync(localPath)) {
                const buffer = fs.readFileSync(localPath);
                const ext = path.extname(localPath).toLowerCase();
                const MIME = {
                    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                    '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4',
                    // A Meta não aceita audio/ogg "puro" — só o perfil Opus.
                    '.ogg': 'audio/ogg; codecs=opus', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf',
                };
                const mime = MIME[ext] || 'application/octet-stream';
                const mediaId = await this.uploadMedia(phoneId, accessToken, buffer, mime, path.basename(localPath));
                if (!mediaId) return false;
                payload[kind] = { id: mediaId };
            } else if (/^https?:\/\//i.test(mediaUrl)) {
                payload[kind] = { link: mediaUrl };
            } else {
                console.warn(`[Meta API] Mídia não encontrada para envio: ${mediaUrl}`);
                return false;
            }

            // Áudio não aceita caption na Cloud API.
            if (caption && kind !== 'audio') payload[kind].caption = caption;

            await axios.post(
                `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`,
                payload,
                { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 60000 }
            );
            console.log(`[Meta API] 📎 Mídia (${kind}) enviada para ${to}`);
            return true;
        } catch (e) {
            console.error('[Meta API] Erro ao enviar mídia:', e.response?.data?.error?.message || e.message);
            return false;
        }
    }

    /** Salva um buffer recebido no diretório de uploads e devolve a URL canônica. */
    static saveIncomingMedia(buffer, mimeType, prefix = 'media') {
        try {
            if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
            const ext = (mimeType.split('/')[1] || 'bin').split(';')[0].replace(/[^a-z0-9]/gi, '');
            const filename = `${prefix}_${Date.now()}.${ext}`;
            fs.writeFileSync(path.join(MEDIA_DIR, filename), buffer);
            return `/api/uploads/${filename}`;
        } catch (e) {
            console.error('[Meta API] Erro ao salvar mídia recebida:', e.message);
            return null;
        }
    }

    static async sendMessage(phoneId, accessToken, to, text) {
        if (!phoneId || !accessToken) {
            throw new Error("Meta: phoneId/accessToken ausentes");
        }
        try {
            const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
            const response = await axios.post(url, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: "text",
                text: { preview_url: false, body: text }
            }, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                timeout: 15000
            });

            console.log(`[Meta API] Mensagem enviada para ${to} (PhoneId: ${phoneId})`);
            return response.data;
        } catch (e) {
            console.error(`[Meta API Error]`, e.response?.data || e.message);
            throw e;
        }
    }

    /**
     * Token de usuário Instagram (fluxo "API do Instagram com login do
     * Instagram") começa com "IG" (IGAA…/IGQV…); Page Access Token com "EAA".
     */
    static isIgUserToken(token) {
        return typeof token === "string" && token.startsWith("IG");
    }

    /**
     * Envio de DM no Instagram. Dois pipelines:
     *  - Instagram Login (token IGAA…): graph.instagram.com/me/messages
     *  - Página do Facebook (Page token): graph.facebook.com/{pageId}/messages
     */
    static async sendInstagramMessage(pageId, pageToken, recipientId, text) {
        if (!pageToken) throw new Error("Instagram: token ausente");
        try {
            if (this.isIgUserToken(pageToken)) {
                const url = `https://graph.instagram.com/${GRAPH_VERSION}/me/messages`;
                const response = await axios.post(url, {
                    recipient: { id: recipientId },
                    message: { text }
                }, {
                    headers: { 'Authorization': `Bearer ${pageToken}` },
                    timeout: 15000
                });
                console.log(`[Instagram API] DM enviada para ${recipientId} (Instagram Login)`);
                return response.data;
            }

            if (!pageId) throw new Error("Instagram: pageId ausente (fluxo via Página)");
            const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/messages`;
            const response = await axios.post(url, {
                recipient: { id: recipientId },
                message: { text },
                messaging_type: "RESPONSE"
            }, {
                headers: { 'Authorization': `Bearer ${pageToken}` },
                timeout: 15000
            });
            console.log(`[Instagram API] DM enviada para ${recipientId} (PageId: ${pageId})`);
            return response.data;
        } catch (e) {
            console.error(`[Instagram API Error]`, e.response?.data || e.message);
            throw e;
        }
    }

    /**
     * Envia mídia (imagem/áudio/vídeo) por DM no Instagram via attachment
     * do Messenger Platform. `type` ∈ {image, audio, video}.
     */
    static async sendInstagramMedia(pageId, pageToken, recipientId, mediaUrl, type = "image") {
        if (!pageToken) throw new Error("Instagram: token ausente");
        if (!this.isIgUserToken(pageToken) && !pageId) throw new Error("Instagram: pageId ausente (fluxo via Página)");
        try {
            const url = this.isIgUserToken(pageToken)
                ? `https://graph.instagram.com/${GRAPH_VERSION}/me/messages`
                : `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/messages`;
            const payload = {
                recipient: { id: recipientId },
                message: {
                    attachment: {
                        type, // image | audio | video
                        payload: { url: mediaUrl, is_reusable: true }
                    }
                },
            };
            // messaging_type é do Messenger Platform (fluxo via Página).
            if (!this.isIgUserToken(pageToken)) payload.messaging_type = "RESPONSE";
            const response = await axios.post(url, payload, {
                headers: { 'Authorization': `Bearer ${pageToken}` },
                timeout: 20000
            });
            console.log(`[Instagram API] Mídia (${type}) enviada para ${recipientId}`);
            return response.data;
        } catch (e) {
            console.error(`[Instagram API Error]`, e.response?.data || e.message);
            throw e;
        }
    }

    /**
     * Roteia uma mensagem inbound (já validada no webhook) para o webhook
     * interno de processamento — o mesmo pipeline usado pelo Baileys — e
     * devolve a resposta da IA pelo canal oficial.
     */
    static async handleIncoming(phoneId, from, name, content, media = null, interactive = null) {
        const account = await prisma.whatsAppAccount.findFirst({
            where: { phoneId, channel: "WHATSAPP" }
        });

        if (!account) {
            console.warn(`[Meta Hub] PhoneId ${phoneId} não encontrado no banco.`);
            return;
        }

        // Mídia recebida (áudio/imagem/documento): baixa da Meta e salva local
        // para o pipeline transcrever/ler, igual ao canal Baileys.
        let extra = {};
        let effectiveContent = content;
        if (media?.id) {
            const dl = await this.downloadMedia(media.id, account.accessToken);
            if (dl) {
                const url = this.saveIncomingMedia(dl.buffer, dl.mimeType, media.kind || 'media');
                if (url) {
                    effectiveContent = url;
                    extra = {
                        messageType: media.messageType,
                        mediaMime: dl.mimeType,
                        mediaCaption: media.caption || null,
                        fileName: media.fileName || null,
                    };
                    console.log(`[Meta Hub] ${media.messageType} recebido de ${from}: ${url}`);
                }
            }
        }
        // Clique em botão/lista: o id segue junto para o fluxo ramificar sem
        // depender do texto do botão, que o cliente pode ver traduzido.
        if (interactive?.replyId) {
            extra = { ...extra, replyId: interactive.replyId, replyTitle: interactive.replyTitle || '' };
            console.log(`[Meta Hub] 🔘 ${from} escolheu "${interactive.replyTitle}" (${interactive.replyId}).`);
        }
        if (!effectiveContent) return;

        await this._routeToAI(
            account, from, name || 'Lead (Meta)', effectiveContent, 'Meta API',
            async (aiText, data) => {
                // Responde em áudio quando o agente está em modo voz e o TTS saiu.
                let audioSent = false;
                const mode = data?.response_mode || 'TEXT';
                if (data?.ai_audio_url && (mode === 'AUDIO' || mode === 'BOTH')) {
                    const { localPathFor } = await import('./src/api/services/StorageService.js');
                    const p = localPathFor(data.ai_audio_url);
                    if (p) audioSent = await this.sendWhatsAppAudio(phoneId, account.accessToken, from, p);
                }
                // Texto sempre que não houver áudio (nunca ficar mudo) ou em TEXT/BOTH.
                if (aiText && (mode === 'TEXT' || mode === 'BOTH' || !audioSent)) {
                    await this.sendMessage(phoneId, account.accessToken, from, aiText);
                }
            },
            extra
        );
    }

    /**
     * Recebe uma DM do Instagram. `igId` é o Instagram Business Account ID
     * que identifica a conta conectada (roteia para o tenant).
     */
    static async handleIncomingInstagram(igId, senderId, name, content) {
        const account = await prisma.whatsAppAccount.findFirst({
            where: { igId, channel: "INSTAGRAM" }
        });

        if (!account) {
            console.warn(`[Instagram Hub] igId ${igId} não encontrado no banco.`);
            return;
        }

        if (account.enabled === false) {
            console.log(`[Instagram Hub] Conexão ${account.name} está desabilitada — ignorando DM.`);
            return;
        }

        await this._routeToAI(account, senderId, name || 'Lead (Instagram)', content, 'Instagram', async (aiText) => {
            await this.sendInstagramMessage(account.pageId, account.accessToken, senderId, aiText);
        });
    }

    /**
     * Núcleo comum: manda a mensagem pro pipeline de IA e devolve a resposta
     * pelo canal (callback `reply`). O identificador do lead é `contactId`
     * (número no WhatsApp, IGSID no Instagram).
     */
    static async _routeToAI(account, contactId, name, content, source, reply, extra = {}) {
        try {
            const response = await axios.post(
                `http://localhost:${INTERNAL_PORT}/api/webhook/whatsapp`,
                {
                    tenantId: account.tenantId,
                    phone: contactId,
                    name,
                    content,
                    source,
                    channel: account.channel || "INSTAGRAM",
                    accountId: account.id,
                    ...extra, // messageType, mediaMime, mediaCaption, fileName
                },
                { timeout: 120000 } // transcrição/leitura de mídia pode demorar
            );
            const data = response.data;
            // Entrega a resposta ao canal — o callback decide texto e/ou áudio.
            if (data?.success && (data.ai_response || data.ai_audio_url)) {
                await reply(data.ai_response, data);
            }
        } catch (e) {
            console.error(`[Meta Processor Error]`, e.message);
        }
    }
}
