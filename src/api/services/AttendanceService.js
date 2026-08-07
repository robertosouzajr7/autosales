import prisma from "../config/prisma.js";
import MessagingService from "./MessagingService.js";

/**
 * Fases do atendimento e fila humana.
 *
 * Antes só existia `botActive`: ou o agente de IA respondia, ou ninguém
 * respondia. Não havia fila, dono do atendimento nem rastro de quem assumiu —
 * o cliente ficava esperando sem saber, e a equipe não tinha uma lista do que
 * precisava de gente.
 *
 * Fases:
 *   BOT    — agente de IA conduzindo (estado inicial)
 *   QUEUE  — a IA (ou o operador) transferiu; aguardando um humano
 *   HUMAN  — um atendente assumiu a conversa
 *   CLOSED — atendimento encerrado
 */

export const PHASES = ["BOT", "QUEUE", "HUMAN", "CLOSED"];

export const PHASE_LABEL = {
  BOT: "Atendimento automático",
  QUEUE: "Na fila",
  HUMAN: "Atendimento humano",
  CLOSED: "Encerrada",
};

/** Mensagem visível na conversa, para o histórico contar a mesma história. */
async function registrar(conversation, { type, toPhase, actor, alvo = null, note, aviso }) {
  await prisma.conversationEvent.create({
    data: {
      conversationId: conversation.id,
      tenantId: conversation.tenantId,
      type,
      fromPhase: conversation.phase || "BOT",
      toPhase,
      actorUserId: actor?.id || null,
      actorName: actor?.name || null,
      // Quem passou a atender. Diferente do ator quando um supervisor
      // transfere a conversa para outra pessoa.
      targetUserId: alvo?.id || null,
      targetName: alvo?.name || null,
      note: note || null,
    },
  });

  if (aviso) {
    const msg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId: conversation.tenantId,
        // SYSTEM aparece como aviso central no inbox, sem virar fala de ninguém.
        role: "SYSTEM",
        content: aviso,
      },
    });
    // Aviso do sistema não conta como mensagem nova para o contador de
    // não-lidas nem muda a janela de 24h — só entra na linha do tempo.
    await prisma.conversation
      .update({ where: { id: conversation.id }, data: { lastMessageAt: msg.createdAt } })
      .catch(() => {});
  }
}

/**
 * Avisa os fluxos que escutam eventos de atendimento. Import tardio para não
 * criar ciclo: o motor também importa este serviço.
 */
function disparar(trigger, lead, tenantId, extra = {}) {
  if (!lead || !tenantId) return;
  import("../../../automation_engine.js")
    .then(({ default: engine }) =>
      engine.dispatchTrigger(trigger, { lead, tenantId, channel: lead.channel, ...extra })
    )
    .catch((e) => console.error(`[Atendimento] Falha ao disparar ${trigger}:`, e.message));
}

/** Quantas conversas estão na frente desta na fila. */
async function posicaoNaFila(conversation) {
  if (!conversation.queuedAt) return null;
  const antes = await prisma.conversation.count({
    where: {
      tenantId: conversation.tenantId,
      phase: "QUEUE",
      ...(conversation.queueId ? { queueId: conversation.queueId } : {}),
      queuedAt: { lt: conversation.queuedAt },
    },
  });
  return antes + 1;
}

class AttendanceService {
  /** Fila padrão do tenant, criada na primeira necessidade. */
  async filaPadrao(tenantId) {
    const existente = await prisma.serviceQueue.findFirst({
      where: { tenantId, active: true },
      orderBy: [{ isDefault: "desc" }, { order: "asc" }],
    });
    if (existente) return existente;
    return prisma.serviceQueue.create({
      data: { tenantId, name: "Atendimento", isDefault: true, description: "Fila padrão de atendimento humano." },
    });
  }

  async carregar(conversationId, tenantId) {
    return prisma.conversation.findFirst({
      where: { id: conversationId, ...(tenantId ? { tenantId } : {}) },
      include: { lead: true, assignedTo: { select: { id: true, name: true } }, queue: true },
    });
  }

