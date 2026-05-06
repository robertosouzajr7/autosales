import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, DisconnectReason, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { CommandCenter } from './command_center.js';

const prisma = new PrismaClient();

export const whatsappSessions = new Map();

// Mapa de cooldown: previne tentativas excessivas após erros 405 (rate-limiting WhatsApp)
const connectionCooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

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
            // Verifica se a conta ainda existe no DB antes de tentar atualizar
            const account = await prisma.whatsAppAccount.findUnique({
                where: { id: accountId },
                select: { id: true }
            });

            if (!account) return;

            const data = { status };
            if (phone) data.phone = phone;
            await prisma.whatsAppAccount.update({
                where: { id: accountId },
                data
            });
            console.log(`[WhatsApp DB] Account ${accountId} -> ${status}${phone ? ` (${phone})` : ''}`);
        } catch (e) {
            if (e.code === 'P2025') return; // Ignora silenciosamente se o registro sumiu entre o check e o update
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

        // Verifica cooldown anti-rate-limit do WhatsApp
        const cooldownUntil = connectionCooldowns.get(accountId);
        if (cooldownUntil && Date.now() < cooldownUntil) {
            const remainingSeconds = Math.ceil((cooldownUntil - Date.now()) / 1000);
            console.log(`[WhatsApp] ⏳ Conta ${accountId} em cooldown. Aguarde ${remainingSeconds}s.`);
            if (emitQr) emitQr(JSON.stringify({ 
                status: "COOLDOWN", 
                message: `Aguarde ${remainingSeconds} segundos antes de tentar novamente.`,
                remainingSeconds
            }));
            return null;
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

        const authDir = `./instances/${accountId}`;
        if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['VendAi SDR', 'Chrome', '1.0.0'],
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
                // Códigos que NÃO devem disparar reconexão automática:
                // 401: Logged Out
                // 403: Forbidden
                // 405: Session Invalid/Logged out elsewhere
                const fatalCodes = [DisconnectReason.loggedOut, 401, 403, 405];
                const shouldReconnect = !fatalCodes.includes(statusCode);

                console.log(`[WhatsApp] Conexão ${accountId} fechada (code: ${statusCode}). Reconectar: ${shouldReconnect}`);
                whatsappSessions.delete(accountId);
                
                if (shouldReconnect) {
                    await WhatsAppManager.updateAccountStatus(accountId, 'CONNECTING');
                    if (emitQr) emitQr(JSON.stringify({ status: "WAITING" }));
                    
                    console.log(`[WhatsApp] Tentando reconectar ${accountId} em 3s...`);
                    setTimeout(() => {
                        // Passamos o mesmo emitQr para que o frontend continue recebendo atualizações da nova sessão
                        WhatsAppManager.createSession(accountId, emitQr).catch(err =>
                            console.error(`[WhatsApp] Falha ao reconectar ${accountId}:`, err)
                        );
                    }, 3000);
                } else {
                    await WhatsAppManager.updateAccountStatus(accountId, 'DISCONNECTED');
                    
                    // Erro 405 = rate limit do WhatsApp. Aplica cooldown de 5 minutos.
                    if (statusCode === 405) {
                        const cooldownUntil = Date.now() + COOLDOWN_MS;
                        connectionCooldowns.set(accountId, cooldownUntil);
                        const remainingSeconds = Math.ceil(COOLDOWN_MS / 1000);
                        console.log(`[WhatsApp] ⏳ Erro 405 para ${accountId}. Cooldown de ${remainingSeconds}s ativado para evitar bloqueio de IP.`);
                        if (emitQr) emitQr(JSON.stringify({ 
                            status: "COOLDOWN", 
                            message: `WhatsApp recusou a conexão. Aguarde ${Math.ceil(remainingSeconds/60)} minutos antes de tentar novamente.`,
                            remainingSeconds
                        }));
                    } else {
                        if (emitQr) emitQr(JSON.stringify({ status: "ERROR", message: `Conexão recusada (Erro ${statusCode}). Limpando sessão...` }));
                    }
                    
                    // Logout explícito ou erro fatal: limpa credenciais
                    console.log(`[WhatsApp] Erro fatal/Logout detectado para ${accountId} (code: ${statusCode}). Limpando credenciais...`);
                    
                    // No Windows, precisamos de um pequeno delay para garantir que o Baileys liberou os handles dos arquivos
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(authDir)) {
                                fs.rmSync(authDir, { recursive: true, force: true });
                                console.log(`[WhatsApp] ✅ Credenciais de ${accountId} limpas com sucesso.`);
                            }
                        } catch (err) {
                            console.error(`[WhatsApp] ❌ Erro ao limpar credenciais de ${accountId}:`, err.message);
                            // Tenta remover apenas o creds.json se a pasta toda falhar
                            try {
                                const credsFile = path.join(authDir, 'creds.json');
                                if (fs.existsSync(credsFile)) fs.unlinkSync(credsFile);
                            } catch (_) {}
                        }
                    }, 1500);
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
            const remoteJid = msg.key.remoteJid;
            
            // FILTRO DE SEGURANÇA: Ignorar mensagens que não sejam de conversas individuais
            // Ignora Grupos (@g.us), Canais/Newsletters (@newsletter) e Transmissões (@broadcast)
            if (remoteJid?.endsWith('@g.us') || remoteJid?.endsWith('@newsletter') || remoteJid?.endsWith('@broadcast')) {
                return;
            }

            if (!msg.message || msg.key.fromMe) return;

            // WhatsApp migrou para LID (@lid) em vez de @s.whatsapp.net
            // Quando é @lid, o telefone real vem em msg.key.senderPn
            let phone;
            if (remoteJid?.endsWith('@lid')) {
                // Extrai o número do senderPn (ex: "557185240084@s.whatsapp.net" -> "557185240084")
                phone = msg.key.senderPn?.split('@')[0] || msg.pushName;
                console.log(`[WhatsApp] Mensagem LID de ${phone} (lid: ${remoteJid})`);
            } else {
                phone = remoteJid?.split('@')[0];
            }
            
            const name = msg.pushName || 'Lead';
            let content = msg.message?.conversation || 
                           msg.message?.extendedTextMessage?.text ||
                           msg.message?.imageMessage?.caption ||
                           msg.message?.videoMessage?.caption;
            let messageType = 'TEXT';

            // 🎙️ Suporte a Áudio Recebido
            if (msg.message?.audioMessage) {
                try {
                    console.log(`[WhatsApp] 🎙️ Recebendo áudio de ${phone}...`);
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                    const filename = `audio_${Date.now()}.ogg`;
                    const dir = path.join(process.cwd(), 'public', 'uploads');
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    
                    const filePath = path.join(dir, filename);
                    fs.writeFileSync(filePath, buffer);
                    
                    content = `/uploads/${filename}`;
                    messageType = 'AUDIO';
                    console.log(`[WhatsApp] ✅ Áudio salvo: ${content}`);
                } catch (err) {
                    console.error(`[WhatsApp] ❌ Erro ao baixar áudio:`, err);
                }
            }

            if (!content || !phone) return;
            if (remoteJid?.includes('@g.us') || remoteJid === 'status@broadcast') return;

            // 🚫 Prevenção de Loop: Ignorar se a mensagem for para o próprio número do robô
            const myNumber = sock.user?.id?.split(':')[0];
            if (phone === myNumber) return;

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
                        messageType,
                        source: 'WhatsApp',
                        skipNewLeadTrigger: true // ⚡ FASE 2/4: Evitar disparo duplo de prospecção em chat direto
                    })
                });
                const data = await response.json();

                if (data.success) {
                    const { ai_response, ai_audio_url, response_mode } = data;
                    
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    await sock.readMessages([msg.key]);
                    await sock.sendPresenceUpdate('composing', remoteJid);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await sock.sendPresenceUpdate('paused', remoteJid);

                    // 1. Envia Texto se necessário
                    if (ai_response && (response_mode === "TEXT" || response_mode === "BOTH")) {
                        await sock.sendMessage(remoteJid, { text: ai_response });
                    }

                    // 2. Envia Áudio se necessário
                    if (ai_audio_url && (response_mode === "AUDIO" || response_mode === "BOTH")) {
                        // O ai_audio_url é relativo (ex: /uploads/audio.mp3)
                        const fullAudioPath = path.join(process.cwd(), "public", ai_audio_url);
                        
                        if (fs.existsSync(fullAudioPath)) {
                            await sock.sendMessage(remoteJid, {
                                audio: { url: fullAudioPath },
                                mimetype: 'audio/mp4',
                                ptt: true // Envia como mensagem de voz gravada
                            });
                        }
                    }
                    
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
                // Timeout de 15 segundos para evitar travamento infinito
                await Promise.race([
                    session.sock.sendMessage(jid, { text }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Baileys sendMessage Timeout")), 15000))
                ]);
                console.log(`[WhatsApp Baileys] Enviado p/ ${phone}`);
                return true;
            } catch (e) {
                console.error(`[WhatsApp Baileys] Erro no envio para ${phone}:`, e.message);
                return false;
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
                let source = mediaUrl;

                // Handle base64 data URLs
                if (typeof mediaUrl === 'string' && mediaUrl.startsWith('data:')) {
                    const [meta, base64Data] = mediaUrl.split(',');
                    source = Buffer.from(base64Data, 'base64');
                }

                switch (mediaType) {
                    case 'image':
                        msgContent = { image: source, caption };
                        break;
                    case 'video':
                        msgContent = { video: source, caption };
                        break;
                    case 'document':
                        msgContent = { document: source, caption, fileName: caption || 'document' };
                        break;
                    case 'audio':
                        msgContent = { 
                            audio: source, 
                            mimetype: 'audio/ogg; codecs=opus', // Formato nativo do WhatsApp voice
                            ptt: true // Envia como mensagem de voz
                        };
                        break;
                    default:
                        msgContent = { image: source, caption };
                }
                await session.sock.sendMessage(jid, msgContent);
                console.log(`[WhatsApp Baileys] Mídia ${mediaType} enviada p/ ${phone}`);
                return true;
            } catch (e) {
                console.error(`[WhatsApp Baileys] Erro crítico no envio de mídia:`, e);
                return false;
            }
        }

        // Fallback: texto com link
        console.warn(`[WhatsApp] sendMedia fallback: enviando como texto p/ ${phone}`);
        return this.sendMessage(tenantId, phone, `${caption}\n${mediaUrl}`);
    }

    /**
     * Verifica se um número existe no WhatsApp (onWhatsApp).
     */
    static async checkWhatsAppNumber(tenantId, phone) {
        const sessionEntry = Array.from(whatsappSessions.entries()).find(
            ([_, s]) => s.tenantId === tenantId && s.status === 'CONNECTED'
        );

        if (!sessionEntry) return false;
        
        const [_, session] = sessionEntry;
        const jid = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;

        try {
            const [result] = await session.sock.onWhatsApp(jid);
            return !!result?.exists;
        } catch (e) {
            console.error(`[WhatsApp] Erro ao validar número ${phone}:`, e.message);
            return false;
        }
    }
}
