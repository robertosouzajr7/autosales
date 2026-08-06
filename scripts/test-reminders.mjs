/**
 * Teste da régua de lembretes contra um Postgres real.
 *
 *   DATABASE_URL=... node scripts/test-reminders.mjs
 *
 * Cobre os cenários da régua: agradecimento imediato, confirmação 24h antes
 * (dentro e fora da janela de 24h), link da call, lembrete final, no-show,
 * cliques nos botões e movimentação no funil.
 */
import prisma from "../src/api/config/prisma.js";
import ReminderService from "../src/api/services/ReminderService.js";
import PipelineAutomation from "../src/api/services/PipelineAutomation.js";
import MessagingService from "../src/api/services/MessagingService.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

// Captura os envios em vez de bater no WhatsApp. `processDue` varre TODOS os
// lembretes vencidos do banco, inclusive os que outros testes deixaram para
// trás, então só interessa o que saiu para o contato deste teste.
const TELEFONE = "5571999990000";
const enviados = [];
MessagingService.sendText = async (tenantId, phone, text) => {
  if (phone === TELEFONE) enviados.push({ tipo: "texto", phone, text });
  return true;
};
/** O envio deste teste que casa com o trecho — não o n-ésimo da fila. */
const enviado = (trecho) => enviados.find((e) => new RegExp(trecho).test(e.text || ""))?.text || "";

const HORA = 60 * 60 * 1000;
const MIN = 60 * 1000;

async function seed() {
  const plan = await prisma.plan.create({
    data: { name: `Teste ${Date.now()}`, priceMonthly: 0, priceYearly: 0, enableAutomations: true },
  });
  const tenant = await prisma.tenant.create({
    data: { name: "Negócio Teste", email: `t${Date.now()}@teste.local`, planId: plan.id },
  });
  const stages = [];
  for (const [i, nome] of ["Novos", "Qualificando", "Agendado", "Atendido", "No-show"].entries()) {
    stages.push(await prisma.pipelineStage.create({ data: { tenantId: tenant.id, name: nome, order: i } }));
  }
  const lead = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      name: "Maria Silva",
      phone: TELEFONE,
      email: "maria@teste.local",
      stageId: stages[0].id,
    },
  });
  // A janela de 24h vive na conversa: última mensagem recebida do cliente.
  await prisma.conversation.create({
    data: { leadId: lead.id, tenantId: tenant.id, lastInboundAt: new Date() },
  });
  await prisma.automationConfig.create({
    data: { tenantId: tenant.id, autoConfirmHours: 24, meetLinkMinutes: 10, lateToleranceMin: 15 },
  });
  return { tenant, lead, stages };
}

