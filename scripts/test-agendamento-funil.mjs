/**
 * Teste do agendamento de ponta a ponta: e-mail, convite e funil.
 *
 *   DATABASE_URL=... node scripts/test-agendamento-funil.mjs
 *
 * Cobre os três buracos que faziam "agendei e o lead não moveu":
 *  - o nó SCHEDULE_APPOINTMENT dos fluxos gravava a linha e ia embora;
 *  - apelidos de etapa com espaço nunca casavam com nada;
 *  - funil sem etapa compatível deixava o lead parado, em silêncio.
 * E a exigência nova: e-mail antes de agendar, com convite no e-mail.
 */
import prisma from "../src/api/config/prisma.js";
import CalendarService from "../calendar_service.js";
import PipelineAutomation from "../src/api/services/PipelineAutomation.js";
import EmailService from "../src/api/services/EmailService.js";
import engine from "../automation_engine.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

// O Google não é chamado no teste: aqui interessa o que fica no banco.
CalendarService.criarEvento = async () => ({ googleEventId: null, meetLink: null });
CalendarService.getBusyIntervals = async () => [];

const convites = [];
EmailService.sendAppointmentInvite = async (dados) => {
  convites.push(dados);
  return { simulated: true };
};

const marca = Date.now();
let n = 0;
const fone = () => `55119${String(marca).slice(-6)}${String(++n).padStart(2, "0")}`;

async function criarTenant(nome, etapas) {
  const t = await prisma.tenant.create({
    data: { name: nome, email: `agenda-${marca}-${nome}@teste.local`, businessType: "CLINICA" },
  });
  for (const [i, e] of etapas.entries()) {
    await prisma.pipelineStage.create({ data: { tenantId: t.id, name: e, order: i } });
  }
  return t;
}

async function criarLead(tenant, extras = {}) {
  return prisma.lead.create({
    data: { tenantId: tenant.id, name: "Cliente Teste", phone: fone(), channel: "WHATSAPP", ...extras },
  });
}

const amanha = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(14, 0, 0, 0);
  return d;
};

