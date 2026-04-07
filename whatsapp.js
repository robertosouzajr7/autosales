import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { CommandCenter } from './command_center.js';

const prisma = new PrismaClient();

export const whatsappSessions = new Map();

// Classe responsável por orquestrar múltiplas conexões de empresas (Multi-tenant SaaS)
export class WhatsAppManager {
    /**
     * Resolve o tenantId real a partir do accountId (WhatsAppAccount.id).
     * Necessário porque o webhook precisa do Tenant.id, não do account.id.
     */
    static async resolveAccountTenant(accountId) {
        try {
            const account = await prisma.whatsAppAccount.findUnique({
                where: { id: accountId },
                select: { tenantId: true }
            });
            return account?.tenantId || null;
        } catch (e) {
            console.error(`[WhatsApp] Erro ao resolver tenant para account ${accountId}:`, e);
            return null;
        }
    }

    /**
     * Atualiza o status da conta no banco de dados.
     */
    static async updateAccountStatus(accountId, status, phone = null) {
        try {
            const data = { status };
            if (phone) data.phone = phone;
            await prisma.whatsAppAccount.update({
                where: { id: accountId },
                data
            });
            console.log(`[WhatsApp DB] Account ${accountId} -> ${status}${phone ? ` (${phone})` : ''}`);
        } catch (e) {
            console.error(`[WhatsApp DB] Erro ao atualizar status:`, e);
        }
    }

