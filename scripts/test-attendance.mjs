/**
 * Teste das filas de atendimento contra um Postgres real.
 *
 *   DATABASE_URL=... node scripts/test-attendance.mjs
 *
 * Cobre o ciclo: IA atendendo → transferência para a fila (com posição) →
 * atendente assume → transferência entre atendentes → devolução para a IA →
 * encerramento e reabertura pelo cliente.
 */
import prisma from "../src/api/config/prisma.js";
import AttendanceService from "../src/api/services/AttendanceService.js";
import MessagingService from "../src/api/services/MessagingService.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const enviados = [];
MessagingService.sendText = async (tenantId, phone, text) => {
  enviados.push({ phone, text });
  return true;
};

async function seed() {
  const plan = await prisma.plan.create({
    data: { name: `Fila ${Date.now()}`, priceMonthly: 0, priceYearly: 0, enableAutomations: true },
  });
  const tenant = await prisma.tenant.create({
    data: { name: "Negócio Fila", email: `fila${Date.now()}@teste.local`, planId: plan.id },
  });
  const ana = await prisma.user.create({
    data: { name: "Ana Souza", email: `ana${Date.now()}@teste.local`, password: "x", tenantId: tenant.id, role: "AGENT" },
  });
  const bruno = await prisma.user.create({
    data: { name: "Bruno Lima", email: `bruno${Date.now()}@teste.local`, password: "x", tenantId: tenant.id, role: "AGENT" },
  });

  const conversas = [];
  for (const nome of ["Cliente Um", "Cliente Dois", "Cliente Três"]) {
    const lead = await prisma.lead.create({
      data: { tenantId: tenant.id, name: nome, phone: `5571${Math.floor(Math.random() * 1e8)}` },
    });
    conversas.push(
      await prisma.conversation.create({ data: { leadId: lead.id, tenantId: tenant.id, botActive: true } })
    );
  }
  return { tenant, ana, bruno, conversas };
}

