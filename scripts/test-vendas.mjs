/**
 * Teste de Vendas e da conferência de comprovante.
 *
 *   DATABASE_URL=... node scripts/test-vendas.mjs
 *
 * A regra que dá nome ao recurso: um comprovante de Pix AGENDADO parece um
 * comprovante de Pix pago — muda uma palavra. Confirmar a venda por causa
 * dele é entregar mercadoria sem receber, e é o erro que o balcão comete
 * sozinho. Por isso a decisão é uma função pura, testada regra a regra.
 */
import prisma from "../src/api/config/prisma.js";
import engine from "../automation_engine.js";
import ReceiptService, {
  conferir,
  interpretar,
  pareceAgendamento,
  lerMotivos,
  VEREDITO,
} from "../src/api/services/ReceiptService.js";
import { registrarVenda } from "../src/api/controllers/SaleController.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = Date.now();
let n = 0;

const NEGOCIO = {
  pixKey: "12345678901",
  holderDoc: "12345678901",
  holderName: "Maria Souza",
  amount: 150,
};

/** Um comprovante que confere em tudo. Cada teste estraga um campo. */
const bom = (extra = {}) => ({
  amount: 150,
  paidAt: new Date(),
  pixKey: "123.456.789-01",
  payerName: "Bruno Lima",
  receiverName: "Maria Souza",
  receiverDoc: "12345678901",
  endToEndId: `E${marca}${++n}`,
  scheduled: false,
  rawText: "Pix realizado com sucesso",
  ...extra,
});

const codigos = (r) => r.motivos.map((m) => m.codigo);

async function conta({ pixKey = "12345678901" } = {}) {
  const tenant = await prisma.tenant.create({
    data: {
      name: `Loja V${++n}`,
      email: `venda-${marca}-${n}@teste.local`,
      pixKey,
      pixKeyType: "CPF",
      pixHolderName: "Maria Souza",
      pixHolderDoc: "12345678901",
      pixCity: "Vitoria",
    },
  });
  const lead = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      name: "Bruno",
      phone: `55279${String(marca).slice(-6)}${String(n).padStart(2, "0")}`,
      channel: "WHATSAPP",
    },
  });
  return { tenant, lead };
}

