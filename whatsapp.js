import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

export const whatsappSessions = new Map();

// Classe responsável por orquestrar múltiplas conexões de empresas (Multi-tenant SaaS)
export class WhatsAppManager {
    static async createSession(companyId, emitQr) {
        // Criar pasta isolada por empresa para segurança e escopo
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
            const { connection, qr } = update;
            
            // Se o sistema solicitar QR Code, emitimos via SSE (Server-Sent Events) para o Dashboard da Interface Web
            if (qr && emitQr) {
                emitQr(qr);
            }
            
            if (connection === 'close') {
                console.log(`[WhatsApp SaaS] Conexão da Empresa ${companyId} abortada/fechada.`);
                whatsappSessions.delete(companyId);
            } else if (connection === 'open') {
                console.log(`[WhatsApp SaaS] Empresa ${companyId} logou com Sucesso!`);
                whatsappSessions.set(companyId, sock);
                if (emitQr) emitQr("CONNECTED"); // Avisa o frontend que não precisa mais do QR
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
                // Ao invez de uma API externa, chama diretamente o webhook interno enviando o ID da empresa!
                const response = await fetch('http://localhost:3000/api/webhook/whatsapp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companyId, phone, name, content, source: 'WhatsApp' })
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
}
