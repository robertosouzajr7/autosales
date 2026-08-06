import prisma from "../config/prisma.js";

/**
 * Períodos de ausência: o CRUD que a tela de Lembretes usa.
 */

function validar({ name, message, startsAt, endsAt }) {
  if (!String(name || "").trim()) return "Dê um nome ao período (ex.: Recesso de fim de ano).";
  if (!String(message || "").trim()) return "Escreva a mensagem que o cliente vai receber.";
  const inicio = new Date(startsAt);
  const fim = new Date(endsAt);
  if (isNaN(inicio) || isNaN(fim)) return "Informe início e fim do período.";
  // Um período que termina antes de começar nunca fica ativo, e a tela não
  // teria como mostrar que está errado — some sem explicação.
  if (fim <= inicio) return "O fim precisa ser depois do início.";
  return null;
}

export const listAwayPeriods = async (req, res) => {
  try {
    const periodos = await prisma.awayPeriod.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { startsAt: "desc" },
      include: { _count: { select: { avisados: true } } },
    });
    const agora = new Date();
    res.json(
      periodos.map((p) => ({
        id: p.id,
        name: p.name,
        message: p.message,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        active: p.active,
        pauseAi: p.pauseAi,
        avisados: p._count.avisados,
        // O estado é derivado das datas, e não guardado: guardar exigiria
        // alguém para virar a chave na hora certa.
        estado:
          !p.active ? "DESLIGADO"
          : p.endsAt < agora ? "ENCERRADO"
          : p.startsAt > agora ? "AGENDADO"
          : "EM_CURSO",
      }))
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const createAwayPeriod = async (req, res) => {
  try {
    const erro = validar(req.body);
    if (erro) return res.status(400).json({ error: erro });
    const { name, message, startsAt, endsAt, pauseAi = true, active = true } = req.body;
    const periodo = await prisma.awayPeriod.create({
      data: {
        tenantId: req.tenantId,
        name: name.trim(),
        message: message.trim(),
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        pauseAi: !!pauseAi,
        active: !!active,
      },
    });
    res.json(periodo);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateAwayPeriod = async (req, res) => {
  try {
    const atual = await prisma.awayPeriod.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!atual) return res.status(404).json({ error: "Período não encontrado." });

    const mesclado = { ...atual, ...req.body };
    const erro = validar(mesclado);
    if (erro) return res.status(400).json({ error: erro });

    const { name, message, startsAt, endsAt, pauseAi, active } = req.body;
    const periodo = await prisma.awayPeriod.update({
      where: { id: atual.id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(message !== undefined ? { message: String(message).trim() } : {}),
        ...(startsAt !== undefined ? { startsAt: new Date(startsAt) } : {}),
        ...(endsAt !== undefined ? { endsAt: new Date(endsAt) } : {}),
        ...(pauseAi !== undefined ? { pauseAi: !!pauseAi } : {}),
        ...(active !== undefined ? { active: !!active } : {}),
      },
    });
    res.json(periodo);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteAwayPeriod = async (req, res) => {
  try {
    const periodo = await prisma.awayPeriod.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!periodo) return res.status(404).json({ error: "Período não encontrado." });
    await prisma.awayPeriod.delete({ where: { id: periodo.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
