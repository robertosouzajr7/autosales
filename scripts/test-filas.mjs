/**
 * Filas de atendimento: cadastro e vínculo com colaboradores.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-filas.mjs
 *
 * O modelo já existia, mas não havia por onde criar fila — então todo mundo
 * caía num balaio só. Aqui se verifica o ciclo que a tela usa: criar,
 * vincular várias pessoas, uma pessoa em várias filas, trocar a padrão e
 * remover sem perder conversa.
 */
import prisma from "../src/api/config/prisma.js";
import jwt from "jsonwebtoken";

const API = process.env.API || "http://127.0.0.1:3000";
const SEGREDO = process.env.JWT_SECRET;

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
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

  const tenant = await prisma.tenant.create({ data: { name: "Clínica Filas", email: `filas-${marca}@teste.local` } });
  const dono = await prisma.user.create({
    data: { name: "Dona", email: `dona-${marca}@teste.local`, password: "x", role: "OWNER", tenantId: tenant.id, emailVerified: true },
  });
  const ana = await prisma.user.create({
    data: { name: "Ana", email: `ana-${marca}@teste.local`, password: "x", role: "AGENT", tenantId: tenant.id, emailVerified: true },
  });
  const bruno = await prisma.user.create({
    data: { name: "Bruno", email: `bruno-${marca}@teste.local`, password: "x", role: "AGENT", tenantId: tenant.id, emailVerified: true },
  });
  token = jwt.sign({ userId: dono.id, tenantId: tenant.id, role: dono.role }, SEGREDO, { expiresIn: "1h" });

  // ── 1. Criar fila ───────────────────────────────────────────
  console.log("\n1. Cadastro");
  let r = await chamar("/queues", { method: "POST", body: JSON.stringify({ name: "" }) });
  ok(r.status === 400, `fila sem nome é recusada (${r.status})`);

  r = await chamar("/queues", {
    method: "POST",
    body: JSON.stringify({ name: "Recepção", description: "Primeiro contato", color: "#2563EB", userIds: [ana.id, bruno.id] }),
  });
  ok(r.status === 200, `fila criada (${r.status})`);
  const recepcao = r.corpo;
  ok(recepcao.isDefault === true, "a primeira fila do negócio vira a padrão");

  r = await chamar("/queues", {
    method: "POST",
    body: JSON.stringify({ name: "Financeiro", color: "#22A06B", userIds: [ana.id] }),
  });
  const financeiro = r.corpo;
  ok(financeiro.isDefault === false, "a segunda não rouba o padrão");

  // ── 2. Uma pessoa em várias filas ───────────────────────────
  console.log("\n2. Múltiplas filas por pessoa");
  r = await chamar("/queues");
  const porNome = Object.fromEntries(r.corpo.map((f) => [f.name, f]));
  ok(porNome["Recepção"].membros.length === 2, `Recepção com dois atendentes (${porNome["Recepção"].membros.length})`);
  const filasDaAna = r.corpo.filter((f) => f.membros.some((m) => m.id === ana.id));
  ok(filasDaAna.length === 2, `Ana atende as duas filas (${filasDaAna.length})`);
  const filasDoBruno = r.corpo.filter((f) => f.membros.some((m) => m.id === bruno.id));
  ok(filasDoBruno.length === 1, `Bruno atende só a Recepção (${filasDoBruno.length})`);

  // ── 3. Vínculo pelo cadastro do colaborador ─────────────────
  console.log("\n3. Vínculo pelo cadastro do colaborador");
  r = await chamar(`/users/${bruno.id}`, {
    method: "PUT",
    body: JSON.stringify({ name: "Bruno", role: "AGENT", queueIds: [recepcao.id, financeiro.id] }),
  });
  ok(r.status === 200, `colaborador salvo (${r.status})`);
  const vinculos = await prisma.queueMember.count({ where: { userId: bruno.id } });
  ok(vinculos === 2, `Bruno passou a atender duas filas (${vinculos})`);

  r = await chamar("/users");
  const brunoNaLista = r.corpo.find((u) => u.id === bruno.id);
  ok((brunoNaLista?.queues || []).length === 2, `a lista de colaboradores mostra as filas (${(brunoNaLista?.queues || []).length})`);

  // ── 4. Trocar a fila padrão ─────────────────────────────────
  console.log("\n4. Fila padrão");
  await chamar(`/queues/${financeiro.id}`, { method: "PUT", body: JSON.stringify({ isDefault: true }) });
  const padroes = await prisma.serviceQueue.findMany({ where: { tenantId: tenant.id, isDefault: true } });
  ok(padroes.length === 1 && padroes[0].id === financeiro.id, `só uma padrão por vez (${padroes.length})`);

  // ── 5. Contagem de quem espera ──────────────────────────────
  console.log("\n5. Quem está esperando");
  const lead = await prisma.lead.create({ data: { tenantId: tenant.id, name: "Contato", phone: `5511${marca}`.slice(0, 13) } });
  await prisma.conversation.create({
    data: { leadId: lead.id, tenantId: tenant.id, phase: "QUEUE", queueId: recepcao.id },
  });
  r = await chamar("/queues");
  const comEspera = r.corpo.find((f) => f.id === recepcao.id);
  ok(comEspera.aguardando === 1, `a fila mostra 1 esperando (${comEspera.aguardando})`);

  // ── 6. Remoção não descarta conversa em espera ──────────────
  console.log("\n6. Remoção");
  r = await chamar(`/queues/${recepcao.id}`, { method: "DELETE" });
  ok(r.status === 409, `fila com gente esperando não é removida (${r.status})`);
  ok(/esperando/i.test(r.corpo.error || ""), `e diz o porquê: "${r.corpo.error}"`);

  await prisma.conversation.updateMany({ where: { queueId: recepcao.id }, data: { phase: "HUMAN" } });
  r = await chamar(`/queues/${recepcao.id}`, { method: "DELETE" });
  ok(r.status === 200, `depois de esvaziada, sai (${r.status})`);
  const aindaExiste = await prisma.user.findUnique({ where: { id: ana.id } });
  ok(!!aindaExiste, "e os colaboradores continuam na conta");

  // ── 7. Fila é do negócio, não da plataforma ─────────────────
  console.log("\n7. Isolamento entre negócios");
  const outro = await prisma.tenant.create({ data: { name: "Outro", email: `outro-filas-${marca}@teste.local` } });
  const donoOutro = await prisma.user.create({
    data: { name: "Dono2", email: `dono2-${marca}@teste.local`, password: "x", role: "OWNER", tenantId: outro.id, emailVerified: true },
  });
  token = jwt.sign({ userId: donoOutro.id, tenantId: outro.id, role: "OWNER" }, SEGREDO, { expiresIn: "1h" });
  r = await chamar("/queues");
  ok(Array.isArray(r.corpo) && r.corpo.length === 0, `outro negócio não enxerga estas filas (${r.corpo.length})`);
  r = await chamar(`/queues/${financeiro.id}`, { method: "PUT", body: JSON.stringify({ name: "Invadida" }) });
  ok(r.status === 404, `nem consegue editar (${r.status})`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
