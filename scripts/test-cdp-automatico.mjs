/**
 * Teste da unificação automática de contatos duplicados.
 *
 *   DATABASE_URL=... node scripts/test-cdp-automatico.mjs
 *
 * O CDP já impedia duplicata nova na entrada. O que faltava era a base
 * antiga se resolver sozinha, em vez de virar uma tela que alguém precisa
 * lembrar de abrir. E o limite: nome igual, sem identificador em comum,
 * continua sendo decisão de quem conhece o cliente.
 */
import prisma from "../src/api/config/prisma.js";
import ContactCleanup from "../src/api/services/ContactCleanup.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = Date.now();
let n = 0;
const fone = () => `55219${String(marca).slice(-6)}${String(++n).padStart(2, "0")}`;

/**
 * O MESMO número, escrito de outro jeito.
 *
 * O índice único de (phone, tenantId) impede duplicata literal: a duplicata
 * real da base antiga é sempre de formato — "(21) 99999-8888" e
 * "5521999998888" são a mesma linha telefônica em duas grafias.
 */
const semDdi = (p) => p.replace(/^55/, "");
const comMascara = (p) => {
  const d = semDdi(p);
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

async function tenant(nome) {
  return prisma.tenant.create({
    data: { name: nome, email: `cdp-${marca}-${nome}@teste.local`, businessType: "CLINICA" },
  });
}

const criar = (t, dados) =>
  prisma.lead.create({ data: { tenantId: t.id, channel: "WHATSAPP", ...dados } });

async function main() {
  console.log("\n1. Mesmo telefone, fichas diferentes");
  {
    const t = await tenant("Telefone");
    const p = fone();
    const antigo = await criar(t, { name: "Maria Souza", phone: p, createdAt: new Date(Date.now() - 86400000) });
    const novo = await criar(t, { name: "Maria S.", phone: semDdi(p) });

    const r = await ContactCleanup.varrer(t.id);
    ok(r.fundidos === 1, "funde sozinho");
    const restantes = await prisma.lead.findMany({ where: { tenantId: t.id } });
    ok(restantes.length === 1, "sobra uma ficha só");
    ok(restantes[0].id === antigo.id, "a mais antiga é a que fica");
    ok(!(await prisma.lead.findUnique({ where: { id: novo.id } })), "a outra some");
  }

  console.log("\n2. Mesmo e-mail, telefones diferentes");
  {
    const t = await tenant("Email");
    await criar(t, { name: "Ana", email: "ana@teste.local", phone: fone() });
    await criar(t, { name: "Ana Paula", email: "ANA@teste.local", phone: fone() });
    const r = await ContactCleanup.varrer(t.id);
    ok(r.fundidos === 1, "e-mail com caixa diferente é o mesmo e-mail");
    ok((await prisma.lead.count({ where: { tenantId: t.id } })) === 1, "sobra uma ficha só");
  }

  console.log("\n3. Ligação transitiva (A–B por telefone, B–C por e-mail)");
  {
    const t = await tenant("Transitivo");
    const p = fone();
    const a = await criar(t, { name: "Carlos", phone: p, createdAt: new Date(Date.now() - 172800000) });
    await criar(t, { name: "Carlos R", phone: comMascara(p), email: "carlos@teste.local" });
    await criar(t, { name: "C. Rocha", email: "carlos@teste.local", phone: fone() });

    const r = await ContactCleanup.varrer(t.id);
    ok(r.grupos === 1, "os três entram num grupo só");
    ok(r.fundidos === 2, "duas fichas são absorvidas");
    const restantes = await prisma.lead.findMany({ where: { tenantId: t.id } });
    ok(restantes.length === 1 && restantes[0].id === a.id, "sobra a mais antiga");
  }

  console.log("\n4. Instagram: mesmo @usuario");
  {
    const t = await tenant("Instagram");
    await criar(t, { name: "Lucas", channel: "INSTAGRAM", igUsername: "lucas.fit", createdAt: new Date(Date.now() - 3600000) });
    await criar(t, { name: "@lucas.fit", channel: "INSTAGRAM", igUsername: "lucas.fit" });
    const r = await ContactCleanup.varrer(t.id);
    ok(r.fundidos === 1, "handle repetido também é a mesma pessoa");
  }

  console.log("\n5. O histórico vai junto");
  {
    const t = await tenant("Historico");
    const p = fone();
    const fica = await criar(t, { name: "Joana", phone: p, createdAt: new Date(Date.now() - 86400000) });
    const some = await criar(t, { name: "Joana M", phone: semDdi(p), email: "joana@teste.local" });

    const conv = await prisma.conversation.create({ data: { leadId: some.id, tenantId: t.id } });
    await prisma.message.create({
      data: { conversationId: conv.id, tenantId: t.id, role: "USER", content: "Oi, quero remarcar" },
    });
    await prisma.appointment.create({
      data: { leadId: some.id, tenantId: t.id, title: "Retorno", date: new Date(Date.now() + 86400000) },
    });

    await ContactCleanup.varrer(t.id);
    const convDepois = await prisma.conversation.findUnique({
      where: { leadId: fica.id }, include: { messages: true },
    });
    ok(convDepois?.messages?.length === 1, "a mensagem migra para quem ficou");
    ok((await prisma.appointment.count({ where: { leadId: fica.id } })) === 1, "o agendamento também");
    const depois = await prisma.lead.findUnique({ where: { id: fica.id } });
    ok(depois.email === "joana@teste.local", "e o e-mail que só a outra tinha é preservado");
  }

  console.log("\n6. Nome igual, nada em comum: NÃO funde sozinho");
  {
    const t = await tenant("Homonimo");
    await criar(t, { name: "João Silva", phone: fone() });
    await criar(t, { name: "Joao Silva", phone: fone() });

    const r = await ContactCleanup.varrer(t.id);
    ok(r.fundidos === 0, "a máquina não decide por conta própria");
    ok((await prisma.lead.count({ where: { tenantId: t.id } })) === 2, "as duas fichas continuam de pé");

    const ambiguos = await ContactCleanup.ambiguos(t.id);
    ok(ambiguos.length === 1, "mas aparecem como sugestão");
    ok(ambiguos[0].confianca === "BAIXA", "marcadas como baixa confiança");
  }

  console.log("\n7. Base já limpa não faz nada");
  {
    const t = await tenant("Limpo");
    await criar(t, { name: "Pedro", phone: fone() });
    await criar(t, { name: "Paula", phone: fone(), email: "paula@teste.local" });
    const r = await ContactCleanup.varrer(t.id);
    ok(r.fundidos === 0 && r.grupos === 0, "nada a fazer, nada feito");
  }

  console.log("\n8. Varredura incremental");
  {
    const t = await tenant("Incremental");
    const p = fone();
    await criar(t, { name: "Rita", phone: p, createdAt: new Date(Date.now() - 86400000) });
    await criar(t, { name: "Rita C", phone: semDdi(p) });

    // Janela no futuro: nada mudou depois dela.
    const r1 = await ContactCleanup.varrer(t.id, { desde: new Date(Date.now() + 60000) });
    ok(r1.fundidos === 0, "sem mudança na janela, nem carrega a base");
    ok((await prisma.lead.count({ where: { tenantId: t.id } })) === 2, "as fichas seguem intactas");

    const r2 = await ContactCleanup.varrer(t.id, { desde: new Date(Date.now() - 3600000) });
    ok(r2.fundidos === 1, "com mudança na janela, funde");
  }

  console.log("\n9. Não atravessa contas");
  {
    const a = await tenant("ContaA");
    const b = await tenant("ContaB");
    const p = fone();
    await criar(a, { name: "Cliente", phone: p });
    await criar(b, { name: "Cliente", phone: p });
    await ContactCleanup.varrer(a.id);
    ok((await prisma.lead.count({ where: { tenantId: b.id } })) === 1, "o contato da outra conta não é tocado");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
