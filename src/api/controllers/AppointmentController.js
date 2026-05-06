import prisma from "../config/prisma.js";
import AutomationEngine from "../../../automation_engine.js";

export const getAppointments = async (req, res) => {
  try {
    const appts = await prisma.appointment.findMany({
      where: { tenantId: req.tenantId },
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
        tenantId: req.tenantId,
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
      where: { id, tenantId: req.tenantId },
      data: {
        title,
        date: date ? new Date(date) : undefined,
        status,
        notes
      }
    });

    if (status === "CANCELLED") {
      AutomationEngine.ee.emit("APPOINTMENT_CANCELLED", { tenantId: req.tenantId, appointment: appt });
    }

    res.json(appt);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar agendamento" });
  }
};

export const deleteAppointment = async (req, res) => {
  const { id } = req.params;
  try {
    const appt = await prisma.appointment.delete({
      where: { id, tenantId: req.tenantId }
    });
    
    AutomationEngine.ee.emit("APPOINTMENT_CANCELLED", { tenantId: req.tenantId, appointment: appt });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir agendamento" });
  }
};
