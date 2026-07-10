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
     * Roteia uma mensagem inbound (já validada no webhook) para o webhook
     * interno de processamento — o mesmo pipeline usado pelo Baileys — e
     * devolve a resposta da IA pelo canal oficial.
     */
    static async handleIncoming(phoneId, from, name, content) {
        const account = await prisma.whatsAppAccount.findFirst({
            where: { phoneId }
        });

        if (!account) {
            console.warn(`[Meta Hub] PhoneId ${phoneId} não encontrado no banco.`);
            return;
        }

        const tenantId = account.tenantId;

        try {
            const response = await axios.post(
                `http://localhost:${INTERNAL_PORT}/api/webhook/whatsapp`,
                {
                    tenantId,
                    phone: from,
                    name: name || 'Lead (Meta)',
                    content,
                    source: 'Meta API'
                },
                { timeout: 60000 }
            );

            const data = response.data;
            if (data.success && data.ai_response) {
                await this.sendMessage(phoneId, account.accessToken, from, data.ai_response);
            }
        } catch (e) {
            console.error(`[Meta Processor Error]`, e.message);
        }
    }
}
