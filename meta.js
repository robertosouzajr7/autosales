import axios from 'axios';
import prisma from './src/api/config/prisma.js';

// Versão da Graph API configurável — Meta descontinua versões antigas.
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
// Porta interna do próprio processo, para o loop do webhook.
const INTERNAL_PORT = process.env.PORT || 3000;

export class MetaManager {
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
     * Envio de DM no Instagram via Messenger Platform (Send API).
     * O endpoint é o da PÁGINA vinculada; o token é o Page Access Token.
     */
    static async sendInstagramMessage(pageId, pageToken, recipientId, text) {
        if (!pageId || !pageToken) {
            throw new Error("Instagram: pageId/pageToken ausentes");
        }
        try {
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
     * Roteia uma mensagem inbound (já validada no webhook) para o webhook
     * interno de processamento — o mesmo pipeline usado pelo Baileys — e
     * devolve a resposta da IA pelo canal oficial.
     */
    static async handleIncoming(phoneId, from, name, content) {
        const account = await prisma.whatsAppAccount.findFirst({
            where: { phoneId, channel: "WHATSAPP" }
        });

        if (!account) {
            console.warn(`[Meta Hub] PhoneId ${phoneId} não encontrado no banco.`);
            return;
        }

        await this._routeToAI(account, from, name || 'Lead (Meta)', content, 'Meta API', async (aiText) => {
            await this.sendMessage(phoneId, account.accessToken, from, aiText);
        });
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

        await this._routeToAI(account, senderId, name || 'Lead (Instagram)', content, 'Instagram', async (aiText) => {
            await this.sendInstagramMessage(account.pageId, account.accessToken, senderId, aiText);
        });
    }

    /**
     * Núcleo comum: manda a mensagem pro pipeline de IA e devolve a resposta
     * pelo canal (callback `reply`). O identificador do lead é `contactId`
     * (número no WhatsApp, IGSID no Instagram).
     */
    static async _routeToAI(account, contactId, name, content, source, reply) {
        try {
            const response = await axios.post(
                `http://localhost:${INTERNAL_PORT}/api/webhook/whatsapp`,
                {
                    tenantId: account.tenantId,
                    phone: contactId,
                    name,
                    content,
                    source
                },
                { timeout: 60000 }
            );
            const data = response.data;
            if (data.success && data.ai_response) {
                await reply(data.ai_response);
            }
        } catch (e) {
            console.error(`[Meta Processor Error]`, e.message);
        }
    }
}
