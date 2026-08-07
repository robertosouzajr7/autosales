/**
 * Teste do envio de mídia do catálogo.
 *
 *   DATABASE_URL=... node scripts/test-midia-catalogo.mjs
 *
 * O sintoma relatado: o agente diz que está enviando a imagem e ela não
 * chega. Eram dois defeitos somados — o motor marcava "enviei" sem olhar o
 * resultado, e o Baileys recebia um caminho relativo que não sabe ler.
 */
import prisma from "../src/api/config/prisma.js";
import { resolverMidia } from "../whatsapp.js";
import MessagingService from "../src/api/services/MessagingService.js";
import engine from "../automation_engine.js";
import fs from "fs";
import path from "path";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = Date.now();
let n = 0;

async function contaComItem({ imageUrl = null } = {}) {
  const tenant = await prisma.tenant.create({
    data: { name: `Mídia ${++n}`, email: `midia-${marca}-${n}@teste.local`, businessType: "CLINICA" },
  });
  const item = await prisma.product.create({
    data: { tenantId: tenant.id, name: `Clareamento ${n}`, price: 1400, description: "Três sessões", imageUrl, isActive: true },
  });
  const lead = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Marina", phone: `55279${String(marca).slice(-6)}${String(n).padStart(2, "0")}`, channel: "WHATSAPP" },
  });
  return { tenant, item, lead };
}

async function main() {
  console.log("\n1. O que o Baileys consegue receber");
  {
    ok((await resolverMidia("data:image/png;base64,aGVsbG8=")) instanceof Buffer, "data URL vira Buffer");
    const abs = await resolverMidia("https://cdn.exemplo.com/foto.jpg");
    ok(abs?.url === "https://cdn.exemplo.com/foto.jpg", "URL absoluta passa como {url}");
    ok((await resolverMidia("")) === null, "vazio é recusado");
    ok((await resolverMidia(null)) === null, "nulo é recusado");
  }

  console.log("\n2. Arquivo que existe no disco vira Buffer");
  {
    const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
    fs.mkdirSync(dir, { recursive: true });
    const nome = `teste-${marca}.txt`;
    fs.writeFileSync(path.join(dir, nome), "conteudo");
    const r = await resolverMidia(`/uploads/${nome}`);
    ok(r instanceof Buffer && r.toString() === "conteudo", "lê do disco, sem depender de DNS");
    fs.unlinkSync(path.join(dir, nome));
  }

  console.log("\n3. Caminho relativo SEM o arquivo no disco");
  {
    const antes = process.env.PUBLIC_URL;

    process.env.PUBLIC_URL = "";
    ok((await resolverMidia("/uploads/nao-existe.jpg")) === null, "sem PUBLIC_URL, recusa em vez de fingir");

    process.env.PUBLIC_URL = "https://app.exemplo.com.br";
    const r = await resolverMidia("/uploads/nao-existe.jpg");
    ok(r?.url === "https://app.exemplo.com.br/uploads/nao-existe.jpg", "com PUBLIC_URL, monta a URL pública");

    process.env.PUBLIC_URL = antes;
  }

  console.log("\n4. O agente NÃO pode dizer que enviou quando não enviou");
  {
    const c = await contaComItem({ imageUrl: "/uploads/foto.jpg" });
    const original = MessagingService.sendMedia;
    MessagingService.sendMedia = async () => false; // canal recusou

    const r = await engine._executeTool("send_catalog_item", { name: c.item.name }, c.lead);
    MessagingService.sendMedia = original;

    ok(r.success === true, "o item continua sendo apresentado");
    ok(r.sent_media === false, "mas sem afirmar que a mídia saiu");
    ok(/NÃO foi entregue/.test(r.note || ""), "e a instrução ao modelo é explícita");
    ok(/NÃO diga que enviou/.test(r.note || ""), "proibindo a promessa que não se cumpre");
  }

  console.log("\n5. Quando envia de verdade");
  {
    const c = await contaComItem({ imageUrl: "/uploads/foto.jpg" });
    const original = MessagingService.sendMedia;
    const chamadas = [];
    MessagingService.sendMedia = async (...args) => { chamadas.push(args); return true; };

    const r = await engine._executeTool("send_catalog_item", { name: c.item.name }, c.lead);
    MessagingService.sendMedia = original;

    ok(r.sent_media === true, "reporta o envio");
    ok(/Mídia enviada/.test(r.note || ""), "e manda o modelo comentar o item");
    ok(chamadas[0]?.[2] === "/uploads/foto.jpg", "com a mídia do item");
    ok(/R\$ 1400\.00/.test(chamadas[0]?.[4] || ""), "e a legenda com o preço");
  }

  console.log("\n6. Item sem imagem");
  {
    const c = await contaComItem({ imageUrl: null });
    const original = MessagingService.sendMedia;
    let chamou = false;
    MessagingService.sendMedia = async () => { chamou = true; return true; };

    const r = await engine._executeTool("send_catalog_item", { name: c.item.name }, c.lead);
    MessagingService.sendMedia = original;

    ok(!chamou, "não tenta enviar mídia que não existe");
    ok(r.sent_media === false && /sem mídia/.test(r.note || ""), "e o modelo sabe que é só texto");
  }

  console.log("\n7. Canal que estoura no meio");
  {
    const c = await contaComItem({ imageUrl: "/uploads/foto.jpg" });
    const original = MessagingService.sendMedia;
    MessagingService.sendMedia = async () => { throw new Error("conexão caiu"); };

    const r = await engine._executeTool("send_catalog_item", { name: c.item.name }, c.lead);
    MessagingService.sendMedia = original;

    ok(r.success === true && r.sent_media === false, "o erro não derruba a resposta, mas conta a verdade");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
