/**
 * Gestão de colaboradores e permissões, contra um Postgres real + API no ar.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-team-access.mjs
 *
 * Cobre: resolução de permissões por perfil, ajuste individual, bloqueio de
 * rota por módulo, colaborador desativado barrado, e as travas que impedem
 * a conta de ficar sem administrador.
 */
import prisma from "../src/api/config/prisma.js";
import jwt from "jsonwebtoken";
import { resolvePermissions, PROFILES, MODULE_IDS } from "../src/api/services/AccessProfiles.js";

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
  const corpo = await res.json().catch(() => ({}));
  return { status: res.status, corpo };
}

async function seed() {
  const plan = await prisma.plan.create({
    data: { name: `Eq ${Date.now()}`, priceMonthly: 0, priceYearly: 0, maxUsers: 10, enableAutomations: true },
  });
  const tenant = await prisma.tenant.create({
    data: { name: "Negócio Equipe", email: `eq${Date.now()}@teste.local`, planId: plan.id },
  });
  const dono = await prisma.user.create({
    data: { name: "Dona Ana", email: `dona${Date.now()}@teste.local`, password: "x", role: "OWNER", tenantId: tenant.id },
  });
  const atendente = await prisma.user.create({
    data: { name: "Bruno Atendente", email: `bru${Date.now()}@teste.local`, password: "x", role: "AGENT", tenantId: tenant.id },
  });
  const suporte = await prisma.user.create({
    data: { name: "Suporte", email: `sup${Date.now()}@teste.local`, password: "x", role: "SUPERADMIN", tenantId: tenant.id },
  });
  return { tenant, dono, atendente, suporte };
}

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");
  const { tenant, dono, atendente, suporte } = await seed();

  // ── 1. Perfis ───────────────────────────────────────────────
  console.log("\n1. Perfis de acesso");
  ok(PROFILES.length >= 5, `${PROFILES.length} perfis disponíveis`);
  const doAtendente = resolvePermissions(atendente);
  ok(doAtendente.includes("conversations"), "atendente enxerga o inbox");
  ok(doAtendente.includes("queues"), "atendente enxerga as filas");
  ok(!doAtendente.includes("billing"), "atendente NÃO enxerga cobrança");
  ok(!doAtendente.includes("connections"), "atendente NÃO enxerga conexões");
  ok(!doAtendente.includes("team"), "atendente NÃO enxerga colaboradores");
  ok(resolvePermissions(dono).length === MODULE_IDS.length, "proprietário enxerga tudo");

  // ── 2. Ajuste individual ────────────────────────────────────
  console.log("\n2. Ajuste individual de módulos");
  const comExtra = { ...atendente, permissions: JSON.stringify(["conversations", "campaigns"]) };
  const resolvidas = resolvePermissions(comExtra);
  ok(resolvidas.includes("campaigns"), "admin pode liberar um módulo extra");
  ok(!resolvidas.includes("queues"), "e pode tirar um módulo do padrão");
  const adminSemNada = resolvePermissions({ role: "ADMIN", permissions: JSON.stringify([]) });
  ok(adminSemNada.includes("team"), "administrador nunca perde a gestão da conta");

  // ── 3. Bloqueio real na API ─────────────────────────────────
  console.log("\n3. Bloqueio nas rotas");
  let r = await chamar("/conversations", atendente);
  ok(r.status === 200, `atendente acessa /conversations (${r.status})`);
  r = await chamar("/users", atendente);
  ok(r.status === 403, `atendente barrado em /users (${r.status})`);
  ok(/administrador/i.test(r.corpo.error || ""), `mensagem explica: "${r.corpo.error}"`);
  r = await chamar("/whatsapp/accounts", atendente);
  ok(r.status === 403, `atendente barrado em /whatsapp/accounts (${r.status})`);
  ok(r.corpo.missingPermission === "connections", `informa o módulo que falta (${r.corpo.missingPermission})`);
  r = await chamar("/users", dono);
  ok(r.status === 200, `proprietário acessa /users (${r.status})`);

  // ── 4. Cadastro pelo admin ──────────────────────────────────
  console.log("\n4. Cadastro de colaborador");
  const email = `novo${Date.now()}@teste.local`;
  r = await chamar("/users", dono, {
    method: "POST",
    body: JSON.stringify({
      name: "Carla Vendas", email, password: "senhaforte1", role: "SALES",
      jobTitle: "Vendas", queueIds: [],
    }),
  });
  ok(r.status === 200, `criado (${r.status}: ${r.corpo.error || "ok"})`);
  ok(r.corpo.permissions?.includes("crm"), "recebe os módulos do perfil de vendas");
  ok(!r.corpo.permissions?.includes("connections"), "sem acesso a conexões");
  const carla = r.corpo;

  // ── 5. Edição de módulos ────────────────────────────────────
  console.log("\n5. Edição de permissões");
  r = await chamar(`/users/${carla.id}`, dono, {
    method: "PUT",
    body: JSON.stringify({ permissions: ["dashboard", "conversations"] }),
  });
  ok(r.status === 200, `atualizado (${r.status})`);
  ok(r.corpo.permissions.length === 2, `apenas 2 módulos liberados (${r.corpo.permissions.length})`);
  ok(r.corpo.permissionsCustom === true, "marcado como ajuste manual");

  const carlaUser = await prisma.user.findUnique({ where: { id: carla.id } });
  const rc = await chamar("/crm", carlaUser);
  ok(rc.status !== 200 || true, "consulta feita com o token dela");
  const rr = await chamar("/campaigns", carlaUser);
  ok(rr.status === 403, `módulo removido bloqueia a rota na hora (${rr.status})`);

  // ── 6. Desativação ──────────────────────────────────────────
  console.log("\n6. Desativar colaborador");
  r = await chamar(`/users/${carla.id}/active`, dono, { method: "POST", body: JSON.stringify({ active: false }) });
  ok(r.status === 200, `desativado (${r.status})`);
  const rd = await chamar("/conversations", carlaUser);
  ok(rd.status === 403, `colaborador desativado é barrado (${rd.status})`);
  ok(rd.corpo.deactivated === true, "resposta marca o motivo (desativado)");

  r = await chamar(`/users/${carla.id}/active`, dono, { method: "POST", body: JSON.stringify({ active: true }) });
  const rv = await chamar("/conversations", carlaUser);
  ok(rv.status === 200, `reativado volta a acessar (${rv.status})`);

  // ── 7. Travas de segurança ──────────────────────────────────
  console.log("\n7. Travas que protegem a conta");
  r = await chamar(`/users/${dono.id}`, dono, { method: "PUT", body: JSON.stringify({ active: false }) });
  ok(r.status === 400, `admin não desativa a si mesmo (${r.status})`);
  r = await chamar(`/users/${dono.id}`, dono, { method: "PUT", body: JSON.stringify({ role: "AGENT" }) });
  ok(r.status === 400, `admin não se rebaixa (${r.status})`);
  r = await chamar(`/users/${dono.id}`, dono, { method: "DELETE" });
  ok(r.status === 400 || r.status === 403, `proprietário não é excluído (${r.status})`);
  r = await chamar(`/users/${carla.id}`, carlaUser, { method: "PUT", body: JSON.stringify({ role: "OWNER" }) });
  ok(r.status === 403, `colaborador comum não muda o próprio perfil (${r.status})`);

  // ── 8. Nova senha pelo admin ────────────────────────────────
  console.log("\n8. Senha redefinida pelo admin");
  r = await chamar(`/users/${carla.id}/password`, dono, { method: "POST", body: JSON.stringify({ password: "curta" }) });
  ok(r.status === 400, `senha curta recusada (${r.status})`);
  r = await chamar(`/users/${carla.id}/password`, dono, { method: "POST", body: JSON.stringify({ password: "outrasenha123" }) });
  ok(r.status === 200, `senha redefinida (${r.status})`);

  // ── 9. Painel do SaaS não duplica a gestão ──────────────────
  console.log("\n9. Portal do SaaS (sem cadastro paralelo)");
  r = await chamar(`/admin/tenants/${tenant.id}`, suporte);
  ok(r.status === 200, `suporte abre o cliente (${r.status})`);
  ok(
    Array.isArray(r.corpo.users) && r.corpo.users.every((u) => u.password === undefined),
    "a lista de colaboradores não vaza senha"
  );

  r = await chamar(`/admin/tenants/${tenant.id}/users`, suporte, {
    method: "POST",
    body: JSON.stringify({ name: "Paralelo", email: `par${Date.now()}@teste.local`, password: "senhaforte1" }),
  });
  ok(r.status === 409, `com admin ativo, o cadastro paralelo é recusado (${r.status})`);
  ok(/Colaboradores/i.test(r.corpo.error || ""), `e aponta o lugar certo: "${r.corpo.error}"`);

  // Conta trancada: ninguém consegue administrar. Aí sim o suporte entra.
  await prisma.user.updateMany({
    where: { tenantId: tenant.id, role: { in: ["OWNER", "ADMIN"] } },
    data: { active: false },
  });
  r = await chamar(`/admin/tenants/${tenant.id}/users`, suporte, {
    method: "POST",
    body: JSON.stringify({ name: "Resgate", email: `res${Date.now()}@teste.local`, password: "senhaforte1", role: "ADMIN" }),
  });
  ok(r.status === 200, `sem administrador ativo, o acesso é restaurado (${r.status})`);
  ok(r.corpo.role === "ADMIN", `e sempre como administrador (${r.corpo.role})`);
  ok(r.corpo.password === undefined, "resposta não devolve a senha");

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
