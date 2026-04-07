import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  makeCacheableSignalKeyStore 
} from '@whiskeysockets/baileys';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { pino } from 'pino';
import { Boom } from '@hapi/boom';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  private sessions = new Map<string, any>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.bootExistingSessions().catch(e => this.logger.error('Error booting sessions:', e));
  }

  private async bootExistingSessions() {
    const accounts = await this.prisma.whatsAppAccount.findMany();
    for (const acc of accounts) {
      await this.createSession(acc.tenantId);
    }
  }

  async createSession(tenantId: string) {
    const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys/${tenantId}`);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) this.createSession(tenantId);
      }
      this.logger.log(`WhatsApp connection state for ${tenantId}: ${connection}`);
    });

    this.sessions.set(tenantId, sock);
    return sock;
  }

  async sendMessage(tenantId: string, to: string, content: string) {
    const sock = this.sessions.get(tenantId);
    if (!sock) throw new Error('Session not found for tenant ' + tenantId);
    return sock.sendMessage(to + '@s.whatsapp.net', { text: content });
  }
}
