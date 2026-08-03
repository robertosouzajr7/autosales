/**
 * Canal de WhatsApp por plano: oficial (Meta cobra) x QR Code (não cobra).
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-whatsapp-mode.mjs
 *
 * O plano é quem decide o canal porque é quem carrega o custo. Aqui se
 * verifica que a conta de custo muda junto, que o cliente não consegue
 * conectar por fora do que contratou, e que nada do que já funcionava parou.
 */
import prisma from "../src/api/config/prisma.js";
import jwt from "jsonwebtoken";
import {
  planWhatsappCost, cobraPorMensagem, estimateCampaign,
  WHATSAPP_MODES,
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

async function conta(modo, extras = {}) {
  const plan = await prisma.plan.create({
    data: {
      name: `${modo} ${Date.now()}${Math.random()}`, priceMonthly: 200, priceYearly: 2000,
      whatsappMode: modo, campaignCreditsBrl: 500,
      maxWhatsAppNumbers: 2, maxTokens: 100000, ...extras,
    },
  });
  const tenant = await prisma.tenant.create({
    data: { name: `Negócio ${modo}`, email: `wa${Date.now()}${Math.random()}@teste.local`.replace(/0\./g, ""), planId: plan.id },
  });
  const dono = await prisma.user.create({
    data: {
      name: "Dono", email: `dwa${Date.now()}${Math.random()}@teste.local`.replace(/0\./g, ""),
      password: "x", role: "OWNER", tenantId: tenant.id, emailVerified: true,
    },
  });
  return { plan, tenant, dono };
}

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");

  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: {
      usdToBrl: 5.0, waMarkup: 3.0, baileysNumberCost: 12,
      waRates: JSON.stringify({ MARKETING: 0.06, UTILITY: 0.008, AUTHENTICATION: 0.008, SERVICE: 0 }),
    },
    create: {
      id: "singleton", usdToBrl: 5.0, waMarkup: 3.0, baileysNumberCost: 12,
      waRates: JSON.stringify({ MARKETING: 0.06, UTILITY: 0.008, AUTHENTICATION: 0.008, SERVICE: 0 }),
    },
  });

  // ── 1. O canal decide se há custo por mensagem ──────────────
  console.log("\n1. Custo por canal");
  ok(cobraPorMensagem({ whatsappMode: "OFFICIAL" }) === true, "oficial cobra por mensagem");
  ok(cobraPorMensagem({ whatsappMode: "BAILEYS" }) === false, "QR Code não cobra por mensagem");
  ok(cobraPorMensagem({ whatsappMode: "BOTH" }) === true, "BOTH assume o pior caso (cobra)");
  ok(cobraPorMensagem({}) === true, "plano sem canal definido também assume o pior caso");

  const oficial = await conta(WHATSAPP_MODES.OFFICIAL);
  const qr = await conta(WHATSAPP_MODES.BAILEYS);

  const custoOficial = await planWhatsappCost(oficial.plan);
  // R$ 500 de crédito com margem 3x custam R$ 166,67 ao SaaS.
  ok(perto(custoOficial.custoBrl, 166.67), `plano oficial: R$ 500 de crédito custam R$ 166,67 (${custoOficial.custoBrl})`);
  ok(custoOficial.porMensagem === true, "e o custo é por mensagem");

  const custoQr = await planWhatsappCost(qr.plan);
  ok(perto(custoQr.custoBrl, 24), `plano QR Code: 2 números × R$ 12 de infra = R$ 24 (${custoQr.custoBrl})`);
  ok(custoQr.porMensagem === false, "e o custo NÃO é por mensagem");
  ok(custoQr.custoBrl < custoOficial.custoBrl, "por isso o plano de QR Code pode ser mais barato");

  // Sem custo de infra configurado, o plano de QR Code custaria zero — é o
  // erro que o aviso da tela existe para evitar.
  await prisma.platformSettings.update({ where: { id: "singleton" }, data: { baileysNumberCost: 0 } });
  const semInfra = await planWhatsappCost(qr.plan);
  ok(semInfra.custoBrl === 0, "custo por número zerado deixa o plano aparentando custo zero");
  await prisma.platformSettings.update({ where: { id: "singleton" }, data: { baileysNumberCost: 12 } });

  // ── 2. Projeção do disparo muda com o canal ─────────────────
  console.log("\n2. Projeção do disparo");
  const estOficial = await estimateCampaign(500, "MARKETING", { cobraPorMensagem: true });
  ok(perto(estOficial.costBrl, 150), `oficial: 500 disparos custam R$ 150 (${estOficial.costBrl})`);
  const estQr = await estimateCampaign(500, "MARKETING", { cobraPorMensagem: false });
  ok(estQr.costBrl === 0 && estQr.priceBrl === 0, "QR Code: mesmo disparo custa zero");
  ok(estQr.cobraPorMensagem === false, "e a projeção diz por quê");

  // ── 3. Franquia informa o canal para a tela ─────────────────
  console.log("\n3. Franquia e canal na tela do cliente");
  const { podeDisparar } = await import("../src/api/services/CampaignCreditService.js");
  const qOficial = await podeDisparar(oficial.tenant.id, 10, "MARKETING");
  ok(
    qOficial.cobraPorMensagem === true && qOficial.custo.unitPriceBrl > 0,
    `oficial mostra preço por disparo (${qOficial.custo.unitPriceBrl})`
  );
  const qQr = await podeDisparar(qr.tenant.id, 10, "MARKETING");
  ok(qQr.cobraPorMensagem === false, "QR Code avisa que não cobra por mensagem");
  ok(qQr.custo.total === 0, "e não debita crédito neste canal");
  ok(qQr.allowed === true, "o disparo por QR Code passa sem consumir saldo");
  ok(qQr.whatsappMode === "BAILEYS", `o canal viaja junto (${qQr.whatsappMode})`);

  // ── 4. O cliente não conecta fora do que contratou ──────────
  console.log("\n4. Trava de canal na conexão");
  let r = await chamar("/whatsapp/accounts/meta", qr.dono, {
    method: "POST",
    body: JSON.stringify({ name: "Oficial", phoneId: "123", accessToken: "x", wabaId: "1" }),
  });
  ok(r.status === 403, `plano QR Code não conecta API oficial (${r.status})`);
  ok(/API oficial/i.test(r.corpo.error || ""), `e a mensagem explica: "${r.corpo.error}"`);

  r = await chamar("/whatsapp/accounts", oficial.dono, { method: "POST", body: JSON.stringify({ name: "QR" }) });
  ok(r.status === 403, `plano oficial não conecta por QR Code (${r.status})`);

  r = await chamar("/whatsapp/accounts/meta", oficial.dono, {
    method: "POST",
    body: JSON.stringify({ name: "Oficial", phoneId: "123", accessToken: "x", wabaId: "1" }),
  });
  ok(r.status === 200, `plano oficial conecta pelo canal dele (${r.status})`);

  // ── 5. Nada do que já existia parou ─────────────────────────
  console.log("\n5. Compatibilidade com o que já estava no ar");
  const antigo = await conta("BOTH");
  r = await chamar("/whatsapp/accounts", antigo.dono, { method: "POST", body: JSON.stringify({ name: "QR" }) });
  ok(r.status === 200, `plano BOTH conecta por QR Code (${r.status})`);
  r = await chamar("/whatsapp/accounts/meta", antigo.dono, {
    method: "POST",
    body: JSON.stringify({ name: "Oficial", phoneId: "456", accessToken: "x", wabaId: "1" }),
  });
  ok(r.status === 200, `e também pela API oficial (${r.status})`);
  const semPlano = await prisma.tenant.create({
    data: { name: "Sem plano", email: `sp${Date.now()}@teste.local` },
  });
  const donoSemPlano = await prisma.user.create({
    data: { name: "Dono", email: `dsp${Date.now()}@teste.local`, password: "x", role: "OWNER", tenantId: semPlano.id, emailVerified: true },
  });
  r = await chamar("/whatsapp/accounts", donoSemPlano, { method: "POST", body: JSON.stringify({ name: "QR" }) });
  // Conta sem plano já era barrada antes, pelo limite de números. O que não
  // pode acontecer é a trava NOVA (canal) ser a responsável — daí olhar o
  // corpo em vez do status.
  ok(r.corpo.whatsappMode === undefined, `conta sem plano não é barrada pelo canal (motivo: ${r.corpo.error?.slice(0, 60)})`);

  // ── 6. Admin configura o canal do plano ─────────────────────
  console.log("\n6. Canal do plano pelo painel do SaaS");
  const suporte = await prisma.user.create({
    data: { name: "Suporte", email: `swa${Date.now()}@teste.local`, password: "x", role: "SUPERADMIN", tenantId: oficial.tenant.id, emailVerified: true },
  });
  r = await chamar(`/admin/plans/${qr.plan.id}`, suporte, {
    method: "PUT", body: JSON.stringify({ whatsappMode: "INVENTADO" }),
  });
  let recarregado = await prisma.plan.findUnique({ where: { id: qr.plan.id } });
  ok(recarregado.whatsappMode === "BAILEYS", `canal inválido é ignorado (${recarregado.whatsappMode})`);
  r = await chamar(`/admin/plans/${qr.plan.id}`, suporte, {
    method: "PUT", body: JSON.stringify({ whatsappMode: "official" }),
  });
  recarregado = await prisma.plan.findUnique({ where: { id: qr.plan.id } });
  ok(recarregado.whatsappMode === "OFFICIAL", `minúscula é normalizada (${recarregado.whatsappMode})`);

  r = await chamar("/admin/token-pricing", suporte);
  ok(r.corpo.baileysNumberCost === 12, `custo do número QR Code vai para a tela (${r.corpo.baileysNumberCost})`);

  // ── 7. O cliente enxerga o canal do plano dele ──────────────
  console.log("\n7. O cliente sabe qual canal usa");
  r = await chamar("/settings", oficial.dono);
  ok(r.corpo.whatsappMode === "OFFICIAL", `Conexões recebe o canal (${r.corpo.whatsappMode})`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
