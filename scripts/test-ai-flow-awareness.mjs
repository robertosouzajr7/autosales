/**
 * Convivência entre o agente de IA e os fluxos, contra um Postgres real.
 *
 *   DATABASE_URL=... node scripts/test-ai-flow-awareness.mjs
 *
 * Cobre: fluxo iniciado pela mensagem cala a IA; fluxo em execução faz a IA
 * esperar; execução travada não segura a conversa para sempre; e o contexto
 * que a IA recebe descreve o que a automação está fazendo.
 */
import prisma from "../src/api/config/prisma.js";
import AutomationEngine from "../automation_engine.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

// Não queremos executar os blocos: só saber quem foi acionado.
const enfileirados = [];
AutomationEngine.enqueueExecution = (auto) => enfileirados.push(auto.name);

async function seed() {
  const plan = await prisma.plan.create({
    data: { name: `IA ${Date.now()}`, priceMonthly: 0, priceYearly: 0, enableAutomations: true },
  });
  const tenant = await prisma.tenant.create({
    data: { name: "Negócio IA", email: `ia${Date.now()}@teste.local`, planId: plan.id },
  });
  const lead = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Carla", phone: `5571${Math.floor(Math.random() * 1e8)}`, channel: "WHATSAPP" },
  });
  await prisma.conversation.create({ data: { leadId: lead.id, tenantId: tenant.id, botActive: true } });
  return { tenant, lead };
}

async function main() {
  const { tenant, lead } = await seed();

  // ── 1. Fluxo iniciado pela mensagem cala a IA ───────────────
  console.log("\n1. Mensagem que dispara um fluxo");
  const comPausa = await prisma.automation.create({
    data: {
      tenantId: tenant.id, name: "Orçamento", trigger: "KEYWORD", active: true,
      triggerConfig: JSON.stringify({ keywords: ["orçamento"] }), // aiDuring ausente = pausa (padrão)
      nodes: "[]", edges: "[]",
    },
  });

  enfileirados.length = 0;
  const calou = await AutomationEngine.handleIncoming(lead.phone, "quero um orçamento", tenant.id, { lead });
  ok(calou === true, "a IA fica em silêncio quando o fluxo assume");
  ok(enfileirados.includes("Orçamento"), "o fluxo foi acionado");

  // ── 2. Fluxo que aceita conviver com a IA ───────────────────
  console.log("\n2. Fluxo configurado para deixar a IA responder");
  await prisma.automation.update({
    where: { id: comPausa.id },
    data: { triggerConfig: JSON.stringify({ keywords: ["orçamento"], aiDuring: "allow" }) },
  });
  enfileirados.length = 0;
  const seguiu = await AutomationEngine.handleIncoming(lead.phone, "quero um orçamento", tenant.id, { lead });
  ok(seguiu === false, "a IA continua respondendo quando o fluxo permite");
  ok(enfileirados.includes("Orçamento"), "o fluxo roda mesmo assim");

  // ── 3. Fluxo em execução faz a IA esperar ───────────────────
  console.log("\n3. Fluxo já em execução");
  const emCurso = await prisma.automation.create({
    data: { tenantId: tenant.id, name: "Boas-vindas", trigger: "NEW_LEAD", active: true, triggerConfig: "{}", nodes: "[]", edges: "[]" },
  });
  const exec = await prisma.automationExecution.create({
    data: { automationId: emCurso.id, leadId: lead.id, status: "RUNNING" },
  });

  let estado = await AutomationEngine.flowState(lead.id);
  ok(estado.executando.length === 1, `1 fluxo em execução (${estado.executando.length})`);
  ok(AutomationEngine.pausaIA(emCurso) === true, "por padrão o fluxo pausa a IA");

  // ── 4. Execução travada não segura para sempre ──────────────
  console.log("\n4. Execução travada (processo reiniciou)");
  await prisma.automationExecution.update({
    where: { id: exec.id },
    data: { startedAt: new Date(Date.now() - 30 * 60 * 1000) },
  });
  estado = await AutomationEngine.flowState(lead.id);
  ok(estado.executando.length === 0, `execução antiga deixa de segurar a IA (${estado.executando.length})`);

  // ── 5. Contexto que a IA recebe ─────────────────────────────
  console.log("\n5. Contexto entregue ao agente");
  await prisma.automationExecution.update({
    where: { id: exec.id },
    data: { status: "WAITING_INPUT", inputVariable: "interesse", startedAt: new Date() },
  });
  const espera = await prisma.automation.create({
    data: { tenantId: tenant.id, name: "Follow-up", trigger: "INACTIVITY", active: true, triggerConfig: "{}", nodes: "[]", edges: "[]" },
  });
  await prisma.automationExecution.create({
    data: {
      automationId: espera.id, leadId: lead.id, status: "WAITING_DELAY",
      resumeAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });

  const texto = await AutomationEngine.buildFlowContext(lead);
  ok(/AUTOMAÇÕES EM ANDAMENTO/.test(texto), "o prompt ganha a seção de automações");
  ok(/Boas-vindas/.test(texto) && /interesse/.test(texto), "descreve o fluxo que espera resposta e a variável");
  ok(/Follow-up/.test(texto) && /volta a agir/.test(texto), "descreve o fluxo pausado e quando ele volta");
  ok(/não repita/i.test(texto), "instrui a não repetir o que a automação enviou");
  console.log(`     contexto:\n${texto.split("\n").map((l) => "       " + l).join("\n")}`);

  // ── 6. Fluxo recém-concluído aparece para a retomada ────────
  console.log("\n6. Fluxo que acabou de terminar");
  await prisma.automationExecution.updateMany({
    where: { leadId: lead.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  const depois = await AutomationEngine.buildFlowContext(lead);
  ok(/terminou há pouco/.test(depois), "a IA sabe que a automação acabou de falar");
  ok(/retome a conversa/i.test(depois), "orienta a retomar de onde parou");

  // ── 7. Sem fluxo nenhum, sem ruído no prompt ────────────────
  console.log("\n7. Conversa sem automação");
  await prisma.automationExecution.updateMany({
    where: { leadId: lead.id },
    data: { completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  });
  const limpo = await AutomationEngine.buildFlowContext(lead);
  ok(limpo === "", "nenhuma seção extra quando não há nada acontecendo");

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
