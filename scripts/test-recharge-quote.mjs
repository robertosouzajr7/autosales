/**
 * Recarga de valor livre: cotação e trava de mínimo.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-recharge-quote.mjs
 *
 * O que importa aqui é a cotação bater com a tabela que cobra o consumo, e o
 * checkout não aceitar preço vindo do navegador.
 */
import prisma from "../src/api/config/prisma.js";
import jwt from "jsonwebtoken";
import { cotar, tabela, MINIMO_TOKENS, MINIMO_DISPARO_BRL } from "../src/api/services/RechargeService.js";

const API = process.env.API || "http://127.0.0.1:3000";
const SEGREDO = process.env.JWT_SECRET;

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

async function main() {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: {
      usdToBrl: 5.0, tokenMarkup: 5.0, waMarkup: 3.0,
      aiProvider: "GEMINI", aiModel: "gemini-2.0-flash",
      waRates: JSON.stringify({ MARKETING: 0.06, UTILITY: 0.008, AUTHENTICATION: 0.008, SERVICE: 0 }),
    },
    create: {
      id: "singleton", usdToBrl: 5.0, tokenMarkup: 5.0, waMarkup: 3.0,
      aiProvider: "GEMINI", aiModel: "gemini-2.0-flash",
      waRates: JSON.stringify({ MARKETING: 0.06, UTILITY: 0.008, AUTHENTICATION: 0.008, SERVICE: 0 }),
    },
  });

  const plan = await prisma.plan.create({
    data: { name: `Recarga ${Date.now()}`, priceMonthly: 300, priceYearly: 3000, campaignCreditsBrl: 200, maxTokens: 1_000_000 },
  });
  const tenant = await prisma.tenant.create({
    data: { name: "Recarga", email: `rec${Date.now()}@teste.local`, planId: plan.id, extraTokens: 500_000 },
  });
  const dono = await prisma.user.create({
    data: { name: "Dono", email: `drec${Date.now()}@teste.local`, password: "x", role: "OWNER", tenantId: tenant.id, emailVerified: true },
  });

  const t = await tabela();

  // ── 1. Disparo ──────────────────────────────────────────────
  console.log("\n1. Recarga de disparo");
  const d = await cotar(tenant.id, { tipo: "DISPARO", valorBrl: 150 });
  ok(d.ok === true, "aceita um valor livre");
  ok(perto(d.creditsBrl, 150) && perto(d.valorBrl, 150), `um real pago é um real de crédito (R$ ${d.creditsBrl})`);
  ok(
    d.equivale.MARKETING === Math.floor(150 / t.precosDisparo.MARKETING),
    `equivalência em marketing bate com a tarifa (${d.equivale.MARKETING})`
  );
  ok(
    d.equivale.UTILITY > d.equivale.MARKETING,
    `utilidade rende mais mensagem que marketing (${d.equivale.UTILITY} x ${d.equivale.MARKETING})`
  );
  ok(perto(d.saldoDepois, d.saldoAtual + 150), `saldo projetado soma a recarga (R$ ${d.saldoDepois})`);

  const abaixo = await cotar(tenant.id, { tipo: "DISPARO", valorBrl: MINIMO_DISPARO_BRL - 1 });
  ok(abaixo.ok === false, "recusa abaixo do mínimo");
  ok(/mínima/i.test(abaixo.motivo || ""), `e diz qual é o mínimo ("${abaixo.motivo}")`);

  // ── 2. Tokens de IA ─────────────────────────────────────────
  console.log("\n2. Recarga de IA");
  const um = await cotar(tenant.id, { tipo: "TOKENS", tokens: MINIMO_TOKENS });
  ok(um.ok === true, "1 milhão de tokens é aceito");
  ok(perto(um.valorBrl, t.precoPor1MTokens), `preço do milhão sai da tabela (R$ ${um.valorBrl})`);
  ok(um.saldoDepois === 500_000 + MINIMO_TOKENS, `saldo projetado soma ao extraTokens (${um.saldoDepois})`);

  const pouco = await cotar(tenant.id, { tipo: "TOKENS", tokens: MINIMO_TOKENS - 1000 });
  ok(pouco.ok === false, "abaixo de 1 milhão é recusado");
  ok(/mínima/i.test(pouco.motivo || ""), `com o mínimo explicado ("${pouco.motivo}")`);

  // Pelos dois lados: quem digita reais e quem digita tokens têm que chegar
  // no mesmo lugar, senão o cliente vê preço diferente conforme o campo usado.
  const porValor = await cotar(tenant.id, { tipo: "TOKENS", valorBrl: um.valorBrl });
  ok(porValor.ok === true && porValor.tokens >= MINIMO_TOKENS, `pagar ${um.valorBrl} devolve ${porValor.tokens} tokens`);
  ok(porValor.valorBrl <= um.valorBrl + 0.01, "cotar por reais nunca cobra mais que o pedido");

  const dezM = await cotar(tenant.id, { tipo: "TOKENS", tokens: 10 * MINIMO_TOKENS });
  ok(perto(dezM.valorBrl, um.valorBrl * 10, 0.05), `10x tokens custa 10x (R$ ${dezM.valorBrl})`);

  // ── 3. Rotas ────────────────────────────────────────────────
  console.log("\n3. Endpoints");
  const token = jwt.sign({ userId: dono.id, tenantId: tenant.id, role: dono.role }, SEGREDO, { expiresIn: "1h" });
  const post = (caminho, corpo) => fetch(`${API}/api${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
  });

  let res = await post("/billing/recharge/quote", { tipo: "DISPARO", valorBrl: 100 });
  let corpo = await res.json();
  ok(res.status === 200 && corpo.ok === true, `cotação responde (${res.status})`);
  ok(perto(corpo.valorBrl, 100), "e devolve o total a pagar");

  // Valor inválido não é erro de servidor: a tela cota a cada tecla.
  res = await post("/billing/recharge/quote", { tipo: "DISPARO", valorBrl: 1 });
  corpo = await res.json();
  ok(res.status === 200 && corpo.ok === false, `valor inválido responde 200 com motivo (${res.status})`);

  // Sem Stripe configurado o checkout falha — mas tem que falhar DEPOIS de
  // validar o mínimo, senão um valor proibido chegaria ao gateway.
  res = await post("/billing/recharge/checkout", { tipo: "TOKENS", tokens: 1000 });
  corpo = await res.json();
  ok(res.status === 400, `checkout barra abaixo do mínimo antes do gateway (${res.status})`);
  ok(/mínima/i.test(corpo.error || ""), `com a mensagem do mínimo ("${corpo.error}")`);

  console.log(falhas === 0 ? "\n✅ Todos os cenários passaram." : `\n❌ ${falhas} falha(s).`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
