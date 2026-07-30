/**
 * Teste do simulador de fluxos contra um Postgres real.
 *
 *   DATABASE_URL=... node scripts/test-flow-simulator.mjs
 *
 * Cobre a execução passo a passo, a pausa em perguntas e botões, o desvio da
 * condição, os avisos de ligação quebrada e a ausência de efeitos colaterais.
 */
import prisma from "../src/api/config/prisma.js";
import FlowSimulator from "../src/api/services/FlowSimulator.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const nodes = [
  { id: "n1", type: "SEND_MSG", data: { label: "Boas-vindas", config: { message: "Olá {{lead.name}}! Tudo bem?" } } },
  { id: "n2", type: "COLLECT_INPUT", data: { label: "Perguntar interesse", config: { prompt: "O que você procura?", variable: "interesse" } } },
  { id: "n3", type: "CONDITION", data: { label: "Quer agendar?", config: { logic: "OR", rules: [{ field: "{{input.interesse}}", operator: "contains", value: "agendar" }] } } },
  { id: "n4", type: "SEND_BUTTONS", data: { label: "Oferecer horários", config: { body: "Qual horário?", buttons: [{ id: "manha", title: "Manhã" }, { id: "tarde", title: "Tarde" }] } } },
  { id: "n5", type: "ADD_TAG", data: { label: "Marcar quente", config: { tag: "quente" } } },
  { id: "n6", type: "SEND_MSG", data: { label: "Nutrir", config: { message: "Sem problema! Te mando material." } } },
  { id: "n7", type: "END", data: { label: "Fim", config: {} } },
];

const edges = [
  { id: "e1", source: "n1", target: "n2" },
  { id: "e2", source: "n2", target: "n3" },
  { id: "e3", source: "n3", target: "n4", sourceHandle: "true" },
  { id: "e4", source: "n3", target: "n6", sourceHandle: "false" },
  { id: "e5", source: "n4", target: "n5", sourceHandle: "manha" },
  { id: "e6", source: "n5", target: "n7" },
];

async function seed() {
  const plan = await prisma.plan.create({
    data: { name: `Sim ${Date.now()}`, priceMonthly: 0, priceYearly: 0, enableAutomations: true },
  });
  const tenant = await prisma.tenant.create({
    data: { name: "Negócio Simulado", email: `sim${Date.now()}@teste.local`, planId: plan.id },
  });
  const automation = await prisma.automation.create({
    data: {
      tenantId: tenant.id, name: "Fluxo de teste", trigger: "NEW_LEAD",
      nodes: JSON.stringify(nodes), edges: JSON.stringify(edges),
    },
  });
  return { tenant, automation };
}

