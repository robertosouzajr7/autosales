/**
 * Quem atendeu: contagem pelo histórico, não pelo dono atual.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-atendente-historico.mjs
 *
 * O relatório contava a conversa para quem estava com ela no fim. Quem
 * atendeu por uma hora e transferiu sumia — e, pior, um supervisor que só
 * encaminhou levava o crédito porque o evento guardava o autor da ação, não
 * quem passou a atender.
 */
import prisma from "../src/api/config/prisma.js";
import AttendanceService from "../src/api/services/AttendanceService.js";
import jwt from "jsonwebtoken";

const API = process.env.API || "http://127.0.0.1:3000";
const SEGREDO = process.env.JWT_SECRET;

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = Date.now();

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");

  const tenant = await prisma.tenant.create({ data: { name: "Clínica Rastro", email: `rastro-${marca}@teste.local` } });
  const pessoas = {};
  for (const nome of ["Dono", "Ana", "Bruno", "Carla"]) {
    pessoas[nome] = await prisma.user.create({
      data: {
        name: nome, email: `${nome.toLowerCase()}-${marca}@teste.local`, password: "x",
        role: nome === "Dono" ? "OWNER" : "AGENT", tenantId: tenant.id, emailVerified: true,
      },
    });
  }
  const token = jwt.sign({ userId: pessoas.Dono.id, tenantId: tenant.id, role: "OWNER" }, SEGREDO, { expiresIn: "1h" });
  const relatorio = () =>
    fetch(`${API}/api/stats/report?days=30`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json());

  async function conversa(i) {
    const lead = await prisma.lead.create({
      data: { tenantId: tenant.id, name: `Contato ${i}`, phone: `5511${String(70000000 + i)}` },
    });
    const c = await prisma.conversation.create({ data: { leadId: lead.id, tenantId: tenant.id, phase: "QUEUE" } });
    await prisma.message.create({ data: { conversationId: c.id, tenantId: tenant.id, role: "USER", content: "oi" } });
    return c;
  }

  // ── 1. Quem assumiu e transferiu continua contando ──────────
  console.log("\n1. Conversa que passou por duas pessoas");
  const c1 = await conversa(1);
  await AttendanceService.assign(c1.id, pessoas.Ana.id, { tenantId: tenant.id, avisarCliente: false });
  await AttendanceService.assign(c1.id, pessoas.Bruno.id, { tenantId: tenant.id, avisarCliente: false, actor: pessoas.Ana });

  let r = await relatorio();
  const porNome = Object.fromEntries(r.equipe.map((p) => [p.nome, p]));
  ok(porNome.Bruno?.atendidas === 1, `Bruno, que está com ela agora, conta (${porNome.Bruno?.atendidas})`);
  ok(porNome.Ana?.atendidas === 1, `Ana, que atendeu antes e transferiu, também (${porNome.Ana?.atendidas})`);

  // ── 2. Supervisor que só encaminha não leva o crédito ───────
  console.log("\n2. Transferência feita por terceiro");
  const c2 = await conversa(2);
  await AttendanceService.assign(c2.id, pessoas.Carla.id, {
    tenantId: tenant.id, avisarCliente: false, actor: pessoas.Dono,
  });
  r = await relatorio();
  const depois = Object.fromEntries(r.equipe.map((p) => [p.nome, p]));
  ok(depois.Carla?.atendidas === 1, `Carla, que recebeu a conversa, conta (${depois.Carla?.atendidas})`);
  ok(!depois.Dono, `o Dono, que só encaminhou, não aparece como atendente (${depois.Dono?.atendidas ?? "ausente"})`);

  const evento = await prisma.conversationEvent.findFirst({
    where: { conversationId: c2.id, type: "ASSIGNED" },
  });
  ok(evento?.actorUserId === pessoas.Dono.id, "o evento continua guardando quem fez a ação");
  ok(evento?.targetUserId === pessoas.Carla.id, "e passou a guardar quem atende");

  // ── 3. Sem contar duas vezes a mesma conversa ───────────────
  console.log("\n3. Idas e vindas");
  const c3 = await conversa(3);
  await AttendanceService.assign(c3.id, pessoas.Ana.id, { tenantId: tenant.id, avisarCliente: false });
  await AttendanceService.assign(c3.id, pessoas.Bruno.id, { tenantId: tenant.id, avisarCliente: false, actor: pessoas.Ana });
  await AttendanceService.assign(c3.id, pessoas.Ana.id, { tenantId: tenant.id, avisarCliente: false, actor: pessoas.Bruno });
  r = await relatorio();
  const idasEVindas = Object.fromEntries(r.equipe.map((p) => [p.nome, p]));
  ok(idasEVindas.Ana?.atendidas === 2, `Ana soma 2 conversas distintas, e não as 4 passagens dela (${idasEVindas.Ana?.atendidas})`);

  // ── 4. Encerrada conta para quem encerrou ───────────────────
  console.log("\n4. Quem encerrou");
  await AttendanceService.close(c3.id, { tenantId: tenant.id, actor: pessoas.Ana, avisarCliente: false });
  r = await relatorio();
  const encerrou = Object.fromEntries(r.equipe.map((p) => [p.nome, p]));
  ok(encerrou.Ana?.encerradas === 1, `Ana encerrou uma (${encerrou.Ana?.encerradas})`);
  ok(encerrou.Bruno?.encerradas === 0, `Bruno, que passou pela mesma conversa, não (${encerrou.Bruno?.encerradas})`);

  // ── 5. Conversa antiga, sem evento, não se perde ────────────
  console.log("\n5. Conversa anterior ao registro de eventos");
  const lead = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Antigo", phone: `5511${String(70009999)}` },
  });
  const antiga = await prisma.conversation.create({
    data: { leadId: lead.id, tenantId: tenant.id, phase: "HUMAN", assignedToId: pessoas.Carla.id },
  });
  await prisma.message.create({ data: { conversationId: antiga.id, tenantId: tenant.id, role: "USER", content: "oi" } });
  r = await relatorio();
  const comAntiga = Object.fromEntries(r.equipe.map((p) => [p.nome, p]));
  ok(comAntiga.Carla?.atendidas === 2, `o dono atual entra quando não há evento nenhum (${comAntiga.Carla?.atendidas})`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
