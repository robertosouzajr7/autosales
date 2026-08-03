/**
 * Precificação de disparo: custo da Meta, margem do SaaS e o reflexo disso
 * no plano e no módulo de disparo em massa.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-dispatch-pricing.mjs
 */
import prisma from "../src/api/config/prisma.js";
import jwt from "jsonwebtoken";
import {
  resolvePricing, unitPricing, planCampaignCost, estimateCampaign,
} from "../src/api/services/WhatsAppPricingService.js";
import {
  saldoDisparo, podeDisparar, custoEstimado, debitar, devolver, creditar,
} from "../src/api/services/CampaignCreditService.js";

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

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");

  // Configuração da plataforma: tarifas + margem, como o admin define.
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: {
      usdToBrl: 5.0,
      waMarkup: 3.0,
      waRates: JSON.stringify({ MARKETING: 0.06, UTILITY: 0.008, AUTHENTICATION: 0.008 }),
    },
    create: {
      id: "singleton", usdToBrl: 5.0, waMarkup: 3.0,
      waRates: JSON.stringify({ MARKETING: 0.06, UTILITY: 0.008, AUTHENTICATION: 0.008 }),
    },
  });

  // ── 1. Tarifa e margem ──────────────────────────────────────
  console.log("\n1. Custo da Meta e margem do SaaS");
  const p = await resolvePricing();
  ok(p.rates.MARKETING === 0.06, `tarifa de marketing veio da configuração (${p.rates.MARKETING})`);
  ok(p.usdToBrl === 5.0 && p.markup === 3.0, `câmbio ${p.usdToBrl} e margem ${p.markup}x em uso`);

  const { categorias } = await unitPricing();
  ok(perto(categorias.MARKETING.unitCostBrl, 0.3), `custo por disparo marketing = R$ 0,30 (${categorias.MARKETING.unitCostBrl})`);
  ok(perto(categorias.MARKETING.unitPriceBrl, 0.9), `preço com margem 3x = R$ 0,90 (${categorias.MARKETING.unitPriceBrl})`);
  ok(
    categorias.UTILITY.unitCostBrl < categorias.MARKETING.unitCostBrl,
    "utilidade continua mais barata que marketing"
  );

  // ── 2. Custo do crédito que o plano dá ──────────────────────
  console.log("\n2. Crédito do plano custeado");
  // Crédito é preço de VENDA; o custo é ele dividido pela margem. Não depende
  // mais da categoria, porque cada mensagem é debitada pela tarifa dela.
  const franquia = await planCampaignCost(900);
  ok(perto(franquia.custoBrl, 300), `R$ 900 de crédito custam R$ 300 com margem 3x (${franquia.custoBrl})`);
  ok(perto(franquia.precoSugeridoBrl, 900), "e o preço sugerido é o próprio crédito");
  const semDisparo = await planCampaignCost(0);
  ok(semDisparo.custoBrl === 0, "plano sem crédito não tem custo de disparo");

  // ── 3. Projeção de um disparo ───────────────────────────────
  console.log("\n3. Projeção de um disparo");
  const est = await estimateCampaign(250, "MARKETING");
  ok(perto(est.costBrl, 75), `250 destinatários custam R$ 75 (${est.costBrl})`);
  ok(perto(est.priceBrl, 225), `e o cliente paga R$ 225 (${est.priceBrl})`);
  ok(perto(est.priceBrl / est.costBrl, 3), "a razão preço/custo é exatamente a margem configurada");

  // ── 4. Crédito de disparo no plano ──────────────────────────
  console.log("\n4. O plano dá crédito, não quantidade");
  const plano = await prisma.plan.create({
    data: {
      name: `Disparo ${Date.now()}`, priceMonthly: 500, priceYearly: 5000,
      campaignCreditsBrl: 90, maxTokens: 100000,
    },
  });
  const tenant = await prisma.tenant.create({
    data: { name: "Negócio Disparo", email: `disp${Date.now()}@teste.local`, planId: plano.id },
  });
  const dono = await prisma.user.create({
    data: { name: "Dono", email: `ddisp${Date.now()}@teste.local`, password: "x", role: "OWNER", tenantId: tenant.id },
  });

  // Tarifas do teste: marketing R$ 0,90 e utilidade R$ 0,12 por mensagem.
  const saldo0 = await saldoDisparo(tenant.id);
  ok(perto(saldo0.total, 90), `crédito do plano vira saldo (R$ ${saldo0.total})`);
  ok(saldo0.equivale.MARKETING === 100, `saldo vale 100 mensagens de marketing (${saldo0.equivale.MARKETING})`);
  ok(
    saldo0.equivale.UTILITY > saldo0.equivale.MARKETING,
    `e muito mais de utilidade (${saldo0.equivale.UTILITY}) — é o ponto do modelo`
  );

  // A MESMA franquia serve às três categorias: é o que a quantidade não fazia.
  const mkt = await podeDisparar(tenant.id, 50, "MARKETING");
  ok(mkt.allowed === true, `50 de marketing cabem (custa R$ ${mkt.custo.total})`);
  const util = await podeDisparar(tenant.id, 50, "UTILITY");
  ok(util.custo.total < mkt.custo.total, `as mesmas 50 de utilidade custam menos (R$ ${util.custo.total})`);

  const demais = await podeDisparar(tenant.id, 200, "MARKETING");
  ok(demais.allowed === false, "acima do saldo o disparo é barrado");
  ok(/insuficiente/i.test(demais.reason || ""), `e o motivo é claro: "${demais.reason?.slice(0, 60)}…"`);

  // Débito, devolução e recarga.
  await debitar(tenant.id, mkt.custo.total);
  let s1 = await saldoDisparo(tenant.id);
  ok(perto(s1.saldo, 45), `depois de gastar R$ 45 sobra R$ 45 (${s1.saldo})`);
  ok(s1.baixo === false, "metade do saldo ainda não é alerta");

  await debitar(tenant.id, 27);
  s1 = await saldoDisparo(tenant.id);
  ok(s1.baixo === true, `abaixo de 20% o alerta liga (restam R$ ${s1.saldo})`);

  await devolver(tenant.id, 27);
  s1 = await saldoDisparo(tenant.id);
  ok(perto(s1.saldo, 45) && s1.baixo === false, "devolução restaura o saldo e desliga o alerta");

  await creditar(tenant.id, 30);
  s1 = await saldoDisparo(tenant.id);
  ok(perto(s1.recarga, 30) && perto(s1.total, 120), `recarga soma ao total (R$ ${s1.total})`);

  // Devolver mais do que se gastou não pode gerar crédito do nada.
  await devolver(tenant.id, 99999);
  const s2 = await saldoDisparo(tenant.id);
  ok(perto(s2.usado, 45), `devolução acima do gasto é ignorada (usado R$ ${s2.usado})`);

  // O custo do crédito para o SaaS é o crédito dividido pela margem.
  const custoFranquia = (await planCampaignCost(plano.campaignCreditsBrl)).custoBrl;
  ok(perto(custoFranquia, 30), `custo do crédito = R$ 90 ÷ margem 3 (R$ ${custoFranquia})`);
  ok(custoFranquia < plano.priceMonthly, `e cabe no preço do plano (R$ ${custoFranquia} < R$ ${plano.priceMonthly})`);

  // ── 5. Admin enxerga tudo que precisa para precificar ───────
  console.log("\n5. Painel do SaaS");
  const suporte = await prisma.user.create({
    data: { name: "Suporte", email: `sdisp${Date.now()}@teste.local`, password: "x", role: "SUPERADMIN", tenantId: tenant.id },
  });
  let r = await chamar("/admin/token-pricing", suporte);
  ok(r.status === 200, `precificação responde (${r.status})`);
  ok(r.corpo.waMarkup === 3, `margem de disparo exposta para a tela (${r.corpo.waMarkup})`);
  ok(perto(r.corpo.waUnit?.MARKETING?.unitCostBrl, 0.3), "custo unitário por categoria vem junto");
  ok(perto(r.corpo.waUnit?.MARKETING?.unitPriceBrl, 0.9), "e o preço já com margem");
  ok(r.corpo.activeModelCostBRLPer1M > 0, "custo de IA continua vindo na mesma chamada");

  // Margem alterada no admin muda o preço na hora.
  r = await chamar("/admin/platform-settings", suporte, {
    method: "PUT", body: JSON.stringify({ waMarkup: 5 }),
  });
  ok(r.status === 200, `margem atualizada pelo admin (${r.status})`);
  const depois = await unitPricing();
  ok(perto(depois.categorias.MARKETING.unitPriceBrl, 1.5), `preço acompanha na hora (${depois.categorias.MARKETING.unitPriceBrl})`);

  r = await chamar("/admin/platform-settings", suporte, {
    method: "PUT", body: JSON.stringify({ waMarkup: 0.5 }),
  });
  const naoBaixou = await resolvePricing();
  ok(naoBaixou.markup === 5, `margem abaixo de 1x é recusada (segue ${naoBaixou.markup}x)`);

  // Tarifa da Meta reajustada pelo admin, sem deploy.
  r = await chamar("/admin/platform-settings", suporte, {
    method: "PUT", body: JSON.stringify({ waRates: { MARKETING: 0.08 } }),
  });
  const nova = await resolvePricing();
  ok(nova.rates.MARKETING === 0.08, `tarifa nova em uso (${nova.rates.MARKETING})`);
  ok(nova.rates.UTILITY === 0.008, "as outras categorias não foram apagadas");

  // ── 6. Crédito editável pelo painel ────────────────────────
  console.log("\n6. Crédito pelo painel do SaaS");
  r = await chamar(`/admin/plans/${plano.id}`, suporte, {
    method: "PUT", body: JSON.stringify({ campaignCreditsBrl: 150 }),
  });
  const recarregado = await prisma.plan.findUnique({ where: { id: plano.id } });
  ok(recarregado.campaignCreditsBrl === 150, `crédito atualizado (R$ ${recarregado.campaignCreditsBrl})`);
  const saldoNovo = await saldoDisparo(tenant.id);
  ok(perto(saldoNovo.incluido, 150), "e o saldo do cliente acompanha na hora");

  // ── 7. Recibos de entrega da Meta ───────────────────────────
  console.log("\n7. Entrega confirmada pela Meta");
  const { registrarStatusEntrega } = await import("../src/api/services/CampaignStatusService.js");


  const modelo = await prisma.messageTemplate.create({
    data: { tenantId: tenant.id, name: `t${Date.now()}`, content: "Olá", language: "pt_BR", category: "MARKETING" },
  });
  // O crédito devolvido tem de ser o da categoria DAQUELE template.
  const campanha = await prisma.campaign.create({
    data: { tenantId: tenant.id, name: "Disparo teste", templateId: modelo.id, status: "COMPLETED", sentCount: 3 },
  });
  const wamid = (n) => `wamid.TESTE${Date.now()}${n}`;
  const ids = [wamid(1), wamid(2), wamid(3)];
  for (const [i, mid] of ids.entries()) {
    await prisma.campaignRecipient.create({
      data: { campaignId: campanha.id, phone: `55719999900${i}`, status: "SENT", messageId: mid },
    });
  }
  // O envio já debitou o crédito das três.
  const gasto3 = await custoEstimado(3, "MARKETING");
  await debitar(tenant.id, gasto3.total);
  const antes = (await prisma.tenant.findUnique({ where: { id: tenant.id } })).usedCampaignCreditsBrl;

  await registrarStatusEntrega(ids[0], "delivered");
  await registrarStatusEntrega(ids[1], "read");
  await registrarStatusEntrega(ids[2], "failed");
  let c = await prisma.campaign.findUnique({ where: { id: campanha.id } });
  ok(c.deliveredCount === 2, `entrega confirmada conta (${c.deliveredCount} de 3 — a terceira falhou)`);
  ok(c.readCount === 1, `leitura conta separado (${c.readCount})`);
  ok(c.errorCount === 1, `falha na entrega conta como erro (${c.errorCount})`);

  const umaMkt = (await custoEstimado(1, "MARKETING")).total;
  const aposFalha = (await prisma.tenant.findUnique({ where: { id: tenant.id } })).usedCampaignCreditsBrl;
  ok(perto(aposFalha, antes - umaMkt), `crédito devolvido no que a Meta não entregou (${antes} → ${aposFalha})`);

  // A Meta reenvia webhook e não garante ordem.
  await registrarStatusEntrega(ids[0], "delivered");
  await registrarStatusEntrega(ids[1], "sent");
  await registrarStatusEntrega(ids[2], "delivered");
  c = await prisma.campaign.findUnique({ where: { id: campanha.id } });
  ok(c.deliveredCount === 2, "recibo repetido não conta duas vezes");
  ok(c.readCount === 1, "status atrasado não faz a leitura regredir");
  const reprocessado = (await prisma.tenant.findUnique({ where: { id: tenant.id } })).usedCampaignCreditsBrl;
  ok(perto(reprocessado, aposFalha), "nem devolve crédito de novo");

  ok((await registrarStatusEntrega("wamid.NAO_EXISTE", "delivered")) === null, "recibo de conversa normal é ignorado");

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
