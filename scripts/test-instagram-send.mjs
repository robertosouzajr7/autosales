/**
 * Resposta do atendente pelo Instagram.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-instagram-send.mjs
 *
 * A DM do Instagram chegava no inbox mas a resposta não saía: o envio pedia
 * telefone, e contato de Instagram não tem telefone — o identificador dele é
 * o IGSID. Aqui se verifica que o canal do contato decide o transporte, que o
 * IGSID chega à API da Meta, e que o WhatsApp continua como estava.
 */
import prisma from "../src/api/config/prisma.js";
import MessagingService from "../src/api/services/MessagingService.js";
import { MetaManager } from "../meta.js";
import jwt from "jsonwebtoken";

const API = process.env.API || "http://127.0.0.1:3000";
const SEGREDO = process.env.JWT_SECRET;

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = `${Date.now()}${Math.random()}`.replace(/0\./g, "");
let sequencia = 0;

async function negocio() {
  const id = `${marca}-${sequencia++}`;
  const tenant = await prisma.tenant.create({
    data: { name: "Negócio IG", email: `ig-${id}@teste.local` },
  });
  const dono = await prisma.user.create({
    data: {
      name: "Dono", email: `dono-ig-${id}@teste.local`, password: "x",
      role: "OWNER", tenantId: tenant.id, emailVerified: true,
    },
  });
  return { tenant, dono };
}

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");
  const { tenant, dono } = await negocio();

  const conta = await prisma.whatsAppAccount.create({
    data: {
      tenantId: tenant.id, name: "@negocio", channel: "INSTAGRAM",
      igId: `ig-${marca}`, pageId: "pagina-123", accessToken: "EAAtoken",
      enabled: true, status: "CONNECTED",
    },
  });

  const contatoIg = await prisma.lead.create({
    data: {
      tenantId: tenant.id, name: "Visitante do Insta", channel: "INSTAGRAM",
      externalId: "IGSID-999", igUsername: "visitante", waAccountId: conta.id,
    },
  });

  // A Meta de verdade não entra no teste: guardamos o que teria sido enviado.
  const enviados = [];
  const originalTexto = MetaManager.sendInstagramMessage;
  const originalMidia = MetaManager.sendInstagramMedia;
  MetaManager.sendInstagramMessage = async (pageId, token, destino, texto) => {
    enviados.push({ tipo: "texto", pageId, token, destino, texto });
    return { message_id: "mid.1" };
  };
  MetaManager.sendInstagramMedia = async (pageId, token, destino, url, tipo) => {
    enviados.push({ tipo: "midia", pageId, token, destino, url, formato: tipo });
    return { message_id: "mid.2" };
  };

  // ── 1. O contato do Instagram recebe pelo Instagram ─────────
  console.log("\n1. Envio pelo canal certo");
  let r = await MessagingService.sendToLead(contatoIg, "Oi! Já te respondo.");
  ok(r.ok === true, `envio aceito (${JSON.stringify(r)})`);
  ok(enviados.length === 1 && enviados[0].tipo === "texto", "saiu pela DM do Instagram");
  ok(enviados[0].destino === "IGSID-999", `endereçado ao IGSID (${enviados[0].destino})`);
  ok(enviados[0].pageId === "pagina-123" && enviados[0].token === "EAAtoken", "com as credenciais da conta que recebeu a conversa");

  // ── 2. Mídia vai como anexo, e a legenda em separado ────────
  console.log("\n2. Mídia");
  enviados.length = 0;
  r = await MessagingService.sendToLead(contatoIg, "", {
    mediaUrl: "https://exemplo.test/foto.jpg", mediaType: "image", caption: "Olha o antes e depois",
  });
  ok(r.ok === true, "envio de mídia aceito");
  ok(enviados[0]?.tipo === "midia" && enviados[0].formato === "image", "anexo de imagem");
  ok(enviados[1]?.texto === "Olha o antes e depois", "a DM não tem legenda, então o texto vai como mensagem seguinte");

  // ── 3. Contato antigo, com o IGSID no lugar do telefone ─────
  console.log("\n3. Contato criado antes do campo externalId");
  enviados.length = 0;
  const antigo = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Antigo", channel: "INSTAGRAM", phone: "IGSID-777", waAccountId: conta.id },
  });
  r = await MessagingService.sendToLead(antigo, "oi");
  ok(r.ok === true && enviados[0]?.destino === "IGSID-777", "ainda é atendido (o IGSID estava em phone)");

  // ── 4. Sem conta conectada, o motivo aparece ────────────────
  console.log("\n4. Quando não dá para enviar");
  const outro = await negocio();
  const orfao = await prisma.lead.create({
    data: { tenantId: outro.tenant.id, name: "Sem conta", channel: "INSTAGRAM", externalId: "IGSID-1" },
  });
  r = await MessagingService.sendToLead(orfao, "oi");
  ok(r.ok === false && /conta do Instagram/i.test(r.erro), `explica a falta de conexão: "${r.erro}"`);

  await prisma.whatsAppAccount.update({ where: { id: conta.id }, data: { enabled: false } });
  r = await MessagingService.sendToLead(contatoIg, "oi");
  ok(r.ok === false, "conexão desabilitada não é usada às escondidas");
  await prisma.whatsAppAccount.update({ where: { id: conta.id }, data: { enabled: true } });

  const semId = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Sem id", channel: "INSTAGRAM", waAccountId: conta.id },
  });
  r = await MessagingService.sendToLead(semId, "oi");
  ok(r.ok === false && /identificador/i.test(r.erro), `contato sem IGSID é recusado com motivo: "${r.erro}"`);

  // ── 5. Recusa da Meta chega como motivo, não como silêncio ──
  console.log("\n5. Quando a Meta recusa");
  MetaManager.sendInstagramMessage = async () => {
    const e = new Error("Request failed");
    e.response = { data: { error: { message: "This message is sent outside of allowed window." } } };
    throw e;
  };
  r = await MessagingService.sendToLead(contatoIg, "oi");
  ok(r.ok === false && /allowed window/.test(r.erro), `o motivo da Meta chega inteiro: "${r.erro}"`);
  MetaManager.sendInstagramMessage = async (pageId, token, destino, texto) => {
    enviados.push({ tipo: "texto", pageId, token, destino, texto });
    return { message_id: "mid.1" };
  };

  // ── 6. WhatsApp continua como estava ────────────────────────
  console.log("\n6. O WhatsApp não mudou");
  const semTelefone = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Sem telefone", channel: "WHATSAPP" },
  });
  r = await MessagingService.sendToLead(semTelefone, "oi");
  ok(r.ok === false && /telefone/i.test(r.erro), `contato de WhatsApp sem telefone segue recusado (${r.erro})`);
  enviados.length = 0;
  const comTelefone = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Com telefone", channel: "WHATSAPP", phone: "5511999990000" },
  });
  await MessagingService.sendToLead(comTelefone, "oi").catch(() => {});
  ok(enviados.length === 0, "contato de WhatsApp não vaza para o Instagram");

  // ── 7. Pelo inbox, com a conversa aberta ────────────────────
  console.log("\n7. Pela tela de conversas");
  MetaManager.sendInstagramMessage = originalTexto;
  MetaManager.sendInstagramMedia = originalMidia;
  const conversa = await prisma.conversation.create({
    data: { leadId: contatoIg.id, tenantId: tenant.id, botActive: false, lastInboundAt: new Date() },
  });
  const token = jwt.sign({ userId: dono.id, tenantId: tenant.id, role: dono.role }, SEGREDO, { expiresIn: "1h" });
  const res = await fetch(`${API}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ leadId: contatoIg.id, content: "Oi!" }),
  });
  const corpo = await res.json().catch(() => ({}));
  // O servidor de verdade fala com a Meta de verdade e a chamada falha aqui;
  // o que importa é ONDE ela falha: no transporte do Instagram, e não mais no
  // "lead sem telefone" que barrava antes de tentar.
  ok(res.status !== 400, `não é mais barrado por falta de telefone (${res.status})`);
  ok(/Instagram/i.test(corpo.error || ""), `a resposta fala do Instagram: "${corpo.error}"`);
  await prisma.conversation.delete({ where: { id: conversa.id } }).catch(() => {});

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
