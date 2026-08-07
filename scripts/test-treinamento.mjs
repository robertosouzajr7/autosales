/**
 * Teste do treinamento com revisão do dono.
 *
 *   API=http://127.0.0.1:3000 DATABASE_URL=... node scripts/test-treinamento.mjs
 *
 * A regra que o teste protege: NADA entra na base do agente sem o dono
 * decidir. Extração que se auto-aprova é como um preço errado de um PDF
 * antigo vira política da casa.
 */
import prisma from "../src/api/config/prisma.js";
import KnowledgeExtractor, { dividirSemIA, origemDoArquivo } from "../src/api/services/KnowledgeExtractor.js";
import AIProviderService from "../src/api/services/AIProviderService.js";
import VoiceService from "../src/api/services/VoiceService.js";
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

const MATERIAL = `Manual de Atendimento - Clínica Vida Plena
Página 1 de 12

Clareamento a Laser
São três sessões de 40 minutos cada, com intervalo de sete dias entre elas.
O resultado costuma aparecer já na primeira sessão.

Limpeza de Pele
Sessão única de 50 minutos. Indicada a cada três meses.

Política de remarcação
O cliente pode remarcar até 24 horas antes sem custo. Depois disso, é cobrada
meia sessão.`;

const ITENS_DA_IA = {
  itens: [
    { pergunta: "Quantas sessões tem o clareamento a laser?", resposta: "São três sessões de 40 minutos, com sete dias de intervalo entre elas.", trecho: "São três sessões de 40 minutos" },
    { pergunta: "De quanto em quanto tempo devo fazer limpeza de pele?", resposta: "A cada três meses. A sessão é única e dura 50 minutos.", trecho: "Sessão única de 50 minutos" },
    { pergunta: "Posso remarcar meu horário?", resposta: "Sim, até 24 horas antes sem custo. Depois disso é cobrada meia sessão.", trecho: "remarcar até 24 horas antes" },
  ],
};

