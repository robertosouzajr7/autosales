import prisma from "../config/prisma.js";
import AttendanceService, { PHASE_LABEL } from "../services/AttendanceService.js";
import AvailabilityService from "../services/AvailabilityService.js";
import PushService, { AVISOS as PUSH_AVISOS } from "../services/PushService.js";

/**
 * Filas de atendimento e ações do operador sobre a conversa.
 */

/** Usuário que está agindo — vira o "quem" no histórico da conversa. */
async function ator(req) {
  if (!req.userId) return null;
  return prisma.user
    .findFirst({ where: { id: req.userId, tenantId: req.tenantId }, select: { id: true, name: true } })
    .catch(() => null);
}

// ── Filas ────────────────────────────────────────────────────────

export const listQueues = async (req, res) => {
  try {
    const filas = await prisma.serviceQueue.findMany({
      where: { tenantId: req.tenantId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { conversations: true } },
      },
    });

    // Quantos estão esperando AGORA em cada fila (o _count conta o histórico).
    const esperando = await prisma.conversation.groupBy({
      by: ["queueId"],
      where: { tenantId: req.tenantId, phase: "QUEUE" },
      _count: { _all: true },
    });
    const porFila = new Map(esperando.map((e) => [e.queueId, e._count._all]));

    res.json(
      filas.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        color: f.color,
        active: f.active,
        isDefault: f.isDefault,
        order: f.order,
        aguardando: porFila.get(f.id) || 0,
        membros: f.members.map((m) => m.user),
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createQueue = async (req, res) => {
  try {
    const { name, description, color, userIds = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Dê um nome à fila." });

    const total = await prisma.serviceQueue.count({ where: { tenantId: req.tenantId } });
    const fila = await prisma.serviceQueue.create({
      data: {
        tenantId: req.tenantId,
        name: name.trim(),
        description: description || null,
        color: color || "#2563EB",
        order: total,
        // A primeira fila do negócio vira a padrão: é onde a IA transfere.
        isDefault: total === 0,
      },
    });
    await sincronizarMembros(fila.id, req.tenantId, userIds);
    res.json(fila);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateQueue = async (req, res) => {
  try {
    const { name, description, color, active, isDefault, userIds } = req.body;
    const fila = await prisma.serviceQueue.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!fila) return res.status(404).json({ error: "Fila não encontrada." });

    // Só uma fila padrão por negócio.
    if (isDefault === true) {
      await prisma.serviceQueue.updateMany({ where: { tenantId: req.tenantId }, data: { isDefault: false } });
    }

    const atualizada = await prisma.serviceQueue.update({
      where: { id: fila.id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(active !== undefined ? { active: !!active } : {}),
        ...(isDefault !== undefined ? { isDefault: !!isDefault } : {}),
      },
    });
    if (Array.isArray(userIds)) await sincronizarMembros(fila.id, req.tenantId, userIds);
    res.json(atualizada);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteQueue = async (req, res) => {
  try {
    const fila = await prisma.serviceQueue.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!fila) return res.status(404).json({ error: "Fila não encontrada." });

    const aguardando = await prisma.conversation.count({ where: { queueId: fila.id, phase: "QUEUE" } });
    if (aguardando > 0) {
      return res.status(409).json({
        error: `Ainda há ${aguardando} conversa(s) esperando nesta fila. Atenda ou transfira antes de remover.`,
      });
    }
    await prisma.serviceQueue.delete({ where: { id: fila.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

async function sincronizarMembros(queueId, tenantId, userIds) {
  const validos = await prisma.user.findMany({
    where: { id: { in: userIds }, tenantId },
    select: { id: true },
  });
  await prisma.queueMember.deleteMany({ where: { queueId } });
  if (validos.length) {
    await prisma.queueMember.createMany({
      data: validos.map((u) => ({ queueId, userId: u.id })),
      skipDuplicates: true,
    });
  }
}

/** Atendentes do negócio, para atribuir e transferir. */
export const listAgents = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId },
      select: {
        id: true, name: true, email: true, role: true, active: true,
        disponibilidade: true, disponivelAte: true, recadoDeAusencia: true,
      },
      orderBy: { name: "asc" },
    });
    const emAtendimento = await prisma.conversation.groupBy({
      by: ["assignedToId"],
      where: { tenantId: req.tenantId, phase: "HUMAN" },
      _count: { _all: true },
    });
    const carga = new Map(emAtendimento.map((e) => [e.assignedToId, e._count._all]));
    // Quem transfere precisa ver quem está de fato disponível: mandar conversa
    // para quem está almoçando é a mesma coisa que deixá-la parada.
    res.json(
      users.map((u) => ({
        ...AvailabilityService.formatar(u),
        email: u.email,
        role: u.role,
        emAtendimento: carga.get(u.id) || 0,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Fila de espera ───────────────────────────────────────────────

export const getQueue = async (req, res) => {
  try {
    const fila = await AttendanceService.listQueue(req.tenantId, { queueId: req.query.queueId || null });
    const emAtendimento = await prisma.conversation.count({ where: { tenantId: req.tenantId, phase: "HUMAN" } });
    res.json({
      aguardando: fila.length,
      emAtendimento,
      esperaMaisAntiga: fila[0]?.esperaMinutos || 0,
      itens: fila,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Ações sobre a conversa ───────────────────────────────────────

export const enqueueConversation = async (req, res) => {
  try {
    const conv = await prisma.conversation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!conv) return res.status(404).json({ error: "Conversa não encontrada." });

    const r = await AttendanceService.enqueue(conv.id, {
      reason: req.body?.reason || null,
      queueId: req.body?.queueId || null,
      actor: await ator(req),
    });
    res.json({ success: true, phase: r?.phase, position: r?.position });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const assignConversation = async (req, res) => {
  try {
    // Sem userId no corpo, o próprio usuário assume ("Atender agora").
    const userId = req.body?.userId || req.userId;
    const r = await AttendanceService.assign(req.params.id, userId, {
      actor: await ator(req),
      tenantId: req.tenantId,
    });
    if (!r) return res.status(404).json({ error: "Conversa não encontrada." });
    res.json({ success: true, phase: r.phase, assignedTo: r.assignedTo });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const transferConversation = async (req, res) => {
  try {
    const { userId = null, queueId = null, reason = null } = req.body || {};
    if (!userId && !queueId) {
      return res.status(400).json({ error: "Escolha um atendente ou uma fila para transferir." });
    }
    const r = await AttendanceService.transfer(req.params.id, {
      toUserId: userId,
      toQueueId: queueId,
      reason,
      actor: await ator(req),
      tenantId: req.tenantId,
    });
    if (!r) return res.status(404).json({ error: "Conversa não encontrada." });
    res.json({ success: true, phase: r.phase, position: r.position ?? null });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const returnToBot = async (req, res) => {
  try {
    const r = await AttendanceService.returnToBot(req.params.id, {
      actor: await ator(req),
      avisarCliente: req.body?.avisarCliente !== false,
      tenantId: req.tenantId,
    });
    if (!r) return res.status(404).json({ error: "Conversa não encontrada." });
    res.json({ success: true, phase: r.phase });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const closeConversation = async (req, res) => {
  try {
    const r = await AttendanceService.close(req.params.id, {
      actor: await ator(req),
      // `mensagem: null` encerra em silêncio; ausente usa a despedida padrão.
      mensagem: req.body?.mensagem,
      tenantId: req.tenantId,
    });
    if (!r) return res.status(404).json({ error: "Conversa não encontrada." });
    res.json({ success: true, phase: r.phase });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const reopenConversation = async (req, res) => {
  try {
    const r = await AttendanceService.reopen(req.params.id, {
      actor: await ator(req),
      comoHumano: req.body?.comoHumano !== false,
      tenantId: req.tenantId,
    });
    if (!r) return res.status(404).json({ error: "Conversa não encontrada." });
    res.json({ success: true, phase: r.phase, assignedTo: r.assignedTo || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Situação atual da conversa: fase, dono, fila e posição. */
export const getConversationStatus = async (req, res) => {
  try {
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        queue: { select: { id: true, name: true, color: true } },
        events: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!conv) return res.status(404).json({ error: "Conversa não encontrada." });

    res.json({
      phase: conv.phase,
      phaseLabel: PHASE_LABEL[conv.phase] || conv.phase,
      assignedTo: conv.assignedTo,
      queue: conv.queue,
      queuedAt: conv.queuedAt,
      handoffReason: conv.handoffReason,
      position: conv.phase === "QUEUE" ? await AttendanceService.positionOf(conv) : null,
      events: conv.events,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Disponibilidade do atendente ──────────────────────────────────

/** O próprio estado, para a tela mostrar sem adivinhar. */
export const minhaDisponibilidade = async (req, res) => {
  try {
    const r = await AvailabilityService.doUsuario(req.userId);
    if (!r) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Entrar em pausa, sair do turno ou voltar.
 *
 * Só sobre si mesmo: quem coloca outra pessoa em pausa é a pessoa. Um gestor
 * que precise tirar alguém da fila desativa o acesso, que é uma ação com
 * outro peso e outro registro.
 */
export const definirDisponibilidade = async (req, res) => {
  try {
    const { estado, minutos = null, recado = null } = req.body || {};
    const r = await AvailabilityService.definir(req.userId, { estado, minutos, recado });
    res.json(r);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

/** A equipe com o estado de cada um, para quem distribui a fila. */
export const equipeDisponivel = async (req, res) => {
  try {
    res.json({ itens: await AvailabilityService.equipe(req.tenantId) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── Notificações no celular ───────────────────────────────────────

/** O app manda o token do aparelho depois de o sistema autorizar o aviso. */
export const registrarAparelho = async (req, res) => {
  try {
    const { token, platform = "android" } = req.body || {};
    await PushService.registrarAparelho(req.userId, req.tenantId, token, platform);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

/** Sair da conta: o aparelho para de receber o que era daquela pessoa. */
export const esquecerAparelho = async (req, res) => {
  try {
    await PushService.esquecerAparelho(req.body?.token);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const preferenciasDePush = async (req, res) => {
  try {
    const prefs = req.method === "PUT"
      ? await PushService.definirPreferencias(req.userId, req.body || {})
      : await PushService.preferencias(req.userId);
    res.json({ avisos: Object.values(PUSH_AVISOS), prefs });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
