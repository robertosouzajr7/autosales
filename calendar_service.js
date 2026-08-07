import { google } from "googleapis";
import prisma from "./src/api/config/prisma.js";

const SLOT_MINUTES = 60;
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 18;
const TIMEZONE = "America/Sao_Paulo";

/**
 * Interpreta a data recebida da IA. Quando a string NÃO traz fuso ("2026-08-10
 * T14:00"), o Node assume o fuso do servidor — que em container é UTC. O
 * resultado era um agendamento 3h deslocado do que o cliente escolheu.
 * Aqui uma data sem fuso é tratada como horário do negócio.
 */
export function parseBusinessDate(valor) {
  if (valor instanceof Date) return valor;
  const bruto = String(valor || "").trim();
  if (!bruto) return new Date(NaN);

  const temFuso = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(bruto);
  if (temFuso) return new Date(bruto);

  // Sem fuso: adiciona o deslocamento vigente do fuso do negócio.
  const normalizado = bruto.replace(" ", "T");
  const offset = offsetDoNegocio(new Date(normalizado + "Z"));
  return new Date(`${normalizado}${offset}`);
}

/** Deslocamento do fuso do negócio na data dada (ex.: "-03:00"). */
function offsetDoNegocio(referencia) {
  const base = isNaN(referencia?.getTime?.()) ? new Date() : referencia;
  // Compara o mesmo instante formatado no fuso alvo com o UTC.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = {};
  for (const { type, value } of fmt.formatToParts(base)) p[type] = value;
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  const minutos = Math.round((comoUtc - base.getTime()) / 60000);
  const sinal = minutos >= 0 ? "+" : "-";
  const abs = Math.abs(minutos);
  return `${sinal}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

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

/** O link do Meet de um evento do Google, venha ele por onde vier. */
function extrairLink(evento) {
  return (
    evento?.hangoutLink ||
    evento?.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    null
  );
}

/**
 * Registra (ou limpa) o motivo da última falha com o Google.
 *
 * Sem isto o modo de falha é o pior possível: o painel diz "conectado", o
 * agendamento aparece, nenhum erro sobe para a tela, e o link simplesmente
 * não existe. O motivo real morria num console.error do servidor.
 */
async function anotarErroGoogle(tenantId, mensagem) {
  if (!tenantId) return;
  await prisma.tenant
    .update({
      where: { id: tenantId },
      data: { googleLastError: mensagem ? String(mensagem).slice(0, 500) : null, googleCheckedAt: new Date() },
    })
    .catch(() => {});
}

/** Traduz o erro do Google para algo acionável por quem usa o sistema. */
export function explicarErroGoogle(err) {
  const bruto = String(err?.response?.data?.error_description || err?.message || err || "");
  if (/invalid_grant/i.test(bruto)) {
    return (
      "A autorização do Google expirou ou foi revogada. Reconecte em Conexões → Google Agenda. " +
      "Se o projeto no Google Cloud estiver como 'Testing', o acesso cai a cada 7 dias — publique o app para parar de repetir."
    );
  }
  if (/insufficient|insufficientPermissions|forbidden|403/i.test(bruto)) {
    return "A conta conectada não tem permissão para gravar nesta agenda. Reconecte aceitando todas as permissões pedidas.";
  }
  if (/invalid_client|unauthorized_client/i.test(bruto)) {
    return "As credenciais do servidor (GOOGLE_CLIENT_ID/SECRET) não batem com o projeto do Google Cloud.";
  }
  if (/Calendar API has not been used|accessNotConfigured/i.test(bruto)) {
    return "A Google Calendar API não está habilitada no projeto do Google Cloud.";
  }
  return bruto || "Falha desconhecida ao falar com o Google.";
}

class CalendarService {
  async getOAuth2Client(tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.googleRefreshToken) return null;

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      // Token salvo mas servidor sem credenciais: a conta parece conectada e
      // nada funciona. Sem esta anotação a causa é invisível.
      await anotarErroGoogle(tenantId, "Servidor sem GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET configurados.");
      return null;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({ refresh_token: tenant.googleRefreshToken });
    return oauth2Client;
  }

  /**
   * Testa a corrente inteira e diz onde ela quebra.
   *
   * O teste decisivo é criar um evento de verdade, ver se o Google devolve
   * sala de Meet e apagá-lo em seguida: é a única resposta que não depende de
   * suposição sobre o tipo de conta, escopo ou configuração da agenda.
   */
  async diagnosticar(tenantId, { criarEventoTeste = true } = {}) {
    const r = {
      configurado: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI),
      tokenSalvo: false,
      tokenValido: false,
      escreveNaAgenda: false,
      geraMeet: false,
      erro: null,
      detalhe: null,
    };

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { googleRefreshToken: true },
    });
    r.tokenSalvo = !!tenant?.googleRefreshToken;

    if (!r.configurado) {
      r.erro = "O servidor não tem GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI configurados.";
      return r;
    }
    if (!r.tokenSalvo) {
      r.erro = "Nenhuma conta Google conectada. Conecte em Conexões → Google Agenda.";
      return r;
    }

    const auth = await this.getOAuth2Client(tenantId);
    if (!auth) {
      r.erro = "Não foi possível montar o cliente do Google.";
      return r;
    }

    // 1. O refresh token ainda vale? É aqui que aparece o invalid_grant de
    //    token revogado ou de projeto OAuth em modo Testing (expira em 7 dias).
    try {
      const { token } = await auth.getAccessToken();
      r.tokenValido = !!token;
    } catch (err) {
      r.erro = explicarErroGoogle(err);
      r.detalhe = String(err?.message || err).slice(0, 300);
      await anotarErroGoogle(tenantId, r.erro);
      return r;
    }

    if (!criarEventoTeste) {
      await anotarErroGoogle(tenantId, null);
      return r;
    }

    // 2. Cria um evento descartável daqui a um ano, confere se veio Meet e
    //    apaga. Único jeito honesto de saber se ESTA conta gera link.
    const calendar = google.calendar({ version: "v3", auth });
    const inicio = new Date(Date.now() + 365 * 24 * 3600e3);
    const fim = new Date(inicio.getTime() + 30 * 60000);
    let eventoId = null;
    try {
      const res = await calendar.events.insert({
        calendarId: "primary",
        resource: {
          summary: "[teste] Agentes Virtuais — pode apagar",
          description: "Evento de diagnóstico criado pelo sistema. É apagado automaticamente.",
          start: { dateTime: inicio.toISOString(), timeZone: TIMEZONE },
          end: { dateTime: fim.toISOString(), timeZone: TIMEZONE },
          conferenceData: {
            createRequest: {
              requestId: `diag-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        },
        conferenceDataVersion: 1,
      });
      eventoId = res.data.id;
      r.escreveNaAgenda = !!eventoId;

      let link = extrairLink(res.data);
      if (!link && eventoId) link = await this.buscarLink(tenantId, eventoId, { tentativas: 3 });
      r.geraMeet = !!link;

      if (!r.geraMeet) {
        const status = res.data.conferenceData?.createRequest?.status?.statusCode;
        r.erro =
          "A agenda aceita eventos, mas o Google não criou sala do Meet" +
          (status ? ` (status: ${status})` : " (nenhum conferenceData na resposta)") +
          ". Contas do Google Workspace com Meet desativado, ou agendas que não permitem videoconferência, se comportam assim.";
      }
    } catch (err) {
      r.erro = explicarErroGoogle(err);
      r.detalhe = String(err?.message || err).slice(0, 300);
    } finally {
      if (eventoId) {
        await calendar.events.delete({ calendarId: "primary", eventId: eventoId }).catch(() => {});
      }
    }

    await anotarErroGoogle(tenantId, r.erro);
    return r;
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
   * Cria o evento no Google Calendar. Best-effort: conta sem Google conectado
   * ou API fora do ar devolve nulos, e o agendamento local segue de pé.
   *
   * Existe separado de createAppointment porque nem todo agendamento nasce do
   * agente: o painel e as automações também criam, e antes disso cada um
   * gravava só na tabela local — o cliente via o compromisso no sistema e não
   * via nada no Google.
   */
  async criarEvento(tenantId, { titulo, inicio, fim, lead, descricao }) {
    const auth = await this.getOAuth2Client(tenantId);
    if (!auth) return { googleEventId: null, meetLink: null };

    try {
      const calendar = google.calendar({ version: "v3", auth });
      const res = await calendar.events.insert({
        calendarId: "primary",
        resource: {
          summary: titulo,
          description: descricao || "Agendado via Agentes Virtuais.",
          start: { dateTime: inicio.toISOString(), timeZone: TIMEZONE },
          end: { dateTime: fim.toISOString(), timeZone: TIMEZONE },
          attendees: lead?.email ? [{ email: lead.email }] : [],
          reminders: { useDefault: true },
          // Pede um Meet para o evento: é o link enviado 10 minutos antes.
          conferenceData: {
            createRequest: {
              requestId: `av-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        },
        // Sem isso o Google ignora o conferenceData e devolve evento sem Meet.
        conferenceDataVersion: 1,
      });

      const googleEventId = res.data.id;
      let meetLink = extrairLink(res.data);

      // O Google cria a sala DEPOIS de responder: é comum o insert voltar com
      // createRequest.status = "pending", sem hangoutLink e sem entryPoints.
      // Ler só a resposta do insert gravava meetLink nulo numa reunião que
      // ganhava link segundos depois — e ninguém nunca ia buscá-lo.
      //
      // Tenta sempre que faltar, e não só quando o status disser "pending":
      // quando a conta não gera Meet, a resposta vem sem conferenceData nenhum,
      // e condicionar ao "pending" deixava esse caso sem tentativa e sem aviso.
      if (!meetLink && googleEventId) {
        meetLink = await this.buscarLink(tenantId, googleEventId, { tentativas: 3 });
      }

      if (googleEventId && !meetLink) {
        const status = res.data.conferenceData?.createRequest?.status?.statusCode || "sem conferenceData";
        await anotarErroGoogle(
          tenantId,
          `O evento foi criado na agenda, mas o Google não gerou sala do Meet (${status}). ` +
            "Rode o diagnóstico em Conexões → Google Agenda."
        );
      } else if (googleEventId) {
        await anotarErroGoogle(tenantId, null);
      }

      return { googleEventId, meetLink: meetLink || null };
    } catch (err) {
      const motivo = explicarErroGoogle(err);
      console.error(`[Calendar] Falha ao inserir no Google (tenant ${tenantId}):`, motivo);
      await anotarErroGoogle(tenantId, motivo);
      return { googleEventId: null, meetLink: null };
    }
  }

  /**
   * Lê o link do Meet de um evento que já existe.
   *
   * Serve para os dois casos em que o link não veio junto: a sala ainda estava
   * sendo criada no insert, e os agendamentos gravados antes disso. Repete
   * poucas vezes com espera curta — se em ~3s o Google não resolveu, quem
   * chamou segue sem link em vez de segurar a requisição.
   */
  async buscarLink(tenantId, googleEventId, { tentativas = 1 } = {}) {
    if (!googleEventId) return null;
    const auth = await this.getOAuth2Client(tenantId);
    if (!auth) return null;

    const calendar = google.calendar({ version: "v3", auth });
    for (let i = 0; i < tentativas; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1000 * i));
      try {
        const res = await calendar.events.get({ calendarId: "primary", eventId: googleEventId });
        const link = extrairLink(res.data);
        if (link) return link;
      } catch (err) {
        console.error(`[Calendar] Falha ao ler evento ${googleEventId}:`, err.message);
        return null;
      }
    }
    return null;
  }

  /**
   * Garante o link no agendamento local, buscando no Google quando falta.
   *
   * Chamado por quem precisa do link de fato (o lembrete e o agente quando o
   * cliente pede). Assim o compromisso que ficou sem link se conserta sozinho
   * na primeira vez que alguém precisa dele, sem varrer a base inteira.
   */
  async garantirLink(appointment) {
    if (!appointment) return null;
    if (appointment.meetLink) return appointment.meetLink;
    if (!appointment.googleEventId) return null;

    const link = await this.buscarLink(appointment.tenantId, appointment.googleEventId);
    if (!link) return null;

    await prisma.appointment
      .update({ where: { id: appointment.id }, data: { meetLink: link } })
      .catch(() => {});
    return link;
  }

  /**
   * Move (ou renomeia) o evento no Google. Remarcar só na tabela local deixava
   * o horário antigo bloqueado na agenda do cliente para sempre.
   */
  async moverEvento(tenantId, googleEventId, { inicio, fim, titulo }) {
    if (!googleEventId) return false;
    const auth = await this.getOAuth2Client(tenantId);
    if (!auth) return false;

    try {
      const calendar = google.calendar({ version: "v3", auth });
      await calendar.events.patch({
        calendarId: "primary",
        eventId: googleEventId,
        resource: {
          ...(titulo ? { summary: titulo } : {}),
          ...(inicio ? { start: { dateTime: inicio.toISOString(), timeZone: TIMEZONE } } : {}),
          ...(fim ? { end: { dateTime: fim.toISOString(), timeZone: TIMEZONE } } : {}),
        },
      });
      return true;
    } catch (err) {
      console.error(`[Calendar] Falha ao mover evento no Google (tenant ${tenantId}):`, err.message);
      return false;
    }
  }

  /**
   * Apaga o evento no Google. Cancelar no painel sem isto deixava fantasma na
   * agenda: o horário continuava ocupado para o cliente e para o detector de
   * conflito, que lê o Google.
   */
  async removerEvento(tenantId, googleEventId) {
    if (!googleEventId) return false;
    const auth = await this.getOAuth2Client(tenantId);
    if (!auth) return false;

    try {
      const calendar = google.calendar({ version: "v3", auth });
      await calendar.events.delete({ calendarId: "primary", eventId: googleEventId });
      return true;
    } catch (err) {
      // 404/410: já não existe lá. Não é falha — o objetivo era sumir com ele.
      const status = err?.code || err?.response?.status;
      if (status === 404 || status === 410) return true;
      console.error(`[Calendar] Falha ao apagar evento no Google (tenant ${tenantId}):`, err.message);
      return false;
    }
  }

  /**
   * Cria um agendamento com detecção de conflito. Lança SlotConflictError se
   * o horário colidir com Google ou com um Appointment local existente.
   */
  async createAppointment(tenantId, lead, date, title = "Reunião - Agentes Virtuais") {
    // parseBusinessDate: data sem fuso vinda da IA vale como horário do negócio.
    const start = parseBusinessDate(date);
    if (isNaN(start.getTime())) throw new Error("Data inválida");
    const end = new Date(start.getTime() + SLOT_MINUTES * 60000);

    // Conflito: qualquer intervalo ocupado que sobreponha o slot pedido.
    const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start); dayEnd.setHours(23, 59, 59, 999);
    const busy = await this.getBusyIntervals(tenantId, dayStart, dayEnd);
    if (busy.some(b => overlaps(start, end, b.start, b.end))) {
      throw new SlotConflictError();
    }

    // Best-effort: não bloqueia o agendamento local se a API do Google falhar.
    const { googleEventId, meetLink } = await this.criarEvento(tenantId, {
      titulo: `${title}: ${lead.name}`,
      descricao: `Agendado via Agentes Virtuais.\nLead: ${lead.phone}\nScore: ${lead.qualificationScore ?? "-"}`,
      inicio: start,
      fim: end,
      lead,
    });

    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        leadId: lead.id,
        title: `${title}: ${lead.name}`,
        date: start,
        status: "SCHEDULED",
        googleEventId,
        meetLink
      }
    });

    await this.aposCriar(appointment, lead);

    return { appointmentId: appointment.id, googleEventId, meetLink, date: start.toISOString() };
  }

  /**
   * O que sempre tem de acontecer depois de um agendamento nascer: régua de
   * lembretes e movimentação no funil.
   *
   * Existe como método porque o agendamento nasce em mais de um lugar — o
   * agente, o painel, o link público e o nó SCHEDULE_APPOINTMENT dos fluxos.
   * O nó dos fluxos gravava a linha e ia embora: sem lembrete e sem sair da
   * etapa, exatamente o sintoma de "agendei e o lead não moveu".
   *
   * Best-effort: o compromisso já está gravado e não pode ser desfeito porque
   * um lembrete falhou.
   */
  async aposCriar(appointment, lead) {
    try {
      const { default: ReminderService } = await import("./src/api/services/ReminderService.js");
      await ReminderService.scheduleForAppointment(appointment.id);
    } catch (e) {
      console.error("[Calendar] Falha ao programar a régua de lembretes:", e.message);
    }
    try {
      const { default: PipelineAutomation } = await import("./src/api/services/PipelineAutomation.js");
      await PipelineAutomation.onEvent(appointment.tenantId, lead?.id || appointment.leadId, "APPOINTMENT_CREATED");
    } catch (e) {
      console.error("[Calendar] Falha ao mover o lead no funil:", e.message);
    }
    await this.enviarConvitePorEmail(appointment, lead).catch((e) =>
      console.error("[Calendar] Falha ao enviar o convite por e-mail:", e.message)
    );
  }

  /**
   * Manda o convite para o e-mail do cliente, com o `.ics` anexo.
   *
   * O Google só convida quando o negócio conectou a agenda, e boa parte não
   * conectou: sem isto o cliente marcava horário e não recebia nada por
   * e-mail. Silencioso quando não há e-mail — é o agente que tem a obrigação
   * de pedir antes de agendar.
   */
  async enviarConvitePorEmail(appointment, lead) {
    const contato = lead?.email
      ? lead
      : await prisma.lead.findUnique({ where: { id: appointment.leadId }, select: { name: true, email: true } });
    if (!contato?.email) return false;

    const tenant = await prisma.tenant.findUnique({
      where: { id: appointment.tenantId },
      select: { name: true, address: true },
    });
    const { default: EmailService } = await import("./src/api/services/EmailService.js");
    await EmailService.sendAppointmentInvite({
      to: contato.email,
      name: contato.name,
      negocio: tenant?.name,
      titulo: appointment.title,
      inicio: appointment.date,
      fim: new Date(new Date(appointment.date).getTime() + SLOT_MINUTES * 60000),
      link: appointment.meetLink,
      // Reunião com link é online; sem link, o endereço do negócio é o lugar.
      endereco: appointment.meetLink ? null : tenant?.address,
      uid: appointment.id,
    });
    return true;
  }
}

export default new CalendarService();