async function main() {
  const { tenant, lead, stages } = await seed();

  // ── 1. Régua completa de um agendamento daqui a 3 dias ──────
  console.log("\n1. Programação da régua");
  const daquiTresDias = new Date(Date.now() + 3 * 24 * HORA);
  const appt = await prisma.appointment.create({
    data: {
      tenantId: tenant.id, leadId: lead.id, title: "Reunião", date: daquiTresDias,
      status: "SCHEDULED", meetLink: "https://meet.google.com/abc-defg-hij",
    },
  });
  await ReminderService.scheduleForAppointment(appt.id);

  const regua = await prisma.appointmentReminder.findMany({
    where: { appointmentId: appt.id }, orderBy: { runAt: "asc" },
  });
  ok(regua.length === 6, `6 momentos programados (veio ${regua.length})`);

  const porTipo = Object.fromEntries(regua.map((r) => [r.kind, r]));
  const dif = (kind) => Math.round((new Date(porTipo[kind].runAt).getTime() - daquiTresDias.getTime()) / MIN);
  ok(dif("CONFIRM") === -1440, `CONFIRM 24h antes (${dif("CONFIRM")} min)`);
  ok(dif("MEET_LINK") === -10, `MEET_LINK 10 min antes (${dif("MEET_LINK")} min)`);
  ok(dif("FINAL") === 0, `FINAL na hora marcada (${dif("FINAL")} min)`);
  ok(dif("NOSHOW") === 15, `NOSHOW 15 min depois (${dif("NOSHOW")} min)`);

  // ── 2. Agradecimento sai na hora do agendamento ─────────────
  console.log("\n2. Agradecimento imediato");
  ok(porTipo.BOOKED.status === "SENT", `BOOKED já enviado (${porTipo.BOOKED.status})`);
  const agradecimento = enviados.at(-1)?.text || "";
  ok(/Obrigado, Maria/.test(agradecimento), "agradece pelo nome");
  ok(/meet\.google\.com/.test(agradecimento), "inclui o link da reunião no resumo");
  ok(agradecimento.includes(daquiTresDias.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })), "traz a data do agendamento");

  // ── 3. Confirmação dentro da janela de 24h ──────────────────
  console.log("\n3. Confirmação 24h antes (janela aberta)");
  await prisma.appointmentReminder.update({ where: { id: porTipo.CONFIRM.id }, data: { runAt: new Date() } });
  await ReminderService.processDue();
  const confirmDepois = await prisma.appointmentReminder.findUnique({ where: { id: porTipo.CONFIRM.id } });
  ok(confirmDepois.status === "SENT", `enviado (${confirmDepois.status}: ${confirmDepois.error || "sem erro"})`);

  // ── 4. Botão "confirmar" ────────────────────────────────────
  console.log("\n4. Cliente clica em Confirmar");
  const tratado = await ReminderService.handleButtonReply(`appt:confirm:${appt.id}`, { ...lead, tenantId: tenant.id });
  ok(tratado === true, "o clique é tratado pela régua (a IA não responde por cima)");
  const apptConfirmado = await prisma.appointment.findUnique({ where: { id: appt.id } });
  ok(!!apptConfirmado.confirmedAt, "confirmedAt gravado");
  const noshow = await prisma.appointmentReminder.findUnique({ where: { id: porTipo.NOSHOW.id } });
  ok(noshow.status === "CANCELLED", `aviso de falta cancelado (${noshow.status})`);
  const leadMovido = await prisma.lead.findUnique({ where: { id: lead.id }, include: { stage: true } });
  ok(leadMovido.stage?.name === "Agendado", `lead movido no funil para "${leadMovido.stage?.name}"`);

  // ── 5. Link da call + lembrete final ────────────────────────
  console.log("\n5. Link da reunião e lembrete final");
  enviados.length = 0;
  await prisma.appointmentReminder.updateMany({
    where: { id: { in: [porTipo.MEET_LINK.id, porTipo.FINAL.id] } },
    data: { runAt: new Date() },
  });
  await ReminderService.processDue();
  const [meet, final] = await Promise.all([
    prisma.appointmentReminder.findUnique({ where: { id: porTipo.MEET_LINK.id } }),
    prisma.appointmentReminder.findUnique({ where: { id: porTipo.FINAL.id } }),
  ]);
  ok(meet.status === "SENT", `link da call enviado (${meet.status}: ${meet.error || "-"})`);
  const doMeet = enviado("meet\\.google\\.com/abc");
  ok(!!doMeet, "mensagem do link traz a URL do Meet");
  ok(/10 minutos/.test(doMeet), "avisa a antecedência");
  ok(final.status === "SENT", `lembrete final enviado (${final.status})`);
  ok(!!enviado("é agora"), "lembrete final diz que é agora");

  // ── 6. Sem link de Meet o lembrete é pulado, não falha ──────
  console.log("\n6. Agendamento sem Google Meet");
  const semMeet = await prisma.appointment.create({
    data: { tenantId: tenant.id, leadId: lead.id, title: "Sem meet", date: new Date(Date.now() + 2 * HORA), status: "SCHEDULED" },
  });
  await ReminderService.scheduleForAppointment(semMeet.id);
  await prisma.appointmentReminder.updateMany({
    where: { appointmentId: semMeet.id, kind: "MEET_LINK" }, data: { runAt: new Date() },
  });
  await ReminderService.processDue();
  const meetSemLink = await prisma.appointmentReminder.findFirst({ where: { appointmentId: semMeet.id, kind: "MEET_LINK" } });
  ok(meetSemLink.status === "SKIPPED", `pulado com motivo (${meetSemLink.status})`);
  ok(/Google Calendar/.test(meetSemLink.error || ""), `motivo explica o que fazer: "${meetSemLink.error}"`);

  // ── 7. Janela fechada sem template configurado ──────────────
  console.log("\n7. Confirmação com a janela de 24h fechada");
  await prisma.conversation.updateMany({
    where: { leadId: lead.id },
    data: { lastInboundAt: new Date(Date.now() - 48 * HORA) },
  });
  const futuro = await prisma.appointment.create({
    data: { tenantId: tenant.id, leadId: lead.id, title: "Futuro", date: new Date(Date.now() + 30 * HORA), status: "SCHEDULED" },
  });
  await ReminderService.scheduleForAppointment(futuro.id);
  await prisma.appointmentReminder.updateMany({
    where: { appointmentId: futuro.id, kind: "CONFIRM" }, data: { runAt: new Date() },
  });
  await ReminderService.processDue();
  const confirmFora = await prisma.appointmentReminder.findFirst({ where: { appointmentId: futuro.id, kind: "CONFIRM" } });
  ok(confirmFora.status === "FAILED", `falha explícita (${confirmFora.status})`);
  ok(/template/i.test(confirmFora.error || ""), `motivo aponta o template: "${confirmFora.error}"`);

  // ── 8. Agendamento em cima da hora pula o aviso de 24h ──────
  console.log("\n8. Agendamento para daqui a 2 horas");
  const curto = await prisma.appointment.create({
    data: { tenantId: tenant.id, leadId: lead.id, title: "Curto", date: new Date(Date.now() + 2 * HORA), status: "SCHEDULED" },
  });
  await ReminderService.scheduleForAppointment(curto.id, { skipBooked: true });
  const confirmCurto = await prisma.appointmentReminder.findFirst({ where: { appointmentId: curto.id, kind: "CONFIRM" } });
  ok(confirmCurto.status === "SKIPPED", `CONFIRM pulado (${confirmCurto.status})`);
  const bookedCurto = await prisma.appointmentReminder.findFirst({ where: { appointmentId: curto.id, kind: "BOOKED" } });
  ok(!bookedCurto, "skipBooked não cria o agradecimento");

  // ── 9. Cancelar limpa a fila ────────────────────────────────
  console.log("\n9. Cancelamento");
  await ReminderService.cancelForAppointment(curto.id);
  const pendentesCurto = await prisma.appointmentReminder.count({ where: { appointmentId: curto.id, status: "PENDING" } });
  ok(pendentesCurto === 0, `nada mais na fila (${pendentesCurto} pendente(s))`);

  // ── 10. Remarcar recalcula a régua ──────────────────────────
  console.log("\n10. Remarcação");
  const novaData = new Date(Date.now() + 10 * 24 * HORA);
  await prisma.appointment.update({ where: { id: futuro.id }, data: { date: novaData } });
  await ReminderService.rescheduleForAppointment(futuro.id);
  const confirmNovo = await prisma.appointmentReminder.findFirst({ where: { appointmentId: futuro.id, kind: "CONFIRM" } });
  const difNovo = Math.round((new Date(confirmNovo.runAt).getTime() - novaData.getTime()) / MIN);
  ok(difNovo === -1440, `CONFIRM recalculado para 24h antes da nova data (${difNovo} min)`);
  ok(confirmNovo.status === "PENDING", `de volta para a fila (${confirmNovo.status})`);

  // ── 11. Régua desligada não envia nada ──────────────────────
  console.log("\n11. Régua desligada nas configurações");
  await prisma.automationConfig.update({ where: { tenantId: tenant.id }, data: { remindersEnabled: false } });
  const desligado = await prisma.appointment.create({
    data: { tenantId: tenant.id, leadId: lead.id, title: "Desligado", date: new Date(Date.now() + 5 * HORA), status: "SCHEDULED" },
  });
  const criados = await ReminderService.scheduleForAppointment(desligado.id);
  ok(criados.length === 0, `nenhum lembrete criado (${criados.length})`);
  await prisma.automationConfig.update({ where: { tenantId: tenant.id }, data: { remindersEnabled: true } });

  // ── 12. Funil ───────────────────────────────────────────────
  console.log("\n12. Movimentação no funil");
  await PipelineAutomation.onEvent(tenant.id, lead.id, "APPOINTMENT_COMPLETED");
  const atendido = await prisma.lead.findUnique({ where: { id: lead.id }, include: { stage: true } });
  ok(atendido.stage?.name === "Atendido", `concluído → "${atendido.stage?.name}"`);
  await PipelineAutomation.onEvent(tenant.id, lead.id, "APPOINTMENT_NOSHOW");
  const faltou = await prisma.lead.findUnique({ where: { id: lead.id }, include: { stage: true } });
  ok(faltou.stage?.name === "No-show", `falta → "${faltou.stage?.name}"`);

  await prisma.automationConfig.update({ where: { tenantId: tenant.id }, data: { pipelineAutoEnabled: false } });
  await PipelineAutomation.onEvent(tenant.id, lead.id, "APPOINTMENT_COMPLETED");
  const parado = await prisma.lead.findUnique({ where: { id: lead.id }, include: { stage: true } });
  ok(parado.stage?.name === "No-show", "com a automação desligada o lead não se move");

  // ── 13. Opt-out ────────────────────────────────────────────
  console.log("\n13. Contato em opt-out");
  await prisma.lead.update({ where: { id: lead.id }, data: { optedOut: true } });
  const posOptOut = await prisma.appointment.create({
    data: { tenantId: tenant.id, leadId: lead.id, title: "Opt-out", date: new Date(Date.now() + 6 * HORA), status: "SCHEDULED" },
  });
  await ReminderService.scheduleForAppointment(posOptOut.id);
  const bookedOptOut = await prisma.appointmentReminder.findFirst({ where: { appointmentId: posOptOut.id, kind: "BOOKED" } });
  ok(bookedOptOut.status === "SKIPPED", `nada é enviado (${bookedOptOut.status})`);
  ok(/opt-out/i.test(bookedOptOut.error || ""), `motivo registrado: "${bookedOptOut.error}"`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
