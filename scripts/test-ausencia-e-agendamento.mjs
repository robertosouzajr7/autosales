/**
 * Períodos de ausência e disparos com hora marcada.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-ausencia-e-agendamento.mjs
 *
 * Duas coisas que a plataforma não fazia: avisar o cliente que o negócio
 * está em recesso (a régua semanal só sabe "hoje já fechamos"), e cumprir o
 * horário de um disparo — `scheduledAt` era gravado e nunca lido.
 */
import prisma from "../src/api/config/prisma.js";
import MessagingService from "../src/api/services/MessagingService.js";
import jwt from "jsonwebtoken";

const API = process.env.API || "http://127.0.0.1:3000";
const SEGREDO = process.env.JWT_SECRET;
const HORA = 60 * 60 * 1000;

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

// Captura os envios em vez de bater no WhatsApp.
const enviados = [];
MessagingService.sendToLead = async (lead, texto) => {
  enviados.push({ leadId: lead.id, texto });
  return { ok: true };
};

const marca = Date.now();
let token;
const chamar = (caminho, opcoes = {}) =>
  fetch(`${API}/api${caminho}`, {
    ...opcoes,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opcoes.headers || {}) },
  }).then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => ({})) }));

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");

  const tenant = await prisma.tenant.create({ data: { name: "Clínica Recesso", email: `aus-${marca}@teste.local` } });
  const dono = await prisma.user.create({
    data: { name: "Dona", email: `aus-d-${marca}@teste.local`, password: "x", role: "OWNER", tenantId: tenant.id, emailVerified: true },
  });
  token = jwt.sign({ userId: dono.id, tenantId: tenant.id, role: "OWNER" }, SEGREDO, { expiresIn: "1h" });

  // ── 1. Cadastro do período ──────────────────────────────────
  console.log("\n1. Cadastro");
  let r = await chamar("/away-periods", { method: "POST", body: JSON.stringify({ name: "", message: "x" }) });
  ok(r.status === 400, `período sem nome é recusado (${r.status})`);

  r = await chamar("/away-periods", {
    method: "POST",
    body: JSON.stringify({
      name: "Recesso", message: "Estamos em recesso até 02/01.",
      startsAt: new Date(Date.now() + 2 * HORA).toISOString(),
      endsAt: new Date(Date.now() + HORA).toISOString(),
    }),
  });
  ok(r.status === 400 && /depois do início/i.test(r.corpo.error || ""), `fim antes do início é recusado: "${r.corpo.error}"`);

  r = await chamar("/away-periods", {
    method: "POST",
    body: JSON.stringify({
      name: "Recesso de fim de ano",
      message: "Olá! Estamos em recesso até 02/01. Respondemos assim que voltarmos. 💙",
      startsAt: new Date(Date.now() - HORA).toISOString(),
      endsAt: new Date(Date.now() + 24 * HORA).toISOString(),
    }),
  });
  ok(r.status === 200, `período criado (${r.status}: ${r.corpo.error || "ok"})`);
  const periodo = r.corpo;

  r = await chamar("/away-periods");
  ok(r.corpo[0]?.estado === "EM_CURSO", `a tela mostra que está em curso (${r.corpo[0]?.estado})`);

  // ── 2. O aviso sai uma vez por contato ──────────────────────
  console.log("\n2. Aviso ao contato");
  const { avisarSeAusente } = await import("../src/api/services/AwayService.js");
  const lead = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Paula", phone: `5511${String(60000000 + (marca % 1000))}`, channel: "WHATSAPP" },
  });
  await prisma.conversation.create({ data: { leadId: lead.id, tenantId: tenant.id } });

  let res1 = await avisarSeAusente(tenant.id, lead);
  ok(res1.avisou === true, "primeiro contato recebe o aviso");
  ok(/recesso até 02\/01/.test(enviados[0]?.texto || ""), `com o texto cadastrado: "${enviados[0]?.texto?.slice(0, 40)}…"`);
  ok(res1.pausarIa === true, "e a IA fica calada no período");

  const antes = enviados.length;
  let res2 = await avisarSeAusente(tenant.id, lead);
  ok(res2.avisou === false && enviados.length === antes, "a segunda mensagem dele NÃO gera outro aviso");
  ok(res2.pausarIa === true, "mas a IA continua calada");

  const noHistorico = await prisma.message.count({
    where: { conversation: { leadId: lead.id }, role: "ASSISTANT" },
  });
  ok(noHistorico === 1, `o aviso entra uma vez no histórico da conversa (${noHistorico})`);

  // ── 3. Outro contato é avisado ──────────────────────────────
  console.log("\n3. Outro contato");
  const lead2 = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Bruno", phone: `5511${String(60001000 + (marca % 1000))}`, channel: "WHATSAPP" },
  });
  const r3 = await avisarSeAusente(tenant.id, lead2);
  ok(r3.avisou === true, "cada contato recebe o seu");

  // ── 4. Fora do período, nada acontece ───────────────────────
  console.log("\n4. Fora do período");
  await prisma.awayPeriod.update({
    where: { id: periodo.id },
    data: { startsAt: new Date(Date.now() + 48 * HORA), endsAt: new Date(Date.now() + 72 * HORA) },
  });
  const lead3 = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Carla", phone: `5511${String(60002000 + (marca % 1000))}`, channel: "WHATSAPP" },
  });
  const r4 = await avisarSeAusente(tenant.id, lead3);
  ok(r4.avisou === false && r4.pausarIa === false, "período que ainda não começou não avisa ninguém nem cala a IA");

  // ── 5. Contato em opt-out não recebe nem o aviso ────────────
  console.log("\n5. Opt-out");
  await prisma.awayPeriod.update({
    where: { id: periodo.id },
    data: { startsAt: new Date(Date.now() - HORA), endsAt: new Date(Date.now() + HORA) },
  });
  const semContato = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Optou por sair", phone: `5511${String(60003000 + (marca % 1000))}`, optedOut: true },
  });
  const r5 = await avisarSeAusente(tenant.id, semContato);
  ok(r5.avisou === false, "quem pediu para não receber não recebe nem o aviso automático");

  // ── 6. Período desligado não vale ───────────────────────────
  console.log("\n6. Desligado");
  await chamar(`/away-periods/${periodo.id}`, { method: "PUT", body: JSON.stringify({ active: false }) });
  const lead4 = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Diego", phone: `5511${String(60004000 + (marca % 1000))}` },
  });
  const r6 = await avisarSeAusente(tenant.id, lead4);
  ok(r6.avisou === false && r6.pausarIa === false, "período desligado é como se não existisse");

  // ── 7. Disparo com hora marcada ─────────────────────────────
  console.log("\n7. Disparo agendado");
  const template = await prisma.messageTemplate.create({
    data: { tenantId: tenant.id, name: `promo_${marca}`, category: "MARKETING", status: "APPROVED", content: "Oi {{1}}!", language: "pt_BR" },
  });
  const campanha = await prisma.campaign.create({
    data: { tenantId: tenant.id, name: "Promoção de janeiro", templateId: template.id, status: "DRAFT" },
  });

  r = await chamar(`/campaigns/${campanha.id}/schedule`, {
    method: "POST", body: JSON.stringify({ scheduledAt: new Date(Date.now() - HORA).toISOString() }),
  });
  ok(r.status === 400, `agendar para o passado é recusado (${r.status})`);

  r = await chamar(`/campaigns/${campanha.id}/schedule`, {
    method: "POST", body: JSON.stringify({ scheduledAt: new Date(Date.now() + 2 * HORA).toISOString() }),
  });
  ok(r.status === 200 && r.corpo.campaign?.status === "SCHEDULED", `agendada (${r.corpo.campaign?.status})`);

  const { dispararAgendadas } = await import("../src/api/controllers/CampaignController.js");
  await dispararAgendadas();
  let atual = await prisma.campaign.findUnique({ where: { id: campanha.id } });
  ok(atual.status === "SCHEDULED", "antes da hora, continua esperando");

  // Puxa a hora para trás: é o que o relógio faria.
  await prisma.campaign.update({ where: { id: campanha.id }, data: { scheduledAt: new Date(Date.now() - 60000) } });
  await dispararAgendadas();
  atual = await prisma.campaign.findUnique({ where: { id: campanha.id } });
  ok(atual.status !== "SCHEDULED", `chegada a hora, sai da fila de agendadas (${atual.status})`);
  ok(
    atual.status === "DRAFT" && /não disparou/i.test(atual.errorLog || ""),
    `o que impediu o disparo volta a rascunho com o motivo à vista: "${(atual.errorLog || "").slice(0, 60)}"`
  );

  // ── 8. Cancelar o agendamento ───────────────────────────────
  console.log("\n8. Cancelamento");
  await chamar(`/campaigns/${campanha.id}/schedule`, {
    method: "POST", body: JSON.stringify({ scheduledAt: new Date(Date.now() + 3 * HORA).toISOString() }),
  });
  r = await chamar(`/campaigns/${campanha.id}/schedule`, { method: "POST", body: JSON.stringify({ scheduledAt: null }) });
  ok(r.status === 200 && r.corpo.campaign?.status === "DRAFT", `volta a rascunho (${r.corpo.campaign?.status})`);
  ok(r.corpo.campaign?.scheduledAt === null, "e a hora é apagada");

  // ── 9. Isolamento ───────────────────────────────────────────
  console.log("\n9. Isolamento entre negócios");
  const outro = await prisma.tenant.create({ data: { name: "Outro", email: `aus-o-${marca}@teste.local` } });
  const donoOutro = await prisma.user.create({
    data: { name: "D2", email: `aus-do-${marca}@teste.local`, password: "x", role: "OWNER", tenantId: outro.id, emailVerified: true },
  });
  token = jwt.sign({ userId: donoOutro.id, tenantId: outro.id, role: "OWNER" }, SEGREDO, { expiresIn: "1h" });
  r = await chamar("/away-periods");
  ok(Array.isArray(r.corpo) && r.corpo.length === 0, `outro negócio não vê estes períodos (${r.corpo.length})`);
  r = await chamar(`/away-periods/${periodo.id}`, { method: "DELETE" });
  ok(r.status === 404, `nem consegue remover (${r.status})`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
