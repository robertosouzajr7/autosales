import prisma from "../config/prisma.js";
import { normalizePhone } from "./ContactIdentity.js";

/**
 * Por onde dá para falar com este contato.
 *
 * Cadastrar um telefone não quer dizer que exista WhatsApp nele — e o
 * atendente só descobria isso ao tentar mandar mensagem e receber um erro.
 * Aqui a verificação acontece sozinha logo depois do cadastro, e o resultado
 * fica na ficha.
 *
 * O tri-estado é honesto de propósito. A conexão por QR Code consegue
 * perguntar ao WhatsApp se o número existe; a API oficial da Meta NÃO tem
 * esse endpoint. Quem só tem conexão oficial fica em DESCONHECIDO em vez de
 * receber um "sim" inventado — e, nesse caso, o caminho correto é o template
 * aprovado, que funciona mesmo sem saber de antemão.
 */

export const STATUS = { SIM: "SIM", NAO: "NAO", DESCONHECIDO: "DESCONHECIDO" };

/** Verificação vale por 30 dias: número muda de dono, mas não toda semana. */
const VALIDADE_DIAS = 30;

function aindaVale(lead) {
  if (!lead?.whatsappStatus || !lead?.whatsappCheckedAt) return false;
  const idade = Date.now() - new Date(lead.whatsappCheckedAt).getTime();
  return idade < VALIDADE_DIAS * 24 * 60 * 60 * 1000;
}

class ChannelDetection {
  /**
   * Descobre e grava se o telefone do contato tem WhatsApp.
   *
   * Best-effort e silencioso: é informação de conveniência, e falhar aqui não
   * pode impedir o cadastro de acontecer.
   */
  async detectar(leadId, { forcar = false } = {}) {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, tenantId: true, phone: true, whatsappStatus: true, whatsappCheckedAt: true },
      });
      if (!lead) return null;

      const telefone = normalizePhone(lead.phone);
      if (!telefone) return this.gravar(lead.id, STATUS.NAO);
      if (!forcar && aindaVale(lead)) return lead.whatsappStatus;

      const { WhatsAppManager } = await import("../../../whatsapp.js");
      const temSessaoQr = await this.temConexaoQr(lead.tenantId);
      if (!temSessaoQr) return this.gravar(lead.id, STATUS.DESCONHECIDO);

      const existe = await WhatsAppManager.checkWhatsAppNumber(lead.tenantId, telefone);
      return this.gravar(lead.id, existe ? STATUS.SIM : STATUS.NAO);
    } catch (e) {
      console.error("[Canal] Falha ao verificar o número:", e.message);
      return null;
    }
  }

  async temConexaoQr(tenantId) {
    const conta = await prisma.whatsAppAccount.findFirst({
      where: { tenantId, channel: "WHATSAPP", enabled: true, status: "CONNECTED", phoneId: null },
      select: { id: true },
    });
    return !!conta;
  }

  async gravar(leadId, status) {
    await prisma.lead
      .update({ where: { id: leadId }, data: { whatsappStatus: status, whatsappCheckedAt: new Date() } })
      .catch(() => {});
    return status;
  }

  /** Dispara sem segurar quem chamou: o cadastro não espera pela verificação. */
  emSegundoPlano(leadId) {
    if (!leadId) return;
    setImmediate(() => this.detectar(leadId).catch(() => {}));
  }
}

export default new ChannelDetection();