    static async createSession(accountId, emitQr) {
        // Se já está conectada, avisa e retorna
        if (whatsappSessions.has(accountId)) {
            const existing = whatsappSessions.get(accountId);
            if (existing.status === 'CONNECTED' && existing.sock) {
                if (emitQr) emitQr(JSON.stringify({ status: "CONNECTED" }));
                return existing.sock;
            }
            // Se está CONNECTING, destrói sessão anterior para recomeçar limpo
            if (existing.status === 'CONNECTING') {
                console.log(`[WhatsApp] Sessão ${accountId} presa em CONNECTING. Reiniciando...`);
                if (existing.sock) {
                    try { existing.sock.end(); } catch (_) {}
                }
                whatsappSessions.delete(accountId);
            }
        }

        // Marca como em progresso
        whatsappSessions.set(accountId, { status: 'CONNECTING', sock: null, tenantId: null });
        await this.updateAccountStatus(accountId, 'CONNECTING');

        // Resolve o tenantId real para uso no webhook de mensagens
        const realTenantId = await this.resolveAccountTenant(accountId);
        if (!realTenantId) {
            console.error(`[WhatsApp] Conta ${accountId} sem tenant válido!`);
            whatsappSessions.delete(accountId);
            if (emitQr) emitQr(JSON.stringify({ status: "ERROR", message: "Tenant não encontrado" }));
            return null;
        }

        const authDir = path.resolve(`./instances/${accountId}`);
        if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['AutoSales SDR', 'Chrome', '1.0.0'],
            logger: pino({ level: 'warn' })
        });

        // Guarda o socket no mapa central
        whatsappSessions.set(accountId, { status: 'CONNECTING', sock, tenantId: realTenantId });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;

            if (qr && emitQr) {
                console.log(`[WhatsApp] QR Gerado para: ${accountId}`);
                // Envia QR como JSON formatado para o frontend
                emitQr(JSON.stringify({ qr }));
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

                console.log(`[WhatsApp] Conexão ${accountId} fechada (code: ${statusCode}). Reconectar: ${shouldReconnect}`);
                whatsappSessions.delete(accountId);
                await WhatsAppManager.updateAccountStatus(accountId, 'DISCONNECTED');

                if (emitQr) emitQr(JSON.stringify({ status: "DISCONNECTED" }));

                // Reconecta automaticamente em caso de queda (não logout)
                if (shouldReconnect) {
                    console.log(`[WhatsApp] Tentando reconectar ${accountId} em 3s...`);
                    setTimeout(() => {
                        WhatsAppManager.createSession(accountId, null).catch(err =>
                            console.error(`[WhatsApp] Falha ao reconectar ${accountId}:`, err)
                        );
                    }, 3000);
                } else {
                    // Logout explícito: limpa credenciais
                    console.log(`[WhatsApp] Logout detectado para ${accountId}. Limpando credenciais.`);
                    try {
                        fs.rmSync(authDir, { recursive: true, force: true });
                    } catch (_) {}
                }
            } else if (connection === 'open') {
                // Extrai o número de telefone da sessão conectada
                const phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0] || null;

                console.log(`[WhatsApp] ✅ Conectado: ${accountId} (phone: ${phoneNumber})`);
                whatsappSessions.set(accountId, { status: 'CONNECTED', sock, tenantId: realTenantId });

                // Atualiza status E telefone no banco
                await WhatsAppManager.updateAccountStatus(accountId, 'CONNECTED', phoneNumber);

                if (emitQr) emitQr(JSON.stringify({ status: "CONNECTED", phone: phoneNumber }));
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

            // 🚫 Prevenção de Loop: Ignorar se a mensagem for para o próprio número do robô
            const myNumber = sock.user?.id?.split(':')[0];
            if (phone === myNumber) {
                // console.log(`[WhatsApp] Ignorando mensagem do próprio número para evitar loop.`);
                return;
            }

            // Usa o tenantId REAL (do Tenant), não o accountId
            const session = whatsappSessions.get(accountId);
            const webhookTenantId = session?.tenantId || realTenantId;

            try {
                // 🎛️ DUAL-MODE: Verificar se é o DONO (Modo Comando) ou um LEAD (Modo SDR)
                const adminUser = await CommandCenter.isAdminPhone(phone, webhookTenantId);
                
                if (adminUser) {
                    // ═══ MODO COMANDO (estilo Eesier) ═══
                    console.log(`[CommandCenter] 🎛️ Admin ${adminUser.name} enviou: ${content.substring(0, 50)}...`);
                    const commandResponse = await CommandCenter.handleOwnerCommand(phone, content, webhookTenantId, adminUser);
                    
                    if (commandResponse) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        await sock.readMessages([msg.key]);
                        await sock.sendPresenceUpdate('composing', remoteJid);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await sock.sendPresenceUpdate('paused', remoteJid);
                        await sock.sendMessage(remoteJid, { text: commandResponse });
                    }
                    return; // Não envia para o webhook de leads
                }

                // ═══ MODO SDR (fluxo original para leads) ═══
                const response = await fetch('http://localhost:3000/api/webhook/whatsapp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenantId: webhookTenantId,
                        phone,
                        name,
                        content,
                        source: 'WhatsApp',
                        skipNewLeadTrigger: true // ⚡ FASE 2/4: Evitar disparo duplo de prospecção em chat direto
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
                    
                    // 🔔 ALERTA & QUALIFICAÇÃO (Assíncrono - Não trava a resposta)
                    setImmediate(async () => {
                        try {
                            const lead = await prisma.lead.findFirst({ where: { phone, tenantId: webhookTenantId } });
                            if (lead && (lead.qualificationScore >= 70 || content.toLowerCase().includes('interesse') || content.toLowerCase().includes('quero'))) {
                                const alert = await CommandCenter.sendLeadAlert(webhookTenantId, lead, content);
                                if (alert) {
                                    const adminJid = `${alert.adminPhone}@s.whatsapp.net`;
                                    if (adminJid !== remoteJid && alert.adminPhone !== myNumber) {
                                        await sock.sendMessage(adminJid, { text: alert.alertText });
                                    }
                                }
                            }
                        } catch (alertErr) {
                            // Erro silencioso em background
                        }
                    });
                }
            } catch (error) {
                console.error(`[WhatsApp SaaS ${accountId}] Erro no processamento:`, error);
            }
        });

        return sock;
    }

    // Inicia todas as instâncias existentes (ao ligar o servidor)
    static async bootExistingSessions() {
        const instancesDir = path.resolve('./instances');
        if (!fs.existsSync(instancesDir)) return;
        const accounts = fs.readdirSync(instancesDir);
        for (const accountId of accounts) {
            // Verifica se a conta ainda existe no banco antes de reconectar
            try {
                const account = await prisma.whatsAppAccount.findUnique({ where: { id: accountId } });
                if (!account) {
                    console.log(`[WhatsApp SaaS] Conta ${accountId} não existe mais no DB. Ignorando.`);
                    continue;
                }
                console.log(`[WhatsApp SaaS] Reiniciando sessão salva para: ${accountId} (${account.name})`);
                this.createSession(accountId, null).catch(err => console.error(err));
            } catch (err) {
                console.error(`[WhatsApp SaaS] Erro ao verificar conta ${accountId}:`, err);
            }
        }
    }

    // Verifica se os números possuem WhatsApp usando a primeira sessão ativa disponível
    static async checkWhatsApp(phones) {
        const sessions = Array.from(whatsappSessions.values()).filter(s => s.status === 'CONNECTED');
        if (sessions.length === 0) return phones.map(p => ({ phone: p, exists: null }));

        const sock = sessions[0].sock;

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

    // Desconecta uma sessão específica
    static async disconnectSession(accountId) {
        const session = whatsappSessions.get(accountId);
        if (session?.sock) {
            try {
                await session.sock.logout();
            } catch (_) {
                try { session.sock.end(); } catch (_) {}
            }
        }
        whatsappSessions.delete(accountId);
        await this.updateAccountStatus(accountId, 'DISCONNECTED');
    }

    // Envia uma mensagem de texto simples usando a sessão ativa do tenant (Baileys ou Meta)
    static async sendMessage(tenantId, phone, text) {
        // 1. Prioridade: Tentativa via Baileys (Sessão em Memória)
        const sessionEntry = Array.from(whatsappSessions.entries()).find(
            ([_, s]) => s.tenantId === tenantId && s.status === 'CONNECTED'
        );

        if (sessionEntry) {
            const [_, session] = sessionEntry;
            const jid = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;
            try {
                await session.sock.sendMessage(jid, { text });
                console.log(`[WhatsApp Baileys] Enviado p/ ${phone}`);
                return true;
            } catch (e) {
                console.error(`[WhatsApp Baileys] Erro no envio:`, e);
            }
        }

        // 2. Fallback: Tentativa via Meta Cloud API Official
        try {
            const metaAccount = await prisma.whatsAppAccount.findFirst({
                where: { 
                    tenantId, 
                    phoneId: { not: null },
                    accessToken: { not: null }
                }
            });

            if (metaAccount) {
                const { MetaManager } = await import('./meta.js');
                await MetaManager.sendMessage(metaAccount.phoneId, metaAccount.accessToken, phone, text);
                console.log(`[WhatsApp Meta] Enviado p/ ${phone} via API Oficial`);
                return true;
            }
        } catch (err) {
            console.error(`[WhatsApp Meta] Erro no envio fallback:`, err.message);
        }

        console.warn(`[WhatsApp] Falha total no envio: Nenhuma conexão ativa para o tenant ${tenantId}`);
        return false;
    }

    // Envia mídia (imagem, vídeo, documento, áudio) - Fase 4
    static async sendMedia(tenantId, phone, mediaUrl, mediaType, caption = "") {
        const sessionEntry = Array.from(whatsappSessions.entries()).find(
            ([_, s]) => s.tenantId === tenantId && s.status === 'CONNECTED'
        );

        if (sessionEntry) {
            const [_, session] = sessionEntry;
            const jid = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;
            try {
                let msgContent = {};
                switch (mediaType) {
                    case 'image':
                        msgContent = { image: { url: mediaUrl }, caption };
                        break;
                    case 'video':
                        msgContent = { video: { url: mediaUrl }, caption };
                        break;
                    case 'document':
                        msgContent = { document: { url: mediaUrl }, caption, fileName: caption || 'document' };
                        break;
                    case 'audio':
                        msgContent = { audio: { url: mediaUrl }, mimetype: 'audio/mpeg' };
                        break;
                    default:
                        msgContent = { image: { url: mediaUrl }, caption };
                }
                await session.sock.sendMessage(jid, msgContent);
                console.log(`[WhatsApp Baileys] Mídia ${mediaType} enviada p/ ${phone}`);
                return true;
            } catch (e) {
                console.error(`[WhatsApp Baileys] Erro no envio de mídia:`, e);
            }
        }

        // Fallback: texto com link
        console.warn(`[WhatsApp] sendMedia fallback: enviando como texto p/ ${phone}`);
        return this.sendMessage(tenantId, phone, `${caption}\n${mediaUrl}`);
    }
}
