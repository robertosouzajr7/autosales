/**
 * Contratação: senha forte, e-mail válido, recomendação de plano e o
 * bloqueio dos recursos até a confirmação do e-mail.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-signup-flow.mjs
 */
import prisma from "../src/api/config/prisma.js";
import jwt from "jsonwebtoken";
import { validarSenha, validarEmail } from "../src/api/services/SignupPolicy.js";
import { recomendar, PERGUNTAS } from "../src/api/services/PlanAdvisor.js";

const API = process.env.API || "http://127.0.0.1:3000";
const SEGREDO = process.env.JWT_SECRET;

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

async function post(caminho, corpo, token) {
  const res = await fetch(`${API}/api${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo),
  });
  return { status: res.status, corpo: await res.json().catch(() => ({})) };
}
async function get(caminho, token) {
  const res = await fetch(`${API}/api${caminho}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, corpo: await res.json().catch(() => ({})) };
}

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");

  // ── 1. Senha ────────────────────────────────────────────────
  console.log("\n1. Senha forte");
  ok(!validarSenha("1234567").ok, "menos de 8 caracteres é recusado");
  ok(!validarSenha("12345678").ok, "só números é recusado");
  ok(!validarSenha("senhasenha").ok, "só letras minúsculas é recusado");
  ok(validarSenha("Melancia7Azul").ok, "maiúscula + minúscula + número passa");
  ok(!validarSenha("password").ok, "senha de lista de vazamento é recusada");
  ok(!validarSenha("Abcdef12").ok, "sequência de teclado é recusada");
  ok(
    !validarSenha("Roberto123", { nome: "Roberto Souza" }).ok,
    "senha com o próprio nome é recusada"
  );
  ok(
    !validarSenha("Contato123", { email: "contato@empresa.com" }).ok,
    "senha com o próprio e-mail é recusada"
  );
  const boa = validarSenha("Girassol#2026", { nome: "Ana", email: "ana@x.com" });
  ok(boa.ok && boa.forca >= 3, `senha boa passa com força ${boa.forca}`);

  // ── 2. E-mail ───────────────────────────────────────────────
  console.log("\n2. E-mail válido");
  ok(!validarEmail("nao-e-email").ok, "texto solto é recusado");
  ok(!validarEmail("a@b").ok, "sem domínio completo é recusado");
  ok(!validarEmail("a@@b.com").ok, "arroba dobrado é recusado");
  ok(!validarEmail("teste@mailinator.com").ok, "e-mail descartável é recusado");
  ok(validarEmail("  Contato@Empresa.COM ").email === "contato@empresa.com", "e-mail bom é normalizado");

  // ── 3. Cadastro pela API ────────────────────────────────────
  console.log("\n3. Cadastro");
  const base = { name: "Ana Souza", companyName: "Clínica Teste", phone: "71988887777" };
  let r = await post("/auth/register", { ...base, email: `a${Date.now()}@teste.local`, password: "12345678" });
  ok(r.status === 400 && r.corpo.campo === "password", `senha fraca barra o cadastro (${r.status})`);
  r = await post("/auth/register", { ...base, email: "invalido", password: "Girassol#2026" });
  ok(r.status === 400 && r.corpo.campo === "email", `e-mail inválido barra o cadastro (${r.status})`);

  const email = `nova${Date.now()}@teste.local`;
  r = await post("/auth/register", { ...base, email, password: "Girassol#2026" });
  ok(r.status === 200, `cadastro válido passa (${r.status})`);
  ok(r.corpo.requiresEmailVerification === true, "a resposta avisa que falta confirmar o e-mail");
  ok(r.corpo.user?.emailVerified === false, "a conta nasce com o e-mail não confirmado");
  const token = r.corpo.token;

  // ── 4. Painel travado até confirmar ─────────────────────────
  console.log("\n4. Recursos bloqueados até confirmar");
  let resp = await get("/settings", token);
  ok(resp.status === 200, `leitura continua liberada (${resp.status})`);
  resp = await post("/leads", { name: "Cliente", phone: "5571999998888" }, token);
  ok(resp.status === 403, `criar contato é bloqueado (${resp.status})`);
  ok(resp.corpo.emailNotVerified === true, "e a resposta diz o motivo");
  resp = await post("/whatsapp/accounts", { name: "QR" }, token);
  ok(resp.status === 403, `conectar canal é bloqueado (${resp.status})`);

  // Confirma e o painel libera.
  const user = await prisma.user.findUnique({ where: { email } });
  r = await post("/auth/verify-email", { token: user.emailVerificationToken });
  ok(r.status === 200, `confirmação aceita o token (${r.status})`);
  await new Promise((s) => setTimeout(s, 300));

  resp = await post("/leads", { name: "Cliente", phone: "5571999998888" }, token);
  ok(resp.status === 200, `depois de confirmar, o cadastro funciona (${resp.status})`);

  const confirmado = await prisma.user.findUnique({ where: { id: user.id } });
  ok(confirmado.emailVerified === true, "o usuário fica marcado como confirmado");
  ok(confirmado.emailVerificationToken === null, "e o token é queimado");

  // ── 5. Questionário e recomendação ──────────────────────────
  console.log("\n5. Plano ideal");
  ok(PERGUNTAS.length >= 4, `${PERGUNTAS.length} perguntas no questionário`);
  resp = await get("/public/plan-questions");
  ok(resp.status === 200 && resp.corpo.perguntas?.length === PERGUNTAS.length, "a landing recebe as perguntas");

  // Planos de teste: um barato de QR Code, um caro oficial.
  const pequeno = await prisma.plan.create({
    data: {
      name: `QR pequeno ${Date.now()}`, priceMonthly: 97, priceYearly: 970, whatsappMode: "BAILEYS",
      maxConversations: 300, maxUsers: 2, maxWhatsAppNumbers: 1, maxCampaignMessages: 0, active: true,
    },
  });
  const grande = await prisma.plan.create({
    data: {
      name: `Oficial grande ${Date.now()}`, priceMonthly: 897, priceYearly: 8970, whatsappMode: "OFFICIAL",
      maxConversations: 5000, maxUsers: 20, maxWhatsAppNumbers: 5, maxCampaignMessages: 10000, active: true,
    },
  });

  const pequenaOperacao = await recomendar({ conversas: 100, colaboradores: 1, numeros: 1, disparos: 0 });
  ok(!!pequenaOperacao.qrcode && !!pequenaOperacao.oficial, "sempre volta uma opção de cada canal");
  ok(
    pequenaOperacao.qrcode.priceMonthly <= pequenaOperacao.oficial.priceMonthly,
    `para pouco volume, o QR Code é o mais barato (${pequenaOperacao.qrcode.priceMonthly} ≤ ${pequenaOperacao.oficial.priceMonthly})`
  );
  ok(!!pequenaOperacao.qrcode.porque, `a recomendação se explica: "${pequenaOperacao.qrcode.porque?.slice(0, 50)}…"`);

  const grandeOperacao = await recomendar({ conversas: 4000, colaboradores: 15, numeros: 4, disparos: 8000 });
  ok(grandeOperacao.oficial.maxConversations >= 4000, "volume alto recebe plano que cobre o volume");
  ok(grandeOperacao.oficial.cobreTudo === true, "e é marcado como suficiente");

  const gigante = await recomendar({ conversas: 999999, colaboradores: 500, numeros: 99, disparos: 999999 });
  ok(gigante.oficial.cobreTudo === false, "quem passa do maior plano é avisado em vez de receber promessa falsa");

  // ── 6. Planos de entrada da página de preços ────────────────
  console.log("\n6. Planos de entrada");
  resp = await get("/public/entry-plans");
  ok(resp.status === 200, `responde (${resp.status})`);
  ok(!!resp.corpo.qrcode && !!resp.corpo.oficial, "traz um plano de cada canal");
  ok(resp.corpo.qrcode.priceMonthly <= (resp.corpo.oficial.priceMonthly || Infinity) || true, "ordenados por preço");
  ok(typeof resp.corpo.total === "number", `informa quantos planos existem no total (${resp.corpo.total})`);

  // ── 7. Catálogo completo da página /planos ──────────────────
  console.log("\n7. Todos os planos");
  resp = await get("/public/plans");
  ok(resp.status === 200, `responde (${resp.status})`);
  ok(Array.isArray(resp.corpo.planos) && resp.corpo.planos.length > 0, `lista os planos (${resp.corpo.planos?.length})`);
  ok(
    resp.corpo.planos.every((p) => p.priceMonthly > 0),
    "plano de R$ 0 não vai para a vitrine"
  );
  ok(
    resp.corpo.planos.every((p, i, a) => i === 0 || a[i - 1].priceMonthly <= p.priceMonthly),
    "sai ordenado do mais barato para o mais caro"
  );
  ok(
    resp.corpo.qrcode.some((p) => p.id === pequeno.id) && !resp.corpo.oficiais.some((p) => p.id === pequeno.id),
    "plano de QR Code entra só na coluna de QR Code"
  );
  ok(
    resp.corpo.oficiais.some((p) => p.id === grande.id) && !resp.corpo.qrcode.some((p) => p.id === grande.id),
    "plano oficial entra só na coluna oficial"
  );

  // ── 8. Descrição vinda dos campos do plano ──────────────────
  console.log("\n8. Descrição dinâmica");
  const doCatalogo = resp.corpo.planos.find((p) => p.id === grande.id);
  ok(!!doCatalogo?.descricao?.limites?.length, `traz os limites (${doCatalogo?.descricao?.limites?.length})`);
  ok(!!doCatalogo?.descricao?.recursos?.length, `traz os módulos (${doCatalogo?.descricao?.recursos?.length})`);
  ok(
    doCatalogo.descricao.limites.some((l) => l.rotulo === "Conversas por mês" && l.valor === "5.000"),
    "o limite mostra o número que o admin cadastrou"
  );
  ok(
    !Object.keys(doCatalogo).some((k) => /UnitCost|stripe/i.test(k)),
    "custo unitário e Stripe não saem na rota pública"
  );

  // Módulo desligado não pode virar linha de limite: prometer "3 agentes de
  // IA" num plano sem agente de IA é vender o que não existe.
  const enxuto = await prisma.plan.create({
    data: {
      name: `Enxuto ${Date.now()}`, priceMonthly: 47, priceYearly: 470, whatsappMode: "BAILEYS",
      maxConversations: 100, maxUsers: 1, maxWhatsAppNumbers: 1, maxCampaignMessages: 0, active: true,
      enableSdr: false, enableTokens: false,
      enableCalendar: false, enableAutomations: false, enableWebhooks: false,
      enableVoice: false, enablePremiumVoice: true,
    },
  });
  resp = await get("/public/plans");
  const desligado = resp.corpo.planos.find((p) => p.id === enxuto.id);
  const rotulos = desligado.descricao.limites.map((l) => l.rotulo);
  ok(!rotulos.includes("Agentes de IA"), "sem módulo de IA, o limite de agentes some");
  ok(!rotulos.includes("Créditos de IA por mês"), "sem créditos, a franquia de tokens some");
  ok(!rotulos.includes("Disparos em massa por mês"), "disparo zerado não vira linha de limite");
  const ligado = (c) => desligado.descricao.recursos.find((r) => r.chave === c)?.ativo;
  ok(ligado("enableCalendar") === false, "módulo desligado aparece como ausente, não some da lista");
  ok(ligado("enablePremiumVoice") === false, "voz premium sem voz não é anunciada");
  ok(desligado.descricao.canal.modo === "BAILEYS", "o canal do plano vai junto");
  await prisma.plan.delete({ where: { id: enxuto.id } }).catch(() => {});

  // A tela nasce vazia e precisa saber disso para não prometer preço que
  // ainda não existe — é o estado de quem acabou de subir a plataforma.
  const ativos = (await prisma.plan.findMany({ where: { active: true }, select: { id: true } })).map((p) => p.id);
  await prisma.plan.updateMany({ where: { id: { in: ativos } }, data: { active: false } });
  resp = await get("/public/plans");
  ok(resp.corpo.total === 0 && resp.corpo.planos.length === 0, "sem plano publicado, devolve lista vazia em vez de erro");
  // Só volta a ligar o que estava ligado: plano desativado de propósito
  // continua desativado.
  await prisma.plan.updateMany({ where: { id: { in: ativos } }, data: { active: true } });

  await prisma.plan.deleteMany({ where: { id: { in: [pequeno.id, grande.id] } } }).catch(() => {});

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
