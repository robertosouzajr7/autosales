import { google } from "googleapis";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  async listAvailableSlots(tenantId, day = new Date()) {
    const auth = await this.getOAuth2Client(tenantId);
    if (!auth) return [];

    const calendar = google.calendar({ version: "v3", auth });
    
    // Buscar eventos para o dia (ou próximos 3 dias para dar opções ao robô)
    const timeMin = new Date(day.setHours(9, 0, 0, 0)).toISOString();
    const timeMax = new Date(day.setHours(18, 0, 0, 0)).toISOString();

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    // Lógica simplificada de slots: 9h às 18h, slot de 1h
    const busy = res.data.items?.map(e => ({ start: e.start.dateTime, end: e.end.dateTime })) || [];
    const slots = [];
    for (let h = 9; h < 18; h++) {
       const start = new Date(day.setHours(h, 0, 0, 0));
       const end = new Date(day.setHours(h + 1, 0, 0, 0));
       const isBusy = busy.some(b => 
         (start >= new Date(b.start) && start < new Date(b.end)) ||
         (end > new Date(b.start) && end <= new Date(b.end))
       );
       if (!isBusy) slots.push(start);
    }

    return slots;
  }

  async createAppointment(tenantId, lead, date, title = "Reunião de Vendas - AutoSales") {
    const auth = await this.getOAuth2Client(tenantId);
    if (!auth) throw new Error("Google Calendar não conectado");

    const calendar = google.calendar({ version: "v3", auth });
    const event = {
      summary: `${title}: ${lead.name}`,
      description: `Agendado automaticamente via AutoSales (Eesier Mode).\nLead Phone: ${lead.phone}\nScore: ${lead.qualificationScore}`,
      start: { dateTime: new Date(date).toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: new Date(new Date(date).getTime() + 3600000).toISOString(), timeZone: "America/Sao_Paulo" },
      attendees: lead.email ? [{ email: lead.email }] : [],
      reminders: { useDefault: true },
    };

    const res = await calendar.events.insert({ calendarId: "primary", resource: event });
    
    // Salvar na nossa DB também
    await prisma.appointment.create({
      data: {
        tenantId,
        leadId: lead.id,
        title: event.summary,
        date: new Date(date),
        status: "SCHEDULED"
      }
    });

    return res.data;
  }
}

export default new CalendarService();
