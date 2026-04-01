import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

export const whatsappSessions = new Map();

// Classe responsável por orquestrar múltiplas conexões de empresas (Multi-tenant SaaS)
export class WhatsAppManager {
    static async createSession(tenantId, emitQr) {
        // Se a sessão já estiver ativa (conectada ou pendente), evita duplicidade
        if (whatsappSessions.has(tenantId)) {
            const existing = whatsappSessions.get(tenantId);
            if (existing.status === 'CONNECTED') {
                if (emitQr) emitQr("CONNECTED");
            }
            return existing.sock;
        }

        // Marca como em progresso para evitar novas instâncias durante o boot
        whatsappSessions.set(tenantId, { status: 'CONNECTING', sock: null });

        const authDir = path.resolve(`./instances/${tenantId}`);
        if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            // Identidade mais amigável para evitar bloqueios automáticos 🕶️
            browser: ['VendAi SDR', 'Chrome', '1.0.0'],
            logger: pino({ level: 'debug' })
        });

        // Agora guardamos o socket ainda pendente no nosso mapa central
        whatsappSessions.set(tenantId, { status: 'CONNECTING', sock: sock });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            if (qr && emitQr) {
                console.log(`[WhatsApp] QR Gerado para: ${tenantId}`);
                emitQr(qr);
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                console.log(`[WhatsApp] Conexão ${tenantId} fechada. Reconectar? ${shouldReconnect}`);
                whatsappSessions.delete(tenantId);
                // Se for queda de rede, o Baileys tenta sozinho, mas limpamos o status
            } else if (connection === 'open') {
                console.log(`[WhatsApp] ✅ Conectado: ${tenantId}`);
                whatsappSessions.set(tenantId, { status: 'CONNECTED', sock: sock });
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
                const response = await fetch('http://localhost:3000/api/webhook/whatsapp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        tenantId, 
                        phone, 
                        name, 
                        content, 
                        source: 'WhatsApp'
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
                console.error(`[WhatsApp SaaS ${tenantId}] Erro no processamento de IA:`, error);
            }
        });
        
        return sock;
    }
    
    // Inicia todas as instâncias existentes (ao ligar o servidor)
    static async bootExistingSessions() {
        const instancesDir = path.resolve('./instances');
        if (!fs.existsSync(instancesDir)) return;
        const tenants = fs.readdirSync(instancesDir);
        for (const tenantId of tenants) {
            console.log(`[WhatsApp SaaS] Reiniciando sessão salva para: ${tenantId}`);
            this.createSession(tenantId, null).catch(err => console.error(err));
        }
    }

    // Verifica se os números possuem WhatsApp usando a primeira sessão ativa disponível
    static async checkWhatsApp(phones) {
        const sessions = Array.from(whatsappSessions.values()).filter(s => s.status === 'CONNECTED');
        if (sessions.length === 0) return phones.map(p => ({ phone: p, exists: null }));
        
        const sock = sessions[0].sock; // Usa qualquer sessão ativa

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
