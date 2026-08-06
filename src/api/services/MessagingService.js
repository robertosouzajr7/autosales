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

/**
 * Conta do Instagram por onde responder. Prioriza a conexão que recebeu a
 * conversa (Lead.waAccountId); sem ela, qualquer conta de Instagram ativa
 * do negócio.
 */
async function resolveInstagramAccount(tenantId, accountId = null) {
  if (accountId) {
    const acc = await prisma.whatsAppAccount
      .findFirst({ where: { id: accountId, tenantId, channel: "INSTAGRAM", enabled: true } })
      .catch(() => null);
    if (acc) return acc;
  }
  return prisma.whatsAppAccount
    .findFirst({
      where: { tenantId, channel: "INSTAGRAM", enabled: true },
      orderBy: { createdAt: "asc" },
    })
    .catch(() => null);
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

  /**
   * Envia para um contato pelo canal em que ele fala.
   *
   * Existe porque `sendText` só sabe WhatsApp: pede telefone e resolve
   * conexões com `channel: "WHATSAPP"`. Contato do Instagram não tem
   * telefone — o identificador dele é o IGSID, guardado em `Lead.externalId`
   * —, então respondê-lo pelo inbox parava antes de sair do servidor.
   *
   * Devolve `{ ok, erro }` em vez de um booleano porque o motivo da recusa é
   * o que o atendente precisa ler na tela.
   */
  async sendToLead(lead, content, opts = {}) {
    const canal = String(lead?.channel || "WHATSAPP").toUpperCase();
    const { mediaUrl = null, mediaType = null, caption = "" } = opts;

    if (canal === "INSTAGRAM") {
      // Leads criados antes de `externalId` existir guardavam o IGSID em `phone`.
      const destino = lead.externalId || lead.phone;
      if (!destino) return { ok: false, erro: "Contato do Instagram sem identificador." };

      const account = await resolveInstagramAccount(lead.tenantId, lead.waAccountId);
      if (!account) {
        return { ok: false, erro: "Nenhuma conta do Instagram conectada e ativa para responder." };
      }

      const { MetaManager } = await import("../../../meta.js");
      try {
        if (mediaUrl) {
          await MetaManager.sendInstagramMedia(account.pageId, account.accessToken, destino, mediaUrl, mediaType || "image");
          // A DM do Instagram não tem legenda: o texto vai como mensagem separada.
          if (caption) {
            await MetaManager.sendInstagramMessage(account.pageId, account.accessToken, destino, caption);
          }
        } else {
          await MetaManager.sendInstagramMessage(account.pageId, account.accessToken, destino, content);
        }
        return { ok: true };
      } catch (e) {
        const motivo = e.response?.data?.error?.message || e.message;
        console.error("[Messaging] Falha no envio pelo Instagram:", motivo);
        return { ok: false, erro: `Instagram recusou o envio: ${motivo}` };
      }
    }

    if (canal === "SITE") {
      return {
        ok: false,
        erro: "O chat do site ainda não recebe resposta do painel — responda por outro canal do contato.",
      };
    }

    if (!lead.phone) return { ok: false, erro: "Contato sem telefone." };
    const enviado = mediaUrl
      ? await this.sendMedia(lead.tenantId, lead.phone, mediaUrl, mediaType || "image", caption, { accountId: lead.waAccountId })
      : await this.sendText(lead.tenantId, lead.phone, content, { accountId: lead.waAccountId });
    return enviado ? { ok: true } : { ok: false, erro: "Falha ao enviar mensagem pelo WhatsApp." };
  }

  /** Descobre o transporte ativo do tenant (útil para logs/diagnóstico). */
  async transportOf(tenantId, accountId = null) {
    const account = await resolveAccount(tenantId, accountId);
    if (!account) return "none";
    return isCloud(account) ? "cloud" : "baileys";
  }
}

export default new MessagingService();
