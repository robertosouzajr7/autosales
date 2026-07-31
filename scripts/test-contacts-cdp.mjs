/**
 * CDP de contatos: identidade única, fusão de duplicatas e API pública.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-contacts-cdp.mjs
 *
 * Cobre os cenários que hoje duplicam contato: o mesmo telefone escrito de
 * formas diferentes, a mesma pessoa em canais diferentes, importação
 * repetida, e o CRM mandando o mesmo contato duas vezes.
 */
import prisma from "../src/api/config/prisma.js";
import jwt from "jsonwebtoken";
import {
  normalizePhone, normalizeEmail, resolveContact, mergeLeads,
} from "../src/api/services/ContactIdentity.js";
import { gerarChave } from "../src/api/middlewares/apiKey.js";

const API = process.env.API || "http://127.0.0.1:3000";
const SEGREDO = process.env.JWT_SECRET;

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const token = (u) => jwt.sign({ userId: u.id, tenantId: u.tenantId, role: u.role }, SEGREDO, { expiresIn: "1h" });

async function chamar(caminho, u, opcoes = {}) {
  const res = await fetch(`${API}/api${caminho}`, {
    ...opcoes,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(u)}`, ...(opcoes.headers || {}) },
  });
  return { status: res.status, corpo: await res.json().catch(() => ({})) };
}

async function chamarComChave(caminho, chave, opcoes = {}) {
  const res = await fetch(`${API}/api${caminho}`, {
    ...opcoes,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}`, ...(opcoes.headers || {}) },
  });
  return { status: res.status, corpo: await res.json().catch(() => ({})) };
}

