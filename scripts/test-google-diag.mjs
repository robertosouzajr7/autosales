/**
 * Diagnóstico do Google: cada modo de falha tem que ser nomeado.
 *
 *   DATABASE_URL=... node scripts/test-google-diag.mjs
 *
 * O modo de falha que motivou isto era o pior possível: o painel dizia
 * "conectado", o agendamento aparecia, nenhum erro subia para a tela e o link
 * simplesmente não existia. Aqui cada causa é encenada e o diagnóstico tem que
 * apontar qual é — e o motivo tem que ficar gravado na conta.
 */
import prisma from "../src/api/config/prisma.js";
import { google } from "googleapis";
import CalendarService from "../calendar_service.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const LINK = "https://meet.google.com/qwe-rtyu-iop";

// Encena a API do Google. `cenario` decide como ela se comporta.
let cenario = "ok";
const apagados = [];
google.calendar = () => ({
  events: {
    insert: async () => {
      if (cenario === "semPermissao") {
        const e = new Error("Request had insufficient authentication scopes.");
        e.code = 403;
        throw e;
      }
      if (cenario === "semMeet") {
        return { data: { id: "evt-sem-meet" } }; // agenda aceita, Meet não vem
      }
      return { data: { id: "evt-ok", hangoutLink: LINK } };
    },
    get: async () => (cenario === "semMeet" ? { data: { id: "evt-sem-meet" } } : { data: { id: "evt-ok", hangoutLink: LINK } }),
    delete: async ({ eventId }) => { apagados.push(eventId); return {}; },
    list: async () => ({ data: { items: [] } }),
  },
});

// Token: `tokenValido` decide se o refresh ainda vale.
let tokenValido = true;
google.auth.OAuth2 = class {
  setCredentials() {}
  async getAccessToken() {
    if (!tokenValido) {
      const e = new Error("invalid_grant: Token has been expired or revoked.");
      throw e;
    }
    return { token: "access-token" };
  }
};

async function main() {
  process.env.GOOGLE_CLIENT_ID = "id-de-teste";
  process.env.GOOGLE_CLIENT_SECRET = "segredo-de-teste";
  process.env.GOOGLE_REDIRECT_URI = "https://exemplo.local/api/auth/google/callback";

  const plan = await prisma.plan.create({
    data: { name: `Diag ${Date.now()}`, priceMonthly: 0, priceYearly: 0, enableCalendar: true },
  });
  const criarTenant = (extra) =>
    prisma.tenant.create({
      data: { name: "Diag", email: `dg${Date.now()}${Math.random()}@teste.local`, planId: plan.id, ...extra },
    });

  // ── 1. Tudo certo ───────────────────────────────────────────
  console.log("\n1. Conexão saudável");
  const bom = await criarTenant({ googleRefreshToken: "refresh-ok" });
  let r = await CalendarService.diagnosticar(bom.id);
  ok(r.tokenValido && r.escreveNaAgenda && r.geraMeet, "os cinco elos passam");
  ok(!r.erro, "sem erro a relatar");
  ok(apagados.includes("evt-ok"), "e o evento de teste é apagado da agenda");
  ok((await prisma.tenant.findUnique({ where: { id: bom.id } })).googleLastError === null, "a conta fica sem erro anotado");

  // ── 2. Sem conta conectada ──────────────────────────────────
  console.log("\n2. Nenhuma conta conectada");
  const vazio = await criarTenant({});
  r = await CalendarService.diagnosticar(vazio.id);
  ok(r.tokenSalvo === false, "aponta que não há conta");
  ok(/Conecte em Conexões/i.test(r.erro || ""), `dizendo o que fazer ("${r.erro}")`);

  // ── 3. Token revogado/expirado ──────────────────────────────
  console.log("\n3. Autorização expirada ou revogada");
  tokenValido = false;
  const morto = await criarTenant({ googleRefreshToken: "refresh-morto" });
  r = await CalendarService.diagnosticar(morto.id);
  ok(r.tokenSalvo === true && r.tokenValido === false, "token salvo mas inválido — o caso que se disfarçava de 'conectado'");
  ok(/expirou ou foi revogada/i.test(r.erro || ""), `com a causa em português ("${r.erro?.slice(0, 60)}...")`);
  ok(/Testing/i.test(r.erro || ""), "e o aviso do projeto em modo Testing, que derruba o token a cada 7 dias");
  const anotado = await prisma.tenant.findUnique({ where: { id: morto.id } });
  ok(!!anotado.googleLastError, "o motivo fica gravado na conta");
  ok(!!anotado.googleCheckedAt, "com a data da verificação");
  tokenValido = true;

  // ── 4. Agenda aceita evento, mas não gera Meet ──────────────
  console.log("\n4. Agenda que não gera Meet");
  cenario = "semMeet";
  const semMeet = await criarTenant({ googleRefreshToken: "refresh-ok" });
  r = await CalendarService.diagnosticar(semMeet.id);
  ok(r.escreveNaAgenda === true, "grava na agenda");
  ok(r.geraMeet === false, "mas não gera link — que é exatamente o sintoma relatado");
  ok(/não criou sala do Meet/i.test(r.erro || ""), `e o diagnóstico separa isso de 'não conectou' ("${r.erro?.slice(0, 50)}...")`);
  ok(apagados.includes("evt-sem-meet"), "o evento de teste também é apagado");

  // Criar um agendamento nesse cenário tem que anotar o motivo.
  const lead = await prisma.lead.create({ data: { tenantId: semMeet.id, name: "M", phone: "5571999990000" } });
  await CalendarService.criarEvento(semMeet.id, {
    titulo: "X", inicio: new Date(Date.now() + 3600e3), fim: new Date(Date.now() + 7200e3), lead,
  });
  const t4 = await prisma.tenant.findUnique({ where: { id: semMeet.id } });
  ok(/não gerou sala do Meet/i.test(t4.googleLastError || ""), "e agendar sem link deixa o motivo registrado, não some");

  // ── 5. Permissão insuficiente ───────────────────────────────
  console.log("\n5. Permissão insuficiente");
  cenario = "semPermissao";
  const semPerm = await criarTenant({ googleRefreshToken: "refresh-ok" });
  r = await CalendarService.diagnosticar(semPerm.id);
  ok(r.escreveNaAgenda === false, "não consegue gravar");
  ok(/permissão/i.test(r.erro || ""), `e diz que é permissão ("${r.erro?.slice(0, 60)}...")`);
  cenario = "ok";

  // ── 6. Servidor sem credenciais ─────────────────────────────
  console.log("\n6. Servidor sem credenciais");
  const guardado = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  r = await CalendarService.diagnosticar(bom.id);
  ok(r.configurado === false, "detecta a falta das variáveis");
  ok(/GOOGLE_CLIENT_ID/.test(r.erro || ""), "nomeando qual falta");
  process.env.GOOGLE_CLIENT_ID = guardado;

  console.log(falhas === 0 ? "\n✅ Todos os cenários passaram." : `\n❌ ${falhas} falha(s).`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
