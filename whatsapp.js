import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, DisconnectReason, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { CommandCenter } from './command_center.js';

const prisma = new PrismaClient();

export const whatsappSessions = new Map();

// Baileys (WhatsApp não-oficial) é modo EXPERIMENTAL. Em produção o canal é a
// Meta Cloud API (oficial, não-banível). Só habilite via env em ambiente de
// teste, ciente do risco de banimento do número.
export const BAILEYS_ENABLED = process.env.ENABLE_BAILEYS === "true";

// Mapa de cooldown: previne tentativas excessivas após erros 405 (rate-limiting WhatsApp)
const connectionCooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

// Diretório das credenciais do Baileys (auth_info). Em produção aponte
// WA_AUTH_DIR para um VOLUME PERSISTENTE (ex.: /data/instances) — NUNCA sob a
// pasta de uploads (que é servida publicamente). Sem persistência, o número
// pede QR de novo a cada redeploy.
const WA_AUTH_BASE = process.env.WA_AUTH_DIR || path.join(process.cwd(), 'instances');
try { fs.mkdirSync(WA_AUTH_BASE, { recursive: true }); } catch (_) {}
console.log(`[WhatsApp] Credenciais (auth_info) em: ${WA_AUTH_BASE}`);

/**
 * Conexões que NÃO são via QR: a oficial (Cloud API, identificada por
 * phoneId + accessToken) e o Instagram. Elas não têm socket Baileys, então o
 * estado delas nunca deve ser escrito por este módulo.
 */
export function isManagedElsewhere(account) {
    if (!account) return false;
    return account.channel === 'INSTAGRAM' || !!(account.phoneId && account.accessToken);
}

// Classe responsável por orquestrar múltiplas conexões de empresas (Multi-tenant SaaS)

/**
 * O que o Baileys recebe como mídia.
 *
 * Ele aceita `Buffer` ou `{ url }` — e só isso. Passar a string
 * "/uploads/x.jpg" não estoura de forma clara: a mensagem simplesmente não
 * chega, e do lado do painel parece que foi enviada. Era assim que o agente
 * dizia "estou te mandando a foto" com a foto nunca tendo saído.
 *
 * A ordem importa: arquivo no disco primeiro (não depende de DNS nem de a
 * URL ser pública), URL absoluta depois, e por último a montagem da URL
 * pública para o caso de a imagem estar no S3 ou o volume não ser o mesmo
 * deste processo.
 *
 * Devolve `null` quando não há como alcançar o arquivo — e quem chamou tem de
 * tratar isso como falha, não como envio.
 */
