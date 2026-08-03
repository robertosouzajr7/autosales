import prisma from "../config/prisma.js";
import { custoEstimado, devolver as devolverCredito } from "./CampaignCreditService.js";

/**
 * Recibos de entrega da Meta aplicados ao disparo.
 *
 * O CampaignRecipient já guardava o wamid "para cruzar com os webhooks de
 * status", mas ninguém cruzava: deliveredCount e readCount nasciam zerados e
 * o relatório só sabia dizer quantas mensagens saíram da nossa ponta. Sair da
 * nossa ponta não é chegar — número errado, número que bloqueou e aparelho
 * desligado por dias entram todos como "enviado".
 *
 * Importa para o bolso porque a Meta cobra por mensagem ENTREGUE. Quando um
 * envio termina em falha definitiva, a franquia que ele consumiu volta: o
 * cliente não pode pagar por mensagem que a Meta não cobrou de nós.
 */

// A ordem impede retrocesso: a Meta reenvia webhook e manda "sent" depois de
// "delivered" sem qualquer garantia de ordem.
const ORDEM = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 2 };

const MAPA = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

/**
 * Aplica um recibo. Ignora em silêncio o que não for de campanha — a maior
 * parte dos status que chegam é de conversa normal do atendimento.
 */
export async function registrarStatusEntrega(messageId, statusBruto) {
  const novo = MAPA[String(statusBruto || "").toLowerCase()];
  if (!messageId || !novo) return null;

  const destinatario = await prisma.campaignRecipient.findFirst({
    where: { messageId },
    select: { id: true, campaignId: true, status: true },
  });
  if (!destinatario) return null;

  const atual = destinatario.status || "PENDING";
  // FAILED é terminal: um "delivered" atrasado não pode desfazer a falha.
  if (atual === "FAILED") return null;
  if ((ORDEM[novo] ?? 0) <= (ORDEM[atual] ?? 0)) return null;

  const campanha = await prisma.campaign.findUnique({
    where: { id: destinatario.campaignId },
    select: { id: true, tenantId: true, template: { select: { category: true } } },
  });
  if (!campanha) return null;

  await prisma.campaignRecipient.update({
    where: { id: destinatario.id },
    data: { status: novo },
  });

  const contadores = {};
  if (novo === "DELIVERED") contadores.deliveredCount = { increment: 1 };
  if (novo === "READ") {
    contadores.readCount = { increment: 1 };
    // Lida sem ter passado por entregue ainda: entregue está implícito, e sem
    // isto o relatório mostraria mais leituras do que entregas.
    if (atual !== "DELIVERED") contadores.deliveredCount = { increment: 1 };
  }
  if (novo === "FAILED") contadores.errorCount = { increment: 1 };

  await prisma.campaign.update({ where: { id: campanha.id }, data: contadores });

  if (novo === "FAILED") {
    // Devolve o crédito: a Meta não cobra o que não entregou, e o valor tem
    // de ser o da categoria daquele template — devolver tarifa de marketing
    // por uma mensagem de utilidade daria crédito de graça.
    const { total } = await custoEstimado(1, campanha.template?.category || "MARKETING");
    await devolverCredito(campanha.tenantId, total);
  }

  return { campaignId: campanha.id, de: atual, para: novo };
}

export default { registrarStatusEntrega };
