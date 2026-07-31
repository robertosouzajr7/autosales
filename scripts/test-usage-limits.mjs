/**
 * Franquia de conversas do plano e medição de consumo.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-usage-limits.mjs
 *
 * Cobre o que o cliente contrata (limite de conversas), o que o sistema
 * conta (conversa nova x continuação, mensagem de serviço, disparo) e o que
 * o SaaS enxerga (custo e margem por conta).
 */
import prisma from "../src/api/config/prisma.js";
import jwt from "jsonwebtoken";
import {
  conversationsHeadroom, registrarConversa, registrarMensagemServico,
  resumoConsumo, reiniciarCiclo, registrarEvento, USAGE_TYPES,
} from "../src/api/services/UsageService.js";
import { touchConversation } from "../src/api/services/ConversationService.js";

const API = process.env.API || "http://127.0.0.1:3000";
const SEGREDO = process.env.JWT_SECRET;

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

const token = (u) => jwt.sign({ userId: u.id, tenantId: u.tenantId, role: u.role }, SEGREDO, { expiresIn: "1h" });
async function chamar(caminho, u, opcoes = {}) {
  const res = await fetch(`${API}/api${caminho}`, {
    ...opcoes,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(u)}`, ...(opcoes.headers || {}) },
  });
  return { status: res.status, corpo: await res.json().catch(() => ({})) };
}

async function seed(maxConversations) {
  const plan = await prisma.plan.create({
    data: {
      name: `Uso ${Date.now()}-${maxConversations}`, priceMonthly: 300, priceYearly: 3000,
      maxConversations, maxCampaignMessages: 500, campaignCategory: "MARKETING", maxTokens: 100000,
    },
  });
  const tenant = await prisma.tenant.create({
    data: { name: "Negócio Uso", email: `uso${Date.now()}${maxConversations}@teste.local`, planId: plan.id },
  });
  const dono = await prisma.user.create({
    data: { name: "Dono", email: `duso${Date.now()}${maxConversations}@teste.local`, password: "x", role: "OWNER", tenantId: tenant.id },
  });
  return { plan, tenant, dono };
}

async function criarConversa(tenantId, nome) {
  const lead = await prisma.lead.create({ data: { tenantId, name: nome, phone: null } });
  const conv = await prisma.conversation.create({ data: { tenantId, leadId: lead.id } });
  return { lead, conv };
}

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");

  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: { usdToBrl: 5.0, waMarkup: 3.0, waRates: JSON.stringify({ MARKETING: 0.06, UTILITY: 0.008, AUTHENTICATION: 0.008, SERVICE: 0 }) },
    create: { id: "singleton", usdToBrl: 5.0, waMarkup: 3.0, waRates: JSON.stringify({ MARKETING: 0.06, UTILITY: 0.008, AUTHENTICATION: 0.008, SERVICE: 0 }) },
  });

  // ── 1. Franquia do plano ────────────────────────────────────
  console.log("\n1. Franquia de conversas");
  const { tenant, dono, plan } = await seed(3);
  let h = await conversationsHeadroom(tenant.id);
  ok(h.max === 3 && h.used === 0 && h.remaining === 3, `plano de 3 conversas, nenhuma usada (${h.used}/${h.max})`);
  ok(h.ilimitado === false, "plano com limite não é ilimitado");

  const semLimite = await seed(0);
  const h0 = await conversationsHeadroom(semLimite.tenant.id);
  ok(h0.ilimitado === true && h0.ok === true, "franquia 0 = sem limite (não bloqueia contas antigas)");

  // ── 2. Conversa nova x continuação ──────────────────────────
  console.log("\n2. O que conta como conversa");
  const a = await criarConversa(tenant.id, "Ana");
  await registrarConversa(tenant.id, { leadId: a.lead.id, conversationId: a.conv.id, janelaEstavaAberta: false });
  let t = await prisma.tenant.findUnique({ where: { id: tenant.id } });
  ok(t.usedConversations === 1, `primeira mensagem abre conversa (${t.usedConversations})`);

  const r = await registrarConversa(tenant.id, { leadId: a.lead.id, conversationId: a.conv.id, janelaEstavaAberta: true });
  t = await prisma.tenant.findUnique({ where: { id: tenant.id } });
  ok(r.nova === false && t.usedConversations === 1, `mensagem dentro da janela NÃO abre outra (${t.usedConversations})`);

  const b = await criarConversa(tenant.id, "Bruno");
  await registrarConversa(tenant.id, { leadId: b.lead.id, conversationId: b.conv.id, janelaEstavaAberta: false });
  t = await prisma.tenant.findUnique({ where: { id: tenant.id } });
  ok(t.usedConversations === 2, `outro contato abre outra conversa (${t.usedConversations})`);

  // A janela que fechou e o cliente voltou a escrever conta de novo — é o
  // que a Meta faz e o que "500 conversas/mês" significa.
  await registrarConversa(tenant.id, { leadId: a.lead.id, conversationId: a.conv.id, janelaEstavaAberta: false });
  t = await prisma.tenant.findUnique({ where: { id: tenant.id } });
  ok(t.usedConversations === 3, `janela fechada e reaberta conta de novo (${t.usedConversations})`);

  h = await conversationsHeadroom(tenant.id);
  ok(h.ok === false && h.remaining === 0, `franquia esgotada (${h.used}/${h.max})`);

  // ── 3. Medição pelo caminho real da mensagem ────────────────
  console.log("\n3. Medição a partir da mensagem que chega");
  const c = await seed(100);
  const conv = await criarConversa(c.tenant.id, "Carla");
  const entrada = await prisma.message.create({
    data: { tenantId: c.tenant.id, conversationId: conv.conv.id, content: "oi", role: "USER" },
  });
  await touchConversation(entrada);
  let tc = await prisma.tenant.findUnique({ where: { id: c.tenant.id } });
  ok(tc.usedConversations === 1, `touchConversation contou a conversa (${tc.usedConversations})`);

  const saida = await prisma.message.create({
    data: { tenantId: c.tenant.id, conversationId: conv.conv.id, content: "olá!", role: "ASSISTANT" },
  });
  await touchConversation(saida);
  tc = await prisma.tenant.findUnique({ where: { id: c.tenant.id } });
  ok(tc.usedServiceMessages === 1, `resposta na janela contou como serviço (${tc.usedServiceMessages})`);
  ok(tc.usedConversations === 1, "e não abriu conversa nova");
  ok(perto(tc.usedCostBrl, 0), `serviço hoje não custa nada (R$ ${tc.usedCostBrl})`);

  // Com tarifa de serviço preenchida, o custo passa a somar sozinho.
  await prisma.platformSettings.update({
    where: { id: "singleton" },
    data: { waRates: JSON.stringify({ MARKETING: 0.06, UTILITY: 0.008, AUTHENTICATION: 0.008, SERVICE: 0.008 }) },
  });
  await registrarMensagemServico(c.tenant.id, 10);
  tc = await prisma.tenant.findUnique({ where: { id: c.tenant.id } });
  ok(perto(tc.usedCostBrl, 0.4), `10 mensagens de serviço a US$0,008 = R$ 0,40 (${tc.usedCostBrl})`);
  ok(tc.usedServiceMessages === 11, `contador acumula (${tc.usedServiceMessages})`);

  // ── 4. Razão de consumo ─────────────────────────────────────
  console.log("\n4. Razão de consumo");
  await registrarEvento(c.tenant.id, {
    type: USAGE_TYPES.CAMPAIGN, category: "MARKETING", quantity: 100,
    costBrl: 30, priceBrl: 90, note: "disparo de teste",
  });
  const eventos = await prisma.usageEvent.findMany({ where: { tenantId: c.tenant.id } });
  ok(eventos.length >= 2, `eventos lançados (${eventos.length})`);
  const campanha = eventos.find((e) => e.type === "CAMPAIGN");
  ok(campanha.costBrl === 30 && campanha.priceBrl === 90, "custo e preço ficam congelados no lançamento");
  tc = await prisma.tenant.findUnique({ where: { id: c.tenant.id } });
  ok(perto(tc.usedCostBrl, 30.4), `custo do ciclo soma tudo (R$ ${tc.usedCostBrl})`);

  // ── 5. Resumo para a tela ───────────────────────────────────
  console.log("\n5. Resumo do consumo");
  const resumo = await resumoConsumo(c.tenant.id);
  ok(resumo.conversas.limite === 100 && resumo.conversas.usado === 1, `conversas ${resumo.conversas.usado}/${resumo.conversas.limite}`);
  ok(resumo.conversas.restante === 99, `restante calculado (${resumo.conversas.restante})`);
  ok(resumo.disparos.limite === 500, "franquia de disparo vem junto");
  ok(perto(resumo.precos.disparo, 0.9), `preço do disparo exposto (${resumo.precos.disparo})`);
  ok(perto(resumo.custoRealBrl, 30.4), `custo real do ciclo (${resumo.custoRealBrl})`);

  // A cota de mensagens foi aposentada: quem limita volume é a conversa.
  ok(resumo.mensagens === undefined, "não existe mais faixa de mensagens");
  ok(typeof resumo.mensagensEnviadas === "number", `mensagens viram contador (${resumo.mensagensEnviadas})`);

  const semLimiteResumo = await resumoConsumo(semLimite.tenant.id);
  ok(semLimiteResumo.conversas.ilimitado === true, "plano sem limite aparece como ilimitado");
  ok(semLimiteResumo.conversas.restante === null, "e sem 'restante' para mostrar");

  // ── 6. Rota da tela ─────────────────────────────────────────
  console.log("\n6. Endpoint de consumo");
  let res = await chamar("/billing/usage", c.dono);
  ok(res.status === 200, `responde (${res.status})`);
  ok(res.corpo.conversas?.limite === 100, "traz a franquia de conversas");
  ok(res.corpo.plano === plan.name || typeof res.corpo.plano === "string", "identifica o plano");
  res = await chamar("/billing/usage/events", c.dono);
  ok(res.status === 200 && Array.isArray(res.corpo), `extrato responde (${res.corpo.length} evento(s))`);

  // ── 7. Virada de ciclo ──────────────────────────────────────
  console.log("\n7. Virada de ciclo");
  await reiniciarCiclo(c.tenant.id);
  tc = await prisma.tenant.findUnique({ where: { id: c.tenant.id } });
  ok(tc.usedConversations === 0 && tc.usedServiceMessages === 0, "contadores zerados");
  ok(tc.usedCostBrl === 0, "custo do ciclo zerado");
  const sobraram = await prisma.usageEvent.count({ where: { tenantId: c.tenant.id } });
  ok(sobraram >= 2, `o histórico do razão NÃO é apagado (${sobraram} evento(s))`);

  // ── 8. O SaaS enxerga custo e margem ────────────────────────
  console.log("\n8. Margem por conta no painel do SaaS");
  const suporte = await prisma.user.create({
    data: { name: "Suporte", email: `suso${Date.now()}@teste.local`, password: "x", role: "SUPERADMIN", tenantId: c.tenant.id },
  });
  await prisma.tenant.update({ where: { id: c.tenant.id }, data: { usedCostBrl: 50 } });
  res = await chamar("/admin/reports", suporte);
  ok(res.status === 200, `relatório responde (${res.status})`);
  const conta = (res.corpo.accountsUsage || []).find((x) => x.id === c.tenant.id);
  ok(!!conta, "a conta aparece no relatório");
  ok(conta.costWhatsappBRL === 50, `custo de WhatsApp medido (${conta.costWhatsappBRL})`);
  ok(conta.priceBRL === 300, `mensalidade do plano (${conta.priceBRL})`);
  ok(conta.marginBRL === Number((300 - conta.costBRL).toFixed(2)), `margem = preço - custo (${conta.marginBRL})`);
  ok(typeof conta.usedConversations === "number", "consumo de conversas vai para o painel");

  // Conta que custa mais do que paga aparece com margem negativa.
  await prisma.tenant.update({ where: { id: c.tenant.id }, data: { usedCostBrl: 400 } });
  res = await chamar("/admin/reports", suporte);
  const cara = (res.corpo.accountsUsage || []).find((x) => x.id === c.tenant.id);
  ok(cara.marginBRL < 0, `conta no prejuízo é sinalizada (${cara.marginBRL})`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