async function conta(nome, { maxKb = 500000 } = {}) {
  const plan = await prisma.plan.create({
    data: { name: `Trein ${nome} ${marca}${++n}`, priceMonthly: 0, priceYearly: 0, maxKnowledgeBaseChars: maxKb },
  });
  const tenant = await prisma.tenant.create({
    data: { name: nome, email: `tr-${marca}-${nome}-${n}@teste.local`, businessType: "CLINICA", planId: plan.id },
  });
  const sdr = await prisma.sdrBot.create({ data: { tenantId: tenant.id, name: "Bia", agentFunction: "SCHEDULER" } });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id, name: "Dono", email: `dono-tr-${marca}-${n}@teste.local`,
      password: await bcrypt.hash("x", 4), role: "ADMIN", emailVerified: true,
    },
  });
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt.sign({ userId: user.id, tenantId: tenant.id, role: "ADMIN" }, process.env.JWT_SECRET)}`,
  };
  return { tenant, sdr, headers };
}

function comIA(itens = ITENS_DA_IA) {
  const oc = AIProviderService.resolveAIConfig;
  const og = AIProviderService.generateText;
  AIProviderService.resolveAIConfig = async () => ({ provider: "gemini", model: "x", apiKey: "chave" });
  AIProviderService.generateText = async () => JSON.stringify(itens);
  return () => { AIProviderService.resolveAIConfig = oc; AIProviderService.generateText = og; };
}

function semIA() {
  const oc = AIProviderService.resolveAIConfig;
  AIProviderService.resolveAIConfig = async () => ({ provider: "gemini", model: "x", apiKey: null });
  return () => { AIProviderService.resolveAIConfig = oc; };
}

async function main() {
  console.log("\n1. Origem do material pela extensão");
  {
    ok(origemDoArquivo("manual.pdf") === "DOCUMENTO", "PDF é documento");
    ok(origemDoArquivo("tabela.xlsx") === "PLANILHA", "XLSX é planilha");
    ok(origemDoArquivo("precos.csv") === "PLANILHA", "CSV é planilha");
    ok(origemDoArquivo("explicacao.webm", "audio/webm") === "AUDIO", "gravação é áudio");
    ok(origemDoArquivo("nota.ogg") === "AUDIO", "OGG é áudio");
  }

  console.log("\n2. Extração propõe, não grava");
  {
    const c = await conta("Propoe");
    const restaurar = comIA();
    const r = await KnowledgeExtractor.extrair(c.tenant.id, c.sdr.id, { texto: MATERIAL });
    restaurar();

    ok(r.total === 3, "três itens extraídos");
    ok(r.extraidoPorIA === true, "pela IA");
    const pendentes = await prisma.knowledgeDraft.count({ where: { lote: r.lote, status: "PENDENTE" } });
    ok(pendentes === 3, "todos como PENDENTE");

    const sdr = await prisma.sdrBot.findUnique({ where: { id: c.sdr.id } });
    ok(!sdr.knowledgeBase, "e a base do agente continua vazia");
  }

  console.log("\n3. O dono decide: mantém, edita e descarta");
  {
    const c = await conta("Decide");
    const restaurar = comIA();
    const r = await KnowledgeExtractor.extrair(c.tenant.id, c.sdr.id, { texto: MATERIAL });
    restaurar();
    const itens = await prisma.knowledgeDraft.findMany({ where: { lote: r.lote }, orderBy: { createdAt: "asc" } });

    const res = await KnowledgeExtractor.consolidar(c.tenant.id, c.sdr.id, [
      { id: itens[0].id, manter: true },
      { id: itens[1].id, manter: false },
      { id: itens[2].id, manter: true, resposta: "Sim, até 24 horas antes. Depois disso cobramos meia sessão." },
    ]);

    ok(res.aprovados === 2 && res.recusados === 1, "dois entram, um fica de fora");

    const sdr = await prisma.sdrBot.findUnique({ where: { id: c.sdr.id } });
    ok(sdr.knowledgeBase.includes("## Quantas sessões tem o clareamento a laser?"), "o item mantido entra como pergunta");
    ok(sdr.knowledgeBase.includes("cobramos meia sessão"), "com a edição do dono, não o texto original");
    ok(!sdr.knowledgeBase.includes("três meses"), "o descartado não entra");

    const recusado = await prisma.knowledgeDraft.findUnique({ where: { id: itens[1].id } });
    ok(recusado.status === "RECUSADO" && !!recusado.decidedAt, "o descartado fica registrado, não some");
  }

  console.log("\n4. Consolidar duas vezes acumula, não sobrescreve");
  {
    const c = await conta("Acumula");
    for (const passe of [1, 2]) {
      const restaurar = comIA({ itens: [{ pergunta: `Pergunta ${passe}`, resposta: `Resposta ${passe}` }] });
      const r = await KnowledgeExtractor.extrair(c.tenant.id, c.sdr.id, { texto: MATERIAL });
      restaurar();
      const itens = await prisma.knowledgeDraft.findMany({ where: { lote: r.lote } });
      await KnowledgeExtractor.consolidar(c.tenant.id, c.sdr.id, itens.map((i) => ({ id: i.id, manter: true })));
    }
    const sdr = await prisma.sdrBot.findUnique({ where: { id: c.sdr.id } });
    ok(sdr.knowledgeBase.includes("Pergunta 1") && sdr.knowledgeBase.includes("Pergunta 2"), "os dois materiais convivem");
  }

  console.log("\n5. Sem IA, ainda dá para treinar");
  {
    const c = await conta("SemIA");
    const restaurar = semIA();
    const r = await KnowledgeExtractor.extrair(c.tenant.id, c.sdr.id, { texto: MATERIAL });
    restaurar();
    ok(r.extraidoPorIA === false, "avisa que não foi a IA");
    ok(/Nenhum provedor/.test(r.motivo || ""), "e diz por quê");
    ok(r.total > 0, "mas propõe itens assim mesmo");
    const sdr = await prisma.sdrBot.findUnique({ where: { id: c.sdr.id } });
    ok(!sdr.knowledgeBase, "e continua sem gravar sozinho");
  }

  console.log("\n6. Divisão sem IA usa o título como pergunta");
  {
    const itens = dividirSemIA("Política de remarcação\nO cliente pode remarcar até 24 horas antes sem custo nenhum.");
    ok(itens.length === 1, "um bloco vira um item");
    ok(itens[0].pergunta === "Política de remarcação", "a primeira linha vira a pergunta");
    ok(itens[0].resposta.includes("24 horas"), "e o resto vira a resposta");
  }

  console.log("\n7. Material curto demais é recusado");
  {
    const c = await conta("Curto");
    let erro = null;
    await KnowledgeExtractor.extrair(c.tenant.id, c.sdr.id, { texto: "oi" }).catch((e) => { erro = e.message; });
    ok(/não tem texto suficiente/.test(erro || ""), "com uma explicação, não um erro genérico");
  }

  console.log("\n8. Áudio: a transcrição vira o material");
  {
    const c = await conta("Audio");
    const ot = VoiceService.transcribeAudio;
    VoiceService.transcribeAudio = async () => MATERIAL;
    const restaurar = comIA();

    const r = await KnowledgeExtractor.extrair(c.tenant.id, c.sdr.id, {
      buffer: Buffer.from("fingindo ser audio"), nome: "explicacao.webm", mimetype: "audio/webm",
    });
    restaurar();
    VoiceService.transcribeAudio = ot;

    ok(r.origem === "AUDIO", "a origem é registrada como áudio");
    ok(r.total === 3, "e os itens saem da fala");
  }

  console.log("\n9. Áudio sem transcrição não vira treino silencioso");
  {
    const c = await conta("AudioMudo");
    const ot = VoiceService.transcribeAudio;
    VoiceService.transcribeAudio = async () => null;
    let erro = null;
    await KnowledgeExtractor.extrair(c.tenant.id, c.sdr.id, {
      buffer: Buffer.from("x"), nome: "mudo.ogg", mimetype: "audio/ogg",
    }).catch((e) => { erro = e.message; });
    VoiceService.transcribeAudio = ot;
    ok(/transcrever o áudio/.test(erro || ""), "o dono é avisado do que houve");
  }

  console.log("\n10. Limite do plano vale na hora de guardar");
  {
    const c = await conta("Limite", { maxKb: 60 });
    const restaurar = comIA();
    const r = await KnowledgeExtractor.extrair(c.tenant.id, c.sdr.id, { texto: MATERIAL });
    restaurar();
    const itens = await prisma.knowledgeDraft.findMany({ where: { lote: r.lote } });
    ok(itens.length === 3, "extrair não é bloqueado: revisar é de graça");

    let erro = null;
    await KnowledgeExtractor.consolidar(c.tenant.id, c.sdr.id, itens.map((i) => ({ id: i.id, manter: true })))
      .catch((e) => { erro = e; });
    ok(erro?.codigo === "LIMITE_DE_PLANO", "guardar respeita o limite do plano");
    const sdr = await prisma.sdrBot.findUnique({ where: { id: c.sdr.id } });
    ok(!sdr.knowledgeBase, "e nada entra pela metade");
  }

  console.log("\n11. Pela API");
  {
    const c = await conta("Api");
    const restaurar = comIA();
    const r = await KnowledgeExtractor.extrair(c.tenant.id, c.sdr.id, { texto: MATERIAL });
    restaurar();

    const pend = await fetch(`${API}/api/sdrs/${c.sdr.id}/knowledge/pending`, { headers: c.headers }).then((x) => x.json());
    ok(pend.total === 3, "o que está pendente é listado, para retomar depois");

    const itens = await prisma.knowledgeDraft.findMany({ where: { lote: r.lote }, orderBy: { createdAt: "asc" } });
    const res = await fetch(`${API}/api/sdrs/${c.sdr.id}/knowledge/consolidate`, {
      method: "POST",
      headers: c.headers,
      body: JSON.stringify({ decisoes: itens.map((i, idx) => ({ id: i.id, manter: idx === 0 })) }),
    });
    const d = await res.json();
    ok(res.ok && d.aprovados === 1 && d.recusados === 2, "a decisão do dono é respeitada");
    ok(d.knowledgeBase.includes("clareamento"), "e a base volta atualizada para a tela");

    const depois = await fetch(`${API}/api/sdrs/${c.sdr.id}/knowledge/pending`, { headers: c.headers }).then((x) => x.json());
    ok(depois.total === 0, "e nada fica pendente depois de decidido");
  }

  console.log("\n12. Não atravessa contas");
  {
    const a = await conta("ContaA");
    const b = await conta("ContaB");
    const restaurar = comIA();
    const r = await KnowledgeExtractor.extrair(b.tenant.id, b.sdr.id, { texto: MATERIAL });
    restaurar();
    const itens = await prisma.knowledgeDraft.findMany({ where: { lote: r.lote } });

    const res = await KnowledgeExtractor.consolidar(a.tenant.id, a.sdr.id, itens.map((i) => ({ id: i.id, manter: true })));
    ok(res.aprovados === 0, "itens de outra conta são ignorados");
    const sdrB = await prisma.sdrBot.findUnique({ where: { id: b.sdr.id } });
    ok(!sdrB.knowledgeBase, "e a base da outra conta não é tocada");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
