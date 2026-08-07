/**
 * Teste de iniciar conversa a partir de um contato do CRM.
 *
 *   API=http://127.0.0.1:3000 DATABASE_URL=... node scripts/test-nova-conversa.mjs
 *
 * O ponto do teste não é criar a linha da conversa: é o painel saber, ANTES
 * de o atendente escrever, o que dá para fazer neste contato — se o número
 * tem WhatsApp, se a janela de 24 h está aberta e se o caminho é texto livre
 * ou template aprovado.
 */
import prisma from "../src/api/config/prisma.js";
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
const fone = () => `55319${String(marca).slice(-6)}${String(++n).padStart(2, "0")}`;

async function conta(nome, { oficial = false } = {}) {
  const plan = await prisma.plan.create({ data: { name: `NC ${nome} ${marca}`, priceMonthly: 0, priceYearly: 0 } });
  const tenant = await prisma.tenant.create({
    data: { name: nome, email: `nc-${marca}-${nome}@teste.local`, businessType: "CLINICA", planId: plan.id },
  });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id, name: "Atendente", email: `at-${marca}-${nome}@teste.local`,
      password: await bcrypt.hash("x", 4), role: "ADMIN", emailVerified: true,
    },
  });
  await prisma.whatsAppAccount.create({
    data: oficial
      ? { tenantId: tenant.id, name: "Oficial", channel: "WHATSAPP", enabled: true, status: "CONNECTED", phoneId: "123", accessToken: "tok" }
      : { tenantId: tenant.id, name: "QR", channel: "WHATSAPP", enabled: true, status: "CONNECTED" },
  });
  const token = jwt.sign({ userId: user.id, tenantId: tenant.id, role: "ADMIN" }, process.env.JWT_SECRET);
  return { tenant, user, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } };
}

const começar = (headers, leadId) =>
  fetch(`${API}/api/conversations/start`, { method: "POST", headers, body: JSON.stringify({ leadId }) })
    .then(async (r) => ({ status: r.status, corpo: await r.json() }));

