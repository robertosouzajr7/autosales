import prisma from "../config/prisma.js";
import MessagingService from "./MessagingService.js";
import { countVariables } from "../controllers/TemplateController.js";

/**
 * Régua de lembretes do agendamento.
 *
 * Cada momento vira uma linha em AppointmentReminder com a hora exata em que
 * deve sair. Um laço processa o que venceu. Antes disso o ciclo de vida era
 * marcado com flags dentro de `Appointment.notes` e recalculado a cada volta
 * do cron: não dava para saber o que ainda ia sair, o que falhou nem por quê,
 * e qualquer reinício do processo podia reenviar (ou pular) um lembrete.
 *
 * Momentos:
 *   BOOKED       — logo após o agendamento: agradece, resume e oferece encerrar
 *   CONFIRM      — X horas antes (padrão 24h): pede confirmação, com botões
 *   MEET_LINK    — X minutos antes (padrão 10): link da call no WhatsApp e e-mail
 *   FINAL        — na hora marcada: "sua reunião é agora"
 *   NOSHOW       — após a tolerância, se ninguém confirmou presença
 *   POST_SERVICE — X horas depois de concluído: pesquisa de satisfação
 */

const TZ = "America/Sao_Paulo";
const MIN = 60 * 1000;
const HORA = 60 * MIN;

/** Ordem em que os lembretes aparecem na tela. */
export const KINDS = ["BOOKED", "CONFIRM", "MEET_LINK", "FINAL", "NOSHOW", "POST_SERVICE"];

export const KIND_LABEL = {
  BOOKED: "Confirmação do agendamento",
  CONFIRM: "Pedido de confirmação",
  MEET_LINK: "Link da reunião",
  FINAL: "Lembrete final",
  NOSHOW: "Falta (no-show)",
  POST_SERVICE: "Pós-atendimento",
};

const PADROES = {
  bookedMsgTemplate:
    "Obrigado, {name}! 🙌 Seu agendamento está confirmado.\n\n📅 {date}\n🕒 {time}{link_block}\n\nPosso te ajudar com mais alguma coisa?",
  // CUIDADO: confirmMsgTemplate, lateMsgTemplate e postServiceMsgTemplate têm
  // DEFAULT na coluna do banco (ver AutomationConfig no schema). Como a linha
  // de config nasce preenchida, o valor do banco vence estes padrões para todo
  // tenant que tenha config salva — mudar só aqui não muda nada em produção.
  // Os outros três (booked/meet/final) são nulos no banco e usam estes textos.
  //
  // {link_block} só rende uma linha quando existe link, então o texto continua
  // limpo em agendamento presencial ou sem Google conectado.
  confirmMsgTemplate:
    "Oi {name}! Passando para confirmar nosso compromisso de {date} às {time}. Podemos confirmar?{link_block}",
  meetMsgTemplate:
    "Oi {name}! Sua reunião começa em {minutes} minutos.\n\nEntre por aqui: {link}",
  finalMsgTemplate: "{name}, sua reunião é agora! 🚀{link_block}",
  // Quem está atrasado muitas vezes é quem não achou o link: mandar de novo
  // resolve mais do que perguntar o que houve.
  lateMsgTemplate:
    "Olá {name}, não conseguimos te encontrar no horário das {time}. Aconteceu algo? Se quiser entrar agora ou remarcar, é só me avisar.{link_block}",
  postServiceMsgTemplate:
    "Oi {name}! Como foi nosso atendimento? Seu retorno ajuda demais. ✨",
};

