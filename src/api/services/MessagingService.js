import prisma from "../config/prisma.js";

/**
 * MessagingService — camada única de ENVIO no WhatsApp.
 *
 * A plataforma suporta dois transportes simultaneamente:
 *   - Cloud API oficial da Meta  (conta com phoneId + accessToken)
 *   - Baileys / QR Code          (conta sem phoneId; sessão via QR)
 *
 * Todo envio (lembretes, campanhas, atendimento humano, mídia do catálogo)
 * deve passar por aqui: resolvemos a conexão certa do tenant — ou a conexão
 * específica da conversa (accountId) — e despachamos pelo transporte dela.
 * Antes, os envios chamavam o Baileys direto e ficavam mudos em contas que
 * usam o canal oficial.
 */

/** True quando a conta é do canal oficial (Cloud API). */
function isCloud(account) {
  return !!(account?.phoneId && account?.accessToken);
}

/**
 * Resolve qual conexão usar. Prioriza:
 *  1. a conexão da própria conversa (accountId), se ativa;
 *  2. uma conexão oficial (Cloud API) conectada;
 *  3. qualquer conexão WhatsApp habilitada.
 */
async function resolveAccount(tenantId, accountId = null) {
  if (accountId) {
    const acc = await prisma.whatsAppAccount
      .findFirst({ where: { id: accountId, tenantId, enabled: true } })
      .catch(() => null);
    if (acc) return acc;
  }
  const accounts = await prisma.whatsAppAccount
    .findMany({ where: { tenantId, channel: "WHATSAPP", enabled: true } })
    .catch(() => []);
  if (!accounts.length) return null;
  return (
    accounts.find((a) => isCloud(a) && a.status === "CONNECTED") ||
    accounts.find((a) => isCloud(a)) ||
    accounts.find((a) => a.status === "CONNECTED") ||
    accounts[0]
  );
}

class MessagingService {
  /**
   * Envia texto pelo transporte correto do tenant.
   * @param {string} tenantId
   * @param {string} phone   número do destinatário
   * @param {string} text
   * @param {{accountId?: string}} opts  conexão específica (Lead.waAccountId)
   */
  async sendText(tenantId, phone, text, opts = {}) {
    if (!tenantId || !phone || !text) return false;
    const account = await resolveAccount(tenantId, opts.accountId);

    if (isCloud(account)) {
      const { MetaManager } = await import("../../../meta.js");
      try {
        await MetaManager.sendMessage(account.phoneId, account.accessToken, phone, text);
        return true;
      } catch (e) {
        console.error(`[Messaging] Falha no envio via Cloud API:`, e.message);
        return false;
      }
    }

    // Fallback: Baileys (QR)
    try {
      const { WhatsAppManager } = await import("../../../whatsapp.js");
      return await WhatsAppManager.sendMessage(tenantId, phone, text);
    } catch (e) {
      console.error(`[Messaging] Falha no envio via Baileys:`, e.message);
      return false;
    }
  }

  /**
   * Envia mídia (image | video | audio | document) pelo transporte correto.
   * `mediaUrl` pode ser caminho local (/api/uploads/…) ou URL pública.
   */
  async sendMedia(tenantId, phone, mediaUrl, mediaType = "image", caption = "", opts = {}) {
    if (!tenantId || !phone || !mediaUrl) return false;
    const account = await resolveAccount(tenantId, opts.accountId);

    if (isCloud(account)) {
      const { MetaManager } = await import("../../../meta.js");
      try {
        const ok = await MetaManager.sendWhatsAppMedia(
          account.phoneId, account.accessToken, phone, mediaUrl, mediaType, caption
        );
        return ok;
      } catch (e) {
        console.error(`[Messaging] Falha na mídia via Cloud API:`, e.message);
        return false;
      }
    }

    try {
      const { WhatsAppManager } = await import("../../../whatsapp.js");
      return await WhatsAppManager.sendMedia(tenantId, phone, mediaUrl, mediaType, caption);
    } catch (e) {
      console.error(`[Messaging] Falha na mídia via Baileys:`, e.message);
      return false;
    }
  }

  /** Descobre o transporte ativo do tenant (útil para logs/diagnóstico). */
  async transportOf(tenantId, accountId = null) {
    const account = await resolveAccount(tenantId, accountId);
    if (!account) return "none";
    return isCloud(account) ? "cloud" : "baileys";
  }
}

export default new MessagingService();
