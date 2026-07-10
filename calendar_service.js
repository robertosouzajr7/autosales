import { google } from "googleapis";
import prisma from "./src/api/config/prisma.js";

const SLOT_MINUTES = 60;
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 18;
const TIMEZONE = "America/Sao_Paulo";

// Erro tipado para o caller (IA/UI) distinguir conflito de falha genérica.
export class SlotConflictError extends Error {
  constructor(message = "Horário indisponível") {
    super(message);
    this.name = "SlotConflictError";
    this.code = "SLOT_CONFLICT";
  }
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

class CalendarService {
  async getOAuth2Client(tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.googleRefreshToken) return null;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({ refresh_token: tenant.googleRefreshToken });
    return oauth2Client;
  }

  /**
   * Intervalos ocupados no dia, unindo Google Calendar (se conectado) e os
   * Appointments locais não-cancelados. Trabalhar com a tabela local garante
   * que o piloto detecte conflito mesmo antes de plugar o Google.
   */
  async getBusyIntervals(tenantId, dayStart, dayEnd) {
    const busy = [];

    // 1. Appointments locais (fonte de verdade sempre disponível)
    const local = await prisma.appointment.findMany({
      where: {
        tenantId,
        date: { gte: dayStart, lt: dayEnd },
        status: { notIn: ["CANCELLED", "NO_SHOW"] }
      }
    });
    for (const appt of local) {
      const start = new Date(appt.date);
      busy.push({ start, end: new Date(start.getTime() + SLOT_MINUTES * 60000) });
    }

    // 2. Google Calendar, quando conectado
    const auth = await this.getOAuth2Client(tenantId);
    if (auth) {
      try {
        const calendar = google.calendar({ version: "v3", auth });
        const res = await calendar.events.list({
          calendarId: "primary",
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          singleEvents: true,
          orderBy: "startTime"
        });
        for (const e of res.data.items || []) {
          const s = e.start?.dateTime || e.start?.date;
          const en = e.end?.dateTime || e.end?.date;
          if (s && en) busy.push({ start: new Date(s), end: new Date(en) });
        }
      } catch (err) {
        console.error(`[Calendar] Erro ao ler Google Calendar do tenant ${tenantId}:`, err.message);
      }
    }

    return busy;
  }

  async listAvailableSlots(tenantId, day = new Date()) {
    const dayStart = new Date(day);
    dayStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(BUSINESS_END_HOUR, 0, 0, 0);

    const busy = await this.getBusyIntervals(tenantId, dayStart, dayEnd);

    const slots = [];
    const now = new Date();
    for (let h = BUSINESS_START_HOUR; h < BUSINESS_END_HOUR; h++) {
      const start = new Date(day);
      start.setHours(h, 0, 0, 0);
      const end = new Date(start.getTime() + SLOT_MINUTES * 60000);
      if (start <= now) continue; // não oferecer horário no passado
      const isBusy = busy.some(b => overlaps(start, end, b.start, b.end));
      if (!isBusy) slots.push(start);
    }
    return slots;
  }

  /**
   * Cria um agendamento com detecção de conflito. Lança SlotConflictError se
   * o horário colidir com Google ou com um Appointment local existente.
   */
  async createAppointment(tenantId, lead, date, title = "Reunião - Agentes Virtuais") {
    const start = new Date(date);
    if (isNaN(start.getTime())) throw new Error("Data inválida");
    const end = new Date(start.getTime() + SLOT_MINUTES * 60000);

    // Conflito: qualquer intervalo ocupado que sobreponha o slot pedido.
    const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start); dayEnd.setHours(23, 59, 59, 999);
    const busy = await this.getBusyIntervals(tenantId, dayStart, dayEnd);
    if (busy.some(b => overlaps(start, end, b.start, b.end))) {
      throw new SlotConflictError();
    }

    // Insere no Google Calendar se conectado (best-effort — não bloqueia o
    // agendamento local se a API falhar).
    let googleEventId = null;
    const auth = await this.getOAuth2Client(tenantId);
    if (auth) {
      try {
        const calendar = google.calendar({ version: "v3", auth });
        const event = {
          summary: `${title}: ${lead.name}`,
          description: `Agendado via Agentes Virtuais.\nLead: ${lead.phone}\nScore: ${lead.qualificationScore ?? "-"}`,
          start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
          end: { dateTime: end.toISOString(), timeZone: TIMEZONE },
          attendees: lead.email ? [{ email: lead.email }] : [],
          reminders: { useDefault: true }
        };
        const res = await calendar.events.insert({ calendarId: "primary", resource: event });
        googleEventId = res.data.id;
      } catch (err) {
        console.error(`[Calendar] Falha ao inserir no Google (tenant ${tenantId}):`, err.message);
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        leadId: lead.id,
        title: `${title}: ${lead.name}`,
        date: start,
        status: "SCHEDULED"
      }
    });

    return { appointmentId: appointment.id, googleEventId, date: start.toISOString() };
  }
}

export default new CalendarService();
