/**
 * Teste da montagem guiada do prompt do agente.
 *
 *   API=http://127.0.0.1:3000 DATABASE_URL=... node scripts/test-prompt-builder.mjs
 *
 * O que precisa ser verdade: o prompt sai completo mesmo sem IA configurada,
 * carrega CONDUTA e não DADOS (preço e horário são injetados vivos a cada
 * conversa, e congelá-los aqui faria o agente cotar preço vencido), e o que
 * o dono proibiu aparece literalmente.
 */
import prisma from "../src/api/config/prisma.js";
import PromptBuilder, { montarEsqueleto, QUESTIONARIO, SECOES } from "../src/api/services/PromptBuilder.js";
import AIProviderService from "../src/api/services/AIProviderService.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API = process.env.API || "http://127.0.0.1:3000";
let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const marca = Date.now();

const RESPOSTAS = {
  nomeAgente: "Bia, da Clínica Vida Plena",
  publico: "Mulheres de 25 a 45 anos buscando tratamento estético pela primeira vez",
  sucesso: "AGENDAR",
  tom: "PROXIMO",
  diferencial: "Somos os únicos da região com o aparelho X e damos retorno gratuito em 30 dias.",
  objecoes: "Achei caro\nPreciso falar com meu marido\nVou pensar",
  nuncaFazer: "Nunca dar desconto\nNunca prometer resultado",
  chamarHumano: "Cliente irritado ou reclamando\nPedido de reembolso",
  coletar: "Nome completo\nSe já foi cliente",
};

