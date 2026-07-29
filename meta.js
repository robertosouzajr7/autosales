import axios from 'axios';
import fs from 'fs';
import path from 'path';
import prisma from './src/api/config/prisma.js';

// Versão da Graph API configurável — Meta descontinua versões antigas.
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
// Porta interna do próprio processo, para o loop do webhook.
const INTERNAL_PORT = process.env.PORT || 3000;
// Mesmo diretório de uploads do StorageService (volume persistente).
const MEDIA_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');

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
            const form = new FormData();
            form.append('messaging_product', 'whatsapp');
            form.append('type', mimeType);
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
        if (!/\.ogg$/i.test(filePath)) {
            console.warn(`[Meta API] Áudio não está em OGG/Opus (${path.extname(filePath)}) — não enviado.`);
            return false;
        }
        const buffer = fs.readFileSync(filePath);
        const mediaId = await this.uploadMedia(phoneId, accessToken, buffer, 'audio/ogg', path.basename(filePath));
        if (!mediaId) return false;
        try {
            await axios.post(
                `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`,
                { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'audio', audio: { id: mediaId } },
                { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 30000 }
            );
            console.log(`[Meta API] 🔊 Nota de voz enviada para ${to}`);
            return true;
        } catch (e) {
            console.error('[Meta API] Erro ao enviar áudio:', e.response?.data?.error?.message || e.message);
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
    static async handleIncoming(phoneId, from, name, content, media = null) {
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
