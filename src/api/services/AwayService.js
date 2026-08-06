import prisma from "../config/prisma.js";
import MessagingService from "./MessagingService.js";

/**
 * Períodos de ausência: feriado, recesso, viagem, inventário.
 *
 * A régua semanal de horário responde "hoje já fechamos". O que faltava era
 * o intervalo com data: de 24/12 às 18h até 02/01 às 8h, o negócio não
 * atende — e nesse caso o cliente escrevia e ficava sem resposta, ou recebia
 * da IA uma promessa de retorno que ninguém ia cumprir.
 *
 * O aviso sai UMA vez por contato por período. Repetir a cada mensagem é o
 * comportamento que faz o cliente bloquear o número.
 */

/** O período ativo agora, se houver. O mais recente ganha em caso de sobreposição. */
export async function periodoAtivo(tenantId, quando = new Date()) {
  return prisma.awayPeriod
    .findFirst({
      where: {
        tenantId,
        active: true,
        startsAt: { lte: quando },
        endsAt: { gte: quando },
      },
      orderBy: { startsAt: "desc" },
    })
    .catch(() => null);
}

/**
 * Avisa o contato, se for o caso.
 *
 * Devolve `{ avisou, pausarIa }`: quem chamou precisa saber se ainda deve
 * deixar a IA responder. `pausarIa` vale mesmo quando o aviso não saiu de
 * novo — durante o recesso a IA continua calada para quem já foi avisado.
 */
export async function avisarSeAusente(tenantId, lead, { quando = new Date() } = {}) {
  const periodo = await periodoAtivo(tenantId, quando);
  if (!periodo) return { avisou: false, pausarIa: false, periodo: null };

  // O contato pediu para não receber mensagens: nem o aviso automático passa.
  if (lead?.optedOut) return { avisou: false, pausarIa: periodo.pauseAi, periodo };

  // A trava de repetição é o índice único (periodId, leadId): duas mensagens
  // chegando ao mesmo tempo não conseguem gerar dois avisos.
  try {
    await prisma.awayNotice.create({ data: { periodId: periodo.id, leadId: lead.id } });
  } catch {
    return { avisou: false, pausarIa: periodo.pauseAi, periodo };
  }

  const envio = await MessagingService.sendToLead(lead, periodo.message).catch((e) => ({
    ok: false,
    erro: e.message,
  }));

  if (!envio?.ok) {
    // Não conseguiu avisar: desfaz a marca para tentar na próxima mensagem.
    await prisma.awayNotice
      .deleteMany({ where: { periodId: periodo.id, leadId: lead.id } })
      .catch(() => {});
    console.warn(`[Ausência] Falha ao avisar ${lead.id}: ${envio?.erro}`);
    return { avisou: false, pausarIa: periodo.pauseAi, periodo };
  }

  // O aviso entra no histórico da conversa: quem abrir o inbox depois precisa
  // ver o que o cliente recebeu.
  const conversa = await prisma.conversation.findUnique({ where: { leadId: lead.id } }).catch(() => null);
  if (conversa) {
    const msg = await prisma.message
      .create({
        data: {
          conversationId: conversa.id,
          tenantId,
          role: "ASSISTANT",
          content: periodo.message,
          messageType: "TEXT",
        },
      })
      .catch(() => null);
    if (msg) {
      const { touchConversation } = await import("./ConversationService.js");
      await touchConversation(msg).catch(() => {});
      const { messageEvents } = await import("../controllers/MessageController.js");
      messageEvents.emit("new_message", { tenantId, message: msg });
    }
  }

  console.log(`[Ausência] Aviso de "${periodo.name}" enviado para ${lead.name || lead.id}.`);
  return { avisou: true, pausarIa: periodo.pauseAi, periodo };
}

export default { periodoAtivo, avisarSeAusente };
