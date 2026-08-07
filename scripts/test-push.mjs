/**
 * Teste das notificações no celular do atendente.
 *
 *   API=http://127.0.0.1:3000 DATABASE_URL=... node scripts/test-push.mjs
 *
 * O Firebase não é chamado aqui — o que se verifica é o que decide o envio:
 * quem recebe, quem não recebe, o que acontece com token morto e se o push
 * pode derrubar o atendimento. A entrega real depende de credencial da
 * plataforma e só dá para conferir com o app instalado.
 */
import prisma from "../src/api/config/prisma.js";
import PushService, { AVISOS } from "../src/api/services/PushService.js";
import AttendanceService from "../src/api/services/AttendanceService.js";
import MessagingService from "../src/api/services/MessagingService.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API = process.env.API || "http://127.0.0.1:3000";
let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = Date.now();
let n = 0;
const fone = () => `55619${String(marca).slice(-6)}${String(++n).padStart(2, "0")}`;

MessagingService.sendText = async () => true;

// O FCM é substituído: o que interessa é a decisão de enviar, não a rede.
const enviados = [];
let recusarTokens = new Set();
PushService.credencial = async () => ({ projectId: "proj-teste", conta: {} });
PushService.enviarParaToken = async (_cred, token, conteudo) => {
  if (recusarTokens.has(token)) return { ok: false, tokenMorto: true };
  enviados.push({ token, ...conteudo });
  return { ok: true };
};

