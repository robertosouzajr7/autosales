/**
 * Depoimentos da landing: cadastro pelo painel do SaaS e leitura pela página
 * pública.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-landing-testimonials.mjs
 *
 * Depoimento é declaração de cliente real publicada como prova social. O que
 * se verifica aqui: só entra o que está completo, a nota não sai da escala,
 * apagar tudo volta a seção ao estado sem depoimento, e o resto da landing
 * não é atropelado no caminho.
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

async function chamar(caminho, token, opcoes = {}) {
  const res = await fetch(`${API}/api${caminho}`, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opcoes.headers || {}),
    },
  });
  return { status: res.status, corpo: await res.json().catch(() => ({})) };
}

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");

  const marca = Date.now();
  const tenant = await prisma.tenant.create({
    data: { name: "SaaS", email: `saas-dep-${marca}@teste.local` },
  });
  const admin = await prisma.user.create({
    data: {
      name: "Suporte", email: `sup-dep-${marca}@teste.local`, password: "x",
      role: "SUPERADMIN", tenantId: tenant.id, emailVerified: true,
    },
  });
  const token = jwt.sign({ userId: admin.id, tenantId: tenant.id, role: admin.role }, SEGREDO, { expiresIn: "1h" });

  const salvar = (corpo) => chamar("/admin/landing-settings", token, { method: "PUT", body: JSON.stringify(corpo) });
  const lidos = (r) => JSON.parse(r.corpo?.testimonials || "[]");

  // Estado inicial conhecido, para não depender do que já estava no banco.
  await salvar({ testimonials: [], contactEmail: "contato@teste.local" });

  // ── 1. Cadastro pelo painel ─────────────────────────────────
  console.log("\n1. Cadastro");
  let r = await salvar({
    testimonials: [
      { nome: "Ana Prado", papel: "Clínica Vida", texto: "Parou de perder consulta por WhatsApp sem resposta.", nota: 5 },
      { nome: "Bruno Lima", papel: "Studio B", texto: "O agente confirma sozinho e a agenda encheu.", nota: 4 },
    ],
  });
  ok(r.status === 200, `salvou (${r.status})`);
  let lista = lidos(r);
  ok(lista.length === 2, `dois depoimentos guardados (${lista.length})`);
  ok(lista[0].nome === "Ana Prado" && lista[0].nota === 5, "nome e nota chegam inteiros");
  ok(typeof r.corpo.testimonials === "string", "guardados como JSON, não como objeto solto");

  // ── 2. Depoimento incompleto não é depoimento ───────────────
  console.log("\n2. O que não entra");
  r = await salvar({
    testimonials: [
      { nome: "Ana Prado", texto: "Vale.", nota: 5 },
      { nome: "", texto: "Ótimo produto!", nota: 5 },        // sem quem assina
      { nome: "Carlos", texto: "   ", nota: 5 },              // sem o que foi dito
    ],
  });
  lista = lidos(r);
  ok(lista.length === 1, `sem nome ou sem texto é descartado (sobrou ${lista.length})`);
  ok(lista[0].nome === "Ana Prado", "sobra o que está completo");

  // ── 3. A nota não sai da escala ─────────────────────────────
  console.log("\n3. Nota");
  r = await salvar({
    testimonials: [
      { nome: "A", texto: "t", nota: 9 },
      { nome: "B", texto: "t", nota: 0 },
      { nome: "C", texto: "t", nota: "quatro" },
      { nome: "D", texto: "t" },
    ],
  });
  lista = lidos(r);
  ok(lista[0].nota === 5, `nota acima da escala vira 5 (${lista[0].nota})`);
  ok(lista[1].nota === 1, `nota abaixo vira 1 (${lista[1].nota})`);
  ok(lista[2].nota === 5, `nota que não é número vira 5 (${lista[2].nota})`);
  ok(lista[3].nota === 5, `sem nota, 5 (${lista[3].nota})`);

  // ── 4. Apagar volta ao estado sem depoimento ────────────────
  console.log("\n4. Apagar");
  r = await salvar({ testimonials: [] });
  ok(r.corpo.testimonials === null, `lista vazia grava null (${JSON.stringify(r.corpo.testimonials)})`);
  r = await salvar({ testimonials: [{ nome: "", texto: "" }] });
  ok(r.corpo.testimonials === null, "lista só com incompletos também zera");

  // ── 5. Formato inválido é recusado, não gravado ─────────────
  console.log("\n5. Formato inválido");
  await salvar({ testimonials: [{ nome: "Ana", texto: "Guarda isto." }] });
  r = await salvar({ testimonials: "{isto não é json" });
  ok(r.status === 400, `string quebrada é recusada (${r.status})`);
  r = await salvar({ testimonials: { nome: "Ana" } });
  ok(r.status === 400, `objeto solto é recusado (${r.status})`);
  let atual = await chamar("/admin/landing-settings", token);
  ok(lidos(atual)[0]?.nome === "Ana", "e o que estava salvo continua lá");

  // ── 6. O resto da landing não é atropelado ──────────────────
  console.log("\n6. Convivência com os outros campos");
  const antes = (await chamar("/admin/landing-settings", token)).corpo;
  r = await salvar({ ...antes, contactWhatsApp: "5511988887777" });
  ok(r.corpo.contactWhatsApp === "5511988887777", "salvar a tela inteira atualiza o contato");
  ok(lidos(r)[0]?.nome === "Ana", "e mantém os depoimentos");
  ok(r.corpo.contactEmail === "contato@teste.local", "e os campos que não mudaram");
  ok(r.corpo.id === "singleton", `id não é sobrescrito pelo corpo da requisição (${r.corpo.id})`);
  r = await salvar({ inventado: "x", testimonials: [{ nome: "Ana", texto: "Guarda isto." }] });
  ok(r.status === 200, `campo desconhecido é ignorado em vez de derrubar o salvamento (${r.status})`);

  // ── 7. A landing pública enxerga ────────────────────────────
  console.log("\n7. Leitura pela página pública");
  const pub = await chamar("/public/landing");
  ok(pub.status === 200, `landing pública responde (${pub.status})`);
  const doPublico = JSON.parse(pub.corpo?.settings?.testimonials || "[]");
  ok(doPublico[0]?.nome === "Ana", "e recebe os depoimentos cadastrados");

  // ── 8. Só o painel do SaaS cadastra ─────────────────────────
  console.log("\n8. Quem pode cadastrar");
  const dono = await prisma.user.create({
    data: {
      name: "Dono", email: `dono-dep-${marca}@teste.local`, password: "x",
      role: "OWNER", tenantId: tenant.id, emailVerified: true,
    },
  });
  const tokenDono = jwt.sign({ userId: dono.id, tenantId: tenant.id, role: dono.role }, SEGREDO, { expiresIn: "1h" });
  r = await chamar("/admin/landing-settings", tokenDono, {
    method: "PUT", body: JSON.stringify({ testimonials: [{ nome: "Fake", texto: "Melhor de todos." }] }),
  });
  ok(r.status === 403 || r.status === 401, `cliente não publica depoimento na landing (${r.status})`);
  r = await chamar("/admin/landing-settings", null, { method: "PUT", body: JSON.stringify({ testimonials: [] }) });
  ok(r.status === 401 || r.status === 403, `nem quem não está logado (${r.status})`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
