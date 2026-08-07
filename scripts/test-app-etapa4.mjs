/**
 * Teste do que a etapa 4 do app precisava do backend.
 *
 *   API=http://127.0.0.1:3000 DATABASE_URL=... node scripts/test-app-etapa4.mjs
 *
 * Enviar item do catálogo pelo atendente (a IA já sabia; ele não tinha por
 * onde) e a lista de horários livres do dia, que antes só existia por dentro
 * do agente.
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
const fone = () => `55519${String(marca).slice(-6)}${String(++n).padStart(2, "0")}`;

async function conta(nome) {
  const plan = await prisma.plan.create({
    data: { name: `E4 ${nome} ${marca}${++n}`, priceMonthly: 0, priceYearly: 0, enableCalendar: true },
  });
  const tenant = await prisma.tenant.create({
    data: { name: nome, email: `e4-${marca}-${nome}-${n}@teste.local`, businessType: "CLINICA", planId: plan.id },
  });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id, name: "Atendente", email: `at4-${marca}-${n}@teste.local`,
      password: await bcrypt.hash("x", 4), role: "ADMIN", emailVerified: true,
    },
  });
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt.sign({ userId: user.id, tenantId: tenant.id, role: "ADMIN" }, process.env.JWT_SECRET)}`,
  };
  // Canal do site: a entrega é a própria linha no histórico, então o caminho
  // feliz é exercitável sem depender de conexão de WhatsApp no ambiente.
  const lead = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Marina Costa", phone: fone(), channel: "SITE", email: "marina@teste.local" },
  });
  await prisma.conversation.create({ data: { leadId: lead.id, tenantId: tenant.id } });
  return { tenant, user, lead, headers };
}

async function main() {
  console.log("\n1. Enviar item com foto");
  {
    const c = await conta("ComFoto");
    const item = await prisma.product.create({
      data: {
        tenantId: c.tenant.id, name: "Clareamento a Laser", price: 1400,
        description: "Três sessões de 40 minutos", imageUrl: "/uploads/clareamento.jpg", isActive: true,
      },
    });

    const res = await fetch(`${API}/api/conversations/${c.lead.id}/catalog-item`, {
      method: "POST", headers: c.headers, body: JSON.stringify({ productId: item.id }),
    });
    const d = await res.json();
    ok(res.ok && d.success, "o item é enviado");
    const msgs = await prisma.message.findMany({ where: { tenantId: c.tenant.id } });
    ok(/R\$\s?1\.400,00/.test(msgs[0]?.content || ""), "o preço sai formatado, não como número cru");
    ok(msgs[0]?.content.includes("*Clareamento a Laser*"), "com o nome em negrito");
    ok(msgs[0]?.content.includes("Três sessões"), "e a descrição");
    ok(msgs.length === 1 && msgs[0].messageType === "IMAGE", "a mensagem fica no histórico como imagem");
    ok(msgs[0].mediaUrl === "/uploads/clareamento.jpg", "com o endereço da mídia");

    const conv = await prisma.conversation.findUnique({ where: { leadId: c.lead.id } });
    ok(conv.lastMessagePreview?.includes("Clareamento"), "e a prévia da conversa mostra o item, não só \"Imagem\"");
  }

  console.log("\n2. Item sem preço e sem foto");
  {
    const c = await conta("SemPreco");
    const item = await prisma.product.create({
      data: { tenantId: c.tenant.id, name: "Avaliação inicial", isActive: true },
    });
    await fetch(`${API}/api/conversations/${c.lead.id}/catalog-item`, {
      method: "POST", headers: c.headers, body: JSON.stringify({ productId: item.id }),
    });
    const msg = await prisma.message.findFirst({ where: { tenantId: c.tenant.id } });
    ok(msg?.messageType === "TEXT" && !msg.mediaUrl, "vai como texto");
    ok(/sob consulta/.test(msg?.content || ""), 'e "sob consulta" no lugar de R$ 0,00');
  }

  console.log("\n3. Recusas");
  {
    const c = await conta("Recusa");
    const outro = await conta("Alheio");
    const itemAlheio = await prisma.product.create({
      data: { tenantId: outro.tenant.id, name: "De outra conta", price: 10, isActive: true },
    });

    const r1 = await fetch(`${API}/api/conversations/${c.lead.id}/catalog-item`, {
      method: "POST", headers: c.headers, body: JSON.stringify({ productId: itemAlheio.id }),
    });
    ok(r1.status === 404, "item de outra conta não é enviado");

    const inativo = await prisma.product.create({
      data: { tenantId: c.tenant.id, name: "Fora de linha", price: 10, isActive: false },
    });
    const r2 = await fetch(`${API}/api/conversations/${c.lead.id}/catalog-item`, {
      method: "POST", headers: c.headers, body: JSON.stringify({ productId: inativo.id }),
    });
    ok(r2.status === 404, "item inativo também não");

    await prisma.lead.update({ where: { id: c.lead.id }, data: { optedOut: true } });
    const ativo = await prisma.product.create({
      data: { tenantId: c.tenant.id, name: "Item bom", price: 10, isActive: true },
    });
    const r3 = await fetch(`${API}/api/conversations/${c.lead.id}/catalog-item`, {
      method: "POST", headers: c.headers, body: JSON.stringify({ productId: ativo.id }),
    });
    ok(r3.status === 403, "contato em opt-out é respeitado");
  }

  console.log("\n4. Falha no canal não vira mensagem fantasma");
  {
    const c = await conta("CanalFora");
    // WhatsApp sem conexão ativa no ambiente: é o canal caído de verdade.
    await prisma.lead.update({ where: { id: c.lead.id }, data: { channel: "WHATSAPP" } });
    const item = await prisma.product.create({
      data: { tenantId: c.tenant.id, name: "Item", price: 100, isActive: true },
    });

    const res = await fetch(`${API}/api/conversations/${c.lead.id}/catalog-item`, {
      method: "POST", headers: c.headers, body: JSON.stringify({ productId: item.id }),
    });

    ok(res.status === 502, "o erro do canal chega como erro");
    ok((await prisma.message.count({ where: { tenantId: c.tenant.id } })) === 0, "e nada é gravado no histórico");
  }

  console.log("\n5. Horários livres do dia");
  {
    const c = await conta("Horarios");
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const data = amanha.toISOString().slice(0, 10);

    const r = await fetch(`${API}/api/appointments/slots?date=${data}`, { headers: c.headers }).then((x) => x.json());
    ok(r.data === data, "responde para o dia pedido");
    ok(r.itens.length > 0, "com horários livres");
    ok(/^\d{2}:\d{2}$/.test(r.itens[0].hora), "com a hora já formatada para a tela");
    ok(r.itens.every((i) => new Date(i.iso) > new Date()), "e nenhum horário no passado");

    // Hoje: os horários que já passaram não podem aparecer.
    const hoje = new Date().toISOString().slice(0, 10);
    const rh = await fetch(`${API}/api/appointments/slots?date=${hoje}`, { headers: c.headers }).then((x) => x.json());
    ok(rh.itens.every((i) => new Date(i.iso) > new Date()), "no dia de hoje, só o que ainda dá tempo");
  }

  console.log("\n6. Horário ocupado sai da lista");
  {
    const c = await conta("Ocupado");
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(10, 0, 0, 0);

    const data = amanha.toISOString().slice(0, 10);
    const antes = await fetch(`${API}/api/appointments/slots?date=${data}`, { headers: c.headers }).then((x) => x.json());
    const alvo = antes.itens[0];
    ok(!!alvo, "há horário livre antes de ocupar");

    // Compromisso de verdade: o stub do processo de teste não alcança a API.
    await prisma.appointment.create({
      data: { tenantId: c.tenant.id, leadId: c.lead.id, title: "Ocupado", date: new Date(alvo.iso), status: "SCHEDULED" },
    });

    const depois = await fetch(`${API}/api/appointments/slots?date=${data}`, { headers: c.headers }).then((x) => x.json());
    ok(!depois.itens.some((i) => i.iso === alvo.iso), "o horário ocupado não é mais oferecido");
    ok(depois.itens.length === antes.itens.length - 1, "e só ele sai da lista");
  }

  console.log("\n7. Data inválida");
  {
    const c = await conta("DataRuim");
    const res = await fetch(`${API}/api/appointments/slots?date=nao-e-data`, { headers: c.headers });
    ok(res.status === 400, "é recusada com explicação");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
