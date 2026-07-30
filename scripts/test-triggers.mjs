/**
 * Teste dos gatilhos de fluxo contra um Postgres real.
 *
 *   DATABASE_URL=... node scripts/test-triggers.mjs
 *
 * Cobre o casamento evento → fluxo (palavra, botão, mídia, etapa, tag, fila,
 * canal) e a entrega efetiva pelo motor, sem executar os blocos.
 */
import prisma from "../src/api/config/prisma.js";
import AutomationEngine from "../automation_engine.js";
import { matchesTrigger, TRIGGERS, normalizeTrigger } from "../src/api/services/TriggerCatalog.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

// Em vez de executar o fluxo, só anotamos qual foi acionado.
const acionados = [];
AutomationEngine.enqueueExecution = (auto) => acionados.push(auto.name);

const fluxo = (trigger, config) => ({ trigger, triggerConfig: JSON.stringify(config || {}) });

async function seed() {
  const plan = await prisma.plan.create({
    data: { name: `Gat ${Date.now()}`, priceMonthly: 0, priceYearly: 0, enableAutomations: true },
  });
  const tenant = await prisma.tenant.create({
    data: { name: "Negócio Gatilhos", email: `gat${Date.now()}@teste.local`, planId: plan.id },
  });
  const lead = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Ana", phone: `5571${Math.floor(Math.random() * 1e8)}`, channel: "WHATSAPP" },
  });
  return { tenant, lead };
}

