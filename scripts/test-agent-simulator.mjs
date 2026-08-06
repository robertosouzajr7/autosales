/**
 * Simulador do agente: testar não pode sujar a conta.
 *
 *   DATABASE_URL=... node scripts/test-agent-simulator.mjs
 *
 * O caminho do webchat cria contato, cria conversa e grava cada mensagem.
 * Para o dono testando o próprio agente isso é lixo: cinco testes virariam
 * cinco contatos no funil. Este teste prende o contrário — a simulação
 * responde e não deixa rastro.
 */
import prisma from "../src/api/config/prisma.js";
import AutomationEngine from "../automation_engine.js";
import * as SdrController from "../src/api/controllers/SdrController.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

function chamar(handler, { tenantId, params = {}, body = {} }) {
  return new Promise((resolve) => {
    let status = 200;
    handler({ tenantId, params, body }, {
      status(c) { status = c; return this; },
      json(payload) { resolve({ status, body: payload }); },
    });
  });
}

async function main() {
  console.log("\n=== Simulador do agente ===\n");

  // A IA de verdade não roda aqui: o que importa é o que o simulador faz
  // ao redor dela — e o contexto que entrega.
  let recebido = null;
  AutomationEngine.callAI = async (custom, lead, ctx) => {
    recebido = { custom, lead, ctx };
    return "Oi! Posso marcar para quinta às 10h?";
  };

  const plan = await prisma.plan.create({ data: { name: `P${Date.now()}`, priceMonthly: 1, priceYearly: 10 } });
  const tenant = await prisma.tenant.create({
    data: { name: "Clínica", email: `s${Date.now()}@teste.local`, planId: plan.id },
  });
  const vizinho = await prisma.tenant.create({
    data: { name: "Vizinha", email: `v${Date.now()}@teste.local`, planId: plan.id },
  });
  const sdr = await prisma.sdrBot.create({
    data: { tenantId: tenant.id, name: "Sofia", knowledgeBase: "Clareamento: R$ 1.400." },
  });

  const antes = {
    leads: await prisma.lead.count({ where: { tenantId: tenant.id } }),
    conversas: await prisma.conversation.count({ where: { tenantId: tenant.id } }),
    mensagens: await prisma.message.count({ where: { tenantId: tenant.id } }),
  };

  console.log("1. Responde");
  let r = await chamar(SdrController.simulateSdr, {
    tenantId: tenant.id, params: { id: sdr.id },
    body: { message: "Quanto custa o clareamento?" },
  });
  ok(r.status === 200, "responde 200");
  ok(/quinta/i.test(r.body.response || ""), "devolve a resposta do agente");

  console.log("\n2. Não deixa rastro");
  const depois = {
    leads: await prisma.lead.count({ where: { tenantId: tenant.id } }),
    conversas: await prisma.conversation.count({ where: { tenantId: tenant.id } }),
    mensagens: await prisma.message.count({ where: { tenantId: tenant.id } }),
  };
  ok(depois.leads === antes.leads, `nenhum contato criado (${depois.leads})`);
  ok(depois.conversas === antes.conversas, `nenhuma conversa criada (${depois.conversas})`);
  ok(depois.mensagens === antes.mensagens, `nenhuma mensagem gravada (${depois.mensagens})`);

  console.log("\n3. Contexto entregue ao motor");
  ok(recebido.ctx?.preloaded?.sdr?.id === sdr.id, "usa o agente que a tela escolheu, não o primeiro ativo");
  ok(recebido.ctx.preloaded.kb === "Clareamento: R$ 1.400.", "leva a base de conhecimento junto");
  ok(recebido.lead.tenantId === tenant.id, "o contato de mentira carrega o tenant certo");

  console.log("\n4. Histórico do navegador vira conversa");
  r = await chamar(SdrController.simulateSdr, {
    tenantId: tenant.id, params: { id: sdr.id },
    body: {
      message: "E parcelado?",
      history: [
        { role: "user", content: "Quanto custa?" },
        { role: "assistant", content: "R$ 1.400 em 3 sessões." },
      ],
    },
  });
  ok(r.status === 200, "aceita histórico");
  const h = recebido.ctx.preloaded.history;
  ok(h.includes("LEAD: Quanto custa?"), "o que o cliente disse entra como LEAD");
  ok(h.includes("SDR: R$ 1.400 em 3 sessões."), "o que o agente disse entra como SDR");
  ok(h.trim().endsWith("LEAD: E parcelado?"), "e a mensagem nova fecha o histórico");

  console.log("\n5. Recusas");
  r = await chamar(SdrController.simulateSdr, {
    tenantId: tenant.id, params: { id: sdr.id }, body: { message: "   " },
  });
  ok(r.status === 400, "mensagem vazia é recusada");

  r = await chamar(SdrController.simulateSdr, {
    tenantId: vizinho.id, params: { id: sdr.id }, body: { message: "oi" },
  });
  ok(r.status === 404, "agente de outra conta não é simulável");

  console.log(falhas === 0 ? "\n✅ Todos os cenários passaram." : `\n❌ ${falhas} falha(s).`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
