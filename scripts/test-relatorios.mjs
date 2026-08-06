/**
 * Relatórios: os números do período.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-relatorios.mjs
 *
 * A tela antiga estimava o que não sabia — "Visitantes" era o total de
 * contatos vezes três, "Qualificados" era 40% do total, o ROI era a string
 * "150%". Aqui se verifica que cada número sai de uma contagem, que o
 * período recorta de verdade e que o que não dá para responder volta nulo
 * em vez de zero.
 */
import prisma from "../src/api/config/prisma.js";
import jwt from "jsonwebtoken";

const API = process.env.API || "http://127.0.0.1:3000";
const SEGREDO = process.env.JWT_SECRET;
const DIA = 24 * 60 * 60 * 1000;

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = Date.now();
let token;
const relatorio = (dias = 30) =>
  fetch(`${API}/api/stats/report?days=${dias}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => ({})) }));

async function conversa(tenantId, { canal = "WHATSAPP", diasAtras = 1, humano = null, fila = null, fase = "BOT", i = 0 }) {
  const quando = new Date(Date.now() - diasAtras * DIA);
  const lead = await prisma.lead.create({
    data: {
      tenantId, name: `Contato ${i}`, channel: canal, createdAt: quando,
      phone: canal === "WHATSAPP" ? `5511${String(80000000 + i)}` : null,
      externalId: canal !== "WHATSAPP" ? `x-${marca}-${i}` : null,
    },
  });
  const c = await prisma.conversation.create({
    data: { leadId: lead.id, tenantId, phase: fase, assignedToId: humano, queueId: fila, createdAt: quando },
  });
  await prisma.message.create({
    data: { conversationId: c.id, tenantId, role: "USER", content: "oi", createdAt: quando },
  });
  await prisma.message.create({
    data: { conversationId: c.id, tenantId, role: "ASSISTANT", content: "olá", createdAt: new Date(quando.getTime() + 20000) },
  });
  return { lead, conversa: c };
}

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");

  const tenant = await prisma.tenant.create({ data: { name: "Relatórios", email: `rel-t-${marca}@teste.local` } });
  const dono = await prisma.user.create({
    data: { name: "Dona", email: `rel-d-${marca}@teste.local`, password: "x", role: "OWNER", tenantId: tenant.id, emailVerified: true },
  });
  const ana = await prisma.user.create({
    data: { name: "Ana", email: `rel-a-${marca}@teste.local`, password: "x", role: "AGENT", tenantId: tenant.id, emailVerified: true },
  });
  const fila = await prisma.serviceQueue.create({ data: { tenantId: tenant.id, name: "Recepção", color: "#2563EB" } });
  token = jwt.sign({ userId: dono.id, tenantId: tenant.id, role: "OWNER" }, SEGREDO, { expiresIn: "1h" });

  // ── 1. Conta vazia não inventa nada ─────────────────────────
  console.log("\n1. Conta sem movimento");
  let r = await relatorio();
  ok(r.status === 200, `responde (${r.status})`);
  ok(r.corpo.volume.conversas === 0, "zero conversas");
  ok(r.corpo.atendimento.percentualIa === null, "sem conversa não existe percentual de IA (null, não 0%)");
  ok(r.corpo.atendimento.respostaSegundos === null, "nem tempo de resposta");
  ok(r.corpo.agenda.comparecimento === null, "nem taxa de comparecimento");
  ok(r.corpo.canais.length === 0 && r.corpo.equipe.length === 0, "listas vazias, não preenchidas com estimativa");

  // ── 2. Volume e canais ──────────────────────────────────────
  console.log("\n2. Volume e canais");
  let i = 0;
  for (const canal of ["WHATSAPP", "WHATSAPP", "WHATSAPP", "INSTAGRAM", "SITE"]) {
    await conversa(tenant.id, { canal, diasAtras: 3, i: i++ });
  }
  r = await relatorio();
  ok(r.corpo.volume.conversas === 5, `cinco conversas (${r.corpo.volume.conversas})`);
  ok(r.corpo.volume.contatosNovos === 5, `cinco contatos novos (${r.corpo.volume.contatosNovos})`);
  ok(r.corpo.volume.recebidas === 5 && r.corpo.volume.enviadas === 5, `mensagens contadas nos dois sentidos (${r.corpo.volume.recebidas}/${r.corpo.volume.enviadas})`);
  const porCanal = Object.fromEntries(r.corpo.canais.map((c) => [c.canal, c.total]));
  ok(porCanal.WHATSAPP === 3 && porCanal.INSTAGRAM === 1 && porCanal.SITE === 1, `canais separados (${JSON.stringify(porCanal)})`);
  ok(r.corpo.volume.serie.length === 30, `série com um ponto por dia (${r.corpo.volume.serie.length})`);
  ok(r.corpo.volume.serie.filter((d) => d.conversas > 0).length === 1, "e só o dia com movimento tem barra");

  // ── 3. O período recorta ────────────────────────────────────
  console.log("\n3. Recorte do período");
  await conversa(tenant.id, { diasAtras: 45, i: i++ });
  await conversa(tenant.id, { diasAtras: 20, i: i++ });
  r = await relatorio(7);
  ok(r.corpo.volume.conversas === 5, `7 dias pega só o que é de 3 dias atrás (${r.corpo.volume.conversas})`);
  r = await relatorio(30);
  ok(r.corpo.volume.conversas === 6, `30 dias inclui a de 20 dias e ignora a de 45 (${r.corpo.volume.conversas})`);
  r = await relatorio(90);
  ok(r.corpo.volume.conversas === 7, `90 dias alcança as sete (${r.corpo.volume.conversas})`);

  // ── 4. IA x equipe ──────────────────────────────────────────
  console.log("\n4. O que a IA resolveu sozinha");
  await conversa(tenant.id, { diasAtras: 2, humano: ana.id, fila: fila.id, fase: "CLOSED", i: i++ });
  await conversa(tenant.id, { diasAtras: 2, fila: fila.id, fase: "QUEUE", i: i++ });
  r = await relatorio(30);
  ok(r.corpo.atendimento.equipe === 2, `duas passaram por gente (${r.corpo.atendimento.equipe})`);
  ok(r.corpo.atendimento.ia === 6, `seis a IA resolveu (${r.corpo.atendimento.ia})`);
  ok(r.corpo.atendimento.percentualIa === 75, `75% (${r.corpo.atendimento.percentualIa}%)`);
  ok(r.corpo.equipe[0]?.nome === "Ana" && r.corpo.equipe[0]?.atendidas === 1, "e a conversa aparece no nome de quem assumiu");
  ok(r.corpo.atendimento.respostaSegundos === 20, `primeira resposta em 20s (${r.corpo.atendimento.respostaSegundos})`);

  // ── 5. Filas ────────────────────────────────────────────────
  console.log("\n5. Filas");
  const naFila = r.corpo.filas.find((f) => f.id === fila.id);
  ok(naFila?.total === 2, `duas conversas passaram pela fila (${naFila?.total})`);
  ok(naFila?.esperando === 1, `uma ainda espera (${naFila?.esperando})`);

  // ── 6. Agenda ───────────────────────────────────────────────
  console.log("\n6. Agenda");
  const alvo = await prisma.lead.findFirst({ where: { tenantId: tenant.id } });
  for (const [status, dias] of [["COMPLETED", 5], ["COMPLETED", 4], ["COMPLETED", 3], ["NOSHOW", 2], ["CANCELLED", 1]]) {
    await prisma.appointment.create({
      data: { tenantId: tenant.id, leadId: alvo.id, title: "Consulta", status, date: new Date(Date.now() - dias * DIA) },
    });
  }
  r = await relatorio(30);
  ok(r.corpo.agenda.concluidos === 3 && r.corpo.agenda.faltas === 1, `3 comparecimentos e 1 falta (${r.corpo.agenda.concluidos}/${r.corpo.agenda.faltas})`);
  ok(r.corpo.agenda.comparecimento === 75, `taxa de 75% — cancelado não conta contra (${r.corpo.agenda.comparecimento}%)`);

  // Compromisso futuro não entra na taxa: ninguém faltou ainda.
  await prisma.appointment.create({
    data: { tenantId: tenant.id, leadId: alvo.id, title: "Futuro", status: "SCHEDULED", date: new Date(Date.now() + 3 * DIA) },
  });
  r = await relatorio(30);
  ok(r.corpo.agenda.comparecimento === 75, `compromisso futuro não mexe na taxa (${r.corpo.agenda.comparecimento}%)`);
  ok(r.corpo.agenda.agendados === 6, `mas conta como marcado (${r.corpo.agenda.agendados})`);

  // ── 7. Nada vaza de outro negócio ───────────────────────────
  console.log("\n7. Isolamento");
  const outro = await prisma.tenant.create({ data: { name: "Outro", email: `rel-o-${marca}@teste.local` } });
  const donoOutro = await prisma.user.create({
    data: { name: "Dono2", email: `rel-do-${marca}@teste.local`, password: "x", role: "OWNER", tenantId: outro.id, emailVerified: true },
  });
  token = jwt.sign({ userId: donoOutro.id, tenantId: outro.id, role: "OWNER" }, SEGREDO, { expiresIn: "1h" });
  r = await relatorio(90);
  ok(r.corpo.volume.conversas === 0 && r.corpo.filas.length === 0, "outro negócio vê a própria conta vazia");

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