async function main() {
  console.log("\n1. Contato do CRM nunca contatado");
  {
    const c = await conta("QrCode");
    const lead = await prisma.lead.create({
      data: { tenantId: c.tenant.id, name: "Novo Cliente", phone: fone(), channel: "WHATSAPP" },
    });
    ok(!(await prisma.conversation.findUnique({ where: { leadId: lead.id } })), "não existe conversa antes");

    const { status, corpo } = await começar(c.headers, lead.id);
    ok(status === 200, "a conversa abre");
    const conv = await prisma.conversation.findUnique({ where: { leadId: lead.id } });
    ok(!!conv, "a conversa passa a existir");
    ok(conv.phase === "HUMAN", "em atendimento humano");
    ok(conv.assignedToId === c.user.id, "com quem abriu");
    ok(conv.botActive === false, "e com a IA calada — quem começou a falar foi a pessoa");
    ok(corpo.precisaTemplate === false, "conexão por QR Code não exige template");
    ok(corpo.transporte === "baileys", "e o transporte é reportado");
  }

  console.log("\n2. Conexão oficial, sem mensagem recebida (janela fechada)");
  {
    const c = await conta("Oficial", { oficial: true });
    await prisma.messageTemplate.create({
      data: { tenantId: c.tenant.id, name: "boas_vindas", content: "Olá {{1}}", status: "APPROVED", language: "pt_BR" },
    });
    const lead = await prisma.lead.create({
      data: { tenantId: c.tenant.id, name: "Cliente Antigo", phone: fone(), channel: "WHATSAPP" },
    });

    const { corpo } = await começar(c.headers, lead.id);
    ok(corpo.janelaAberta === false, "a janela está fechada");
    ok(corpo.precisaTemplate === true, "e o caminho é template");
    ok(corpo.templates?.length === 1, "os templates aprovados vêm junto");
    ok(corpo.templates[0].name === "boas_vindas", "com o nome certo");
    ok(/24 h/.test(corpo.aviso || ""), "e o aviso explica por quê");
  }

  console.log("\n3. Conexão oficial, dentro da janela de 24 h");
  {
    const c = await conta("Dentro", { oficial: true });
    const lead = await prisma.lead.create({
      data: { tenantId: c.tenant.id, name: "Cliente Ativo", phone: fone(), channel: "WHATSAPP" },
    });
    await prisma.conversation.create({
      data: { leadId: lead.id, tenantId: c.tenant.id, lastInboundAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const { corpo } = await começar(c.headers, lead.id);
    ok(corpo.janelaAberta === true, "a janela está aberta");
    ok(corpo.precisaTemplate === false, "texto livre é permitido");
    ok(corpo.minutosRestantes > 0, "e o tempo restante é informado");
  }

  console.log("\n4. Oficial fora da janela, sem nenhum template aprovado");
  {
    const c = await conta("SemTemplate", { oficial: true });
    await prisma.messageTemplate.create({
      data: { tenantId: c.tenant.id, name: "rascunho", content: "Oi", status: "DRAFT", language: "pt_BR" },
    });
    const lead = await prisma.lead.create({
      data: { tenantId: c.tenant.id, name: "Sem Saída", phone: fone(), channel: "WHATSAPP" },
    });

    const { corpo } = await começar(c.headers, lead.id);
    ok(corpo.precisaTemplate === true, "ainda exige template");
    ok(corpo.templates.length === 0, "e não há nenhum aprovado");
    ok(/nenhum está aprovado/.test(corpo.aviso || ""), "o aviso diz o que fazer");
  }

  console.log("\n5. Número marcado como sem WhatsApp");
  {
    const c = await conta("SemWhats");
    const lead = await prisma.lead.create({
      data: {
        tenantId: c.tenant.id, name: "Fixo", phone: fone(), channel: "WHATSAPP",
        whatsappStatus: "NAO", whatsappCheckedAt: new Date(),
      },
    });
    const { corpo } = await começar(c.headers, lead.id);
    ok(corpo.whatsapp === "NAO", "o estado do número é devolvido");
    ok(/não tem WhatsApp/.test(corpo.aviso || ""), "e o atendente é avisado antes de escrever");
  }

  console.log("\n6. Contato em opt-out");
  {
    const c = await conta("OptOut");
    const lead = await prisma.lead.create({
      data: { tenantId: c.tenant.id, name: "Pediu Parar", phone: fone(), channel: "WHATSAPP", optedOut: true },
    });
    const { status, corpo } = await começar(c.headers, lead.id);
    ok(status === 403, "a abertura é recusada");
    ok(/não receber mensagens/.test(corpo.error || ""), "com o motivo correto");
    ok(!(await prisma.conversation.findUnique({ where: { leadId: lead.id } })), "e nenhuma conversa é criada");
  }

  console.log("\n7. Conversa encerrada volta ao ar");
  {
    const c = await conta("Reabrir");
    const lead = await prisma.lead.create({
      data: { tenantId: c.tenant.id, name: "Antigo", phone: fone(), channel: "WHATSAPP" },
    });
    await prisma.conversation.create({
      data: { leadId: lead.id, tenantId: c.tenant.id, phase: "CLOSED", closedAt: new Date() },
    });
    await começar(c.headers, lead.id);
    const conv = await prisma.conversation.findUnique({ where: { leadId: lead.id } });
    ok(conv.phase === "HUMAN" && conv.closedAt === null, "reabre em atendimento humano");
    ok((await prisma.conversation.count({ where: { tenantId: c.tenant.id } })) === 1, "sem criar uma segunda conversa");
  }

  console.log("\n8. Conversa de outro atendente não troca de dono");
  {
    const c = await conta("Outro");
    const outro = await prisma.user.create({
      data: {
        tenantId: c.tenant.id, name: "Colega", email: `colega-${marca}@teste.local`,
        password: await bcrypt.hash("x", 4), role: "USER", emailVerified: true,
      },
    });
    const lead = await prisma.lead.create({
      data: { tenantId: c.tenant.id, name: "Em Atendimento", phone: fone(), channel: "WHATSAPP" },
    });
    await prisma.conversation.create({
      data: { leadId: lead.id, tenantId: c.tenant.id, phase: "HUMAN", assignedToId: outro.id, assignedAt: new Date() },
    });
    await começar(c.headers, lead.id);
    const conv = await prisma.conversation.findUnique({ where: { leadId: lead.id } });
    ok(conv.assignedToId === outro.id, "quem já atendia continua atendendo");
  }

  console.log("\n9. Contato de outra conta");
  {
    const a = await conta("ContaX");
    const b = await conta("ContaY");
    const lead = await prisma.lead.create({
      data: { tenantId: b.tenant.id, name: "Alheio", phone: fone(), channel: "WHATSAPP" },
    });
    const { status } = await começar(a.headers, lead.id);
    ok(status === 404, "não é possível abrir conversa com contato de outra conta");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