async function main() {
  console.log("\n1. O esqueleto tem todas as seções");
  {
    const p = montarEsqueleto(RESPOSTAS, { negocio: "Clínica Vida Plena", agentFunction: "SCHEDULER" });
    for (const s of SECOES) {
      ok(p.includes(`# ${s.titulo}`), `seção ${s.titulo}`);
    }
  }

  console.log("\n2. O que o dono escreveu aparece");
  {
    const p = montarEsqueleto(RESPOSTAS, { negocio: "Clínica Vida Plena", agentFunction: "SCHEDULER" });
    ok(p.includes("Bia, da Clínica Vida Plena"), "o nome do agente");
    ok(p.includes("Mulheres de 25 a 45 anos"), "o público");
    ok(p.includes("Nunca dar desconto"), "as proibições, literais");
    ok(p.includes("Nunca prometer resultado"), "todas elas");
    ok(p.includes("Cliente irritado ou reclamando"), "os gatilhos de escalonamento");
    ok(p.includes("aparelho X"), "o diferencial, no cenário de comparação");
    ok(p.includes('"Achei caro"'), "cada objeção vira um cenário");
    ok(p.includes('"Vou pensar"'), "todas elas");
    ok(p.includes("Nome completo"), "o que precisa ser descoberto");
  }

  console.log("\n3. Conduta, não dados");
  {
    const p = montarEsqueleto(RESPOSTAS, { negocio: "Clínica Vida Plena", agentFunction: "SCHEDULER" });
    ok(!/R\$\s*\d/.test(p), "nenhum preço no texto");
    ok(!/\b\d{1,2}h(\d{2})?\s*(às|as)\s*\d/.test(p), "nenhum horário de funcionamento");
    ok(p.includes("SOMENTE o que está no contexto"), "e a regra que manda usar o contexto vivo");
    ok(/não sabe/i.test(p), "com o limite do que ele sabe dito por extenso");
  }

  console.log("\n4. O desfecho escolhido muda o prompt");
  {
    const agendar = montarEsqueleto({ ...RESPOSTAS, sucesso: "AGENDAR" }, {});
    const vender = montarEsqueleto({ ...RESPOSTAS, sucesso: "VENDER" }, {});
    ok(agendar.includes("dia e hora marcados"), "AGENDAR fala em marcar");
    ok(vender.includes("link de pagamento"), "VENDER fala em fechar");
    ok(agendar !== vender, "e os dois prompts são diferentes");
  }

  console.log("\n5. O tom escolhido muda o prompt");
  {
    const proximo = montarEsqueleto({ ...RESPOSTAS, tom: "PROXIMO" }, {});
    const tecnico = montarEsqueleto({ ...RESPOSTAS, tom: "TECNICO" }, {});
    ok(proximo.includes("pessoa próxima"), "PROXIMO");
    ok(tecnico.includes("vocabulário técnico"), "TECNICO");
    ok(!tecnico.includes("emoji só quando cabe"), "e o tom técnico não herda a regra de emoji");
  }

  console.log("\n6. As skills mudam as ferramentas e a coleta");
  {
    const comAgenda = montarEsqueleto(RESPOSTAS, { skills: ["schedule", "escalate_human"] });
    const semAgenda = montarEsqueleto(RESPOSTAS, { skills: ["send_catalog"] });
    ok(comAgenda.includes("Agendar horários"), "quem agenda vê a ferramenta de agenda");
    ok(comAgenda.includes("E-mail do cliente — obrigatório antes de agendar"), "e o e-mail entra na coleta");
    ok(!semAgenda.includes("Agendar horários"), "quem não agenda não vê");
    ok(!semAgenda.includes("obrigatório antes de agendar"), "nem a exigência de e-mail");
    ok(semAgenda.includes("Enviar catálogo/mídia"), "e vê a ferramenta que tem");
  }

  console.log("\n7. Sem IA configurada, ainda sai um prompt");
  {
    const tenant = await prisma.tenant.create({
      data: { name: "Sem IA", email: `pb-semia-${marca}@teste.local`, businessType: "CLINICA" },
    });
    const original = AIProviderService.resolveAIConfig;
    AIProviderService.resolveAIConfig = async () => ({ provider: "gemini", model: "x", apiKey: null });

    const r = await PromptBuilder.gerar(tenant.id, RESPOSTAS, { agentFunction: "SCHEDULER" });
    AIProviderService.resolveAIConfig = original;

    ok(r.geradoPorIA === false, "avisa que não foi a IA");
    ok(/Nenhum provedor/.test(r.motivo || ""), "e diz por quê");
    ok(r.prompt.includes("# PROIBIÇÕES"), "mas o prompt está completo");
    ok(r.prompt.includes("Sem IA"), "com o nome do negócio na identidade");
  }

  console.log("\n8. IA que falha não deixa o dono sem prompt");
  {
    const tenant = await prisma.tenant.create({
      data: { name: "IA Fora", email: `pb-iafora-${marca}@teste.local`, businessType: "CLINICA" },
    });
    const oc = AIProviderService.resolveAIConfig;
    const og = AIProviderService.generateText;
    AIProviderService.resolveAIConfig = async () => ({ provider: "gemini", model: "x", apiKey: "chave" });
    AIProviderService.generateText = async () => { throw new Error("503 do provedor"); };

    const r = await PromptBuilder.gerar(tenant.id, RESPOSTAS, {});
    AIProviderService.resolveAIConfig = oc;
    AIProviderService.generateText = og;

    ok(r.geradoPorIA === false && /503/.test(r.motivo || ""), "o motivo real é reportado");
    ok(r.prompt.includes("# OBJETIVO"), "e o esqueleto vai no lugar");
  }

  console.log("\n9. Resposta curta da IA é descartada");
  {
    const tenant = await prisma.tenant.create({
      data: { name: "IA Curta", email: `pb-curta-${marca}@teste.local`, businessType: "CLINICA" },
    });
    const oc = AIProviderService.resolveAIConfig;
    const og = AIProviderService.generateText;
    AIProviderService.resolveAIConfig = async () => ({ provider: "gemini", model: "x", apiKey: "chave" });
    AIProviderService.generateText = async () => "Claro! Aqui está o prompt.";

    const r = await PromptBuilder.gerar(tenant.id, RESPOSTAS, {});
    AIProviderService.resolveAIConfig = oc;
    AIProviderService.generateText = og;

    ok(r.geradoPorIA === false, "não entrega o texto truncado");
    ok(r.prompt.includes("# IDENTIDADE"), "e mantém o esqueleto bom");
  }

  console.log("\n10. IA boa: o texto dela é usado, sem cerca de código");
  {
    const tenant = await prisma.tenant.create({
      data: { name: "IA Boa", email: `pb-boa-${marca}@teste.local`, businessType: "CLINICA" },
    });
    const oc = AIProviderService.resolveAIConfig;
    const og = AIProviderService.generateText;
    AIProviderService.resolveAIConfig = async () => ({ provider: "gemini", model: "x", apiKey: "chave" });
    const desenvolvido = montarEsqueleto(RESPOSTAS, {}) + "\n\nCenário extra desenvolvido pela IA.";
    AIProviderService.generateText = async () => "```\n" + desenvolvido + "\n```";

    const r = await PromptBuilder.gerar(tenant.id, RESPOSTAS, {});
    AIProviderService.resolveAIConfig = oc;
    AIProviderService.generateText = og;

    ok(r.geradoPorIA === true, "usa o texto da IA");
    ok(!r.prompt.includes("```"), "e tira a cerca de código");
    ok(r.prompt.includes("Cenário extra"), "com o desenvolvimento preservado");
  }

  console.log("\n11. Pela API");
  {
    const plan = await prisma.plan.create({ data: { name: `PB ${marca}`, priceMonthly: 0, priceYearly: 0 } });
    const tenant = await prisma.tenant.create({
      data: { name: "Clínica API", email: `pb-api-${marca}@teste.local`, businessType: "CLINICA", planId: plan.id },
    });
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id, name: "Dono", email: `dono-pb-${marca}@teste.local`,
        password: await bcrypt.hash("x", 4), role: "ADMIN", emailVerified: true,
      },
    });
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt.sign({ userId: user.id, tenantId: tenant.id, role: "ADMIN" }, process.env.JWT_SECRET)}`,
    };

    const q = await fetch(`${API}/api/sdrs/prompt/questionario`, { headers }).then((r) => r.json());
    ok(q.questionario?.length === QUESTIONARIO.length, "o questionário é servido");
    ok(q.negocio === "Clínica API", "com o nome do negócio");

    const semObrig = await fetch(`${API}/api/sdrs/prompt/gerar`, {
      method: "POST", headers, body: JSON.stringify({ respostas: { publico: "só isso" } }),
    });
    const erro = await semObrig.json();
    ok(semObrig.status === 400, "faltando resposta obrigatória, recusa");
    ok(erro.faltando?.includes("nomeAgente"), "e diz qual falta");

    const gerado = await fetch(`${API}/api/sdrs/prompt/gerar`, {
      method: "POST", headers, body: JSON.stringify({ respostas: RESPOSTAS, agentFunction: "SCHEDULER" }),
    }).then((r) => r.json());
    ok(typeof gerado.prompt === "string" && gerado.prompt.length > 800, "com tudo respondido, gera");
    ok(gerado.prompt.includes("Nunca dar desconto"), "respeitando o que o dono proibiu");

    const agentes = await prisma.sdrBot.count({ where: { tenantId: tenant.id } });
    ok(agentes === 0, "e não grava nada: quem decide aplicar é o dono");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