  /**
   * Coloca a conversa na fila humana. Chamado pela ferramenta de escalação da
   * IA, pelas palavras-chave de urgência e pelo botão do painel.
   */
  async enqueue(conversationId, { reason = null, queueId = null, actor = null, avisarCliente = true } = {}) {
    const conversation = await this.carregar(conversationId);
    if (!conversation) return null;
    if (conversation.phase === "QUEUE") return conversation;

    const fila = queueId
      ? await prisma.serviceQueue.findFirst({ where: { id: queueId, tenantId: conversation.tenantId } })
      : await this.filaPadrao(conversation.tenantId);

    const atualizada = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        phase: "QUEUE",
        queueId: fila?.id || null,
        queuedAt: new Date(),
        handoffReason: reason,
        // O bot para de responder no instante em que entra na fila.
        botActive: false,
        assignedToId: null,
        assignedAt: null,
        closedAt: null,
      },
      include: { lead: true, queue: true },
    });

    const posicao = await posicaoNaFila(atualizada);
    await registrar(conversation, {
      type: "QUEUED",
      toPhase: "QUEUE",
      actor,
      note: reason,
      aviso: `Entrou na fila${fila ? ` "${fila.name}"` : ""} — posição ${posicao}.${reason ? ` Motivo: ${reason}` : ""}`,
    });

    // O cliente precisa saber que saiu do automático e está esperando gente.
    if (avisarCliente && atualizada.lead?.phone) {
      const espera = posicao > 1 ? ` Você é o ${posicao}º da fila.` : " Você é o próximo a ser atendido.";
      await MessagingService.sendText(
        atualizada.tenantId,
        atualizada.lead.phone,
        `Estou transferindo você para um de nossos atendentes.${espera} Já já alguém continua por aqui. 🙂`,
        { accountId: atualizada.lead.waAccountId }
      ).catch(() => {});
    }

    // O celular de quem pode atender toca agora. Sem isto, o atendente só
    // descobre que tem gente esperando quando abre o app — e o cliente fica
    // no vácuo exatamente pelo tempo que ninguém abriu.
    this.avisarFilaNoCelular(atualizada, posicao, reason).catch((e) =>
      console.error("[Atendimento] Falha ao notificar a fila no celular:", e.message)
    );

    console.log(`[Atendimento] Conversa ${conversation.id} entrou na fila (posição ${posicao}).`);
    disparar("HANDOFF_QUEUED", atualizada.lead, atualizada.tenantId, {
      queueName: fila?.name || null,
      position: posicao,
      reason,
    });
    return { ...atualizada, position: posicao };
  }

  /** Um atendente assume a conversa. */
  async assign(conversationId, userId, { actor = null, avisarCliente = true, tenantId = null } = {}) {
    const conversation = await this.carregar(conversationId, tenantId);
    if (!conversation) return null;

    const atendente = await prisma.user.findFirst({
      where: { id: userId, tenantId: conversation.tenantId },
      select: { id: true, name: true },
    });
    if (!atendente) throw new Error("Atendente não encontrado neste negócio.");

    const atualizada = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        phase: "HUMAN",
        assignedToId: atendente.id,
        assignedAt: new Date(),
        botActive: false,
        closedAt: null,
        closedById: null,
      },
      include: { lead: true, assignedTo: { select: { id: true, name: true } }, queue: true },
    });

    await registrar(conversation, {
      type: conversation.phase === "HUMAN" ? "TRANSFERRED" : "ASSIGNED",
      toPhase: "HUMAN",
      actor: actor || atendente,
      alvo: atendente,
      note: `Atendimento com ${atendente.name}`,
      aviso: `${atendente.name} assumiu o atendimento.`,
    });

    if (avisarCliente && atualizada.lead?.phone) {
      await MessagingService.sendText(
        atualizada.tenantId,
        atualizada.lead.phone,
        `Olá! Aqui é ${atendente.name.split(" ")[0]}, vou continuar seu atendimento a partir de agora. 😊`,
        { accountId: atualizada.lead.waAccountId }
      ).catch(() => {});
    }
    disparar("ATTENDANCE_ASSIGNED", atualizada.lead, atualizada.tenantId, { agentName: atendente.name });
    return atualizada;
  }

  /** Passa para outro atendente ou devolve para uma fila. */
  async transfer(conversationId, { toUserId = null, toQueueId = null, actor = null, reason = null, tenantId = null } = {}) {
    if (toUserId) {
      // Transferir para quem está em pausa é o mesmo que deixar a conversa
      // parada — e do lado do cliente isso é indistinguível de ninguém ter
      // visto. Melhor recusar com o motivo do que entregar no vazio.
      const { estaDisponivel, estadoDe } = await import("./AvailabilityService.js");
      const destino = await prisma.user.findUnique({ where: { id: toUserId } });
      if (destino && !estaDisponivel(destino)) {
        const estado = estadoDe(destino);
        throw new Error(
          `${destino.name} está ${estado === "PAUSA" ? "em pausa" : "fora do turno"}` +
          `${destino.recadoDeAusencia ? ` (${destino.recadoDeAusencia})` : ""}. ` +
          "Escolha outro atendente ou devolva para a fila."
        );
      }
      const r = await this.assign(conversationId, toUserId, { actor, tenantId });
      if (r) {
        const { default: PushService } = await import("./PushService.js");
        PushService.avisar(toUserId, "TRANSFERIDA", {
          titulo: `${r.lead?.name || "Uma conversa"} é sua agora`,
          corpo: `${actor?.name || "A equipe"} transferiu esta conversa para você.`,
          dados: { tipo: "transferida", leadId: r.leadId, conversationId: r.id },
        }).catch(() => {});
      }
      return r;
    }
    const conversation = await this.carregar(conversationId, tenantId);
    if (!conversation) return null;
    return this.enqueue(conversation.id, {
      queueId: toQueueId,
      reason: reason || `Transferida por ${actor?.name || "um atendente"}`,
      actor,
      avisarCliente: false,
    });
  }

  /** Devolve o atendimento ao agente de IA. */
  async returnToBot(conversationId, { actor = null, avisarCliente = false, tenantId = null } = {}) {
    const conversation = await this.carregar(conversationId, tenantId);
    if (!conversation) return null;

    const atualizada = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        phase: "BOT",
        botActive: true,
        assignedToId: null,
        assignedAt: null,
        queueId: null,
        queuedAt: null,
        handoffReason: null,
        closedAt: null,
        closedById: null,
      },
      include: { lead: true },
    });

    await registrar(conversation, {
      type: "RETURNED_TO_BOT",
      toPhase: "BOT",
      actor,
      aviso: `Atendimento devolvido ao agente de IA${actor ? ` por ${actor.name}` : ""}.`,
    });

    if (avisarCliente && atualizada.lead?.phone) {
      await MessagingService.sendText(
        atualizada.tenantId,
        atualizada.lead.phone,
        "Vou seguir com você por aqui. Como posso ajudar?",
        { accountId: atualizada.lead.waAccountId }
      ).catch(() => {});
    }
    return atualizada;
  }

  /**
   * Encerra o atendimento. A conversa sai da fila e do painel ativo; se o
   * cliente escrever de novo, ela reabre automaticamente no modo IA.
   */
  // `mensagem` ausente usa a despedida padrão; `mensagem: null` encerra em
  // silêncio (útil para arrumar o painel sem falar com o cliente).
  async close(conversationId, { actor = null, mensagem, tenantId = null } = {}) {
    const conversation = await this.carregar(conversationId, tenantId);
    if (!conversation) return null;

    const atualizada = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        phase: "CLOSED",
        closedAt: new Date(),
        closedById: actor?.id || null,
        assignedToId: null,
        assignedAt: null,
        queueId: null,
        queuedAt: null,
        // Fica pronta para o bot atender de novo no próximo contato.
        botActive: true,
      },
      include: { lead: true },
    });

    await registrar(conversation, {
      type: "CLOSED",
      toPhase: "CLOSED",
      actor,
      aviso: `Atendimento encerrado${actor ? ` por ${actor.name}` : ""}.`,
    });

    disparar("ATTENDANCE_CLOSED", atualizada.lead, atualizada.tenantId, {});

    const despedida =
      mensagem === undefined ? "Atendimento encerrado. Se precisar de algo, é só chamar por aqui! 👋" : mensagem;
    if (despedida && atualizada.lead?.phone) {
      await MessagingService.sendText(atualizada.tenantId, atualizada.lead.phone, despedida, {
        accountId: atualizada.lead.waAccountId,
      }).catch(() => {});
    }
    return atualizada;
  }

  /**
   * Reabre uma conversa encerrada. Quem inicia decide se assume (HUMAN) ou
   * devolve para a IA (BOT) — abrir a janela do WhatsApp continua sendo
   * trabalho do template, tratado no envio.
   */
  async reopen(conversationId, { actor = null, comoHumano = true, tenantId = null } = {}) {
    const conversation = await this.carregar(conversationId, tenantId);
    if (!conversation) return null;

    const atualizada = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        phase: comoHumano ? "HUMAN" : "BOT",
        botActive: !comoHumano,
        assignedToId: comoHumano ? actor?.id || null : null,
        assignedAt: comoHumano ? new Date() : null,
        closedAt: null,
        closedById: null,
      },
      include: { lead: true, assignedTo: { select: { id: true, name: true } } },
    });

    await registrar(conversation, {
      type: "REOPENED",
      toPhase: atualizada.phase,
      actor,
      aviso: comoHumano
        ? `Atendimento reaberto${actor ? ` por ${actor.name}` : ""}.`
        : "Atendimento reaberto com o agente de IA.",
    });
    return atualizada;
  }

  /**
   * Cliente respondeu numa conversa encerrada: volta ao automático sozinha.
   * Sem isso a conversa ficaria presa em CLOSED e o bot nunca responderia.
   */
  async onInbound(conversationId) {
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.phase !== "CLOSED") return conversation;

    const atualizada = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { phase: "BOT", botActive: true, closedAt: null, closedById: null },
    });
    await registrar(conversation, {
      type: "REOPENED",
      toPhase: "BOT",
      aviso: "Cliente voltou a escrever — atendimento reaberto no automático.",
    });
    return atualizada;
  }

  /** Fila do painel: quem está esperando, há quanto tempo e em que posição. */
  /**
   * Toca o celular de quem pode assumir.
   *
   * Só quem está disponível: avisar quem está em pausa é acordar alguém que
   * não vai poder atender, e a segunda notificação ignorada ensina a ignorar
   * todas.
   */
  async avisarFilaNoCelular(conversa, posicao, motivo) {
    const [{ default: PushService }, { default: AvailabilityService }] = await Promise.all([
      import("./PushService.js"),
      import("./AvailabilityService.js"),
    ]);
    // Primeiro quem atende aquela fila. Se a fila não tem ninguém vinculado —
    // e a fila padrão nasce assim, criada sozinha na primeira transferência —
    // vale para todo mundo que está disponível. Fila sem membro significa
    // "ainda não foi dividido", não "ninguém atende": sem esta volta, a
    // notificação simplesmente nunca sairia.
    const daFila = conversa.queueId
      ? await AvailabilityService.disponiveis(conversa.tenantId, { queueId: conversa.queueId })
      : [];
    const disponiveis = daFila.length
      ? daFila
      : await AvailabilityService.disponiveis(conversa.tenantId);
    if (!disponiveis.length) return;

    const nome = conversa.lead?.name || "Um cliente";
    await PushService.avisarVarios(disponiveis.map((u) => u.id), "FILA", {
      titulo: `${nome} está esperando`,
      corpo: motivo || (posicao > 1 ? `${posicao}º da fila.` : "Pediu para falar com uma pessoa."),
      dados: { tipo: "fila", leadId: conversa.leadId, conversationId: conversa.id },
    });
  }

  async listQueue(tenantId, { queueId = null } = {}) {
    const conversas = await prisma.conversation.findMany({
      where: { tenantId, phase: "QUEUE", ...(queueId ? { queueId } : {}) },
      orderBy: { queuedAt: "asc" },
      include: {
        lead: { select: { id: true, name: true, phone: true, channel: true, igUsername: true } },
        queue: { select: { id: true, name: true, color: true } },
      },
      take: 200,
    });

    return conversas.map((c, i) => ({
      conversationId: c.id,
      leadId: c.leadId,
      position: i + 1,
      name: c.lead?.name || "Sem nome",
      phone: c.lead?.phone || "",
      channel: c.lead?.channel || "WHATSAPP",
      queue: c.queue,
      reason: c.handoffReason,
      queuedAt: c.queuedAt,
      esperaMinutos: c.queuedAt ? Math.round((Date.now() - new Date(c.queuedAt).getTime()) / 60000) : 0,
      lastMessagePreview: c.lastMessagePreview || "",
    }));
  }

  /** Posição de uma conversa específica (usada no cabeçalho do chat). */
  async positionOf(conversation) {
    return posicaoNaFila(conversation);
  }
}

export default new AttendanceService();
