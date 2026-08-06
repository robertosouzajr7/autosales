/**
 * Conversa do site: do visitante ao painel e de volta.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-chat-site.mjs
 *
 * O chat público era mão única: o visitante falava, a IA respondia na mesma
 * requisição, e o que o atendente escrevesse pelo painel era gravado e morria
 * ali. Aqui se verifica que a conversa mora no servidor, que a resposta do
 * humano chega ao visitante, e que ninguém lê a conversa de outro.
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
const chat = (corpo) =>
  fetch(`${API}/api/public/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
  }).then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => ({})) }));

const historico = (token) =>
  fetch(`${API}/api/public/chat/history?token=${encodeURIComponent(token || "")}`)
    .then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => ({})) }));

/** Abre o SSE do visitante e devolve o que chegar até o tempo acabar. */
function escutar(token, ms = 4000) {
  const recebidas = [];
  const controle = new AbortController();
  const pronto = fetch(`${API}/api/public/chat/stream?token=${encodeURIComponent(token)}`, {
    headers: { Accept: "text/event-stream" },
    signal: controle.signal,
  }).then(async (res) => {
    if (!res.ok) return { status: res.status, recebidas };
    const leitor = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await leitor.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        for (const bloco of buffer.split("\n\n")) {
          const linha = bloco.split("\n").find((l) => l.startsWith("data: "));
          if (linha) {
            try { recebidas.push(JSON.parse(linha.slice(6))); } catch {}
          }
        }
        buffer = buffer.slice(buffer.lastIndexOf("\n\n") + 2);
      }
    } catch { /* abortado */ }
    return { status: res.status, recebidas };
  }).catch(() => ({ status: 0, recebidas }));

  return { recebidas, encerrar: () => controle.abort(), pronto, ms };
}

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");

  const tenant = await prisma.tenant.create({ data: { name: "Clínica Site", email: `site-${marca}@teste.local` } });
  const atendente = await prisma.user.create({
    data: { name: "Marina", email: `marina-site-${marca}@teste.local`, password: "x", role: "OWNER", tenantId: tenant.id, emailVerified: true },
  });
  const tokenPainel = jwt.sign({ userId: atendente.id, tenantId: tenant.id, role: "OWNER" }, SEGREDO, { expiresIn: "1h" });

  // ── 1. A conversa começa e ganha credencial ─────────────────
  console.log("\n1. Início da conversa");
  let r = await chat({
    tenantId: tenant.id, message: "Oi, vocês atendem sábado?",
    name: "Paula Ribeiro", email: "paula@exemplo.com", phone: "11988887777",
  });
  ok(r.status === 200, `conversa iniciada (${r.status})`);
  ok(!!r.corpo.chatToken, "o visitante recebe a credencial da conversa");
  const token = r.corpo.chatToken;
  const leadId = r.corpo.leadId;

  const dados = jwt.decode(token);
  ok(dados?.tipo === "webchat", `a credencial é de webchat, não de painel (${dados?.tipo})`);
  ok(dados?.leadId === leadId, "e está presa a esta conversa");

  // ── 2. O histórico vem do servidor ──────────────────────────
  console.log("\n2. Histórico no servidor");
  r = await historico(token);
  ok(r.status === 200, `histórico responde (${r.status})`);
  ok(r.corpo.messages.some((m) => m.content.includes("atendem sábado")), "traz a mensagem do visitante");

  // ── 3. A resposta do atendente chega ao visitante ───────────
  console.log("\n3. Resposta do painel");
  const ouvinte = escutar(token);
  await new Promise((r) => setTimeout(r, 700)); // deixa o SSE conectar

  const envio = await fetch(`${API}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenPainel}` },
    body: JSON.stringify({ leadId, content: "Atendemos sim, das 9h às 13h!", role: "SDR" }),
  });
  ok(envio.status === 200, `o painel consegue responder um contato do site (${envio.status})`);

  await new Promise((r) => setTimeout(r, 1500));
  ouvinte.encerrar();
  await ouvinte.pronto;
  ok(
    ouvinte.recebidas.some((m) => m.content?.includes("das 9h às 13h")),
    `a resposta chega ao visitante em tempo real (${ouvinte.recebidas.length} evento(s))`
  );
  ok(!ouvinte.recebidas.some((m) => m.role === "USER"), "e a fala do próprio visitante não volta duplicada");

  r = await historico(token);
  ok(
    r.corpo.messages.some((m) => m.content.includes("das 9h às 13h")),
    "quem voltar depois também encontra a resposta no histórico"
  );

  // ── 4. Sem janela de 24h no canal próprio ───────────────────
  console.log("\n4. Janela de 24h não vale no site");
  const conversa = await prisma.conversation.findFirst({ where: { leadId } });
  await prisma.conversation.update({
    where: { id: conversa.id },
    data: { lastInboundAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
  });
  const tardia = await fetch(`${API}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenPainel}` },
    body: JSON.stringify({ leadId, content: "Passando para lembrar do seu horário.", role: "SDR" }),
  });
  ok(tardia.status === 200, `três dias depois ainda dá para responder (${tardia.status})`);

  // ── 5. A credencial de um não abre a conversa do outro ──────
  console.log("\n5. Isolamento");
  r = await historico("token-inventado");
  ok(r.status === 401, `credencial falsa é recusada (${r.status})`);

  const tokenDePainel = jwt.sign({ userId: atendente.id, tenantId: tenant.id, role: "OWNER" }, SEGREDO, { expiresIn: "1h" });
  r = await historico(tokenDePainel);
  ok(r.status === 401, `token de login não serve como credencial de chat (${r.status})`);

  const outroChat = await chat({
    tenantId: tenant.id, message: "oi", name: "Bruno", email: "bruno@exemplo.com", phone: "11955554444",
  });
  r = await historico(outroChat.corpo.chatToken);
  ok(
    !r.corpo.messages.some((m) => m.content.includes("das 9h às 13h")),
    "cada visitante enxerga só a própria conversa"
  );

  const stream = await fetch(`${API}/api/public/chat/stream?token=nao-vale`);
  ok(stream.status === 401, `o fluxo de eventos também exige credencial (${stream.status})`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