async function main() {
  const { tenant, ana, bruno, conversas } = await seed();
  const [c1, c2, c3] = conversas;

  // ── 1. Estado inicial ───────────────────────────────────────
  console.log("\n1. Conversa nasce em atendimento automático");
  ok(c1.phase === "BOT", `fase inicial ${c1.phase}`);
  ok(c1.botActive === true, "IA respondendo");

  // ── 2. IA transfere para a fila ─────────────────────────────
  console.log("\n2. Agente de IA transfere para atendimento humano");
  enviados.length = 0;
  const r1 = await AttendanceService.enqueue(c1.id, { reason: "Cliente pediu falar com humano" });
  ok(r1.phase === "QUEUE", `fase ${r1.phase}`);
  ok(r1.botActive === false, "IA para de responder");
  ok(r1.position === 1, `posição ${r1.position}`);
  ok(!!r1.queueId, "entrou numa fila (criada automaticamente)");
  ok(/transferindo/i.test(enviados[0]?.text || ""), "cliente avisado da transferência");
  ok(/próximo/i.test(enviados[0]?.text || ""), `posição comunicada: "${enviados[0]?.text}"`);

  const avisoNaConversa = await prisma.message.findFirst({
    where: { conversationId: c1.id, role: "SYSTEM" },
    orderBy: { createdAt: "desc" },
  });
  ok(/posição 1/.test(avisoNaConversa?.content || ""), `marco na conversa: "${avisoNaConversa?.content}"`);

  // ── 3. Fila com mais gente ──────────────────────────────────
  console.log("\n3. Mais clientes na fila");
  const r2 = await AttendanceService.enqueue(c2.id, { reason: "Reclamação" });
  const r3 = await AttendanceService.enqueue(c3.id, {});
  ok(r2.position === 2, `segundo cliente na posição ${r2.position}`);
  ok(r3.position === 3, `terceiro cliente na posição ${r3.position}`);

  const fila = await AttendanceService.listQueue(tenant.id);
  ok(fila.length === 3, `fila com ${fila.length} aguardando`);
  ok(fila[0].position === 1 && fila[2].position === 3, "posições em ordem de chegada");
  ok(fila[1].reason === "Reclamação", `motivo preservado: "${fila[1].reason}"`);

  // ── 4. Atendente assume ─────────────────────────────────────
  console.log("\n4. Ana assume o primeiro da fila");
  enviados.length = 0;
  const assumida = await AttendanceService.assign(c1.id, ana.id, { actor: ana });
  ok(assumida.phase === "HUMAN", `fase ${assumida.phase}`);
  ok(assumida.assignedTo?.name === "Ana Souza", `dono do atendimento: ${assumida.assignedTo?.name}`);
  ok(/Ana/.test(enviados[0]?.text || ""), `cliente sabe com quem fala: "${enviados[0]?.text}"`);

  const filaDepois = await AttendanceService.listQueue(tenant.id);
  ok(filaDepois.length === 2, `fila baixou para ${filaDepois.length}`);
  ok(filaDepois[0].position === 1, "quem era o segundo virou o primeiro");

  // ── 5. Transferência entre atendentes ───────────────────────
  console.log("\n5. Ana transfere para Bruno");
  const transferida = await AttendanceService.transfer(c1.id, { toUserId: bruno.id, actor: ana });
  ok(transferida.assignedTo?.name === "Bruno Lima", `agora com ${transferida.assignedTo?.name}`);
  const evTransfer = await prisma.conversationEvent.findFirst({
    where: { conversationId: c1.id, type: "TRANSFERRED" },
    orderBy: { createdAt: "desc" },
  });
  ok(!!evTransfer, "transferência registrada no histórico");
  ok(evTransfer?.actorName === "Ana Souza", `quem transferiu: ${evTransfer?.actorName}`);

  // ── 6. Devolver para a fila ─────────────────────────────────
  console.log("\n6. Bruno devolve para a fila");
  const devolvida = await AttendanceService.transfer(c1.id, { actor: bruno, reason: "Preciso de outro time" });
  ok(devolvida.phase === "QUEUE", `voltou para ${devolvida.phase}`);
  ok(devolvida.assignedToId === null, "sem dono enquanto espera");
  ok(devolvida.position === 3, `entra no fim da fila (posição ${devolvida.position})`);

  // ── 7. Devolver para a IA ───────────────────────────────────
  console.log("\n7. Devolver o atendimento para a IA");
  const naIA = await AttendanceService.returnToBot(c2.id, { actor: ana });
  ok(naIA.phase === "BOT", `fase ${naIA.phase}`);
  ok(naIA.botActive === true, "IA volta a responder");
  ok(naIA.queuedAt === null, "sai da fila");

  // ── 8. Encerrar ─────────────────────────────────────────────
  console.log("\n8. Encerrar o atendimento");
  enviados.length = 0;
  const encerrada = await AttendanceService.close(c3.id, { actor: bruno });
  ok(encerrada.phase === "CLOSED", `fase ${encerrada.phase}`);
  ok(!!encerrada.closedAt, "hora do encerramento gravada");
  ok(/encerrado/i.test(enviados[0]?.text || ""), `despedida enviada: "${enviados[0]?.text}"`);

  // ── 9. Cliente volta a escrever ─────────────────────────────
  console.log("\n9. Cliente escreve depois de encerrada");
  const reaberta = await AttendanceService.onInbound(c3.id);
  ok(reaberta.phase === "BOT", `reabre no automático (${reaberta.phase})`);
  ok(reaberta.botActive === true, "IA assume de novo");

  // ── 10. Reabrir pelo painel ─────────────────────────────────
  console.log("\n10. Reabrir pelo painel");
  await AttendanceService.close(c3.id, { actor: bruno, mensagem: null });
  const reaberta2 = await AttendanceService.reopen(c3.id, { actor: ana, comoHumano: true });
  ok(reaberta2.phase === "HUMAN", `fase ${reaberta2.phase}`);
  ok(reaberta2.assignedTo?.name === "Ana Souza", `assumida por ${reaberta2.assignedTo?.name}`);

  // ── 11. Encerrar em silêncio ────────────────────────────────
  console.log("\n11. Encerrar sem avisar o cliente");
  enviados.length = 0;
  await AttendanceService.close(c3.id, { actor: ana, mensagem: null });
  ok(enviados.length === 0, `nenhuma mensagem enviada (${enviados.length})`);

  // ── 12. Histórico completo ──────────────────────────────────
  console.log("\n12. Linha do tempo do atendimento");
  const eventos = await prisma.conversationEvent.findMany({
    where: { conversationId: c1.id },
    orderBy: { createdAt: "asc" },
  });
  const tipos = eventos.map((e) => e.type);
  ok(tipos[0] === "QUEUED", `começa com ${tipos[0]}`);
  ok(tipos.includes("ASSIGNED"), "registra quem assumiu");
  ok(tipos.includes("TRANSFERRED"), "registra a transferência");
  console.log(`     sequência: ${tipos.join(" → ")}`);

  // ── 13. Fila vazia depois de tudo ───────────────────────────
  console.log("\n13. Estado final");
  const filaFinal = await AttendanceService.listQueue(tenant.id);
  ok(filaFinal.length === 1, `sobrou ${filaFinal.length} na fila (a devolvida por Bruno)`);
  ok(filaFinal[0].position === 1, "posição recalculada");

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