export async function resolverMidia(mediaUrl) {
    if (typeof mediaUrl !== 'string' || !mediaUrl) return null;

    if (mediaUrl.startsWith('data:')) {
        const base64 = mediaUrl.split(',')[1];
        return base64 ? Buffer.from(base64, 'base64') : null;
    }

    const { localPathFor, toPublicUrl } = await import('./src/api/services/StorageService.js');
    const localPath = localPathFor(mediaUrl);
    if (localPath && fs.existsSync(localPath)) return fs.readFileSync(localPath);

    if (/^https?:\/\//i.test(mediaUrl)) return { url: mediaUrl };

    const publica = toPublicUrl(mediaUrl);
    if (/^https?:\/\//i.test(publica)) return { url: publica };

    console.error(
        `[WhatsApp Baileys] Mídia inacessível: "${mediaUrl}". ` +
        'O arquivo não está neste disco e PUBLIC_URL não está configurada.'
    );
    return null;
}

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
                select: { id: true, phoneId: true, accessToken: true, channel: true }
            });

            if (!account) return;

            // Conexão oficial (Cloud API) ou Instagram não têm socket Baileys:
            // o estado delas vem das credenciais, não daqui. Sem esta guarda,
            // uma pasta auth_info órfã faz o Baileys marcar como DESCONECTADA
            // uma conexão oficial que está funcionando normalmente.
            if (isManagedElsewhere(account)) {
                console.warn(`[WhatsApp DB] Ignorando status '${status}' para ${accountId}: conexão não é via QR.`);
                return;
            }

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

    /**
     * Força uma reconexão manual: limpa o cooldown anti-rate-limit e a sessão
     * presa em memória, fechando o socket antigo — SEM apagar as credenciais
     * (auth_info), para reconectar sem novo QR quando possível. Depois disso,
     * uma chamada a createSession (via stream de QR) recomeça limpo.
     */
    static async forceReconnect(accountId) {
        connectionCooldowns.delete(accountId);
        if (whatsappSessions.has(accountId)) {
            const existing = whatsappSessions.get(accountId);
            try { existing.sock?.end?.(); } catch (_) {}
            whatsappSessions.delete(accountId);
        }
        await this.updateAccountStatus(accountId, 'DISCONNECTED').catch(() => {});
        console.log(`[WhatsApp] 🔄 Reconexão forçada para ${accountId} (cooldown/sessão limpos).`);
    }

    static async createSession(accountId, emitQr) {
        if (!BAILEYS_ENABLED) {
            const msg = "WhatsApp via Baileys está desabilitado. Use a conexão oficial (Meta Cloud API).";
            console.warn(`[WhatsApp] ${msg}`);
            if (emitQr) emitQr(JSON.stringify({ status: "DISABLED", message: msg }));
            return null;
        }
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

        const authDir = path.join(WA_AUTH_BASE, accountId);
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
                // Telefone real vem em senderPn quando disponível; senão usamos o
                // número do @lid como identificador estável (NUNCA o pushName,
                // que é um nome e muda/colide entre contatos).
                phone = msg.key.senderPn?.split('@')[0] || remoteJid.split('@')[0];
                console.log(`[WhatsApp] Mensagem LID de ${msg.pushName || phone} (phone: ${phone}, lid: ${remoteJid})`);
            } else {
                phone = remoteJid?.split('@')[0];
            }
            
            const name = msg.pushName || 'Lead';
            let content = msg.message?.conversation ||
                           msg.message?.extendedTextMessage?.text ||
                           msg.message?.imageMessage?.caption ||
                           msg.message?.videoMessage?.caption;
            let messageType = 'TEXT';
            let mediaMime = null;   // mimetype da mídia recebida (imagem/documento)
            let mediaCaption = null; // legenda enviada junto da mídia
            let fileName = null;

            // 🎙️ Suporte a Áudio Recebido
            if (msg.message?.audioMessage) {
                try {
                    console.log(`[WhatsApp] 🎙️ Recebendo áudio de ${phone}...`);
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                    const filename = `audio_${Date.now()}.ogg`;
                    const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                    const filePath = path.join(dir, filename);
                    fs.writeFileSync(filePath, buffer);

                    // URL canônica servida pela API (proxied em /api).
                    content = `/api/uploads/${filename}`;
                    messageType = 'AUDIO';
                    console.log(`[WhatsApp] ✅ Áudio salvo: ${content}`);
                } catch (err) {
                    console.error(`[WhatsApp] ❌ Erro ao baixar áudio:`, err);
                }
            }

            // 🖼️ Imagem recebida (o agente "lê" via IA multimodal)
            if (msg.message?.imageMessage) {
                try {
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                    mediaMime = msg.message.imageMessage.mimetype || 'image/jpeg';
                    mediaCaption = msg.message.imageMessage.caption || null;
                    const ext = (mediaMime.split('/')[1] || 'jpg').split(';')[0];
                    const filename = `img_${Date.now()}.${ext}`;
                    const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(path.join(dir, filename), buffer);
                    content = `/api/uploads/${filename}`;
                    messageType = 'IMAGE';
                    console.log(`[WhatsApp] 🖼️ Imagem salva: ${content}`);
                } catch (err) {
                    console.error(`[WhatsApp] ❌ Erro ao baixar imagem:`, err);
                }
            }

            // 📄 Documento recebido (PDF, txt, etc.) — o agente lê o conteúdo
            if (msg.message?.documentMessage || msg.message?.documentWithCaptionMessage?.message?.documentMessage) {
                try {
                    const doc = msg.message.documentMessage || msg.message.documentWithCaptionMessage.message.documentMessage;
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                    mediaMime = doc.mimetype || 'application/octet-stream';
                    fileName = doc.fileName || `doc_${Date.now()}`;
                    mediaCaption = doc.caption || null;
                    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const filename = `doc_${Date.now()}_${safe}`;
                    const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(path.join(dir, filename), buffer);
                    content = `/api/uploads/${filename}`;
                    messageType = 'DOCUMENT';
                    console.log(`[WhatsApp] 📄 Documento salvo: ${content} (${mediaMime})`);
                } catch (err) {
                    console.error(`[WhatsApp] ❌ Erro ao baixar documento:`, err);
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
                        mediaMime,   // mimetype (imagem/documento) p/ leitura por IA
                        mediaCaption,
                        fileName,
                        source: 'WhatsApp',
                        channel: 'WHATSAPP',
                        accountId, // conexão (WhatsAppAccount.id) que recebeu a mensagem
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

                    // 1. Tenta enviar Áudio (modo AUDIO/BOTH). Marca se conseguiu.
                    let audioSent = false;
                    if (ai_audio_url && (response_mode === "AUDIO" || response_mode === "BOTH")) {
                        try {
                            const { localPathFor } = await import('./src/api/services/StorageService.js');
                            const fullAudioPath = localPathFor(ai_audio_url)
                                || path.join(process.cwd(), "public", ai_audio_url.replace(/^\/+/, ""));
                            // Nota de voz só aparece no app em OGG/Opus. Um WAV é
                            // aceito no envio mas fica invisível no WhatsApp —
                            // nesse caso preferimos cair no texto.
                            const isOgg = /\.ogg$/i.test(fullAudioPath);
                            if (fs.existsSync(fullAudioPath) && isOgg) {
                                await sock.sendMessage(remoteJid, {
                                    audio: fs.readFileSync(fullAudioPath),
                                    mimetype: 'audio/ogg; codecs=opus',
                                    ptt: true, // mensagem de voz gravada
                                });
                                audioSent = true;
                                console.log(`[WhatsApp] 🔊 Nota de voz enviada para ${remoteJid}`);
                            } else if (!fs.existsSync(fullAudioPath)) {
                                console.warn(`[WhatsApp] Áudio TTS não encontrado no disco: ${fullAudioPath}`);
                            } else {
                                console.warn(`[WhatsApp] Áudio não está em OGG/Opus (${path.extname(fullAudioPath)}) — enviando texto no lugar. Verifique o ffmpeg no container.`);
                            }
                        } catch (e) {
                            console.error(`[WhatsApp] Falha ao enviar áudio (fallback p/ texto):`, e.message);
                        }
                    }

                    // 2. Envia Texto — SEMPRE que o áudio não foi enviado (nunca
                    // ficar em silêncio), ou nos modos TEXT/BOTH.
                    if (ai_response && (response_mode === "TEXT" || response_mode === "BOTH" || !audioSent)) {
                        try {
                            await sock.sendMessage(remoteJid, { text: ai_response });
                        } catch (e) {
                            console.error(`[WhatsApp] Falha ao enviar texto para ${remoteJid}:`, e.message);
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
        if (!BAILEYS_ENABLED) {
            console.log("[WhatsApp] Baileys desabilitado (ENABLE_BAILEYS != true). Canal oficial: Meta Cloud API.");
            return;
        }
        const instancesDir = WA_AUTH_BASE;
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
                // Número migrado para a API oficial costuma deixar a pasta
                // auth_info para trás. Reconectar por QR aqui falha em loop e
                // ainda sobrescreve o status da conexão oficial.
                if (isManagedElsewhere(account)) {
                    console.log(`[WhatsApp SaaS] ${accountId} (${account.name}) usa conexão oficial/Instagram — pulando restauração por QR. Credenciais antigas em ${path.join(instancesDir, accountId)} podem ser removidas.`);
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
                const source = await resolverMidia(mediaUrl);
                if (!source) return false;

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
