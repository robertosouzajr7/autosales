import prisma from "../config/prisma.js";

export const getAppointments = async (req, res) => {
  try {
    const appts = await prisma.appointment.findMany({
      where: { tenantId: req.user.tenantId },
      include: { lead: true },
      orderBy: { date: "asc" }
    });
    res.json(appts);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar agendamentos" });
  }
};

export const createAppointment = async (req, res) => {
  const { title, date, leadId, notes } = req.body;
  try {
    const appt = await prisma.appointment.create({
      data: {
        title,
        date: new Date(date),
        leadId,
        notes,
        tenantId: req.user.tenantId,
        status: "PENDING"
      }
    });
    res.json(appt);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar agendamento" });
  }
};

export const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const { title, date, status, notes } = req.body;
  try {
    const appt = await prisma.appointment.update({
      where: { id, tenantId: req.user.tenantId },
      data: {
        title,
        date: date ? new Date(date) : undefined,
        status,
        notes
      }
    });
    res.json(appt);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar agendamento" });
  }
};

export const deleteAppointment = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.appointment.delete({
      where: { id, tenantId: req.user.tenantId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir agendamento" });
  }
};
