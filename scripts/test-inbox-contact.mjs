/**
 * Ficha do contato e contador do menu, no inbox.
 *
 *   DATABASE_URL=... node scripts/test-inbox-contact.mjs
 *
 * Dois comportamentos que a tela de Conversas passou a depender:
 *
 * 1. A ficha ao lado da conversa precisa trazer etapa, tags, próximo
 *    agendamento e anotação — e só aceitar gravar os dois campos editáveis,
 *    de dentro do próprio tenant.
 * 2. O badge do menu conta CONVERSAS que esperam atenção, não mensagens.
 *    Somar fila + não lidas contava a mesma conversa duas vezes.
 */
import prisma from "../src/api/config/prisma.js";
import * as MessageController from "../src/api/controllers/MessageController.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

/** Chama um controller sem subir o Express: req/res de mentira. */
function chamar(handler, { tenantId, params = {}, body = {} }) {
  return new Promise((resolve) => {
    let status = 200;
    const res = {
      status(c) { status = c; return this; },
      json(payload) { resolve({ status, body: payload }); },
    };
    handler({ tenantId, params, body }, res);
  });
}

async function criarTenant(nome) {
  const plan = await prisma.plan.create({
    data: { name: `P-${Date.now()}-${Math.random()}`, priceMonthly: 1, priceYearly: 10 },
  });
  return prisma.tenant.create({
    data: { name: nome, email: `t${Date.now()}${Math.random()}@teste.local`, planId: plan.id },
  });
}