function fmtData(date) {
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtHora(date) {
  return new Date(date).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/** Aplica os marcadores do texto configurável. */
function preencher(texto, { lead, appointment, minutes }) {
  const link = appointment.meetLink || "";
  return String(texto || "")
    .replaceAll("{name}", (lead.name || "").split(" ")[0] || lead.name || "")
    .replaceAll("{nome}", (lead.name || "").split(" ")[0] || lead.name || "")
    .replaceAll("{date}", fmtData(appointment.date))
    .replaceAll("{time}", fmtHora(appointment.date))
    .replaceAll("{title}", appointment.title || "")
    .replaceAll("{minutes}", String(minutes ?? ""))
    .replaceAll("{link}", link)
    // Só entra a linha do link quando existe link — evita "Entre por aqui:" vazio.
    .replaceAll("{link_block}", link ? `\n🔗 ${link}` : "")
    .trim();
}

/**
 * A janela de serviço de 24h da Meta: fora dela só template aprovado passa.
 * O marco é a última mensagem RECEBIDA, gravada na conversa do lead.
 */
async function dentroDaJanela(lead) {
  const conversa = await prisma.conversation
    .findUnique({ where: { leadId: lead.id }, select: { lastInboundAt: true } })
    .catch(() => null);
  if (!conversa?.lastInboundAt) return false;
  return Date.now() - new Date(conversa.lastInboundAt).getTime() < 24 * HORA;
}

async function getConfig(tenantId) {
  const config = await prisma.automationConfig.findUnique({ where: { tenantId } }).catch(() => null);
  return config || {};
}

/** Conexão oficial do tenant — botões e templates só existem na Cloud API. */
async function contaOficial(tenantId) {
  const contas = await prisma.whatsAppAccount.findMany({
    where: { tenantId, channel: { not: "INSTAGRAM" } },
    orderBy: { createdAt: "asc" },
  });
  return contas.find((a) => a.phoneId && a.accessToken) || null;
}

/**
 * Manda botões quando dá (Cloud API + janela aberta) e cai para texto puro
 * quando não dá — o lembrete nunca deixa de sair por causa dos botões.
 */
async function enviarComBotoes(tenantId, lead, body, buttons) {
  const conta = (await dentroDaJanela(lead)) ? await contaOficial(tenantId) : null;
  if (conta) {
    const { MetaManager } = await import("../../../meta.js");
    const r = await MetaManager.sendButtons(conta.phoneId, conta.accessToken, lead.phone, { body, buttons });
    if (r?.ok) return { ok: true, channel: "WHATSAPP_BUTTONS" };
  }
  const ok = await MessagingService.sendText(tenantId, lead.phone, body, { accountId: lead.waAccountId });
  return ok ? { ok: true, channel: "WHATSAPP" } : { ok: false, error: "Falha no envio pelo WhatsApp." };
}

/**
 * Envia um template aprovado. Mesma regra de parâmetros do disparo em massa:
 * a Meta exige exatamente a quantidade de {{n}} que o template declara.
 */
async function enviarTemplate(tenantId, lead, templateId, valores) {
  const template = await prisma.messageTemplate.findFirst({ where: { id: templateId, tenantId } });
  if (!template) return { ok: false, error: "Template configurado não existe mais." };
  if (template.status !== "APPROVED") return { ok: false, error: `Template "${template.name}" não está aprovado pela Meta.` };

  const conta = await contaOficial(tenantId);
  if (!conta) return { ok: false, error: "Nenhuma conexão oficial (Cloud API) disponível." };

  const esperados = countVariables(template.content);
  const variables = Array.from({ length: esperados }, (_, i) =>
    String(valores[i] ?? (i === 0 ? lead.name || "Cliente" : "")).replace(/\s+/g, " ")
  );

  const { MetaManager } = await import("../../../meta.js");
  const r = await MetaManager.sendTemplate(conta.phoneId, conta.accessToken, lead.phone, {
    name: template.name,
    language: template.language,
    variables,
    headerMediaUrl: template.headerType && template.headerType !== "TEXT" ? template.mediaUrl : null,
    headerType: template.headerType || "IMAGE",
  });
  return r.ok ? { ok: true, channel: "WHATSAPP_TEMPLATE" } : { ok: false, error: r.error };
}

class ReminderService {
  /**
   * Cria (ou atualiza) a régua de um agendamento. Idempotente: rodar de novo
   * apenas recalcula os horários do que ainda não saiu.
   */
  async scheduleForAppointment(appointmentId, { skipBooked = false } = {}) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { lead: true },
    });
    if (!appt) return [];

    const config = await getConfig(appt.tenantId);
    if (config.remindersEnabled === false) return [];

    const inicio = new Date(appt.date).getTime();
    const confirmHoras = config.autoConfirmHours ?? 24;
    const meetMin = config.meetLinkMinutes ?? 10;
    const noShowMin = config.lateToleranceMin ?? 15;
    const posHoras = config.postServiceHours ?? 24;

    const planejado = [
      { kind: "BOOKED", runAt: new Date(), on: config.bookedEnabled !== false && !skipBooked },
      { kind: "CONFIRM", runAt: new Date(inicio - confirmHoras * HORA), on: config.confirmEnabled !== false },
      { kind: "MEET_LINK", runAt: new Date(inicio - meetMin * MIN), on: config.meetLinkEnabled !== false },
      { kind: "FINAL", runAt: new Date(inicio), on: config.finalEnabled !== false },
      { kind: "NOSHOW", runAt: new Date(inicio + noShowMin * MIN), on: config.noShowEnabled !== false },
      { kind: "POST_SERVICE", runAt: new Date(inicio + posHoras * HORA), on: config.postServiceEnabled !== false },
    ];

    const criados = [];
    for (const item of planejado) {
      if (!item.on) continue;
      // Agendamento marcado para daqui a 2h não recebe o pedido de confirmação
      // de 24h antes: marcamos como pulado para a tela explicar a ausência.
      const atrasado = item.kind !== "BOOKED" && item.runAt.getTime() < Date.now() - 5 * MIN;
      const existente = await prisma.appointmentReminder.findUnique({
        where: { appointmentId_kind: { appointmentId: appt.id, kind: item.kind } },
      });
      // Nunca mexe no que já saiu.
      if (existente && ["SENT", "SKIPPED"].includes(existente.status)) continue;

      const dados = {
        runAt: item.runAt,
        status: atrasado ? "SKIPPED" : "PENDING",
        error: atrasado ? "Horário do lembrete já tinha passado quando o agendamento foi criado." : null,
      };
      // Upsert, e não ler-depois-criar: a régua é montada na criação e de novo
      // ao remarcar, e as duas podem se cruzar — quem agenda e remarca em
      // seguida caía na trava de (appointmentId, kind) e recebia 500.
      const row = await prisma.appointmentReminder.upsert({
        where: { appointmentId_kind: { appointmentId: appt.id, kind: item.kind } },
        update: dados,
        create: { appointmentId: appt.id, tenantId: appt.tenantId, kind: item.kind, ...dados },
      });
      criados.push(row);
    }

    // O agradecimento não espera o próximo ciclo: o cliente acabou de agendar
    // e um "obrigado" que chega um minuto depois soa quebrado.
    const booked = criados.find((r) => r.kind === "BOOKED" && r.status === "PENDING");
    if (booked) await this.processOne(booked.id).catch(() => {});

    return criados;
  }

  /** Processa um lembrete específico agora (usado pelo envio imediato). */
  async processOne(id) {
    const lembrete = await prisma.appointmentReminder.findUnique({
      where: { id },
      include: { appointment: { include: { lead: true } } },
    });
    if (!lembrete || lembrete.status !== "PENDING") return null;

    const resultado = await this.dispatch(lembrete);
    return prisma.appointmentReminder.update({
      where: { id },
      data: {
        status: resultado.skip ? "SKIPPED" : resultado.ok ? "SENT" : "FAILED",
        sentAt: resultado.ok ? new Date() : null,
        channel: resultado.channel || null,
        error: resultado.error || resultado.skip || null,
        attempts: { increment: 1 },
      },
    });
  }

  /** Cancela o que ainda não saiu (agendamento cancelado/remarcado). */
  async cancelForAppointment(appointmentId, motivo = "Agendamento cancelado.") {
    await prisma.appointmentReminder.updateMany({
      where: { appointmentId, status: "PENDING" },
      data: { status: "CANCELLED", error: motivo },
    });
  }

  /** Chamado quando o agendamento muda de data: recalcula a régua inteira. */
  async rescheduleForAppointment(appointmentId) {
    await prisma.appointmentReminder.deleteMany({
      where: { appointmentId, status: { in: ["PENDING", "CANCELLED", "SKIPPED", "FAILED"] } },
    });
    return this.scheduleForAppointment(appointmentId, { skipBooked: true });
  }

  /**
   * Laço principal: envia tudo que venceu. Erros ficam gravados na própria
   * linha, então a tela mostra "falhou porque X" em vez de silêncio.
   */
  async processDue(limite = 50) {
    const pendentes = await prisma.appointmentReminder.findMany({
      where: { status: "PENDING", runAt: { lte: new Date() } },
      orderBy: { runAt: "asc" },
      take: limite,
      include: { appointment: { include: { lead: true } } },
    });

    for (const lembrete of pendentes) {
      try {
        const atualizado = await this.processOne(lembrete.id);
        if (atualizado?.status === "SENT") {
          console.log(`[Lembretes] ✅ ${lembrete.kind} enviado para ${lembrete.appointment.lead?.name || "lead"}.`);
        } else if (atualizado?.status === "FAILED") {
          console.warn(`[Lembretes] ⚠️ ${lembrete.kind} falhou: ${atualizado.error}`);
        }
      } catch (e) {
        await prisma.appointmentReminder
          .update({
            where: { id: lembrete.id },
            data: { status: "FAILED", error: String(e.message || e).slice(0, 500), attempts: { increment: 1 } },
          })
          .catch(() => {});
        console.error(`[Lembretes] Erro ao processar ${lembrete.kind}:`, e.message);
      }
    }
    return pendentes.length;
  }

  /** Decide e executa o envio de um lembrete específico. */
  async dispatch(lembrete) {
    const appt = lembrete.appointment;
    const lead = appt?.lead;
    if (!appt || !lead) return { skip: "Agendamento ou contato não existe mais." };
    if (lead.optedOut) return { skip: "Contato pediu para não receber mensagens (opt-out)." };
    if (!lead.phone) return { skip: "Contato sem telefone válido." };

    const config = await getConfig(appt.tenantId);
    if (config.remindersEnabled === false) return { skip: "Régua de lembretes desligada nas configurações." };

    // Estado do agendamento manda: cancelado não recebe nada, e o
    // pós-atendimento só faz sentido depois de concluído.
    if (["CANCELLED", "CANCELED"].includes(appt.status)) return { skip: "Agendamento cancelado." };
    if (lembrete.kind === "POST_SERVICE" && appt.status !== "COMPLETED") {
      return { skip: "Agendamento não foi marcado como concluído." };
    }
    if (["CONFIRM", "MEET_LINK", "FINAL", "NOSHOW"].includes(lembrete.kind) && appt.status !== "SCHEDULED") {
      return { skip: `Agendamento está como ${appt.status}.` };
    }
    if (lembrete.kind === "NOSHOW" && appt.confirmedAt) {
      return { skip: "Cliente confirmou presença." };
    }

    switch (lembrete.kind) {
      case "BOOKED":
        return this.enviarBooked(appt, lead, config);
      case "CONFIRM":
        return this.enviarConfirmacao(appt, lead, config);
      case "MEET_LINK":
        return this.enviarLinkDaCall(appt, lead, config);
      case "FINAL":
        return this.enviarFinal(appt, lead, config);
      case "NOSHOW":
        return this.enviarNoShow(appt, lead, config);
      case "POST_SERVICE":
        return this.enviarPosAtendimento(appt, lead, config);
      default:
        return { skip: `Tipo de lembrete desconhecido: ${lembrete.kind}` };
    }
  }

  // ── Momentos da régua ──────────────────────────────────────────

  /** Agradece, manda o resumo com o link e oferece encerrar o atendimento. */
  async enviarBooked(appt, lead, config) {
    // Esta é a primeira mensagem depois de marcar, e é a que o cliente guarda.
    // Ela sai no mesmo instante da criação do agendamento — e a sala do Meet
    // costuma ficar pronta um pouco depois. Buscar aqui é o que evita mandar
    // o resumo sem link e nunca mais mandar link nenhum.
    if (!appt.meetLink) {
      const { default: CalendarService } = await import("../../../calendar_service.js");
      appt.meetLink = await CalendarService.garantirLink(appt);
    }
    const body = preencher(config.bookedMsgTemplate || PADROES.bookedMsgTemplate, { lead, appointment: appt });
    return enviarComBotoes(appt.tenantId, lead, body, [
      { id: `appt:more:${appt.id}`, title: "Tenho uma dúvida" },
      { id: `appt:close:${appt.id}`, title: "Encerrar atendimento" },
    ]);
  }

  /**
   * Pedido de confirmação. Dentro da janela vai com botões (grátis); fora
   * dela só um template aprovado passa — e sem template configurado o
   * lembrete falha com o motivo explícito, em vez de sumir.
   */
  async enviarConfirmacao(appt, lead, config) {
    const body = preencher(config.confirmMsgTemplate || PADROES.confirmMsgTemplate, { lead, appointment: appt });

    if (await dentroDaJanela(lead)) {
      return enviarComBotoes(appt.tenantId, lead, body, [
        { id: `appt:confirm:${appt.id}`, title: "Confirmar" },
        { id: `appt:reschedule:${appt.id}`, title: "Remarcar" },
      ]);
    }

    if (!config.confirmTemplateId) {
      return {
        ok: false,
        error:
          "A janela de 24h está fechada e nenhum template de confirmação foi escolhido em Lembretes → Confirmações.",
      };
    }
    return enviarTemplate(appt.tenantId, lead, config.confirmTemplateId, [
      lead.name || "Cliente",
      `${fmtData(appt.date)} às ${fmtHora(appt.date)}`,
    ]);
  }

  /** 10 minutos antes: link da call no WhatsApp e no e-mail. */
  async enviarLinkDaCall(appt, lead, config) {
    if (!appt.meetLink) {
      // A sala pode ter ficado pronta depois da criação do evento. Antes de
      // desistir, busca no Google e grava — é o momento em que o link importa.
      const { default: CalendarService } = await import("../../../calendar_service.js");
      appt.meetLink = await CalendarService.garantirLink(appt);
    }
    if (!appt.meetLink) {
      return { skip: "Agendamento sem link de reunião (conecte o Google Calendar para gerar o Meet)." };
    }
    const minutes = config.meetLinkMinutes ?? 10;
    const body = preencher(config.meetMsgTemplate || PADROES.meetMsgTemplate, { lead, appointment: appt, minutes });

    const zap = await MessagingService.sendText(appt.tenantId, lead.phone, body, { accountId: lead.waAccountId });

    let emailOk = false;
    if (lead.email) {
      const { sendMeetingLinkEmail } = await import("./EmailService.js");
      emailOk = await sendMeetingLinkEmail({
        to: lead.email,
        name: lead.name,
        link: appt.meetLink,
        when: `${fmtData(appt.date)} às ${fmtHora(appt.date)}`,
        minutes,
      })
        .then(() => true)
        .catch(() => false);
    }

    if (!zap && !emailOk) return { ok: false, error: "Falha ao enviar o link no WhatsApp e no e-mail." };
    return { ok: true, channel: zap && emailOk ? "WHATSAPP+EMAIL" : zap ? "WHATSAPP" : "EMAIL" };
  }

  /** Na hora marcada. */
  async enviarFinal(appt, lead, config) {
    const body = preencher(config.finalMsgTemplate || PADROES.finalMsgTemplate, { lead, appointment: appt });
    const ok = await MessagingService.sendText(appt.tenantId, lead.phone, body, { accountId: lead.waAccountId });
    return ok ? { ok: true, channel: "WHATSAPP" } : { ok: false, error: "Falha no envio pelo WhatsApp." };
  }

  async enviarNoShow(appt, lead, config) {
    const body = preencher(config.lateMsgTemplate || PADROES.lateMsgTemplate, { lead, appointment: appt });
    const ok = await MessagingService.sendText(appt.tenantId, lead.phone, body, { accountId: lead.waAccountId });
    if (ok) {
      await prisma.appointment.update({ where: { id: appt.id }, data: { status: "NOSHOW" } }).catch(() => {});
      const { default: PipelineAutomation } = await import("./PipelineAutomation.js");
      await PipelineAutomation.onEvent(appt.tenantId, appt.leadId, "APPOINTMENT_NOSHOW");
    }
    return ok ? { ok: true, channel: "WHATSAPP" } : { ok: false, error: "Falha no envio pelo WhatsApp." };
  }

  async enviarPosAtendimento(appt, lead, config) {
    const body = preencher(config.postServiceMsgTemplate || PADROES.postServiceMsgTemplate, { lead, appointment: appt });
    const ok = await MessagingService.sendText(appt.tenantId, lead.phone, body, { accountId: lead.waAccountId });
    return ok ? { ok: true, channel: "WHATSAPP" } : { ok: false, error: "Falha no envio pelo WhatsApp." };
  }

  // ── Respostas do cliente aos botões ────────────────────────────

  /**
   * Trata o clique nos botões da régua. Devolve `true` quando a resposta já
   * foi dada aqui — nesse caso a IA não deve responder por cima.
   */
  async handleButtonReply(replyId, lead) {
    const m = String(replyId || "").match(/^appt:(confirm|reschedule|close|more):(.+)$/);
    if (!m) return false;
    const [, acao, appointmentId] = m;

    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId: lead.tenantId },
    });
    if (!appt) return false;

    const enviar = (texto) =>
      MessagingService.sendText(lead.tenantId, lead.phone, texto, { accountId: lead.waAccountId });

    if (acao === "confirm") {
      await prisma.appointment.update({ where: { id: appt.id }, data: { confirmedAt: new Date() } });
      // Presença confirmada torna o aviso de falta desnecessário.
      await prisma.appointmentReminder.updateMany({
        where: { appointmentId: appt.id, kind: "NOSHOW", status: "PENDING" },
        data: { status: "CANCELLED", error: "Cliente confirmou presença." },
      });
      const { default: PipelineAutomation } = await import("./PipelineAutomation.js");
      await PipelineAutomation.onEvent(lead.tenantId, lead.id, "APPOINTMENT_CONFIRMED");
      await enviar(`Presença confirmada, ${(lead.name || "").split(" ")[0]}! Te espero ${fmtData(appt.date)} às ${fmtHora(appt.date)}. 👍`);
      return true;
    }

    if (acao === "reschedule") {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      await this.cancelForAppointment(appt.id, "Cliente pediu para remarcar.");
      const { default: PipelineAutomation } = await import("./PipelineAutomation.js");
      await PipelineAutomation.onEvent(lead.tenantId, lead.id, "APPOINTMENT_CANCELLED");
      // Deixa a IA assumir a partir daqui: remarcar é conversa, não script.
      await enviar("Sem problema! Me diga qual dia e horário ficam melhores para você.");
      return true;
    }

    if (acao === "close") {
      // Encerrar o atendimento devolve a conversa ao estado inicial: o bot
      // volta a responder normalmente quando o cliente escrever de novo.
      await prisma.conversation
        .updateMany({ where: { leadId: lead.id }, data: { botActive: true } })
        .catch(() => {});
      await enviar("Atendimento encerrado. Qualquer coisa é só me chamar por aqui! 👋");
      return true;
    }

    // "Tenho uma dúvida": não responde nada pronto, só libera a IA.
    return false;
  }
}

export default new ReminderService();
