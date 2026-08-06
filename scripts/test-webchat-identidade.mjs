/**
 * Identificação do visitante no chat público (landing e widget do site).
 *
 *   DATABASE_URL=... API=http://127.0.0.1:3000 node scripts/test-webchat-identidade.mjs
 *
 * A conversa do site chegava ao painel como "Visitante do site": sem nome,
 * sem e-mail e sem telefone, ninguém conseguia retomar o contato depois que
 * a aba fechava. Agora a conversa só começa identificada.
 */
import prisma from "../src/api/config/prisma.js";

const API = process.env.API || "http://127.0.0.1:3000";
let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = Date.now();
const chat = (corpo) =>
  fetch(`${API}/api/public/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  }).then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => ({})) }));

async function main() {
  const tenant = await prisma.tenant.create({
    data: { name: "Clínica Web", email: `web-${marca}@teste.local` },
  });

  // ── 1. Sem identificação, a conversa não começa ─────────────
  console.log("\n1. Conversa nova exige os três dados");
  let r = await chat({ tenantId: tenant.id, message: "oi" });
  ok(r.status === 400 && r.corpo.identificacaoNecessaria, `recusada sem nada (${r.status})`);

  r = await chat({ tenantId: tenant.id, message: "oi", name: "Ana" });
  ok(r.status === 400, "só o nome não basta");

  r = await chat({ tenantId: tenant.id, message: "oi", name: "Ana", email: "ana@exemplo.com" });
  ok(r.status === 400, "nome e e-mail sem telefone também não");

  r = await chat({ tenantId: tenant.id, message: "oi", name: "Ana", email: "não-é-email", phone: "11988887777" });
  ok(r.status === 400, "e-mail inválido é recusado");

  r = await chat({ tenantId: tenant.id, message: "oi", name: "Ana", email: "ana@exemplo.com", phone: "123" });
  ok(r.status === 400, "telefone que não é telefone é recusado");

  // ── 2. Com os três, a conversa nasce identificada ───────────
  console.log("\n2. Contato criado com nome, e-mail e telefone");
  r = await chat({
    tenantId: tenant.id, message: "quero saber os valores",
    name: "Ana Prado", email: "ana.prado@exemplo.com", phone: "11988887777",
  });
  ok(r.status === 200 && !!r.corpo.leadId, `conversa começou (${r.status})`);
  const lead = await prisma.lead.findUnique({ where: { id: r.corpo.leadId } });
  ok(lead?.name === "Ana Prado", `nome guardado (${lead?.name})`);
  ok(lead?.email === "ana.prado@exemplo.com", `e-mail guardado (${lead?.email})`);
  ok(!!lead?.phone && lead.phone.includes("11988887777"), `telefone guardado (${lead?.phone})`);
  ok(lead?.channel === "SITE", `canal correto (${lead?.channel})`);
  ok(lead?.source === "WEBCHAT", `origem correta (${lead?.source})`);

  // ── 3. Mensagens seguintes não pedem tudo de novo ───────────
  console.log("\n3. Continuidade");
  r = await chat({ tenantId: tenant.id, message: "e tem horário sábado?", leadId: lead.id });
  ok(r.status === 200, `segue com o leadId da sessão (${r.status})`);
  const mensagens = await prisma.message.count({
    where: { conversation: { leadId: lead.id }, role: "USER" },
  });
  ok(mensagens === 2, `as duas mensagens do visitante foram registradas (${mensagens})`);

  // ── 4. Contato antigo é completado, não sobrescrito ─────────
  console.log("\n4. Contato que já existia sem os dados");
  const antigo = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Visitante do site", channel: "SITE" },
  });
  r = await chat({
    tenantId: tenant.id, message: "oi", leadId: antigo.id,
    name: "Bruno Lima", email: "bruno@exemplo.com", phone: "11977776666",
  });
  ok(r.status === 200, `conversa segue (${r.status})`);
  const completado = await prisma.lead.findUnique({ where: { id: antigo.id } });
  ok(completado.name === "Bruno Lima", `o rótulo genérico deu lugar ao nome (${completado.name})`);
  ok(completado.email === "bruno@exemplo.com", "e-mail preenchido");

  const jaTinhaNome = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Carla Menezes", email: "carla@exemplo.com", channel: "SITE" },
  });
  await chat({
    tenantId: tenant.id, message: "oi", leadId: jaTinhaNome.id,
    name: "Outro Nome", email: "outro@exemplo.com", phone: "11966665555",
  });
  const preservado = await prisma.lead.findUnique({ where: { id: jaTinhaNome.id } });
  ok(preservado.name === "Carla Menezes", `nome já conhecido não é sobrescrito (${preservado.name})`);
  ok(preservado.email === "carla@exemplo.com", "nem o e-mail");
  ok(!!preservado.phone, "mas o que faltava foi preenchido");

  // ── 5. leadId de outro negócio não é aceito ─────────────────
  console.log("\n5. leadId vem do navegador, então é conferido");
  const outro = await prisma.tenant.create({ data: { name: "Outro", email: `outro-${marca}@teste.local` } });
  r = await chat({ tenantId: outro.id, message: "oi", leadId: lead.id });
  ok(r.status === 400, `contato de outro negócio não é reaproveitado (${r.status})`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
