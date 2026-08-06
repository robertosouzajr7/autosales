/**
 * Upload de arquivo e mídia, em todos os pontos da plataforma.
 *
 *   DATABASE_URL=... JWT_SECRET=... API=http://127.0.0.1:3000 \
 *     node scripts/test-uploads.mjs
 *
 * O treino do agente quebrava em todo PDF ("pdfParse is not a function": o
 * pdf-parse 2.x trocou a função por uma classe), e qualquer falha de caminho
 * chegava à tela como `Unexpected token "<"`, porque uma rota inexistente
 * respondia a página de erro do Express em HTML.
 *
 * Aqui sobem arquivos de verdade — PDF, DOCX, TXT, CSV e PNG — por cada
 * endpoint, e se verifica também o que acontece quando dá errado.
 */
import prisma from "../src/api/config/prisma.js";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const API = process.env.API || "http://127.0.0.1:3000";
const SEGREDO = process.env.JWT_SECRET;
const AMOSTRAS = path.join(process.cwd(), "scripts", "amostras");

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = Date.now();
let token;

/** Sobe um arquivo como o navegador sobe: multipart, sem Content-Type manual. */
const MIMES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  csv: "text/csv",
  png: "image/png",
};

async function subir(caminho, arquivo, extras = {}, campo = "file", mimeForcado = null) {
  const fd = new FormData();
  const dados = fs.readFileSync(path.join(AMOSTRAS, arquivo));
  const ext = arquivo.split(".").pop();
  fd.append(campo, new Blob([dados], { type: mimeForcado ?? (MIMES[ext] || "") }), arquivo);
  for (const [k, v] of Object.entries(extras)) fd.append(k, v);
  const res = await fetch(`${API}/api${caminho}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const bruto = await res.text();
  let corpo = null;
  let eraJson = true;
  try { corpo = bruto ? JSON.parse(bruto) : null; } catch { eraJson = false; }
  return { status: res.status, corpo, eraJson, bruto };
}

async function main() {
  if (!SEGREDO) throw new Error("Defina JWT_SECRET igual ao do servidor.");
  if (!fs.existsSync(path.join(AMOSTRAS, "documento.pdf"))) {
    execFileSync("python3", [path.join(AMOSTRAS, "gerar-amostras.py")], { stdio: "inherit" });
  }

  const plano = await prisma.plan.create({
    data: { name: `Upload ${marca}`, priceMonthly: 100, priceYearly: 1000, maxKnowledgeBaseChars: 100000 },
  });
  const tenant = await prisma.tenant.create({
    data: { name: "Clínica Upload", email: `up-${marca}@teste.local`, planId: plano.id },
  });
  const dono = await prisma.user.create({
    data: { name: "Marina", email: `up-d-${marca}@teste.local`, password: "x", role: "OWNER", tenantId: tenant.id, emailVerified: true },
  });
  token = jwt.sign({ userId: dono.id, tenantId: tenant.id, role: "OWNER" }, SEGREDO, { expiresIn: "1h" });
  const agente = await prisma.sdrBot.create({ data: { tenantId: tenant.id, name: "Sofia", active: true } });

  // ── 1. Treino do agente: PDF, DOCX e TXT ────────────────────
  console.log("\n1. Base de conhecimento do agente");
  let r = await subir(`/sdrs/${agente.id}/training`, "documento.pdf");
  ok(r.status === 200, `PDF aceito (${r.status}: ${r.corpo?.error || "ok"})`);
  ok((r.corpo?.extractedChars || 0) > 20, `e o texto foi extraído (${r.corpo?.extractedChars} caracteres)`);
  ok(/Horario de atendimento/.test(r.corpo?.sdr?.knowledgeBase || ""), "com o conteúdo real do arquivo");

  r = await subir(`/sdrs/${agente.id}/training`, "documento.docx");
  ok(r.status === 200, `DOCX aceito (${r.status}: ${r.corpo?.error || "ok"})`);
  ok(/cancelamento/.test(r.corpo?.sdr?.knowledgeBase || ""), "com o conteúdo real do arquivo");

  r = await subir(`/sdrs/${agente.id}/training`, "documento.txt");
  ok(r.status === 200, `TXT aceito (${r.status}: ${r.corpo?.error || "ok"})`);
  ok(/Estacionamento/.test(r.corpo?.sdr?.knowledgeBase || ""), "com o conteúdo real do arquivo");

  r = await subir(`/sdrs/${agente.id}/training`, "contatos.csv");
  ok(r.status === 200, `CSV aceito (${r.status})`);

  // ── 2. O que o treino recusa, e como ────────────────────────
  console.log("\n2. Recusas do treino");
  r = await subir(`/sdrs/${agente.id}/training`, "imagem.png");
  ok(r.status === 415, `imagem não é documento de treino (${r.status})`);
  ok(r.eraJson && /png|não são aceitos/i.test(r.corpo?.error || ""), `e a recusa é legível: "${r.corpo?.error}"`);

  // ── 3. Mídia da conversa ────────────────────────────────────
  console.log("\n3. Anexo na conversa");
  r = await subir("/messages/upload", "imagem.png");
  ok(r.status === 200, `imagem aceita (${r.status}: ${r.corpo?.error || "ok"})`);
  ok(r.corpo?.kind === "IMAGE" && !!r.corpo?.url, `classificada e guardada (${r.corpo?.kind} → ${r.corpo?.url})`);

  const arquivoSalvo = r.corpo?.url;
  const busca = await fetch(`${API}${arquivoSalvo}`);
  ok(busca.status === 200, `e o arquivo é servido de volta (${busca.status})`);
  ok((busca.headers.get("content-type") || "").includes("image"), `com o tipo certo (${busca.headers.get("content-type")})`);

  r = await subir("/messages/upload", "documento.pdf");
  ok(r.status === 200 && r.corpo?.kind === "DOCUMENT", `PDF vai como documento (${r.corpo?.kind})`);

  // O navegador manda octet-stream sempre que o sistema não reconhece a
  // extensão. Recusar por isso barrava foto boa.
  r = await subir("/messages/upload", "imagem.png", {}, "file", "application/octet-stream");
  ok(r.status === 200 && r.corpo?.kind === "IMAGE", `tipo genérico é resolvido pela extensão (${r.status}: ${r.corpo?.kind || r.corpo?.error})`);

  // ── 4. Mídia do catálogo ────────────────────────────────────
  console.log("\n4. Mídia do catálogo");
  r = await subir("/products/upload", "imagem.png");
  ok(r.status === 200 && !!r.corpo?.url, `imagem do produto aceita (${r.status}: ${r.corpo?.error || r.corpo?.url})`);

  // ── 5. Importação de contatos ───────────────────────────────
  console.log("\n5. Planilha de contatos");
  r = await subir("/contacts/import-csv", "contatos.csv");
  ok(r.status === 200, `CSV importado (${r.status}: ${r.corpo?.error || "ok"})`);
  ok(r.corpo?.criados === 2, `dois contatos criados (${r.corpo?.criados})`);
  r = await subir("/contacts/import-csv", "documento.pdf");
  ok(r.status === 415, `PDF não passa por planilha de contatos (${r.status})`);

  // ── 6. Arquivo grande é recusado com o motivo ───────────────
  console.log("\n6. Tamanho");
  r = await subir("/messages/upload", "grande.png");
  ok(r.status === 413, `arquivo de 26 MB recusado (${r.status})`);
  ok(r.eraJson, "e a recusa vem em JSON, não numa página de erro");
  ok(/limite/i.test(r.corpo?.error || ""), `dizendo qual é o limite: "${r.corpo?.error}"`);

  // ── 7. Nada de HTML numa resposta de API ────────────────────
  console.log("\n7. Rota que não existe");
  const inexistente = await fetch(`${API}/api/uploads-que-nao-existe`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  });
  const corpoBruto = await inexistente.text();
  ok(inexistente.status === 404, `responde 404 (${inexistente.status})`);
  ok(!corpoBruto.trim().startsWith("<"), "sem HTML — era daqui que vinha o 'Unexpected token \"<\"'");
  let legivel = null;
  try { legivel = JSON.parse(corpoBruto); } catch {}
  ok(!!legivel?.error, `e diz o que faltou: "${legivel?.error}"`);

  // ── 8. Sem arquivo ──────────────────────────────────────────
  console.log("\n8. Requisição sem arquivo");
  const vazio = await fetch(`${API}/api/messages/upload`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: new FormData(),
  });
  const corpoVazio = await vazio.json().catch(() => null);
  ok(vazio.status === 400 && !!corpoVazio?.error, `recusa explicada (${vazio.status}: ${corpoVazio?.error})`);

  console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro no teste:", e);
  await prisma.$disconnect();
  process.exit(1);
});
