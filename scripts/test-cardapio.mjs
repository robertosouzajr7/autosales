/**
 * Teste do cardápio em arquivo.
 *
 *   DATABASE_URL=... node scripts/test-cardapio.mjs
 *
 * O pedido: nichos de alimentação sobem uma foto ou um PDF do cardápio em
 * "Meu Negócio", e o agente entrega esse arquivo quando o cliente pede o
 * cardápio — sem transcrever nem inventar itens.
 */
import prisma from "../src/api/config/prisma.js";
import MessagingService from "../src/api/services/MessagingService.js";
import engine from "../automation_engine.js";
import { classificar, cardapioDe, legenda, ehNichoDeAlimentacao } from "../src/api/services/MenuService.js";
import { nomeDeArquivo } from "../whatsapp.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = Date.now();
let n = 0;

async function conta({ menuUrl = null, menuKind = null, menuFileName = null } = {}) {
  const tenant = await prisma.tenant.create({
    data: {
      name: `Cantina ${++n}`,
      email: `cardapio-${marca}-${n}@teste.local`,
      businessType: "RESTAURANT",
      menuUrl,
      menuKind,
      menuFileName,
      menuUpdatedAt: menuUrl ? new Date() : null,
    },
  });
  const lead = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      name: "Rafael",
      phone: `55279${String(marca).slice(-6)}${String(n).padStart(2, "0")}`,
      channel: "WHATSAPP",
    },
  });
  return { tenant, lead };
}

async function main() {
  console.log("\n1. Que arquivo serve como cardápio");
  {
    ok(classificar("cardapio.pdf", "application/pdf").kind === "document", "PDF entra como documento");
    ok(classificar("cardapio.jpg", "image/jpeg").kind === "image", "JPG entra como imagem");
    ok(classificar("cardapio.PNG", "").kind === "image", "extensão em caixa alta é aceita");
    // O navegador manda octet-stream sempre que o sistema não reconhece o
    // arquivo. Recusar por causa disso é recusar um PDF bom.
    ok(classificar("cardapio.pdf", "application/octet-stream").kind === "document",
      "mimetype genérico não derruba o PDF");
    const doc = classificar("contrato.docx", "");
    ok(doc.ok === false && /imagem/.test(doc.erro), "DOCX é recusado com o motivo na frase");
    ok(classificar("video.mp4", "video/mp4").ok === false, "vídeo não é cardápio");
  }

  console.log("\n2. Em que nichos o campo aparece");
  {
    ok(ehNichoDeAlimentacao("RESTAURANT"), "restaurante tem cardápio");
    ok(ehNichoDeAlimentacao("food"), "e a comparação não depende da caixa");
    ok(!ehNichoDeAlimentacao("CLINIC"), "clínica não");
  }

  console.log("\n3. O cardápio publicado");
  {
    const semCardapio = await conta();
    ok((await cardapioDe(semCardapio.tenant.id)) === null, "conta sem arquivo devolve null");

    const c = await conta({ menuUrl: "/uploads/cardapio.pdf", menuKind: "document", menuFileName: "cardapio-2026.pdf" });
    const achado = await cardapioDe(c.tenant.id);
    ok(achado?.url === "/uploads/cardapio.pdf", "devolve o arquivo publicado");
    ok(achado?.kind === "document" && achado?.fileName === "cardapio-2026.pdf", "com o tipo e o nome original");
  }

  console.log("\n4. O agente entrega o arquivo");
  {
    const c = await conta({ menuUrl: "/uploads/cardapio.pdf", menuKind: "document", menuFileName: "cardapio-2026.pdf" });
    const original = MessagingService.sendMedia;
    const chamadas = [];
    MessagingService.sendMedia = async (...args) => { chamadas.push(args); return true; };

    const r = await engine._executeTool("send_menu", {}, c.lead);
    MessagingService.sendMedia = original;

    ok(r.success === true && r.sent === true, "reporta o envio");
    ok(chamadas[0]?.[2] === "/uploads/cardapio.pdf", "com o arquivo do cardápio");
    ok(chamadas[0]?.[3] === "document", "como documento");
    ok(chamadas[0]?.[5]?.fileName === "cardapio-2026.pdf",
      "e com o nome original — é o que o cliente vê no celular");
    ok(/cardápio/i.test(chamadas[0]?.[4] || ""), "acompanhado de uma legenda curta");
  }

  console.log("\n5. Quando o arquivo não sai, o agente não pode dizer que saiu");
  {
    const c = await conta({ menuUrl: "/uploads/cardapio.jpg", menuKind: "image" });
    const original = MessagingService.sendMedia;
    MessagingService.sendMedia = async () => false; // o canal recusou
    const r = await engine._executeTool("send_menu", {}, c.lead);
    MessagingService.sendMedia = original;

    ok(r.sent === false, "não afirma o envio");
    ok(/NÃO foi entregue/.test(r.note || ""), "e a instrução ao modelo é explícita");
    ok(/NÃO diga que enviou/.test(r.note || ""), "proibindo a promessa que não se cumpre");
  }

  console.log("\n6. Canal que estoura no meio");
  {
    const c = await conta({ menuUrl: "/uploads/cardapio.jpg", menuKind: "image" });
    const original = MessagingService.sendMedia;
    MessagingService.sendMedia = async () => { throw new Error("conexão caiu"); };
    const r = await engine._executeTool("send_menu", {}, c.lead);
    MessagingService.sendMedia = original;

    ok(r.success === true && r.sent === false, "o erro não derruba a resposta, mas conta a verdade");
  }

  console.log("\n7. Conta sem cardápio publicado");
  {
    const c = await conta();
    const original = MessagingService.sendMedia;
    let chamou = false;
    MessagingService.sendMedia = async () => { chamou = true; return true; };
    const r = await engine._executeTool("send_menu", {}, c.lead);
    MessagingService.sendMedia = original;

    ok(!chamou, "não tenta enviar arquivo que não existe");
    ok(r.success === false && /não publicou/.test(r.error || ""), "e diz ao modelo por quê");
  }

  console.log("\n8. Nome do arquivo para o documento no WhatsApp");
  {
    ok(nomeDeArquivo("/uploads/abc/cardapio-2026.pdf") === "cardapio-2026.pdf", "tira do caminho");
    ok(nomeDeArquivo("https://cdn.exemplo.com/x/menu.pdf?v=3") === "menu.pdf", "ignora a querystring");
    ok(nomeDeArquivo("/uploads/sem-extensao") === null, "sem extensão, não inventa nome");
    ok(nomeDeArquivo("data:application/pdf;base64,AAA") === null, "data URL não vira nome");
  }

  console.log("\n9. A legenda combina com o tipo do arquivo");
  {
    ok(/abrir o arquivo/.test(legenda({ kind: "document" })), "PDF avisa que é para abrir");
    ok(!/abrir o arquivo/.test(legenda({ kind: "image" })), "imagem já aparece na conversa");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
