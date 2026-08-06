/**
 * Números da home do painel.
 *
 *   DATABASE_URL=... node scripts/test-home-stats.mjs
 *
 * A home passou a afirmar coisas que ninguém conseguia conferir de olho:
 * variação contra o período anterior, quanto a IA resolveu sozinha, série
 * diária do gráfico e valores do funil. Cada uma dessas contas tem uma
 * definição — e é a definição que este teste prende.
 */
import prisma from "../src/api/config/prisma.js";
import * as StatsController from "../src/api/controllers/StatsController.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

function chamar(handler, { tenantId, query = {} }) {
  return new Promise((resolve) => {
    let status = 200;
    const res = {
      status(c) { status = c; return this; },
      json(payload) { resolve({ status, body: payload }); },
    };
    handler({ tenantId, query }, res);
  });
}

const DIA = 24 * 60 * 60 * 1000;
const atras = (d) => new Date(Date.now() - d * DIA);

async function main() {
  console.log("\n=== Números da home ===\n");

  const plan = await prisma.plan.create({ data: { name: `P${Date.now()}`, priceMonthly: 1, priceYearly: 10 } });
  const tenant = await prisma.tenant.create({
    data: { name: "Clínica", email: `h${Date.now()}@teste.local`, planId: plan.id },
  });
  const vizinho = await prisma.tenant.create({
    data: { name: "Vizinha", email: `v${Date.now()}@teste.local`, planId: plan.id },
  });

  /** Cria uma conversa com mensagens em um dia específico. */
  async function conversa({ dias, humano = false, tid = tenant.id }) {
    const lead = await prisma.lead.create({ data: { tenantId: tid, name: `L${Math.random()}` } });
    const c = await prisma.conversation.create({
      data: {
        tenantId: tid, leadId: lead.id,
        phase: humano ? "HUMAN" : "BOT",
        handoffReason: humano ? "cliente pediu atendente" : null,
      },
    });
    const quando = atras(dias);
    await prisma.message.create({ data: { conversationId: c.id, tenantId: tid, role: "USER", content: "oi", createdAt: quando } });
    await prisma.message.create({
      data: { conversationId: c.id, tenantId: tid, role: "ASSISTANT", content: "olá", createdAt: new Date(quando.getTime() + 10_000) },
    });
    return c;
  }

  // Período atual (últimos 30 dias): 4 conversas, 1 delas passou por humano.
  await conversa({ dias: 1 });
  await conversa({ dias: 1 });
  await conversa({ dias: 5 });
  await conversa({ dias: 10, humano: true });
  // Período anterior (30–60 dias atrás): 2 conversas.
  await conversa({ dias: 40 });
  await conversa({ dias: 50 });
  // Conta vizinha não pode vazar para a nossa.
  await conversa({ dias: 2, tid: vizinho.id });

  let r = await chamar(StatsController.getHomeStats, { tenantId: tenant.id, query: { days: 30 } });
  console.log("1. Conversas, variação e divisão IA/equipe");
  ok(r.status === 200, "responde 200");
  ok(r.body.conversas.total === 4, `conta as 4 do período (${r.body.conversas.total})`);
  ok(r.body.conversas.delta === 100, `variação contra as 2 anteriores é +100% (${r.body.conversas.delta})`);
  ok(r.body.conversas.equipe === 1, `1 passou para a equipe (${r.body.conversas.equipe})`);
  ok(r.body.conversas.ia === 3, `3 a IA resolveu sozinha (${r.body.conversas.ia})`);

  console.log("\n2. Série do gráfico");
  ok(r.body.conversas.serie.length === 30, `um ponto por dia do período (${r.body.conversas.serie.length})`);
  const soma = r.body.conversas.serie.reduce((s, p) => s + p.total, 0);
  ok(soma === 4, `os pontos somam as conversas do período (${soma})`);
  const ontem = r.body.conversas.serie.find((p) => p.dia === atras(1).toISOString().slice(0, 10));
  ok(ontem?.total === 2, `o dia com 2 conversas aparece com 2 (${ontem?.total})`);
  const vazios = r.body.conversas.serie.filter((p) => p.total === 0).length;
  ok(vazios > 0, `dias sem conversa vêm preenchidos com zero (${vazios} dias)`);
  ok(r.body.conversas.serie.every((p, i, a) => i === 0 || p.dia > a[i - 1].dia), "e a série vem em ordem crescente de data");

  console.log("\n3. Comparecimento");
  const lead = await prisma.lead.create({ data: { tenantId: tenant.id, name: "Ana" } });
  // 3 compareceram, 1 faltou, dentro do período e já vencidos.
  for (const s of ["COMPLETED", "COMPLETED", "COMPLETED", "NOSHOW"]) {
    await prisma.appointment.create({ data: { tenantId: tenant.id, leadId: lead.id, title: "C", date: atras(3), status: s } });
  }
  // Um agendado no futuro não entra na conta: ninguém faltou ainda.
  await prisma.appointment.create({
    data: { tenantId: tenant.id, leadId: lead.id, title: "Futuro", date: new Date(Date.now() + DIA), status: "SCHEDULED" },
  });
  r = await chamar(StatsController.getHomeStats, { tenantId: tenant.id, query: { days: 30 } });
  ok(r.body.comparecimento.taxa === 75, `3 de 4 dá 75% (${r.body.comparecimento.taxa})`);
  ok(r.body.comparecimento.concluidos === 3 && r.body.comparecimento.faltas === 1, "e os dois números crus vêm junto");

  console.log("\n4. Sem base de comparação");
  r = await chamar(StatsController.getHomeStats, { tenantId: vizinho.id, query: { days: 30 } });
  ok(r.body.conversas.delta === null, "variação é nula quando o período anterior está vazio — não 0%, não 100%");
  ok(r.body.comparecimento.taxa === null, "e comparecimento sem compromisso vencido também é nulo");

  console.log("\n5. Funil com valores");
  const etapas = [];
  for (const [i, n] of ["Novos", "Proposta", "Fechado"].entries()) {
    etapas.push(await prisma.pipelineStage.create({ data: { tenantId: tenant.id, name: n, order: i } }));
  }
  await prisma.lead.create({ data: { tenantId: tenant.id, name: "A", stageId: etapas[0].id, value: 1000 } });
  await prisma.lead.create({ data: { tenantId: tenant.id, name: "B", stageId: etapas[1].id, value: 2500 } });
  // Sem valor: entra na contagem, não no dinheiro.
  await prisma.lead.create({ data: { tenantId: tenant.id, name: "C", stageId: etapas[1].id } });
  await prisma.lead.create({ data: { tenantId: tenant.id, name: "D", stageId: etapas[2].id, value: 3000 } });
  await prisma.lead.create({ data: { tenantId: tenant.id, name: "E", stageId: etapas[2].id, value: 1000 } });

  r = await chamar(StatsController.getHomeStats, { tenantId: tenant.id, query: { days: 30 } });
  const f = r.body.funil;
  ok(f.etapas.length === 3, "traz as 3 etapas na ordem do board");
  ok(f.etapas[1].total === 2, `contagem inclui quem não tem valor (${f.etapas[1].total})`);
  ok(f.emNegociacao === 3500, `em negociação soma tudo fora da última etapa (${f.emNegociacao})`);
  ok(f.fechado === 4000, `fechado é a última etapa (${f.fechado})`);
  ok(f.ticketMedio === 2000, `ticket médio é fechado ÷ contatos fechados (${f.ticketMedio})`);

  console.log(falhas === 0 ? "\n✅ Todos os cenários passaram." : `\n❌ ${falhas} falha(s).`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