async function main() {
  console.log("\n1. Pix agendado não é pagamento");
  {
    const r = conferir(bom({ scheduled: true }), NEGOCIO);
    ok(r.status === VEREDITO.RECUSADO, "comprovante agendado é recusado");
    ok(codigos(r).includes("AGENDADO"), "com o motivo nomeado");

    // Rede de segurança: mesmo com o campo estruturado dizendo que foi pago,
    // a palavra "agendado" no corpo do comprovante já basta.
    const r2 = conferir(bom({ scheduled: false, rawText: "Pix agendado para 12/03/2026" }), NEGOCIO);
    ok(r2.status === VEREDITO.RECUSADO, "e o texto sozinho também derruba");

    ok(pareceAgendamento("PAGAMENTO PROGRAMADO"), "programado conta como agendamento");
    ok(pareceAgendamento("Será debitado em 10/03"), "e a promessa de débito futuro também");
    ok(!pareceAgendamento("Pix realizado em 10/03"), "mas um Pix realizado passa");
  }

  console.log("\n2. Valor");
  {
    ok(conferir(bom(), NEGOCIO).status === VEREDITO.APROVADO, "valor igual aprova");
    const menor = conferir(bom({ amount: 100 }), NEGOCIO);
    ok(menor.status === VEREDITO.RECUSADO && codigos(menor).includes("VALOR_MENOR"), "pagar menos é recusa");
    // Pagar a mais não é golpe — é troco a devolver. Quem decide é o dono.
    const maior = conferir(bom({ amount: 200 }), NEGOCIO);
    ok(maior.status === VEREDITO.REVISAR && codigos(maior).includes("VALOR_MAIOR"), "pagar mais vai para conferência");
    ok(conferir(bom({ amount: 150.004 }), NEGOCIO).status === VEREDITO.APROVADO, "diferença de arredondamento não conta");
    const sem = conferir(bom({ amount: null }), NEGOCIO);
    ok(sem.status === VEREDITO.REVISAR && codigos(sem).includes("SEM_VALOR"), "valor ilegível vai para conferência");
  }

  console.log("\n3. Para quem foi o dinheiro");
  {
    const outra = conferir(bom({ pixKey: "98765432100", receiverDoc: null }), NEGOCIO);
    ok(outra.status === VEREDITO.RECUSADO && codigos(outra).includes("CHAVE_DIFERENTE"), "chave de outra conta é recusa");

    const outroDoc = conferir(bom({ pixKey: null, receiverDoc: "99988877766" }), NEGOCIO);
    ok(outroDoc.status === VEREDITO.RECUSADO, "CPF de outro recebedor também");

    // O comprovante quase sempre mascara o CPF do recebedor.
    const mascarado = conferir(bom({ pixKey: null, receiverDoc: "•••.456.789-••" }), NEGOCIO);
    ok(mascarado.status === VEREDITO.APROVADO, "CPF mascarado confere pelos dígitos visíveis");

    const anonimo = conferir(bom({ pixKey: null, receiverDoc: null }), NEGOCIO);
    ok(anonimo.status === VEREDITO.REVISAR && codigos(anonimo).includes("SEM_RECEBEDOR"),
      "sem saber quem recebeu, nunca aprova sozinho");
  }

  console.log("\n4. Data e hora");
  {
    const agora = new Date("2026-03-10T12:00:00Z");
    const futuro = conferir(bom({ paidAt: new Date("2026-03-11T12:00:00Z") }), { ...NEGOCIO, agora });
    ok(futuro.status === VEREDITO.RECUSADO && codigos(futuro).includes("DATA_FUTURA"),
      "data no futuro é agendamento com outro nome");

    // O relógio do celular do cliente adianta alguns minutos com frequência.
    const quase = conferir(bom({ paidAt: new Date("2026-03-10T12:05:00Z") }), { ...NEGOCIO, agora });
    ok(quase.status === VEREDITO.APROVADO, "cinco minutos de folga não derrubam o comprovante");

    const velho = conferir(bom({ paidAt: new Date("2026-02-01T12:00:00Z") }), { ...NEGOCIO, agora });
    ok(velho.status === VEREDITO.REVISAR && codigos(velho).includes("COMPROVANTE_ANTIGO"),
      "comprovante de mês passado vai para conferência");

    const semData = conferir(bom({ paidAt: null }), NEGOCIO);
    ok(semData.status === VEREDITO.REVISAR && codigos(semData).includes("SEM_DATA"), "sem data, conferência");
  }

  console.log("\n5. Comprovante repetido");
  {
    const r = conferir(bom(), { ...NEGOCIO, jaUsado: true });
    ok(r.status === VEREDITO.RECUSADO && codigos(r).includes("REPETIDO"),
      "o mesmo comprovante não paga duas compras");
  }

  console.log("\n6. Leitura do que o modelo devolve");
  {
    const cercado = interpretar('```json\n{"amount": 150, "scheduled": false}\n```');
    ok(cercado.ok && cercado.dados.amount === 150, "JSON dentro de cerca de código é lido");

    const conversado = interpretar('Claro! Aqui está: {"amount": "R$ 1.234,56"} Espero ter ajudado.');
    ok(conversado.dados.amount === 1234.56, "valor em formato brasileiro vira número");

    ok(interpretar('{"amount": "150,00"}').dados.amount === 150, "vírgula decimal sozinha também");
    ok(interpretar("desculpe, não consegui ler").ok === false, "resposta sem JSON é erro, não chute");
    ok(interpretar('{"amount": ').ok === false, "JSON quebrado é erro");
    ok(interpretar('{"paidAt": "não sei"}').dados.paidAt === null, "data ilegível vira null em vez de data inválida");
  }

  console.log("\n7. A venda");
  {
    const c = await conta();
    const r = await registrarVenda(c.tenant.id, {
      leadId: c.lead.id,
      title: "Pedido 240",
      items: [
        { name: "Pizza grande", quantity: 2, unitPrice: 60 },
        { name: "Refrigerante", quantity: 1, unitPrice: 12 },
      ],
    });
    ok(r.ok, "cria a venda");
    // Com itens, o total é a soma deles: valor digitado à parte é a origem
    // clássica de venda que não bate com o que foi vendido.
    ok(r.venda.amount === 132, "o total é a soma dos itens");
    ok(r.venda.status === "PENDING", "nascendo pendente de pagamento");

    const lead = await prisma.lead.findUnique({ where: { id: c.lead.id }, include: { stage: true } });
    ok(!!lead.stageId, "e o lead se move no funil, como no agendamento");

    const semValor = await registrarVenda(c.tenant.id, {});
    ok(semValor.ok === false, "venda sem valor é recusada");
  }

  console.log("\n8. O agente confere o comprovante");
  {
    const c = await conta();
    const venda = await registrarVenda(c.tenant.id, { leadId: c.lead.id, amount: 150, title: "Pedido" });
    const conversa = await prisma.conversation.create({
      data: { tenantId: c.tenant.id, leadId: c.lead.id },
    });
    await prisma.message.create({
      data: {
        conversationId: conversa.id,
        tenantId: c.tenant.id,
        content: "🖼️ imagem",
        mediaUrl: "/api/uploads/comprovante.jpg",
        role: "USER",
        messageType: "IMAGE",
      },
    });

    // A leitura do arquivo é do modelo multimodal; aqui interessa o que o
    // motor faz com o resultado dela.
    const lerOriginal = ReceiptService.ler;
    const baixarOriginal = ReceiptService.baixar;
    ReceiptService.baixar = async () => ({ ok: true, buffer: Buffer.from("x"), mimetype: "image/jpeg" });

    ReceiptService.ler = async () => ({ ok: true, dados: bom({ amount: 150 }) });
    const aprovado = await engine._executeTool("check_payment_receipt", {}, c.lead);
    ok(aprovado.veredito === "APPROVED", "comprovante que confere é aprovado");
    ok(/Pagamento confirmado/.test(aprovado.note || ""), "e o agente é mandado seguir");
    const paga = await prisma.sale.findUnique({ where: { id: venda.venda.id } });
    ok(paga.status === "PAID" && !!paga.paidAt, "a venda é baixada sozinha");
    const leadGanho = await prisma.lead.findUnique({ where: { id: c.lead.id } });
    ok(leadGanho.status === "WON", "e o lead vira ganho no funil");

    ReceiptService.ler = lerOriginal;
    ReceiptService.baixar = baixarOriginal;
  }

  console.log("\n9. O agente NÃO pode confirmar um Pix agendado");
  {
    const c = await conta();
    await registrarVenda(c.tenant.id, { leadId: c.lead.id, amount: 150, title: "Pedido" });
    const conversa = await prisma.conversation.create({
      data: { tenantId: c.tenant.id, leadId: c.lead.id },
    });
    await prisma.message.create({
      data: {
        conversationId: conversa.id,
        tenantId: c.tenant.id,
        content: "🖼️ imagem",
        mediaUrl: "/api/uploads/agendado.jpg",
        role: "USER",
        messageType: "IMAGE",
      },
    });

    const lerOriginal = ReceiptService.ler;
    const baixarOriginal = ReceiptService.baixar;
    ReceiptService.baixar = async () => ({ ok: true, buffer: Buffer.from("x"), mimetype: "image/jpeg" });
    ReceiptService.ler = async () => ({ ok: true, dados: bom({ scheduled: true }) });

    const r = await engine._executeTool("check_payment_receipt", {}, c.lead);
    ReceiptService.ler = lerOriginal;
    ReceiptService.baixar = baixarOriginal;

    ok(r.veredito === "REJECTED", "o veredito é recusa");
    ok(r.scheduled === true, "identificando o agendamento");
    ok(/NÃO trate a venda como paga/.test(r.note || ""), "e o agente é proibido de tratar como paga");

    const venda = await prisma.sale.findFirst({ where: { leadId: c.lead.id } });
    ok(venda.status === "PENDING", "a venda continua pendente");
  }

  console.log("\n10. Sem comprovante nenhum");
  {
    const c = await conta();
    const r = await engine._executeTool("check_payment_receipt", {}, c.lead);
    ok(r.success === false && /não enviou nenhum comprovante/.test(r.error || ""),
      "o agente é mandado pedir o arquivo, não inventar o resultado");
  }

  console.log("\n11. Os motivos ficam gravados para o dono conferir");
  {
    const gravados = await prisma.paymentReceipt.findFirst({
      where: { status: VEREDITO.RECUSADO },
      orderBy: { createdAt: "desc" },
    });
    const motivos = lerMotivos(gravados?.reasons);
    ok(motivos.length > 0, "cada recusa guarda o porquê");
    ok(!!motivos[0].texto && !!motivos[0].codigo, "com texto para ler e código para filtrar");
    ok(lerMotivos("nada disso").length === 0, "e um campo corrompido não derruba a tela");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