async function main() {
  console.log("\n1. Funil sem etapa de agendamento");
  {
    const t = await criarTenant("So Novos", ["Novos"]);
    const lead = await criarLead(t, { email: "cliente@teste.local" });
    await CalendarService.createAppointment(t.id, lead, amanha().toISOString(), "Consulta");

    const etapas = await prisma.pipelineStage.findMany({ where: { tenantId: t.id }, orderBy: { order: "asc" } });
    ok(etapas.some((e) => e.name === "Agendado"), 'a etapa "Agendado" passa a existir');

    const depois = await prisma.lead.findUnique({ where: { id: lead.id } });
    const agendado = etapas.find((e) => e.name === "Agendado");
    ok(depois.stageId === agendado?.id, "o lead foi para ela");
    ok(depois.status === "SCHEDULED", "e o status virou SCHEDULED");
    ok(etapas.length === 2 && etapas[1].name === "Agendado", "a etapa nova entra no fim do funil");
  }

  console.log("\n2. Funil sem etapa nenhuma");
  {
    const t = await criarTenant("Funil Vazio", []);
    const lead = await criarLead(t);
    await PipelineAutomation.onEvent(t.id, lead.id, "APPOINTMENT_CREATED");
    const depois = await prisma.lead.findUnique({ where: { id: lead.id }, include: { stage: true } });
    ok(depois.stage?.name === "Agendado", "cria a etapa mesmo partindo do zero");
  }

  console.log('\n3. Apelido com espaço ("Reunião marcada")');
  {
    const t = await criarTenant("Reuniao", ["Novos", "Reunião marcada"]);
    const lead = await criarLead(t);
    await PipelineAutomation.onEvent(t.id, lead.id, "APPOINTMENT_CREATED");
    const depois = await prisma.lead.findUnique({ where: { id: lead.id }, include: { stage: true } });
    ok(depois.stage?.name === "Reunião marcada", "casa com a etapa existente");
    const etapas = await prisma.pipelineStage.count({ where: { tenantId: t.id } });
    ok(etapas === 2, "e não inventa uma etapa nova por cima");
  }

  console.log('\n4. Apelido com espaço ("No show")');
  {
    const t = await criarTenant("NoShow", ["Novos", "No show"]);
    const lead = await criarLead(t);
    await PipelineAutomation.onEvent(t.id, lead.id, "APPOINTMENT_NOSHOW");
    const depois = await prisma.lead.findUnique({ where: { id: lead.id }, include: { stage: true } });
    ok(depois.stage?.name === "No show", "casa com a etapa existente");
  }

  console.log("\n5. Etapa mapeada pelo dono tem prioridade");
  {
    const t = await criarTenant("Mapeado", ["Novos", "Agendado", "Minha etapa"]);
    const minha = await prisma.pipelineStage.findFirst({ where: { tenantId: t.id, name: "Minha etapa" } });
    await prisma.automationConfig.create({
      data: { tenantId: t.id, stageMap: JSON.stringify({ APPOINTMENT_CREATED: minha.id }) },
    });
    const lead = await criarLead(t);
    await PipelineAutomation.onEvent(t.id, lead.id, "APPOINTMENT_CREATED");
    const depois = await prisma.lead.findUnique({ where: { id: lead.id }, include: { stage: true } });
    ok(depois.stage?.name === "Minha etapa", 'o mapa do dono ganha de "Agendado"');
  }

  console.log("\n6. Convite por e-mail");
  {
    convites.length = 0;
    const t = await criarTenant("Convite", ["Novos"]);
    const lead = await criarLead(t, { email: "convidado@teste.local", name: "Marina Costa" });
    await CalendarService.createAppointment(t.id, lead, amanha().toISOString(), "Avaliação");
    ok(convites.length === 1, "o convite sai para o e-mail do cliente");
    ok(convites[0]?.to === "convidado@teste.local", "para o endereço certo");
    ok(convites[0]?.negocio === "Convite", "com o nome do negócio");
    ok(convites[0]?.fim > convites[0]?.inicio, "com início e fim coerentes");
  }

  console.log("\n7. Sem e-mail no cadastro, nenhum convite é tentado");
  {
    convites.length = 0;
    const t = await criarTenant("Sem Email", ["Novos"]);
    const lead = await criarLead(t);
    await CalendarService.createAppointment(t.id, lead, amanha().toISOString(), "Consulta");
    ok(convites.length === 0, "não tenta enviar para endereço nenhum");
    const depois = await prisma.lead.findUnique({ where: { id: lead.id }, include: { stage: true } });
    ok(depois.stage?.name === "Agendado", "mas o agendamento acontece e o lead move");
  }

  console.log("\n8. O agente exige e-mail antes de agendar");
  {
    const t = await criarTenant("Agente", ["Novos"]);
    const lead = await criarLead(t);
    const antes = await prisma.appointment.count({ where: { tenantId: t.id } });

    const r = await engine._executeTool(
      "create_appointment",
      { title: "Consulta", iso_date: amanha().toISOString() },
      lead
    );
    ok(r.success === false && r.need_email === true, "recusa e pede o e-mail");
    ok(await prisma.appointment.count({ where: { tenantId: t.id } }) === antes, "e não cria o compromisso");

    const r2 = await engine._executeTool(
      "create_appointment",
      { title: "Consulta", iso_date: amanha().toISOString(), email: "dado.depois@teste.local" },
      lead
    );
    ok(r2.success === true, "com o e-mail, agenda");
    const salvo = await prisma.lead.findUnique({ where: { id: lead.id } });
    ok(salvo.email === "dado.depois@teste.local", "e o e-mail fica no cadastro");
  }

  console.log("\n9. Nó SCHEDULE_APPOINTMENT dos fluxos");
  {
    const t = await criarTenant("Fluxo", ["Novos"]);
    const lead = await criarLead(t);
    const quando = amanha();

    // Execução real: o motor grava um log por passo, e o log referencia a
    // execução. Sem ela o teste morreria numa validação do Prisma, não no
    // comportamento que interessa.
    const automacao = await prisma.automation.create({
      data: { tenantId: t.id, name: "Fluxo de teste", trigger: "NEW_LEAD", nodes: "[]", edges: "[]" },
    });
    const execucao = await prisma.automationExecution.create({
      data: { automationId: automacao.id, leadId: lead.id, context: JSON.stringify({ variables: {} }) },
    });

    const resultado = await engine.executeNode(
      { id: "no-1", type: "SCHEDULE_APPOINTMENT", data: { config: { title: "Retorno", date: quando.toISOString() } } },
      execucao,
      lead
    );

    ok(resultado?.output?.appointmentId, "o compromisso é criado");
    const depois = await prisma.lead.findUnique({ where: { id: lead.id }, include: { stage: true } });
    ok(depois.stage?.name === "Agendado", "e agora o lead move no funil");
    const lembretes = await prisma.appointmentReminder.count({
      where: { appointmentId: resultado.output.appointmentId },
    });
    ok(lembretes > 0, "e a régua de lembretes é programada");
  }

  console.log("\n10. Formato do arquivo .ics");
  {
    const ics = EmailService.montarIcs({
      uid: "compromisso-123",
      titulo: "Consulta de avaliação",
      inicio: amanha(),
      fim: new Date(amanha().getTime() + 3600000),
      link: "https://meet.google.com/abc-defg-hij",
      organizadorNome: "Clínica; Vida, Plena",
      organizadorEmail: "contato@clinica.local",
      convidadoNome: "Marina Costa",
      convidadoEmail: "cliente@teste.local",
    });
    ok(ics.startsWith("BEGIN:VCALENDAR") && ics.endsWith("END:VCALENDAR"), "o .ics é gerado inteiro");
    ok(ics.includes("\r\n"), "com quebra de linha CRLF, como o formato exige");
    ok(/DTSTART:\d{8}T\d{6}Z/.test(ics), "com data em UTC no formato do iCalendar");
    ok(ics.includes("UID:compromisso-123@agentesvirtuais"), "com o identificador do compromisso");
    ok(ics.includes("CN=Clínica\\; Vida\\, Plena"), "e com vírgula e ponto-e-vírgula escapados");
    ok(ics.includes("LOCATION:https://meet.google.com/abc-defg-hij"), "com o link da reunião no lugar");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
