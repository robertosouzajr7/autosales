/**
 * Sincronia do agendamento com o Google Calendar.
 *
 *   DATABASE_URL=... node scripts/test-calendar-sync.mjs
 *
 * O agendamento nasce em três lugares — painel, agente e automação — e cada
 * um gravava por conta própria. Aqui o Google é dublê: o que importa é que os
 * três cheguem nele, e que remarcar, cancelar e excluir não deixem fantasma.
 *
 * Os controllers são chamados no processo do teste, e não por HTTP, porque o
 * dublê precisa valer para o código que está sendo exercitado — com o servidor
 * à parte o teste passaria batendo no Google de verdade ou em nada.
 */
import prisma from "../src/api/config/prisma.js";
import CalendarService from "../calendar_service.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

// Dublê do Google: registra as chamadas em vez de bater na API. Troca só os
// três métodos que falam com o Google; o resto do serviço continua real.
const chamadas = { criados: [], movidos: [], removidos: [] };
let contador = 0;
CalendarService.criarEvento = async (tenantId, dados) => {
  contador += 1;
  const googleEventId = `evt-${contador}`;
  chamadas.criados.push({ tenantId, ...dados, googleEventId });
  return { googleEventId, meetLink: `https://meet.google.com/${googleEventId}` };
};
CalendarService.moverEvento = async (tenantId, googleEventId, dados) => {
  chamadas.movidos.push({ tenantId, googleEventId, ...dados });
  return true;
};
CalendarService.removerEvento = async (tenantId, googleEventId) => {
  chamadas.removidos.push({ tenantId, googleEventId });
  return true;
};

// Importado DEPOIS do dublê: o controller guarda a referência do serviço no
// import, então trocar os métodos do objeto (e não o objeto) é o que funciona.
const Appointments = await import("../src/api/controllers/AppointmentController.js");
const { default: AutomationEngine } = await import("../automation_engine.js");

/** req/res mínimos, só o que os controllers usam. */
function fingirResposta() {
  const r = { statusCode: 200, corpo: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.corpo = b; return r; };
  return r;
}
const chamar = async (fn, { tenantId, body, params }) => {
  const res = fingirResposta();
  await fn({ tenantId, body: body || {}, params: params || {} }, res);
  return res;
};

/** Horário em São Paulo, para conferir que o fuso não escorregou. */
const horaEmSP = (d) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date(d));

