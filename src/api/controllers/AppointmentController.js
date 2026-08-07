import prisma from "../config/prisma.js";
import AutomationEngine from "../../../automation_engine.js";
import CalendarService, { parseBusinessDate } from "../../../calendar_service.js";
import ReminderService from "../services/ReminderService.js";
import PipelineAutomation from "../services/PipelineAutomation.js";

/** Duração padrão do compromisso, igual à do agendamento feito pelo agente. */
const DURACAO_MIN = 60;

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
    // O formulário manda datetime-local ("2026-08-10T14:00"), sem fuso. Com
    // `new Date()` o container (UTC) lia isso como 14h UTC e gravava 11h em
    // São Paulo — o compromisso aparecia três horas antes do combinado.
    const inicio = parseBusinessDate(date);
    if (isNaN(inicio.getTime())) return res.status(400).json({ error: "Data inválida" });
    const fim = new Date(inicio.getTime() + DURACAO_MIN * 60000);

    const lead = leadId ? await prisma.lead.findFirst({ where: { id: leadId, tenantId: req.tenantId } }) : null;

    // O evento no Google vem antes da gravação para o id já nascer junto do
    // agendamento. Se o Google estiver fora, volta nulo e o resto segue.
    const { googleEventId, meetLink } = await CalendarService.criarEvento(req.tenantId, {
      titulo: lead ? `${title}: ${lead.name}` : title,
      descricao: [notes, lead?.phone ? `Contato: ${lead.phone}` : null]
        .filter(Boolean).join("\n") || "Agendado pelo painel.",
      inicio,
      fim,
      lead,
    });

    const appt = await prisma.appointment.create({
      data: {
        title,
        date: inicio,
        leadId,
        notes,
        tenantId: req.tenantId,
        googleEventId,
        meetLink,
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
    if (lead) {
      PipelineAutomation.onEvent(req.tenantId, leadId, "APPOINTMENT_CREATED").catch(() => {});
      AutomationEngine.dispatchTrigger("APPOINTMENT_CREATED", { lead, tenantId: req.tenantId, appointment: appt })
        .catch((e) => console.error("[Appointment] dispatchTrigger falhou:", e));
    }

    res.json(appt);
  } catch (error) {
    console.error("[Appointment] Erro ao criar agendamento:", error.message);
    res.status(500).json({ error: "Erro ao criar agendamento" });
  }
};

export const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const { title, date, status, notes } = req.body;
  try {
    const anterior = await prisma.appointment.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!anterior) return res.status(404).json({ error: "Agendamento não encontrado" });

    // Mesmo tratamento de fuso da criação: sem isto, remarcar pelo painel
    // deslocava o horário mesmo quando o agendamento tinha nascido certo.
    const novaData = date ? parseBusinessDate(date) : null;
    if (novaData && isNaN(novaData.getTime())) return res.status(400).json({ error: "Data inválida" });
    const mudouData = novaData && novaData.getTime() !== new Date(anterior.date).getTime();

    const appt = await prisma.appointment.update({
      where: { id, tenantId: req.tenantId },
      data: {
        title,
        date: novaData || undefined,
        status,
        notes,
        ...(status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
        // Cancelou: o evento sai do Google, então o id guardado não aponta
        // mais para nada e não pode ser reaproveitado numa reativação.
        ...(status === "CANCELLED" ? { googleEventId: null, meetLink: null } : {}),
      }
    });

    if (status === "CANCELLED") {
      await CalendarService.removerEvento(req.tenantId, anterior.googleEventId);
      await ReminderService.cancelForAppointment(appt.id, "Agendamento cancelado no painel.");
      await PipelineAutomation.onEvent(req.tenantId, appt.leadId, "APPOINTMENT_CANCELLED");
      // O barramento é ligado no boot (app.js). Sem ele, avisar a lista de
      // espera é o que se perde — não a resposta ao cliente que cancelou.
      AutomationEngine.ee?.emit("APPOINTMENT_CANCELLED", { tenantId: req.tenantId, appointment: appt });
    } else if (mudouData || (title && title !== anterior.title)) {
      // Remarcou ou renomeou: a agenda do cliente tem que acompanhar, senão o
      // horário velho segue bloqueado lá e o novo não existe.
      await CalendarService.moverEvento(req.tenantId, anterior.googleEventId, {
        ...(mudouData ? { inicio: novaData, fim: new Date(novaData.getTime() + DURACAO_MIN * 60000) } : {}),
        ...(title ? { titulo: title } : {}),
      });
      // Os horários da régua inteira mudam junto. Best-effort: o agendamento
      // já mudou e o Google já sabe — falhar aqui devolveria erro para uma
      // operação que deu certo, e o cliente remarcaria de novo achando que não.
      if (mudouData) {
        await ReminderService.rescheduleForAppointment(appt.id).catch((e) =>
          console.error("[Appointment] Falha ao remarcar os lembretes:", e.message)
        );
      }
    }

    if (status === "COMPLETED" && anterior.status !== "COMPLETED") {
      await PipelineAutomation.onEvent(req.tenantId, appt.leadId, "APPOINTMENT_COMPLETED");
    }

    res.json(appt);
  } catch (error) {
    console.error("[Appointment] Erro ao atualizar agendamento:", error.message);
    res.status(500).json({ error: "Erro ao atualizar agendamento" });
  }
};

export const deleteAppointment = async (req, res) => {
  const { id } = req.params;
  try {
    const appt = await prisma.appointment.delete({
      where: { id, tenantId: req.tenantId }
    });

    // Sumiu do sistema, tem que sumir da agenda: senão o horário fica ocupado
    // no Google para sempre, sem nada no painel que explique por quê.
    await CalendarService.removerEvento(req.tenantId, appt.googleEventId);

    AutomationEngine.ee?.emit("APPOINTMENT_CANCELLED", { tenantId: req.tenantId, appointment: appt });

    res.json({ success: true });
  } catch (error) {
    console.error("[Appointment] Erro ao excluir agendamento:", error.message);
    res.status(500).json({ error: "Erro ao excluir agendamento" });
  }
};

/**
 * Horários livres de um dia.
 *
 * O agente já consultava isso por dentro (get_availability); o atendente não
 * tinha por onde — ele abria a agenda em outra tela, conferia e voltava para
 * a conversa de memória. Aqui a lista vem para dentro do chat.
 */
export const getAvailableSlots = async (req, res) => {
  try {
    const dia = req.query.date ? new Date(`${req.query.date}T12:00:00`) : new Date();
    if (isNaN(dia.getTime())) return res.status(400).json({ error: "Data inválida." });

    const slots = await CalendarService.listAvailableSlots(req.tenantId, dia);
    const agora = Date.now();
    res.json({
      data: dia.toISOString().slice(0, 10),
      // Horário que já passou não é horário livre: oferecê-lo é combinar algo
      // impossível e descobrir só na hora de gravar.
      itens: slots
        .filter((s) => new Date(s).getTime() > agora)
        .map((s) => ({
          iso: new Date(s).toISOString(),
          hora: new Date(s).toLocaleTimeString("pt-BR", {
            timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
          }),
        })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