async function main() {
  console.log("\n=== Ficha do contato e contador do inbox ===\n");

  const tenant = await criarTenant("Clínica A");
  const outro = await criarTenant("Clínica B");

  const etapa = await prisma.pipelineStage.create({ data: { tenantId: tenant.id, name: "Proposta", order: 0 } });
  const etapaAlheia = await prisma.pipelineStage.create({ data: { tenantId: outro.id, name: "Alheia", order: 0 } });
  const tag = await prisma.tag.create({ data: { name: "VIP", color: "#7C5CFF" } });

  const lead = await prisma.lead.create({
    data: {
      tenantId: tenant.id, name: "Marina Costa", phone: "5571988124470",
      email: "marina@exemplo.com", source: "Instagram Ads",
      tags: { connect: { id: tag.id } },
    },
  });
  const conversa = await prisma.conversation.create({
    data: { tenantId: tenant.id, leadId: lead.id, phase: "BOT" },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: conversa.id, tenantId: tenant.id, role: "USER", content: "Oi" },
      { conversationId: conversa.id, tenantId: tenant.id, role: "ASSISTANT", content: "Olá!" },
    ],
  });

  // Um agendamento no passado e dois no futuro: a ficha tem que mostrar o
  // futuro mais próximo, e ignorar cancelado.
  const daquiA = (h) => new Date(Date.now() + h * 3600e3);
  await prisma.appointment.create({ data: { tenantId: tenant.id, leadId: lead.id, title: "Antigo", date: daquiA(-48), status: "COMPLETED" } });
  await prisma.appointment.create({ data: { tenantId: tenant.id, leadId: lead.id, title: "Cancelado", date: daquiA(2), status: "CANCELLED" } });
  await prisma.appointment.create({ data: { tenantId: tenant.id, leadId: lead.id, title: "Retorno", date: daquiA(24), status: "SCHEDULED", meetLink: "https://meet.google.com/abc-defg-hij" } });

  // ── 1. Leitura da ficha ─────────────────────────────────────
  console.log("1. Leitura da ficha");
  let r = await chamar(MessageController.getConversationContact, { tenantId: tenant.id, params: { leadId: lead.id } });
  ok(r.status === 200, "responde 200");
  ok(r.body.name === "Marina Costa", "traz o nome");
  ok(r.body.source === "Instagram Ads", "traz a origem");
  ok(r.body.messageCount === 2, `conta as mensagens (${r.body.messageCount})`);
  ok(r.body.tags?.[0]?.name === "VIP", "traz as tags");
  ok(r.body.nextAppointment?.title === "Retorno", `o próximo agendamento é o futuro mais perto ("${r.body.nextAppointment?.title}")`);
  ok(!!r.body.nextAppointment?.meetLink, "com o link da reunião junto");

  // ── 2. Contato de outro tenant ──────────────────────────────
  console.log("\n2. Isolamento entre contas");
  r = await chamar(MessageController.getConversationContact, { tenantId: outro.id, params: { leadId: lead.id } });
  ok(r.status === 404, "a ficha some para quem é de outra conta");

  // ── 3. Gravação do que a ficha edita ────────────────────────
  console.log("\n3. Gravação");
  r = await chamar(MessageController.updateConversationContact, {
    tenantId: tenant.id, params: { leadId: lead.id },
    body: { stageId: etapa.id, notes: "Pediu orçamento." },
  });
  ok(r.status === 200, "grava etapa e anotação");
  let fresco = await prisma.lead.findUnique({ where: { id: lead.id } });
  ok(fresco.stageId === etapa.id, "a etapa mudou de verdade");
  ok(fresco.notes === "Pediu orçamento.", "a anotação também");

  r = await chamar(MessageController.updateConversationContact, {
    tenantId: tenant.id, params: { leadId: lead.id }, body: { stageId: etapaAlheia.id },
  });
  ok(r.status === 400, "recusa etapa de outra conta");
  fresco = await prisma.lead.findUnique({ where: { id: lead.id } });
  ok(fresco.stageId === etapa.id, "e não move o contato");

  // Campo fora da lista permitida não pode passar para o banco.
  r = await chamar(MessageController.updateConversationContact, {
    tenantId: tenant.id, params: { leadId: lead.id }, body: { name: "Invadido", tenantId: outro.id },
  });
  fresco = await prisma.lead.findUnique({ where: { id: lead.id } });
  ok(fresco.name === "Marina Costa" && fresco.tenantId === tenant.id, "ignora campos que a ficha não edita");

  r = await chamar(MessageController.updateConversationContact, {
    tenantId: tenant.id, params: { leadId: lead.id }, body: { stageId: "" },
  });
  fresco = await prisma.lead.findUnique({ where: { id: lead.id } });
  ok(fresco.stageId === null, "e aceita tirar o contato do funil");

  // ── 4. Contador do menu ─────────────────────────────────────
  console.log("\n4. Contador do menu");
  r = await chamar(MessageController.getPendingCount, { tenantId: tenant.id });
  ok(r.body.pending === 0, `nada esperando ainda (${r.body.pending})`);

  // Uma conversa na fila COM mensagens não lidas: é um item, não quatro.
  await prisma.conversation.update({
    where: { id: conversa.id }, data: { phase: "QUEUE", unreadCount: 3 },
  });
  r = await chamar(MessageController.getPendingCount, { tenantId: tenant.id });
  ok(r.body.pending === 1, `fila + não lidas na mesma conversa conta 1, não 4 (${r.body.pending})`);
  ok(r.body.queue === 1, "e a fila é reportada à parte");

  // Outra conversa, só com não lidas, sem estar na fila.
  const lead2 = await prisma.lead.create({ data: { tenantId: tenant.id, name: "Bruno" } });
  await prisma.conversation.create({ data: { tenantId: tenant.id, leadId: lead2.id, phase: "BOT", unreadCount: 2 } });
  r = await chamar(MessageController.getPendingCount, { tenantId: tenant.id });
  ok(r.body.pending === 2, `não lida fora da fila também entra (${r.body.pending})`);
  ok(r.body.queue === 1, "sem inflar a fila");

  // Encerrada não pede nada de ninguém.
  const lead3 = await prisma.lead.create({ data: { tenantId: tenant.id, name: "Carla" } });
  await prisma.conversation.create({ data: { tenantId: tenant.id, leadId: lead3.id, phase: "CLOSED", unreadCount: 9 } });
  r = await chamar(MessageController.getPendingCount, { tenantId: tenant.id });
  ok(r.body.pending === 2, "conversa encerrada não entra na conta");

  r = await chamar(MessageController.getPendingCount, { tenantId: outro.id });
  ok(r.body.pending === 0, "e a conta do vizinho continua zerada");

  console.log(falhas === 0 ? "\n✅ Todos os cenários passaram." : `\n❌ ${falhas} falha(s).`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
