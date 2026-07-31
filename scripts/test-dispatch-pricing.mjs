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
  resolvePricing, unitPricing, planCampaignCost, estimateCampaign, checkCampaignQuota,
} from "../src/api/services/WhatsAppPricingService.js";

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

  // ── 2. Custo da franquia do plano ───────────────────────────
  console.log("\n2. Franquia do plano custeada");
  const franquia = await planCampaignCost(1000, "MARKETING");
  ok(perto(franquia.custoBrl, 300), `1.000 disparos custam R$ 300 (${franquia.custoBrl})`);
  ok(perto(franquia.precoSugeridoBrl, 900), `e deveriam ser vendidos por R$ 900 (${franquia.precoSugeridoBrl})`);
  const semDisparo = await planCampaignCost(0, "MARKETING");
  ok(semDisparo.custoBrl === 0, "plano sem franquia não tem custo de disparo");
  const utilidade = await planCampaignCost(1000, "UTILITY");
  ok(utilidade.custoBrl < franquia.custoBrl, "franquia de utilidade custa menos que a de marketing");

  // ── 3. Projeção de um disparo ───────────────────────────────
  console.log("\n3. Projeção de um disparo");
  const est = await estimateCampaign(250, "MARKETING");
  ok(perto(est.costBrl, 75), `250 destinatários custam R$ 75 (${est.costBrl})`);
  ok(perto(est.priceBrl, 225), `e o cliente paga R$ 225 (${est.priceBrl})`);
  ok(perto(est.priceBrl / est.costBrl, 3), "a razão preço/custo é exatamente a margem configurada");

  // ── 4. Plano reflete a precificação ─────────────────────────
  console.log("\n4. O plano carrega a categoria da franquia");
  const plano = await prisma.plan.create({
    data: {
      name: `Disparo ${Date.now()}`, priceMonthly: 500, priceYearly: 5000,
      maxCampaignMessages: 1000, campaignCategory: "MARKETING", maxTokens: 100000,
    },
  });
  ok(plano.campaignCategory === "MARKETING", "categoria gravada no plano");

  const tenant = await prisma.tenant.create({
    data: { name: "Negócio Disparo", email: `disp${Date.now()}@teste.local`, planId: plano.id },
  });
  const dono = await prisma.user.create({
    data: { name: "Dono", email: `ddisp${Date.now()}@teste.local`, password: "x", role: "OWNER", tenantId: tenant.id },
  });

  const quota = await checkCampaignQuota(tenant.id, 10);
  ok(quota.allowed === true, "conta com franquia pode disparar");
  ok(quota.category === "MARKETING", `a franquia informa a categoria (${quota.category})`);
  ok(perto(quota.unitPriceBrl, 0.9), `e quanto vale cada disparo (${quota.unitPriceBrl})`);

  // Custo da franquia (R$ 300) contra o preço do plano (R$ 500): sobra pouco.
  const custoFranquia = (await planCampaignCost(plano.maxCampaignMessages, plano.campaignCategory)).custoBrl;
  ok(custoFranquia < plano.priceMonthly, `o plano cobre o custo da franquia (R$ ${custoFranquia} < R$ ${plano.priceMonthly})`);

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

  // ── 6. Categoria inválida não entra no plano ────────────────
  console.log("\n6. Trava do plano");
  r = await chamar(`/admin/plans/${plano.id}`, suporte, {
    method: "PUT", body: JSON.stringify({ campaignCategory: "INVENTADA" }),
  });
  const recarregado = await prisma.plan.findUnique({ where: { id: plano.id } });
  ok(recarregado.campaignCategory === "MARKETING", `categoria inválida é ignorada (${recarregado.campaignCategory})`);
  r = await chamar(`/admin/plans/${plano.id}`, suporte, {
    method: "PUT", body: JSON.stringify({ campaignCategory: "utility" }),
  });
  const emMinuscula = await prisma.plan.findUnique({ where: { id: plano.id } });
  ok(emMinuscula.campaignCategory === "UTILITY", `categoria em minúscula é normalizada (${emMinuscula.campaignCategory})`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