async function conta(nome) {
  const tenant = await prisma.tenant.create({
    data: { name: nome, email: `push-${marca}-${nome}-${++n}@teste.local`, businessType: "CLINICA" },
  });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id, name: "Diego", email: `push-u-${marca}-${n}@teste.local`,
      password: await bcrypt.hash("x", 4), role: "ADMIN", emailVerified: true,
    },
  });
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt.sign({ userId: user.id, tenantId: tenant.id, role: "ADMIN" }, process.env.JWT_SECRET)}`,
  };
  return { tenant, user, headers };
}

const comAparelho = (c, token) =>
  PushService.registrarAparelho(c.user.id, c.tenant.id, token, "ios");

/**
 * Espera a notificação sair.
 *
 * O push é disparado sem segurar quem chamou — de propósito: entrar na fila
 * não pode esperar o celular de ninguém. E a primeira entrada de fila do
 * processo ainda paga o custo de carregar o motor de automação, que leva
 * segundos. Por isso a espera é por condição, não por tempo fixo.
 */
async function esperarPor(condicao, limiteMs = 15000) {
  const ate = Date.now() + limiteMs;
  while (Date.now() < ate) {
    if (condicao()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

async function main() {
  console.log("\n1. Registro do aparelho");
  {
    const c = await conta("Registro");
    const r = await fetch(`${API}/api/attendance/device`, {
      method: "POST", headers: c.headers, body: JSON.stringify({ token: `tk-${marca}-1`, platform: "ios" }),
    });
    ok(r.ok, "o app registra o aparelho");
    ok((await prisma.deviceToken.count({ where: { userId: c.user.id } })) === 1, "e fica um registro");

    await fetch(`${API}/api/attendance/device`, {
      method: "POST", headers: c.headers, body: JSON.stringify({ token: `tk-${marca}-1`, platform: "ios" }),
    });
    ok((await prisma.deviceToken.count({ where: { userId: c.user.id } })) === 1, "registrar de novo não duplica");

    const semToken = await fetch(`${API}/api/attendance/device`, {
      method: "POST", headers: c.headers, body: JSON.stringify({}),
    });
    ok(semToken.status === 400, "sem token, recusa");
  }

  console.log("\n2. O aparelho que troca de dono");
  {
    const a = await conta("DonoA");
    const b = await conta("DonoB");
    const token = `tk-${marca}-compartilhado`;
    await comAparelho(a, token);
    await comAparelho(b, token);

    const registros = await prisma.deviceToken.findMany({ where: { token } });
    ok(registros.length === 1, "o token continua único");
    ok(registros[0].userId === b.user.id, "e passa a ser de quem entrou por último");

    enviados.length = 0;
    await PushService.avisar(a.user.id, "FILA", { titulo: "x", corpo: "y" });
    ok(enviados.length === 0, "o dono anterior não recebe mais nada nesse aparelho");
  }

  console.log("\n3. Quem recebe e o que chega");
  {
    enviados.length = 0;
    const c = await conta("Envio");
    await comAparelho(c, `tk-${marca}-3a`);
    await comAparelho(c, `tk-${marca}-3b`);

    const r = await PushService.avisar(c.user.id, "FILA", {
      titulo: "Carla está esperando",
      corpo: "Pediu para falar com uma pessoa.",
      dados: { tipo: "fila", leadId: "lead-123" },
    });
    ok(r.enviados === 2, "vai para todos os aparelhos da pessoa");
    ok(enviados[0].titulo === "Carla está esperando", "com o título");
    ok(enviados[0].dados.leadId === "lead-123", "e com o que o app usa para abrir a conversa certa");
  }

  console.log("\n4. Preferências do atendente");
  {
    const c = await conta("Prefs");
    await comAparelho(c, `tk-${marca}-4`);

    const inicial = await fetch(`${API}/api/attendance/push`, { headers: c.headers }).then((x) => x.json());
    ok(inicial.avisos.length === Object.keys(AVISOS).length, "os avisos disponíveis são listados");
    ok(inicial.prefs.fila === true, "quem acabou de instalar recebe tudo");

    await fetch(`${API}/api/attendance/push`, {
      method: "PUT", headers: c.headers, body: JSON.stringify({ fila: false }),
    });

    enviados.length = 0;
    const desligado = await PushService.avisar(c.user.id, "FILA", { titulo: "x", corpo: "y" });
    ok(desligado.enviados === 0, "o aviso desligado não é enviado");
    ok(/desligou/.test(desligado.motivo || ""), "e o motivo diz por quê");

    const outro = await PushService.avisar(c.user.id, "MENSAGEM", { titulo: "x", corpo: "y" });
    ok(outro.enviados === 1, "os outros avisos continuam valendo");
  }

  console.log("\n5. Token morto é apagado");
  {
    const c = await conta("Morto");
    const bom = `tk-${marca}-bom`;
    const ruim = `tk-${marca}-ruim`;
    await comAparelho(c, bom);
    await comAparelho(c, ruim);
    recusarTokens = new Set([ruim]);

    const r = await PushService.avisar(c.user.id, "FILA", { titulo: "x", corpo: "y" });
    recusarTokens = new Set();

    ok(r.enviados === 1 && r.removidos === 1, "um entrega, o outro é descartado");
    const restantes = await prisma.deviceToken.findMany({ where: { userId: c.user.id } });
    ok(restantes.length === 1 && restantes[0].token === bom, "o token morto sai do banco");
  }

  console.log("\n6. Sem aparelho, sem credencial, atendente inativo");
  {
    const c = await conta("Vazio");
    const semAparelho = await PushService.avisar(c.user.id, "FILA", { titulo: "x", corpo: "y" });
    ok(/Nenhum aparelho/.test(semAparelho.motivo || ""), "sem aparelho registrado, diz isso");

    await comAparelho(c, `tk-${marca}-6`);
    const original = PushService.credencial;
    PushService.credencial = async () => null;
    const semCred = await PushService.avisar(c.user.id, "FILA", { titulo: "x", corpo: "y" });
    PushService.credencial = original;
    ok(/não configurado/.test(semCred.motivo || ""), "sem credencial da plataforma, também");

    await prisma.user.update({ where: { id: c.user.id }, data: { active: false } });
    const inativo = await PushService.avisar(c.user.id, "FILA", { titulo: "x", corpo: "y" });
    ok(inativo.enviados === 0, "atendente desativado não recebe");
  }

  console.log("\n7. Entrar na fila toca o celular de quem pode atender");
  {
    enviados.length = 0;
    const c = await conta("Fila");
    await comAparelho(c, `tk-${marca}-7`);

    const emPausa = await prisma.user.create({
      data: {
        tenantId: c.tenant.id, name: "Ana", email: `pausa-${marca}-${++n}@teste.local`,
        password: await bcrypt.hash("x", 4), role: "USER", emailVerified: true, disponibilidade: "PAUSA",
      },
    });
    await PushService.registrarAparelho(emPausa.id, c.tenant.id, `tk-${marca}-pausa`, "android");

    const lead = await prisma.lead.create({
      data: { tenantId: c.tenant.id, name: "Carla Nogueira", phone: fone(), channel: "WHATSAPP" },
    });
    const conv = await prisma.conversation.create({ data: { leadId: lead.id, tenantId: c.tenant.id } });

    await AttendanceService.enqueue(conv.id, { reason: "Pediu para falar com uma pessoa" });
    await esperarPor(() => enviados.length > 0);

    ok(enviados.length === 1, "só quem está disponível é avisado");
    ok(enviados[0].token === `tk-${marca}-7`, "quem está em pausa não é acordado");
    ok(/Carla Nogueira/.test(enviados[0].titulo || ""), "o aviso diz quem está esperando");
    ok(enviados[0].dados.leadId === lead.id, "e leva ao contato certo");
  }

  console.log("\n8. Push que falha não derruba o atendimento");
  {
    const c = await conta("Resiliente");
    await comAparelho(c, `tk-${marca}-8`);
    const original = PushService.enviarParaToken;
    PushService.enviarParaToken = async () => { throw new Error("rede fora"); };

    const lead = await prisma.lead.create({
      data: { tenantId: c.tenant.id, name: "Cliente", phone: fone(), channel: "WHATSAPP" },
    });
    const conv = await prisma.conversation.create({ data: { leadId: lead.id, tenantId: c.tenant.id } });

    let estourou = false;
    await AttendanceService.enqueue(conv.id, { reason: "teste" }).catch(() => { estourou = true; });
    await new Promise((r) => setTimeout(r, 800));
    PushService.enviarParaToken = original;

    ok(!estourou, "a entrada na fila acontece mesmo com o push fora");
    const depois = await prisma.conversation.findUnique({ where: { id: conv.id } });
    ok(depois.phase === "QUEUE", "e a conversa está na fila, que é o que importa");
  }

  console.log("\n9. Sair da conta desliga o aparelho");
  {
    const c = await conta("Saiu");
    const token = `tk-${marca}-9`;
    await comAparelho(c, token);

    const r = await fetch(`${API}/api/attendance/device/forget`, {
      method: "POST", headers: c.headers, body: JSON.stringify({ token }),
    });
    ok(r.ok, "o app pede para esquecer o aparelho");
    ok((await prisma.deviceToken.count({ where: { token } })) === 0, "e ele some do banco");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
