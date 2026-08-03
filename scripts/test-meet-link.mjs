/**
 * Link da reunião: no painel, na régua de lembretes e sob pedido do cliente.
 *
 *   DATABASE_URL=... node scripts/test-meet-link.mjs
 *
 * O link nasce no Google e mora no agendamento. Aqui se verifica que ele
 * chega ao cliente pelos três caminhos que importam — o lembrete automático,
 * o pedido explícito no chat e a listagem que alimenta o painel — e que o
 * agente NUNCA inventa um link quando não existe.
 */
import prisma from "../src/api/config/prisma.js";
import MessagingService from "../src/api/services/MessagingService.js";
import ReminderService from "../src/api/services/ReminderService.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

// Captura os envios em vez de bater no WhatsApp.
const enviados = [];
MessagingService.sendText = async (tenantId, phone, text) => {
  enviados.push({ phone, text });
  return true;
};

const { default: AutomationEngine } = await import("../automation_engine.js");
const Appointments = await import("../src/api/controllers/AppointmentController.js");

const LINK = "https://meet.google.com/abc-defg-hij";
const MIN = 60 * 1000;
const HORA = 60 * MIN;

function fingirResposta() {
  const r = { statusCode: 200, corpo: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.corpo = b; return r; };
  return r;
}

async function main() {
  const plan = await prisma.plan.create({
    data: { name: `Meet ${Date.now()}`, priceMonthly: 0, priceYearly: 0, enableCalendar: true },
  });
  const tenant = await prisma.tenant.create({
    data: { name: "Negócio Meet", email: `mk${Date.now()}@teste.local`, planId: plan.id },
  });
  const lead = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Maria Silva", phone: "5571999990000", email: "maria@teste.local" },
  });
  await prisma.automationConfig.create({
    data: { tenantId: tenant.id, autoConfirmHours: 24, meetLinkMinutes: 10, lateToleranceMin: 15 },
  });
  // A confirmação com botões só vale dentro da janela de 24h da Meta, e o
  // marco é a última mensagem recebida do cliente.
  await prisma.conversation.create({
    data: { leadId: lead.id, tenantId: tenant.id, lastInboundAt: new Date() },
  });

  // ── 1. O cliente pede o link ────────────────────────────────
  console.log("\n1. Cliente pede o link no chat");
  const appt = await prisma.appointment.create({
    data: {
      tenantId: tenant.id, leadId: lead.id, title: "Consulta",
      date: new Date(Date.now() + 3 * HORA), status: "SCHEDULED",
      googleEventId: "evt-1", meetLink: LINK,
    },
  });

  enviados.length = 0;
  let r = await AutomationEngine._executeTool("send_meeting_link", { message: "Claro! É por aqui:" }, lead);
  ok(r.success === true, "a ferramenta responde que enviou");
  ok(r.link === LINK, "devolvendo o link do agendamento");
  ok(enviados.length === 1, "e mandou uma mensagem ao cliente");
  ok(enviados[0]?.text.includes(LINK), `com o link dentro ("${enviados[0]?.text.replace(/\n/g, " ")}")`);
  ok(enviados[0]?.text.includes("Claro!"), "e a frase que o agente escolheu");

  // ── 2. Sem reunião marcada ──────────────────────────────────
  console.log("\n2. Cliente sem reunião marcada");
  const outro = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "João", phone: "5571988880000" },
  });
  enviados.length = 0;
  r = await AutomationEngine._executeTool("send_meeting_link", {}, outro);
  ok(r.success === false, "a ferramenta recusa");
  ok(enviados.length === 0, "não manda nada");
  ok(/não invente/i.test(r.note || ""), `e instrui o agente a não inventar link ("${r.note}")`);

  // ── 3. Compromisso sem link ─────────────────────────────────
  console.log("\n3. Compromisso presencial (sem link)");
  const presencial = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Ana", phone: "5571977770000" },
  });
  await prisma.appointment.create({
    data: {
      tenantId: tenant.id, leadId: presencial.id, title: "Avaliação",
      date: new Date(Date.now() + 2 * HORA), status: "SCHEDULED",
    },
  });
  enviados.length = 0;
  r = await AutomationEngine._executeTool("send_meeting_link", {}, presencial);
  ok(r.success === false, "a ferramenta recusa");
  ok(!!r.quando, `mas informa quando é o compromisso (${r.quando})`);
  ok(/NÃO invente/i.test(r.note || ""), "sem deixar o agente improvisar uma URL");

  // ── 4. Reunião cancelada não vale ───────────────────────────
  console.log("\n4. Reunião cancelada");
  await prisma.appointment.update({ where: { id: appt.id }, data: { status: "CANCELLED" } });
  r = await AutomationEngine._executeTool("send_meeting_link", {}, lead);
  ok(r.success === false, "não manda o link de um compromisso cancelado");
  await prisma.appointment.update({ where: { id: appt.id }, data: { status: "SCHEDULED" } });

  // ── 5. Lembretes levam o link ───────────────────────────────
  console.log("\n5. Lembretes da régua");
  const daqui = (ms) => new Date(Date.now() + ms);
  const comLink = await prisma.appointment.create({
    data: {
      tenantId: tenant.id, leadId: lead.id, title: "Reunião",
      date: daqui(25 * HORA), status: "SCHEDULED", meetLink: LINK,
    },
  });

  for (const [kind, quando] of [["CONFIRM", daqui(MIN)], ["FINAL", daqui(MIN)], ["NOSHOW", daqui(MIN)]]) {
    enviados.length = 0;
    const lembrete = await prisma.appointmentReminder.create({
      data: { appointmentId: comLink.id, tenantId: tenant.id, kind, runAt: quando, status: "PENDING" },
    });
    await ReminderService.processOne(lembrete.id);
    const texto = enviados.map((e) => e.text).join(" ");
    ok(texto.includes(LINK), `${kind} sai com o link`);
    await prisma.appointmentReminder.delete({ where: { id: lembrete.id } }).catch(() => {});
    // NOSHOW marca o agendamento; devolve para SCHEDULED para o próximo caso.
    await prisma.appointment.update({ where: { id: comLink.id }, data: { status: "SCHEDULED" } });
  }

  // Sem link, o mesmo texto não pode virar "Entre por aqui:" vazio.
  console.log("\n6. Lembrete de compromisso sem link");
  const semLink = await prisma.appointment.create({
    data: { tenantId: tenant.id, leadId: lead.id, title: "Presencial", date: daqui(25 * HORA), status: "SCHEDULED" },
  });
  enviados.length = 0;
  const lembrete = await prisma.appointmentReminder.create({
    data: { appointmentId: semLink.id, tenantId: tenant.id, kind: "CONFIRM", runAt: daqui(MIN), status: "PENDING" },
  });
  await ReminderService.processOne(lembrete.id);
  const texto = enviados.map((e) => e.text).join(" ");
  ok(texto.length > 0, "o lembrete sai mesmo assim");
  ok(!texto.includes("🔗"), `e sem linha de link vazia ("${texto.replace(/\n/g, " ")}")`);

  // ── 7. O painel recebe o link ───────────────────────────────
  console.log("\n7. Listagem do painel");
  const res = fingirResposta();
  await Appointments.getAppointments({ tenantId: tenant.id }, res);
  const naLista = res.corpo.find((a) => a.id === comLink.id);
  ok(!!naLista, "o agendamento aparece na lista");
  ok(naLista?.meetLink === LINK, "com o link junto, para o card mostrar e copiar");

  console.log(falhas === 0 ? "\n✅ Todos os cenários passaram." : `\n❌ ${falhas} falha(s).`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
