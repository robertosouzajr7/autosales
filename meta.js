import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class MetaManager {
    static async sendMessage(phoneId, accessToken, to, text) {
        try {
            const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
            const response = await axios.post(url, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: to,
                type: "text",
                text: { preview_url: false, body: text }
            }, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            console.log(`[Meta API] Message sent to ${to} (PhoneId: ${phoneId})`);
            return response.data;
        } catch (e) {
            console.error(`[Meta API Error]`, e.response?.data || e.message);
            throw e;
        }
    }

    static async handleIncoming(phoneId, from, name, content) {
        // Encontra o tenantId pelo phoneId Meta
        const account = await prisma.whatsAppAccount.findFirst({
            where: { phoneId }
        });

        if (!account) {
            console.warn(`[Meta Hub] PhoneId ${phoneId} não encontrado no banco.`);
            return;
        }

        const tenantId = account.tenantId;

        try {
            // Dispara para o webhook interno (o mesmo que Baileys usa) em server.js
            const response = await axios.post('http://localhost:3000/api/webhook/whatsapp', {
                tenantId,
                phone: from,
                name: name || 'Lead (Meta)',
                content,
                source: 'Meta API'
            });

            const data = response.data;
            if (data.success && data.ai_response) {
                // Responde pro-ativamente se a IA gerou resposta
                await this.sendMessage(phoneId, account.accessToken, from, data.ai_response);
            }
        } catch (e) {
            console.error(`[Meta Processor Error]`, e.message);
        }
    }
}