async function main() {
  const { tenant, lead } = await seed();

  // ── 1. Catálogo ─────────────────────────────────────────────
  console.log("\n1. Catálogo de gatilhos");
  ok(TRIGGERS.length >= 20, `${TRIGGERS.length} gatilhos disponíveis`);
  ok(TRIGGERS.every((t) => t.id && t.label && t.categoria), "todos com id, rótulo e categoria");
  ok(normalizeTrigger("NEW_MSG") === "INCOMING_MESSAGE", "nome antigo NEW_MSG continua válido");

  // ── 2. Palavra-chave ────────────────────────────────────────
  console.log("\n2. Palavra-chave");
  const porPalavra = fluxo("KEYWORD", { keywords: ["preço", "orçamento"], match: "word" });
  ok(matchesTrigger(porPalavra, { message: "qual o PREÇO do plano?" }).ok, "casa ignorando acento e caixa");
  ok(!matchesTrigger(porPalavra, { message: "vou apreciar a proposta" }).ok, "não casa dentro de outra palavra");
  const porTrecho = fluxo("KEYWORD", { keywords: ["preç"], match: "contains" });
  ok(matchesTrigger(porTrecho, { message: "precinho bom" }).ok, "modo 'em qualquer parte' casa trecho");
  const exato = fluxo("KEYWORD", { keywords: ["menu"], match: "exact" });
  ok(matchesTrigger(exato, { message: "menu" }).ok, "modo exato casa mensagem inteira");
  ok(!matchesTrigger(exato, { message: "quero o menu" }).ok, "modo exato recusa frase");
  ok(!matchesTrigger(fluxo("KEYWORD", {}), { message: "oi" }).ok, "sem palavra configurada não dispara");

  // ── 3. Botões ───────────────────────────────────────────────
  console.log("\n3. Clique em botão");
  const qualquerBotao = fluxo("BUTTON_CLICK", {});
  ok(matchesTrigger(qualquerBotao, { replyId: "opt_2" }).ok, "sem filtro, qualquer opção serve");
  const soConfirmar = fluxo("BUTTON_CLICK", { buttonIds: ["confirmar"] });
  ok(matchesTrigger(soConfirmar, { replyId: "x", replyTitle: "Confirmar" }).ok, "casa pelo título da opção");
  ok(!matchesTrigger(soConfirmar, { replyId: "cancelar", replyTitle: "Cancelar" }).ok, "opção fora da lista não dispara");

  // ── 4. Mídia, etapa, tag e fila ─────────────────────────────
  console.log("\n4. Demais filtros");
  ok(matchesTrigger(fluxo("MEDIA_RECEIVED", { mediaType: "AUDIO" }), { mediaType: "AUDIO" }).ok, "áudio casa");
  ok(!matchesTrigger(fluxo("MEDIA_RECEIVED", { mediaType: "AUDIO" }), { mediaType: "IMAGE" }).ok, "imagem não casa com filtro de áudio");
  ok(matchesTrigger(fluxo("PIPELINE_MOVE", { stageName: "Agendados" }), { stageName: "Agendados" }).ok, "etapa casa");
  ok(!matchesTrigger(fluxo("PIPELINE_MOVE", { stageName: "Agendados" }), { stageName: "Perdidos" }).ok, "outra etapa não dispara");
  ok(matchesTrigger(fluxo("PIPELINE_MOVE", {}), { stageName: "Qualquer" }).ok, "sem filtro vale qualquer etapa");
  ok(matchesTrigger(fluxo("TAG_ADDED", { tagName: "quente" }), { tagName: "Quente" }).ok, "tag casa sem caixa");
  ok(matchesTrigger(fluxo("HANDOFF_QUEUED", { queueName: "Suporte" }), { queueName: "Suporte N1" }).ok, "fila casa por parte do nome");

  // ── 5. Canal ────────────────────────────────────────────────
  console.log("\n5. Filtro de canal");
  const soInsta = fluxo("INCOMING_MESSAGE", { channel: "INSTAGRAM" });
  ok(matchesTrigger(soInsta, { channel: "INSTAGRAM" }).ok, "Instagram casa");
  ok(!matchesTrigger(soInsta, { channel: "WHATSAPP" }).ok, "WhatsApp não dispara fluxo de Instagram");

  // ── 6. Entrega pelo motor ───────────────────────────────────
  console.log("\n6. Entrega pelo dispatcher");
  await prisma.automation.createMany({
    data: [
      { tenantId: tenant.id, name: "Preço", trigger: "KEYWORD", active: true, triggerConfig: JSON.stringify({ keywords: ["preço"] }) },
      { tenantId: tenant.id, name: "Outra palavra", trigger: "KEYWORD", active: true, triggerConfig: JSON.stringify({ keywords: ["entrega"] }) },
      { tenantId: tenant.id, name: "Toda mensagem", trigger: "INCOMING_MESSAGE", active: true, triggerConfig: "{}" },
      { tenantId: tenant.id, name: "Nome antigo", trigger: "NEW_MSG", active: true, triggerConfig: "{}" },
      { tenantId: tenant.id, name: "Desligado", trigger: "KEYWORD", active: false, triggerConfig: JSON.stringify({ keywords: ["preço"] }) },
    ],
  });

  acionados.length = 0;
  await AutomationEngine.dispatchTrigger("KEYWORD", { lead, tenantId: tenant.id, message: "qual o preço?" });
  ok(acionados.includes("Preço"), "fluxo da palavra certa foi acionado");
  ok(!acionados.includes("Outra palavra"), "fluxo de outra palavra ficou parado");
  ok(!acionados.includes("Desligado"), "fluxo desligado não roda");

  acionados.length = 0;
  await AutomationEngine.dispatchTrigger("INCOMING_MESSAGE", { lead, tenantId: tenant.id, message: "oi" });
  ok(acionados.includes("Toda mensagem"), "gatilho de qualquer mensagem funciona");
  ok(acionados.includes("Nome antigo"), "fluxo salvo com NEW_MSG continua sendo acionado");

  // ── 7. Eventos de agenda e atendimento ──────────────────────
  console.log("\n7. Eventos de agenda e atendimento");
  await prisma.automation.createMany({
    data: [
      { tenantId: tenant.id, name: "Confirmou", trigger: "APPOINTMENT_CONFIRMED", active: true, triggerConfig: "{}" },
      { tenantId: tenant.id, name: "Entrou na fila", trigger: "HANDOFF_QUEUED", active: true, triggerConfig: JSON.stringify({ queueName: "Atendimento" }) },
      { tenantId: tenant.id, name: "Fila de vendas", trigger: "HANDOFF_QUEUED", active: true, triggerConfig: JSON.stringify({ queueName: "Vendas" }) },
    ],
  });

  acionados.length = 0;
  await AutomationEngine.dispatchTrigger("APPOINTMENT_CONFIRMED", { lead, tenantId: tenant.id });
  ok(acionados.includes("Confirmou"), "presença confirmada aciona o fluxo");

  acionados.length = 0;
  await AutomationEngine.dispatchTrigger("HANDOFF_QUEUED", { lead, tenantId: tenant.id, queueName: "Atendimento" });
  ok(acionados.includes("Entrou na fila"), "fila certa aciona");
  ok(!acionados.includes("Fila de vendas"), "fluxo de outra fila não é acionado");

  // ── 8. Fluxo de outro negócio ───────────────────────────────
  console.log("\n8. Isolamento entre negócios");
  const outro = await seed();
  acionados.length = 0;
  await AutomationEngine.dispatchTrigger("INCOMING_MESSAGE", { lead: outro.lead, tenantId: outro.tenant.id, message: "oi" });
  ok(acionados.length === 0, `nenhum fluxo do outro negócio foi acionado (${acionados.length})`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