async function seed() {
  const plan = await prisma.plan.create({
    data: { name: `CDP ${Date.now()}`, priceMonthly: 0, priceYearly: 0, maxUsers: 10 },
  });
  const tenant = await prisma.tenant.create({
    data: { name: "Negócio CDP", email: `cdp${Date.now()}@teste.local`, planId: plan.id },
  });
  const dono = await prisma.user.create({
    data: { name: "Dono CDP", email: `dcdp${Date.now()}@teste.local`, password: "x", role: "OWNER", tenantId: tenant.id, emailVerified: true },
  });
  await prisma.pipelineStage.create({ data: { tenantId: tenant.id, name: "Novos", order: 0 } });
  return { tenant, dono };
}

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");
  const { tenant, dono } = await seed();
  const T = tenant.id;

  // ── 1. Normalização ─────────────────────────────────────────
  console.log("\n1. Telefone e e-mail em forma canônica");
  const canonico = "5571988887777";
  for (const variacao of ["5571988887777", "71988887777", "(71) 98888-7777", "+55 71 98888-7777", "5571988887777@s.whatsapp.net"]) {
    ok(normalizePhone(variacao) === canonico, `"${variacao}" → ${canonico}`);
  }
  ok(normalizePhone("557188887777") === canonico, `sem o nono dígito também converge`);
  ok(normalizePhone("João da Silva") === null, "nome não vira telefone");
  ok(normalizePhone("17841400000000000") === null, "IGSID não vira telefone");
  ok(normalizeEmail("  Joao@Empresa.COM ") === "joao@empresa.com", "e-mail sem caixa nem espaço");
  ok(normalizeEmail("não é email") === null, "texto solto não vira e-mail");

  // ── 2. Mesma pessoa, formatos diferentes ────────────────────
  console.log("\n2. O mesmo contato escrito de formas diferentes");
  const a = await resolveContact(T, { name: "Ana Souza", phone: "(71) 98888-7777" });
  const b = await resolveContact(T, { name: "Ana", phone: "5571988887777" });
  const c = await resolveContact(T, { name: "Ana S.", phone: "71 9 8888-7777" });
  ok(a.criado === true, "primeiro cadastro cria");
  ok(b.criado === false && b.lead.id === a.lead.id, "segundo reconhece o mesmo contato");
  ok(c.criado === false && c.lead.id === a.lead.id, "terceiro também");
  const totalAna = await prisma.lead.count({ where: { tenantId: T, phone: canonico } });
  ok(totalAna === 1, `só existe 1 contato para este telefone (${totalAna})`);

  // ── 3. Cruzamento de canais ─────────────────────────────────
  console.log("\n3. A mesma pessoa em canais diferentes");
  const wa = await resolveContact(T, { channel: "WHATSAPP", externalId: "5571977776666", phone: "5571977776666", name: "Bruno" });
  const site = await resolveContact(T, { channel: "SITE", externalId: "visitante-abc", email: "bruno@empresa.com", name: "Bruno" });
  ok(site.lead.id !== wa.lead.id, "sem dado em comum, são contatos separados (correto)");
  // Agora o formulário do site entrega o telefone: é a mesma pessoa.
  const juntou = await resolveContact(T, { email: "bruno@empresa.com", phone: "5571977776666" });
  ok(juntou.mesclados === 1, `os dois viraram um só (${juntou.mesclados} fundido)`);
  const sobrouWa = await prisma.lead.findUnique({ where: { id: wa.lead.id } });
  const sobrouSite = await prisma.lead.findUnique({ where: { id: site.lead.id } });
  ok(!!sobrouWa !== !!sobrouSite, "sobrou exatamente um dos dois");
  const bruno = sobrouWa || sobrouSite;
  ok(bruno.phone === "5571977776666" && bruno.email === "bruno@empresa.com", "o que sobrou tem telefone E e-mail");

  // ── 4. A fusão não perde histórico ──────────────────────────
  console.log("\n4. Fusão preserva histórico");
  const p1 = await resolveContact(T, { name: "Carla", phone: "5571966665555" });
  const p2 = await resolveContact(T, { name: "Carla Dias", email: "carla@empresa.com" });
  const conv1 = await prisma.conversation.create({ data: { tenantId: T, leadId: p1.lead.id } });
  const conv2 = await prisma.conversation.create({ data: { tenantId: T, leadId: p2.lead.id } });
  await prisma.message.create({ data: { tenantId: T, conversationId: conv1.id, content: "oi pelo whats", role: "USER" } });
  await prisma.message.create({ data: { tenantId: T, conversationId: conv2.id, content: "oi pelo site", role: "USER" } });
  await prisma.appointment.create({
    data: { tenantId: T, leadId: p2.lead.id, date: new Date(Date.now() + 86400000), title: "Consulta" },
  });

  await mergeLeads(p1.lead.id, p2.lead.id);
  const convs = await prisma.conversation.count({ where: { leadId: p1.lead.id } });
  const msgs = await prisma.message.count({ where: { conversation: { leadId: p1.lead.id } } });
  const ags = await prisma.appointment.count({ where: { leadId: p1.lead.id } });
  ok(convs === 1, `ficou 1 conversa (${convs})`);
  ok(msgs === 2, `as 2 mensagens ficaram juntas (${msgs})`);
  ok(ags === 1, `o agendamento mudou de dono (${ags})`);
  const carla = await prisma.lead.findUnique({ where: { id: p1.lead.id } });
  ok(carla.email === "carla@empresa.com", "e-mail do duplicado foi absorvido");
  ok(carla.name === "Carla", "nome do principal foi mantido");
  ok(carla.mergedCount === 1, "o contato registra que absorveu alguém");
  ok((await prisma.lead.findUnique({ where: { id: p2.lead.id } })) === null, "o duplicado deixou de existir");

  // ── 5. Opt-out sobrevive à fusão ────────────────────────────
  console.log("\n5. LGPD na fusão");
  const d1 = await resolveContact(T, { name: "Dani", phone: "5571955554444" });
  const d2 = await resolveContact(T, { name: "Dani", email: "dani@empresa.com" });
  await prisma.lead.update({ where: { id: d2.lead.id }, data: { optedOut: true, optOutAt: new Date() } });
  await mergeLeads(d1.lead.id, d2.lead.id);
  const dani = await prisma.lead.findUnique({ where: { id: d1.lead.id } });
  ok(dani.optedOut === true, "quem pediu para sair continua fora depois da fusão");

  // ── 6. Rotas da tela ────────────────────────────────────────
  console.log("\n6. Cadastro pela tela");
  let r = await chamar("/leads", dono, {
    method: "POST",
    body: JSON.stringify({ name: "Eduardo", phone: "(71) 94444-3333" }),
  });
  ok(r.status === 200, `criado (${r.status})`);
  ok(r.corpo.phone === "5571944443333", `telefone gravado canônico (${r.corpo.phone})`);
  const eduardoId = r.corpo.id;
  r = await chamar("/leads", dono, {
    method: "POST",
    body: JSON.stringify({ name: "Eduardo Lima", phone: "+55 71 94444-3333" }),
  });
  ok(r.corpo.id === eduardoId, "o mesmo telefone não cria um segundo contato");
  ok(r.corpo.duplicado === true, "e a tela é avisada de que já existia");

  console.log("\n7. Importação repetida");
  const linhas = [
    { name: "Fernanda", phone: "5571933332222", email: "fe@empresa.com" },
    { name: "Fernanda", phone: "(71) 93333-2222" },
  ];
  r = await chamar("/contacts/import-bulk", dono, { method: "POST", body: JSON.stringify({ contacts: linhas }) });
  ok(r.status === 200, `importado (${r.status})`);
  const fernandas = await prisma.lead.count({ where: { tenantId: T, phone: "5571933332222" } });
  ok(fernandas === 1, `arquivo com a mesma pessoa duas vezes gera 1 contato (${fernandas})`);
  // Rodar a mesma importação de novo não deve criar nada.
  r = await chamar("/contacts/import-bulk", dono, { method: "POST", body: JSON.stringify({ contacts: linhas }) });
  ok(r.corpo.criados === 0, `reimportar não cria nada (${r.corpo.criados} novo(s))`);

  // ── 8. Duplicatas herdadas ──────────────────────────────────
  console.log("\n8. Duplicatas da base antiga");
  // Criadas direto no banco, como se fossem anteriores ao CDP.
  const velho1 = await prisma.lead.create({ data: { tenantId: T, name: "Gustavo", phone: "5571922221111" } });
  const velho2 = await prisma.lead.create({ data: { tenantId: T, name: "Gustavo Reis", email: "gu@empresa.com" } });
  await prisma.lead.update({ where: { id: velho2.id }, data: { phone: null } });
  await prisma.contactIdentity.create({
    data: { tenantId: T, leadId: velho2.id, type: "EMAIL", value: "gu@empresa.com" },
  });
  await prisma.lead.create({ data: { tenantId: T, name: "Gu", email: "gu@empresa.com2" } });

  r = await chamar("/contacts/duplicates", dono);
  ok(r.status === 200, `lista de duplicatas responde (${r.status})`);
  ok(Array.isArray(r.corpo.grupos), "vem agrupado por pessoa");

  r = await chamar("/contacts/merge", dono, {
    method: "POST",
    body: JSON.stringify({ canonicalId: velho1.id, ids: [velho2.id] }),
  });
  ok(r.status === 200 && r.corpo.fundidos === 1, `fusão manual pela tela (${r.corpo.fundidos})`);
  const gustavo = await prisma.lead.findUnique({ where: { id: velho1.id } });
  ok(gustavo.email === "gu@empresa.com", "dados do duplicado foram para o principal");

  r = await chamar(`/contacts/${velho1.id}/identities`, dono);
  ok(r.status === 200 && r.corpo.identities.length >= 2, `o contato mostra suas identidades (${r.corpo.identities?.length})`);

  // ── 9. API pública com chave ────────────────────────────────
  console.log("\n9. API pública (/api/v1) para o CRM do cliente");
  r = await chamar("/integrations/api-keys", dono, {
    method: "POST",
    body: JSON.stringify({ name: "CRM da empresa" }),
  });
  ok(r.status === 200 && !!r.corpo.key, "chave criada");
  const chave = r.corpo.key;
  ok(chave.startsWith("av_live_"), `com prefixo reconhecível (${r.corpo.prefix})`);

  r = await chamar("/integrations/api-keys", dono);
  ok(r.status === 200 && r.corpo[0]?.hash === undefined, "a listagem nunca devolve a chave");

  let s = await chamarComChave("/v1/contacts", "av_live_chave-inventada");
  ok(s.status === 401, `chave inválida é barrada (${s.status})`);

  s = await chamarComChave("/v1/contacts", chave, {
    method: "POST",
    body: JSON.stringify({ name: "Helena Prado", email: "Helena@Empresa.com", phone: "(71) 91111-2222" }),
  });
  ok(s.status === 201, `contato criado pela API (${s.status})`);
  ok(s.corpo.created === true, "marcado como novo");
  const helenaId = s.corpo.id;
  ok(s.corpo.phone === "+5571911112222", `telefone devolvido em E.164 (${s.corpo.phone})`);

  s = await chamarComChave("/v1/contacts", chave, {
    method: "POST",
    body: JSON.stringify({ name: "Helena P.", phone: "5571911112222" }),
  });
  ok(s.status === 200 && s.corpo.id === helenaId, `reenviar atualiza em vez de duplicar (${s.status})`);

  s = await chamarComChave("/v1/contacts", chave, { method: "POST", body: JSON.stringify({ name: "Sem chave nenhuma" }) });
  ok(s.status === 400, `sem identificador é recusado (${s.status})`);

  s = await chamarComChave("/v1/contacts?phone=(71) 91111-2222", chave);
  ok(s.corpo.contacts?.length === 1, `busca aceita telefone formatado (${s.corpo.contacts?.length})`);
  ok(s.corpo.contacts?.[0]?.id === helenaId, "e acha o contato certo");

  s = await chamarComChave("/v1/contacts/batch", chave, {
    method: "POST",
    body: JSON.stringify({
      contacts: [
        { name: "Igor", email: "igor@empresa.com" },
        { name: "Igor Duplicado", email: "IGOR@empresa.com" },
        { name: "Sem nada" },
      ],
    }),
  });
  ok(s.status === 200, `lote aceito (${s.status})`);
  ok(s.corpo.criados === 1 && s.corpo.atualizados === 1, `1 criado, 1 reconhecido (${s.corpo.criados}/${s.corpo.atualizados})`);
  ok(s.corpo.ignorados.length === 1, "o registro sem identificador foi reportado");

  s = await chamarComChave(`/v1/contacts/${helenaId}`, chave, { method: "DELETE" });
  ok(s.corpo.optedOut === true, "exclusão pela API é opt-out, não apagar histórico");

  // Chave revogada perde o acesso na hora.
  const chaves = await prisma.apiKey.findMany({ where: { tenantId: T } });
  await chamar(`/integrations/api-keys/${chaves[0].id}`, dono, { method: "DELETE" });
  s = await chamarComChave("/v1/contacts", chave);
  ok(s.status === 401, `chave revogada para de funcionar (${s.status})`);

  // ── 10. Isolamento entre contas ─────────────────────────────
  console.log("\n10. Uma conta não enxerga contato da outra");
  const outro = await seed();
  await resolveContact(outro.tenant.id, { name: "Homônimo", phone: "5571988887777" });
  const naMinha = await prisma.lead.count({ where: { tenantId: T, phone: "5571988887777" } });
  const naOutra = await prisma.lead.count({ where: { tenantId: outro.tenant.id, phone: "5571988887777" } });
  ok(naMinha === 1 && naOutra === 1, "o mesmo telefone existe nas duas contas, separado");

  // ── 11. Provedores de CRM ───────────────────────────────────
  console.log("\n11. Catálogo de CRMs");
  r = await chamar("/integrations/crm/providers", dono);
  const ids = (r.corpo || []).map((p) => p.id);
  ok(r.status === 200, `catálogo responde (${r.status})`);
  for (const p of ["RDSTATION", "HUBSPOT", "SALESFORCE", "PIPEDRIVE"]) {
    ok(ids.includes(p), `${p} disponível`);
  }
  r = await chamar("/integrations/crm", dono, {
    method: "POST",
    body: JSON.stringify({ provider: "INVENTADO", accessToken: "x" }),
  });
  ok(r.status === 400, `CRM desconhecido é recusado (${r.status})`);
  r = await chamar("/integrations/crm", dono, { method: "POST", body: JSON.stringify({ provider: "HUBSPOT" }) });
  ok(r.status === 400, `sem token não salva (${r.status})`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