async function main() {
  const { tenant, automation } = await seed();

  // ── 1. Início ───────────────────────────────────────────────
  console.log("\n1. Início da simulação");
  let estado = await FlowSimulator.start(tenant.id, automation.id);
  ok(estado.status === "WAITING", `para na pergunta (${estado.status})`);
  ok(estado.mensagens.length === 2, `2 mensagens enviadas (${estado.mensagens.length})`);
  ok(/Olá Maria Silva/.test(estado.mensagens[0].texto), `variável resolvida: "${estado.mensagens[0].texto}"`);
  ok(estado.esperando?.variable === "interesse", `esperando input.${estado.esperando?.variable}`);
  ok(estado.caminho.includes("n1") && estado.caminho.includes("n2"), "trilha marca os blocos executados");

  // ── 2. Resposta que leva pelo ramo verdadeiro ───────────────
  console.log("\n2. Cliente responde 'quero agendar'");
  estado = await FlowSimulator.send(estado.sessionId, "quero agendar uma consulta");
  ok(estado.variaveis.input.interesse === "quero agendar uma consulta", "resposta guardada na variável");
  const cond = estado.trilha.find((t) => t.nodeType === "CONDITION");
  ok(cond?.saida === "true", `condição escolheu o ramo ${cond?.saida}`);
  ok(/✓/.test(cond?.detalhe || ""), `console explica a regra: "${cond?.detalhe}"`);
  ok(estado.status === "WAITING", `para nos botões (${estado.status})`);
  const comBotoes = estado.mensagens.at(-1);
  ok((comBotoes.opcoes || []).length === 2, `2 opções oferecidas (${comBotoes.opcoes?.length})`);

  // ── 3. Clique no botão escolhe o ramo ───────────────────────
  console.log("\n3. Cliente clica em 'Manhã'");
  estado = await FlowSimulator.send(estado.sessionId, "Manhã", "manha");
  ok(estado.status === "FINISHED", `fluxo chega ao fim (${estado.status})`);
  const tag = estado.trilha.find((t) => t.nodeType === "ADD_TAG");
  ok(/Adicionaria a tag "quente"/.test(tag?.detalhe || ""), `ação simulada descrita: "${tag?.detalhe}"`);
  ok(estado.caminho.includes("n5") && estado.caminho.includes("n7"), "seguiu pelo ramo do botão até o fim");

  // ── 4. Nada foi gravado de verdade ──────────────────────────
  console.log("\n4. Sem efeitos colaterais");
  const tags = await prisma.tag.count({ where: { name: "quente" } });
  const leads = await prisma.lead.count({ where: { tenantId: tenant.id } });
  ok(leads === 0, `nenhum lead criado (${leads})`);
  ok(tags === 0, `nenhuma tag criada (${tags})`);

  // ── 5. Caminho falso ────────────────────────────────────────
  console.log("\n5. Resposta que segue pelo ramo falso");
  let e2 = await FlowSimulator.start(tenant.id, automation.id);
  e2 = await FlowSimulator.send(e2.sessionId, "só queria uma informação");
  ok(e2.status === "FINISHED", `termina no ramo falso (${e2.status})`);
  ok(/Te mando material/.test(e2.mensagens.at(-1)?.texto || ""), "mensagem do ramo falso enviada");

  // ── 6. Ligação faltando é denunciada ────────────────────────
  console.log("\n6. Bloco sem saída");
  const solto = await prisma.automation.create({
    data: {
      tenantId: tenant.id, name: "Sem saída", trigger: "NEW_LEAD",
      nodes: JSON.stringify([
        { id: "a", type: "COLLECT_INPUT", data: { label: "Pergunta", config: { prompt: "Oi?", variable: "x" } } },
      ]),
      edges: JSON.stringify([]),
    },
  });
  let e3 = await FlowSimulator.start(tenant.id, solto.id);
  e3 = await FlowSimulator.send(e3.sessionId, "resposta");
  const aviso = e3.trilha.find((t) => t.nivel === "aviso");
  ok(!!aviso, "avisa que o caminho acabou");
  ok(/não tem ligação de saída/.test(aviso?.detalhe || ""), `explica o problema: "${aviso?.detalhe}"`);

  // ── 7. Ligação apontando para bloco inexistente ─────────────
  console.log("\n7. Ligação quebrada");
  const quebrado = await prisma.automation.create({
    data: {
      tenantId: tenant.id, name: "Quebrado", trigger: "NEW_LEAD",
      nodes: JSON.stringify([{ id: "a", type: "SEND_MSG", data: { label: "Oi", config: { message: "Oi" } } }]),
      edges: JSON.stringify([{ id: "x", source: "a", target: "fantasma" }]),
    },
  });
  const e4 = await FlowSimulator.start(tenant.id, quebrado.id);
  const erro = e4.trilha.find((t) => t.nivel === "erro");
  ok(!!erro, "erro registrado na trilha");
  ok(/não está no fluxo/.test(erro?.detalhe || ""), `aponta o bloco fantasma: "${erro?.detalhe}"`);

  // ── 8. Ciclo infinito é interrompido ────────────────────────
  console.log("\n8. Ciclo no fluxo");
  const ciclo = await prisma.automation.create({
    data: {
      tenantId: tenant.id, name: "Ciclo", trigger: "NEW_LEAD",
      nodes: JSON.stringify([
        { id: "a", type: "SEND_MSG", data: { label: "A", config: { message: "a" } } },
        { id: "b", type: "SEND_MSG", data: { label: "B", config: { message: "b" } } },
      ]),
      edges: JSON.stringify([
        { id: "1", source: "a", target: "b" },
        { id: "2", source: "b", target: "a" },
      ]),
    },
  });
  const e5 = await FlowSimulator.start(tenant.id, ciclo.id);
  ok(e5.status === "ERROR", `simulação para com erro (${e5.status})`);
  ok(/ciclo/i.test(e5.trilha.at(-1)?.detalhe || ""), "explica que há um ciclo");

  // ── 9. Sessão encerrada ─────────────────────────────────────
  console.log("\n9. Encerramento da sessão");
  FlowSimulator.stop(e5.sessionId);
  ok(FlowSimulator.get(e5.sessionId) === null, "sessão removida da memória");

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
