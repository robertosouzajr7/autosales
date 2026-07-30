import prisma from "../config/prisma.js";
import AutomationEngine from "../../../automation_engine.js";
import ReminderService from "../services/ReminderService.js";
import PipelineAutomation from "../services/PipelineAutomation.js";

export const getAppointments = async (req, res) => {
  try {
    const appts = await prisma.appointment.findMany({
      where: { tenantId: req.tenantId },
      include: {
        lead: true,
        // A régua de cada agendamento aparece no card: sem isso não há como
        // saber se o lembrete saiu, está na fila ou falhou.
        reminders: { orderBy: { runAt: "asc" } },
      },
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
        // Agendamento criado no painel já nasce agendado: com "PENDING" a
        // régua de lembretes o considerava fora do ciclo e nada era enviado.
        status: "SCHEDULED"
      }
    });

    // Régua de lembretes (confirmação, link da call, lembrete final).
    ReminderService.scheduleForAppointment(appt.id).catch((e) =>
      console.error("[Appointment] Falha ao programar lembretes:", e.message)
    );

    // Dispara automações com gatilho "Novo Agendamento" (ex.: confirmação,
    // lembrete). Só quando há lead associado — a automação roda sobre o lead.
    if (leadId) {
      PipelineAutomation.onEvent(req.tenantId, leadId, "APPOINTMENT_CREATED").catch(() => {});
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (lead) {
        AutomationEngine.dispatchTrigger("APPOINTMENT_CREATED", { lead, tenantId: req.tenantId, appointment: appt })
          .catch((e) => console.error("[Appointment] dispatchTrigger falhou:", e));
      }
    }

    res.json(appt);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar agendamento" });
  }
};

export const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const { title, date, status, notes } = req.body;
  try {
    const anterior = await prisma.appointment.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!anterior) return res.status(404).json({ error: "Agendamento não encontrado" });

    const appt = await prisma.appointment.update({
      where: { id, tenantId: req.tenantId },
      data: {
        title,
        date: date ? new Date(date) : undefined,
        status,
        notes,
        ...(status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
      }
    });

    const mudouData = date && new Date(date).getTime() !== new Date(anterior.date).getTime();
    if (status === "CANCELLED") {
      await ReminderService.cancelForAppointment(appt.id, "Agendamento cancelado no painel.");
      await PipelineAutomation.onEvent(req.tenantId, appt.leadId, "APPOINTMENT_CANCELLED");
      AutomationEngine.ee.emit("APPOINTMENT_CANCELLED", { tenantId: req.tenantId, appointment: appt });
    } else if (mudouData) {
      // Remarcou: os horários da régua inteira mudam junto.
      await ReminderService.rescheduleForAppointment(appt.id);
    }

    if (status === "COMPLETED" && anterior.status !== "COMPLETED") {
      await PipelineAutomation.onEvent(req.tenantId, appt.leadId, "APPOINTMENT_COMPLETED");
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
