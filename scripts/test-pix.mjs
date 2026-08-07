/**
 * Teste do Pix em três formatos: QR Code, copia e cola e link.
 *
 *   DATABASE_URL=... node scripts/test-pix.mjs
 *
 * O que precisa ficar de pé: o BR Code montado aqui tem de ser o mesmo que o
 * app do banco aceita — estrutura EMV correta e CRC batendo. Um dígito errado
 * vira "QR Code inválido" na mão do cliente, sem erro nenhum do nosso lado.
 */
import prisma from "../src/api/config/prisma.js";
import MessagingService from "../src/api/services/MessagingService.js";
import engine from "../automation_engine.js";
import {
  normalizarChave,
  mesmaChave,
  crc16,
  montarBrCode,
  normalizarTxid,
  qrCodeDataUrl,
  conferirCadastro,
  gerarCodigo,
} from "../src/api/services/PixService.js";
import { criarCobranca } from "../src/api/controllers/PixController.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = Date.now();
let n = 0;

async function conta({ pixKey = "12345678901", pixKeyType = "CPF", pixCity = "Sao Paulo" } = {}) {
  const tenant = await prisma.tenant.create({
    data: {
      name: `Loja ${++n}`,
      email: `pix-${marca}-${n}@teste.local`,
      pixKey,
      pixKeyType,
      pixHolderName: "Maria Souza",
      pixHolderDoc: "12345678901",
      pixCity,
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

/** Lê os campos EMV do payload, para conferir o que foi montado. */
function lerEmv(payload) {
  const campos = {};
  let i = 0;
  while (i < payload.length - 4) {
    const id = payload.slice(i, i + 2);
    const tam = parseInt(payload.slice(i + 2, i + 4), 10);
    campos[id] = payload.slice(i + 4, i + 4 + tam);
    i += 4 + tam;
  }
  return campos;
}

async function main() {
  console.log("\n1. Normalização da chave");
  {
    ok(normalizarChave("CPF", "123.456.789-01").chave === "12345678901", "CPF perde a máscara");
    ok(normalizarChave("CPF", "12345").ok === false, "CPF curto é recusado");
    ok(normalizarChave("CNPJ", "12.345.678/0001-99").chave === "12345678000199", "CNPJ perde a máscara");
    ok(normalizarChave("EMAIL", " Contato@Loja.com ").chave === "contato@loja.com", "e-mail em minúsculas e sem espaço");
    ok(normalizarChave("EMAIL", "sem-arroba").ok === false, "e-mail inválido é recusado");
    ok(normalizarChave("PHONE", "(27) 99999-8888").chave === "+5527999998888", "telefone vira E.164");
    ok(normalizarChave("PHONE", "5527999998888").chave === "+5527999998888", "e não duplica o 55 quando já veio");
    ok(normalizarChave("RANDOM", "123e4567-e89b-12d3-a456-426614174000").ok === true, "chave aleatória em UUID passa");
    ok(normalizarChave("RANDOM", "abc").ok === false, "chave aleatória torta é recusada");
    ok(normalizarChave("PIX", "x").ok === false, "tipo desconhecido é recusado");
  }

  console.log("\n2. Comparar chaves para conferir comprovante");
  {
    ok(mesmaChave("123.456.789-01", "12345678901"), "a máscara não muda a chave");
    ok(mesmaChave("+5527999998888", "27999998888"), "com e sem o código do país é a mesma chave");
    ok(mesmaChave("Contato@Loja.com", "contato@loja.com"), "e-mail ignora a caixa");
    ok(!mesmaChave("12345678901", "10987654321"), "chaves diferentes não se confundem");
    ok(!mesmaChave("", "12345678901"), "chave vazia nunca casa");
  }

  console.log("\n3. O BR Code");
  {
    const r = montarBrCode({ chave: "12345678901", nome: "Cantina do Zé", cidade: "São Paulo", valor: 42.5, txid: "PEDIDO-123" });
    ok(r.ok, "monta com valor");
    const c = lerEmv(r.payload);
    ok(c["00"] === "01", "indicador de formato");
    ok(c["26"].includes("br.gov.bcb.pix"), "domínio do Pix no campo 26");
    ok(c["26"].includes("12345678901"), "com a chave dentro");
    ok(c["53"] === "986", "moeda BRL");
    ok(c["54"] === "42.50", "valor com duas casas");
    ok(c["58"] === "BR", "país");
    ok(c["59"] === "CANTINA DO ZE", "nome sem acento e em caixa alta");
    ok(c["60"] === "SAO PAULO", "cidade idem");
    ok(c["62"] === "0509PEDIDO123", "txid sem o hífen, que o padrão não aceita");
    ok(crc16(r.payload.slice(0, -4)) === r.payload.slice(-4), "CRC bate — é isso que o banco valida");

    const semValor = montarBrCode({ chave: "12345678901", nome: "Loja", cidade: "Vitoria" });
    ok(!("54" in lerEmv(semValor.payload)), "sem valor, o campo 54 nem aparece");
    ok(lerEmv(semValor.payload)["62"] === "0503***", "e o txid vira *** como manda o padrão");

    const nomeLongo = montarBrCode({
      chave: "12345678901",
      nome: "Restaurante Sabor Caseiro da Dona Benta Limitada",
      cidade: "Sao Jose dos Campos do Litoral",
    });
    const cl = lerEmv(nomeLongo.payload);
    ok(cl["59"].length <= 25, "nome cortado no limite de 25");
    ok(cl["60"].length <= 15, "cidade cortada no limite de 15");

    ok(montarBrCode({ chave: "", nome: "X", cidade: "Y" }).ok === false, "sem chave não monta");
    ok(normalizarTxid("pedido #12/2026") === "pedido122026", "txid perde o que o padrão não aceita");
  }

  console.log("\n4. QR Code e código do link");
  {
    const r = montarBrCode({ chave: "12345678901", nome: "Loja", cidade: "Vitoria" });
    const png = await qrCodeDataUrl(r.payload);
    ok(png.startsWith("data:image/png;base64,"), "o QR Code sai como PNG");
    ok(png.length > 500, "com conteúdo de verdade");

    const codigos = new Set(Array.from({ length: 200 }, () => gerarCodigo()));
    ok(codigos.size === 200, "os códigos do link não se repetem");
    ok(!/[01lo]/.test([...codigos][0]), "sem caracteres que se confundem na leitura");
  }

  console.log("\n5. Cadastro incompleto");
  {
    ok(conferirCadastro({}).ok === false, "sem chave, avisa");
    ok(/Meu Negócio/.test(conferirCadastro({}).erro), "e diz onde cadastrar");
    ok(conferirCadastro({ pixKey: "123", pixKeyType: "CPF" }).ok === false, "chave inválida também barra");
  }

  console.log("\n6. A cobrança");
  {
    const c = await conta();
    const r = await criarCobranca(c.tenant.id, { amount: 89.9, description: "Pedido 240", leadId: c.lead.id });
    ok(r.ok, "cria a cobrança");
    ok(r.cobranca.amount === 89.9, "com o valor");
    ok(r.cobranca.status === "PENDING", "nascendo pendente");
    ok(lerEmv(r.cobranca.payload)["54"] === "89.90", "e o valor dentro do BR Code");
    ok(/\/pix\//.test(r.cobranca.link), "com o link público");

    const gravada = await prisma.pixCharge.findUnique({ where: { code: r.cobranca.code } });
    ok(gravada?.leadId === c.lead.id, "presa ao lead que vai pagar");

    const negativa = await criarCobranca(c.tenant.id, { amount: -5 });
    ok(negativa.ok === false, "valor negativo é recusado");

    const semPix = await prisma.tenant.create({
      data: { name: "Sem Pix", email: `sempix-${marca}@teste.local` },
    });
    const r2 = await criarCobranca(semPix.id, { amount: 10 });
    ok(r2.ok === false && /chave Pix/.test(r2.erro), "conta sem chave não gera cobrança");
  }

  console.log("\n7. O agente entrega o Pix");
  {
    const c = await conta();
    const midias = [];
    const textos = [];
    const om = MessagingService.sendMedia;
    const ot = MessagingService.sendText;
    MessagingService.sendMedia = async (...a) => { midias.push(a); return true; };
    MessagingService.sendText = async (...a) => { textos.push(a); return true; };

    const r = await engine._executeTool("send_pix", { amount: 55, description: "Pedido 12" }, c.lead);
    MessagingService.sendMedia = om;
    MessagingService.sendText = ot;

    ok(r.success === true && r.sent_qr === true, "manda o QR Code como imagem");
    ok(midias[0]?.[3] === "image", "no formato certo");
    ok(r.sent_code === true, "e o copia e cola");
    // O código sozinho na mensagem: qualquer texto em volta faz o cliente
    // selecionar junto e o app do banco recusar o código.
    ok(/^00020126/.test(textos[0]?.[2] || ""), "o copia e cola vai sozinho, sem texto em volta");
    ok(crc16(textos[0][2].slice(0, -4)) === textos[0][2].slice(-4), "com o CRC íntegro");
    ok(/\/pix\//.test(r.link || ""), "e a ferramenta devolve o link ao modelo");
    ok(/comprovante/.test(r.note || ""), "instruindo a pedir o comprovante depois");
  }

  console.log("\n8. Quando nada sai, o agente não pode dizer que enviou");
  {
    const c = await conta();
    const om = MessagingService.sendMedia;
    const ot = MessagingService.sendText;
    MessagingService.sendMedia = async () => false;
    MessagingService.sendText = async () => false;

    const r = await engine._executeTool("send_pix", { amount: 30 }, c.lead);
    MessagingService.sendMedia = om;
    MessagingService.sendText = ot;

    ok(r.sent_qr === false && r.sent_code === false, "não afirma o envio");
    ok(/NÃO diga que enviou/.test(r.note || ""), "e proíbe a promessa que não se cumpre");
  }

  console.log("\n9. Conta sem chave cadastrada");
  {
    const tenant = await prisma.tenant.create({
      data: { name: "Sem Pix 2", email: `sempix2-${marca}@teste.local` },
    });
    const lead = await prisma.lead.create({
      data: { tenantId: tenant.id, name: "Ana", phone: `5527${String(marca).slice(-7)}9`, channel: "WHATSAPP" },
    });
    const om = MessagingService.sendMedia;
    let chamou = false;
    MessagingService.sendMedia = async () => { chamou = true; return true; };
    const r = await engine._executeTool("send_pix", {}, lead);
    MessagingService.sendMedia = om;

    ok(!chamou, "não tenta enviar Pix que o negócio não sabe receber");
    ok(r.success === false && /chave Pix/.test(r.error || ""), "e diz ao modelo por quê");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
