import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

export const whatsappSessions = new Map();

// Classe responsável por orquestrar múltiplas conexões de empresas (Multi-tenant SaaS)
export class WhatsAppManager {
    static async createSession(companyId, emitQr) {
        // Se a sessão já estiver ativa e conectada, avisa o front imediatamente
        if (whatsappSessions.has(companyId)) {
            if (emitQr) emitQr("CONNECTED");
            return whatsappSessions.get(companyId);
        }

        const authDir = path.resolve(`./instances/${companyId}`);
        if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS('Desktop'),
            logger: pino({ level: 'silent' })
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            if (qr && emitQr) {
                console.log(`[WhatsApp] QR Gerado para: ${companyId}`);
                emitQr(qr);
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                console.log(`[WhatsApp] Conexão ${companyId} fechada. Reconectar? ${shouldReconnect}`);
                whatsappSessions.delete(companyId);
                // O boot diário cuidará de reconectar se for erro de rede e não deslogue manual
            } else if (connection === 'open') {
                console.log(`[WhatsApp] ✅ Conectado: ${companyId}`);
                whatsappSessions.set(companyId, sock);
                if (emitQr) emitQr("CONNECTED");
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const remoteJid = msg.key.remoteJid;
            const phone = remoteJid?.split('@')[0];
            const name = msg.pushName || 'Lead';
            const content = msg.message.conversation || msg.message.extendedTextMessage?.text;

            if (!content || !phone || !remoteJid) return; 
            if (remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') return;

            try {
                // ROTEAMENTO INTELIGENTE DE SDR (Requirement 8 & 9)
                // Busca no banco de dados qual SDR deve responder este contato
                const response = await fetch('http://localhost:3000/api/webhook/whatsapp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        companyId, 
                        phone, 
                        name, 
                        content, 
                        source: 'WhatsApp',
                        // O backend decidirá qual SDR usar (Inbound/Outbound) baseado no histórico
                    })
                });
                const data = await response.json();
                
                if (data.success && data.ai_response) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    await sock.readMessages([msg.key]);
                    await sock.sendPresenceUpdate('composing', remoteJid);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await sock.sendPresenceUpdate('paused', remoteJid);
                    await sock.sendMessage(remoteJid, { text: data.ai_response });
                }
            } catch (error) {
                console.error(`[WhatsApp SaaS ${companyId}] Erro no processamento de IA:`, error);
            }
        });
        
        return sock;
    }
    
    // Inicia todas as instâncias existentes (ao ligar o servidor)
    static async bootExistingSessions() {
        const instancesDir = path.resolve('./instances');
        if (!fs.existsSync(instancesDir)) return;
        const companies = fs.readdirSync(instancesDir);
        for (const companyId of companies) {
            console.log(`[WhatsApp SaaS] Reiniciando sessão salva para: ${companyId}`);
            this.createSession(companyId, null).catch(err => console.error(err));
        }
    }

    // Verifica se os números possuem WhatsApp usando a primeira sessão ativa disponível
    static async checkWhatsApp(phones) {
        if (whatsappSessions.size === 0) return phones.map(p => ({ phone: p, exists: null }));
        
        const sessions = Array.from(whatsappSessions.values());
        const sock = sessions[0]; // Usa qualquer sessão ativa

        try {
            const results = await Promise.all(phones.map(async (p) => {
                const jid = p + '@s.whatsapp.net';
                const [result] = await sock.onWhatsApp(jid);
                return { phone: p, exists: !!result?.exists };
            }));
            return results;
        } catch (e) {
            console.error("[WhatsApp SaaS] Erro ao verificar números:", e);
            return phones.map(p => ({ phone: p, exists: null }));
        }
    }
}