async function main() {
  const plan = await prisma.plan.create({
    data: { name: `Agenda ${Date.now()}`, priceMonthly: 0, priceYearly: 0, enableCalendar: true, enableAutomations: true },
  });
  const tenant = await prisma.tenant.create({
    data: {
      name: "Negócio Agenda", email: `ag${Date.now()}@teste.local`, planId: plan.id,
      // Conta "conectada": é o que separa este cenário do sem-Google.
      googleRefreshToken: "refresh-de-teste",
    },
  });
  const lead = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Maria Silva", phone: "5571999990000", email: "maria@teste.local" },
  });

  // ── 1. Criado no painel ─────────────────────────────────────
  console.log("\n1. Agendamento criado no painel");
  let res = await chamar(Appointments.createAppointment, {
    tenantId: tenant.id,
    // Exatamente o que o input datetime-local manda: sem fuso.
    body: { title: "Consulta", leadId: lead.id, notes: "primeira vez", date: "2027-03-10T14:00" },
  });
  const criado = res.corpo;
  ok(res.statusCode === 200, `criou (${res.statusCode})`);
  ok(chamadas.criados.length === 1, "chamou o Google");
  ok(!!criado.googleEventId, `e guardou o id do evento (${criado.googleEventId})`);
  ok(!!criado.meetLink, "junto com o link do Meet");
  ok(horaEmSP(criado.date) === "14:00", `gravou 14h no fuso do negócio (${horaEmSP(criado.date)})`);

  const evento = chamadas.criados.at(-1);
  ok(evento.titulo.includes("Maria Silva"), `o evento leva o nome do cliente ("${evento.titulo}")`);
  ok(horaEmSP(evento.inicio) === "14:00", "e o mesmo horário foi mandado ao Google");
  ok(new Date(evento.fim) - new Date(evento.inicio) === 3600000, "com uma hora de duração");

  // ── 2. Remarcado ────────────────────────────────────────────
  console.log("\n2. Remarcado no painel");
  res = await chamar(Appointments.updateAppointment, {
    tenantId: tenant.id, params: { id: criado.id },
    body: { title: "Consulta", date: "2027-03-11T09:00" },
  });
  ok(res.statusCode === 200, `remarcou (${res.statusCode})`);
  ok(chamadas.movidos.length === 1, "moveu o evento no Google");
  ok(chamadas.movidos[0]?.googleEventId === criado.googleEventId, "o mesmo evento, não um novo");
  ok(horaEmSP(res.corpo.date) === "09:00", `no horário certo (${horaEmSP(res.corpo.date)})`);
  ok(horaEmSP(chamadas.movidos[0]?.inicio) === "09:00", "e o Google recebeu esse horário");

  // ── 3. Cancelado ────────────────────────────────────────────
  console.log("\n3. Cancelado no painel");
  res = await chamar(Appointments.updateAppointment, {
    tenantId: tenant.id, params: { id: criado.id }, body: { status: "CANCELLED" },
  });
  ok(res.statusCode === 200, `cancelou (${res.statusCode})`);
  ok(chamadas.removidos.length === 1, "apagou o evento no Google");
  ok(chamadas.removidos[0]?.googleEventId === criado.googleEventId, "o evento certo");
  ok(res.corpo.googleEventId === null, "e limpou o id, que não aponta mais para nada");

  // ── 4. Excluído ─────────────────────────────────────────────
  console.log("\n4. Excluído no painel");
  res = await chamar(Appointments.createAppointment, {
    tenantId: tenant.id, body: { title: "Retorno", leadId: lead.id, date: "2027-03-12T10:00" },
  });
  const paraExcluir = res.corpo;
  // A régua de lembretes é agendada em promessa solta; excluir no mesmo tique
  // faria a gravação dela esbarrar num agendamento que já não existe.
  await new Promise((r) => setTimeout(r, 400));
  const removidosAntes = chamadas.removidos.length;
  res = await chamar(Appointments.deleteAppointment, { tenantId: tenant.id, params: { id: paraExcluir.id } });
  ok(res.statusCode === 200, `excluiu (${res.statusCode})`);
  ok(chamadas.removidos.length === removidosAntes + 1, "apagou o evento no Google também");
  ok(chamadas.removidos.at(-1)?.googleEventId === paraExcluir.googleEventId, "o evento do agendamento excluído");

  // ── 5. Criado por automação ─────────────────────────────────
  console.log("\n5. Agendamento criado por automação");
  const criadosAntes = chamadas.criados.length;
  // Execução real: o nó grava log com FK para ela, então um id inventado
  // rebenta antes de chegar no que este teste quer medir.
  const automacao = await prisma.automation.create({
    data: { tenantId: tenant.id, name: "Agenda auto", trigger: "NEW_LEAD" },
  });
  const execucao = await prisma.automationExecution.create({
    // Nasce fechada: com RUNNING, um engine rodando noutro processo (a API,
    // se estiver de pé) adota a execução e o teste vira loteria.
    data: { automationId: automacao.id, leadId: lead.id, context: '{"variables":{}}', status: "COMPLETED" },
  });
  const saida = await AutomationEngine.executeNode(
    { id: "no-teste", type: "SCHEDULE_APPOINTMENT", data: { config: { title: "Avaliação", date: "2027-03-14T16:00" } } },
    execucao,
    lead,
    tenant
  );
  ok(chamadas.criados.length === criadosAntes + 1, "a automação também chama o Google");
  const apptAuto = await prisma.appointment.findUnique({
    where: { id: saida?.output?.appointmentId || "" },
  }).catch(() => null);
  ok(!!apptAuto?.googleEventId, `e o agendamento nasce com o id do evento (${apptAuto?.googleEventId})`);
  ok(apptAuto && horaEmSP(apptAuto.date) === "16:00", `no fuso do negócio (${apptAuto ? horaEmSP(apptAuto.date) : "—"})`);

  // ── 6. Conta sem Google ─────────────────────────────────────
  console.log("\n6. Conta sem Google conectado");
  const semGoogle = await prisma.tenant.create({
    data: { name: "Sem Google", email: `sg${Date.now()}@teste.local`, planId: plan.id },
  });
  const lead2 = await prisma.lead.create({ data: { tenantId: semGoogle.id, name: "João", phone: "5571988880000" } });
  res = await chamar(Appointments.createAppointment, {
    tenantId: semGoogle.id, body: { title: "Consulta", leadId: lead2.id, date: "2027-03-13T15:00" },
  });
  ok(res.statusCode === 200, `agenda mesmo sem Google (${res.statusCode})`);
  ok(horaEmSP(res.corpo.date) === "15:00", "e no horário certo");

  // ── 7. Remarcar logo depois de criar ────────────────────────
  console.log("\n7. Remarcado antes da régua de lembretes terminar");
  // A régua é montada em promessa solta na criação; remarcar no mesmo instante
  // fazia as duas montagens colidirem na trava (appointmentId, kind) e o
  // usuário recebia 500 num agendamento que já tinha sido alterado.
  res = await chamar(Appointments.createAppointment, {
    tenantId: tenant.id, body: { title: "Rápido", leadId: lead.id, date: "2027-04-01T11:00" },
  });
  const rapido = res.corpo;
  res = await chamar(Appointments.updateAppointment, {
    tenantId: tenant.id, params: { id: rapido.id }, body: { date: "2027-04-01T15:00" },
  });
  ok(res.statusCode === 200, `remarcar em seguida não dá erro (${res.statusCode})`);
  ok(res.corpo?.date && horaEmSP(res.corpo.date) === "15:00", "e o horário novo vale");

  // ── 8. Data inválida ────────────────────────────────────────
  console.log("\n8. Data inválida");
  res = await chamar(Appointments.createAppointment, {
    tenantId: tenant.id, body: { title: "X", leadId: lead.id, date: "banana" },
  });
  ok(res.statusCode === 400, `recusa com 400 em vez de gravar lixo (${res.statusCode})`);

  console.log(falhas === 0 ? "\n✅ Todos os cenários passaram." : `\n❌ ${falhas} falha(s).`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
