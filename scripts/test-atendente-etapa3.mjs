/**
 * Teste das três lacunas que o app do atendente precisava.
 *
 *   API=http://127.0.0.1:3000 DATABASE_URL=... node scripts/test-atendente-etapa3.mjs
 *
 * Sugestão da IA (que NÃO envia nem age), respostas rápidas de verdade (com
 * atalho e contagem de uso) e disponibilidade do atendente (que é o que
 * decide para quem a fila transfere).
 */
import prisma from "../src/api/config/prisma.js";
import SuggestionService from "../src/api/services/SuggestionService.js";
import AvailabilityService, { estadoDe, estaDisponivel } from "../src/api/services/AvailabilityService.js";
import AttendanceService from "../src/api/services/AttendanceService.js";
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
let n = 0;
const fone = () => `55419${String(marca).slice(-6)}${String(++n).padStart(2, "0")}`;

async function conta(nome) {
  const plan = await prisma.plan.create({
    data: { name: `E3 ${nome} ${marca}${++n}`, priceMonthly: 0, priceYearly: 0, enableTokens: true, maxTokens: 1000000 },
  });
  const tenant = await prisma.tenant.create({
    data: { name: nome, email: `e3-${marca}-${nome}-${n}@teste.local`, businessType: "CLINICA", planId: plan.id },
  });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id, name: "Diego Lopes", email: `diego-${marca}-${n}@teste.local`,
      password: await bcrypt.hash("x", 4), role: "ADMIN", emailVerified: true,
    },
  });
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt.sign({ userId: user.id, tenantId: tenant.id, role: "ADMIN" }, process.env.JWT_SECRET)}`,
  };
  return { tenant, user, headers };
}

function comIA(resposta) {
  const oc = AIProviderService.resolveAIConfig;
  const og = AIProviderService.generateText;
  AIProviderService.resolveAIConfig = async () => ({ provider: "gemini", model: "x", apiKey: "chave" });
  AIProviderService.generateText = async () => resposta;
  return () => { AIProviderService.resolveAIConfig = oc; AIProviderService.generateText = og; };
}

async function conversaCom(c, ultimaDe = "USER") {
  const lead = await prisma.lead.create({
    data: { tenantId: c.tenant.id, name: "Marina Costa", phone: fone(), channel: "WHATSAPP" },
  });
  const conv = await prisma.conversation.create({ data: { leadId: lead.id, tenantId: c.tenant.id } });
  await prisma.message.create({
    data: { conversationId: conv.id, tenantId: c.tenant.id, role: "USER", content: "Oi, quanto custa o clareamento?" },
  });
  await prisma.message.create({
    data: { conversationId: conv.id, tenantId: c.tenant.id, role: ultimaDe, content: ultimaDe === "USER" ? "E dá para parcelar?" : "Custa R$ 1.400." },
  });
  return { lead, conv };
}

async function main() {
  console.log("\n1. Sugestão da IA");
  {
    const c = await conta("Sugestao");
    await prisma.sdrBot.create({ data: { tenantId: c.tenant.id, name: "Bia", agentFunction: "SCHEDULER" } });
    const { lead, conv } = await conversaCom(c);

    const restaurar = comIA('  "Sugestão: Consigo sim, em até 3x sem juros. Quer que eu já reserve um horário?"  ');
    const r = await SuggestionService.sugerir(c.tenant.id, lead.id);
    restaurar();

    ok(r.ok === true, "a sugestão é gerada");
    ok(r.sugestao.startsWith("Consigo sim"), 'o "Sugestão:" e as aspas são removidos');
    ok(!r.sugestao.includes('"'), "sem aspas sobrando");

    const mensagens = await prisma.message.count({ where: { conversationId: conv.id } });
    ok(mensagens === 2, "e NADA é enviado: a conversa continua com as mesmas mensagens");
  }

  console.log("\n2. Quando não faz sentido sugerir");
  {
    const c = await conta("SemSugestao");
    const { lead } = await conversaCom(c, "ASSISTANT");
    const restaurar = comIA("qualquer coisa");
    const r = await SuggestionService.sugerir(c.tenant.id, lead.id);
    restaurar();
    ok(r.ok === false, "a última mensagem é nossa: não há o que responder");
    ok(/Espere o cliente/.test(r.motivo || ""), "e o motivo explica");

    const vazio = await prisma.lead.create({
      data: { tenantId: c.tenant.id, name: "Sem conversa", phone: fone(), channel: "WHATSAPP" },
    });
    const r2 = await SuggestionService.sugerir(c.tenant.id, vazio.id);
    ok(r2.ok === false && /não há conversa/i.test(r2.motivo || ""), "sem conversa, também não sugere");
  }

  console.log("\n3. Sem IA configurada, a sugestão falha sem quebrar o atendimento");
  {
    const c = await conta("SemIA");
    const { lead } = await conversaCom(c);
    const oc = AIProviderService.resolveAIConfig;
    AIProviderService.resolveAIConfig = async () => ({ provider: "gemini", model: "x", apiKey: null });
    const r = await SuggestionService.sugerir(c.tenant.id, lead.id);
    AIProviderService.resolveAIConfig = oc;
    ok(r.ok === false && /provedor de IA/.test(r.motivo || ""), "devolve o motivo em vez de estourar");
  }

  console.log("\n4. Créditos de IA acabados");
  {
    const c = await conta("SemCredito");
    await prisma.tenant.update({
      where: { id: c.tenant.id },
      data: { usedTokens: 2000000 },
    });
    const { lead } = await conversaCom(c);
    const restaurar = comIA("nao deveria chegar aqui");
    const r = await SuggestionService.sugerir(c.tenant.id, lead.id);
    restaurar();
    ok(r.ok === false && /créditos/i.test(r.motivo || ""), "não gasta o que não tem");
  }

  console.log("\n5. Respostas rápidas: semeia na primeira vez");
  {
    const c = await conta("Respostas");
    const r = await fetch(`${API}/api/quick-replies`, { headers: c.headers }).then((x) => x.json());
    ok(r.total === 4, "as quatro padrão aparecem em vez de uma tela vazia");
    ok(r.itens.some((i) => i.atalho === "/conf"), "com atalho");

    const denovo = await fetch(`${API}/api/quick-replies`, { headers: c.headers }).then((x) => x.json());
    ok(denovo.total === 4, "e a semente não se repete a cada carregamento");
  }

  console.log("\n6. Criar, editar e o atalho único");
  {
    const c = await conta("Atalhos");
    await fetch(`${API}/api/quick-replies`, { headers: c.headers });

    const criada = await fetch(`${API}/api/quick-replies`, {
      method: "POST", headers: c.headers,
      body: JSON.stringify({ titulo: "Orçamento", texto: "Vou montar seu orçamento agora.", atalho: "orc" }),
    }).then((x) => x.json());
    ok(criada.atalho === "/orc", "o atalho ganha a barra sozinho");

    const repetido = await fetch(`${API}/api/quick-replies`, {
      method: "POST", headers: c.headers,
      body: JSON.stringify({ titulo: "Outro", texto: "Texto", atalho: "/orc" }),
    });
    ok(repetido.status === 409, "atalho repetido é recusado");
    ok(/já é de "Orçamento"/.test((await repetido.json()).error || ""), "dizendo de quem já é");

    const semTexto = await fetch(`${API}/api/quick-replies`, {
      method: "POST", headers: c.headers, body: JSON.stringify({ titulo: "Só título" }),
    });
    ok(semTexto.status === 400, "resposta sem texto é recusada");
  }

  console.log("\n7. A lista se ordena pelo que é usado");
  {
    const c = await conta("Uso");
    const lista = await fetch(`${API}/api/quick-replies`, { headers: c.headers }).then((x) => x.json());
    const alvo = lista.itens.find((i) => i.atalho === "/mom");

    for (let i = 0; i < 3; i++) {
      await fetch(`${API}/api/quick-replies/${alvo.id}/used`, { method: "POST", headers: c.headers });
    }
    const depois = await fetch(`${API}/api/quick-replies`, { headers: c.headers }).then((x) => x.json());
    ok(depois.itens[0].id === alvo.id, "a mais usada vai para o topo");
    ok(depois.itens[0].usos === 3, "com a contagem certa");
  }

  console.log("\n8. Disponibilidade");
  {
    const c = await conta("Pausa");
    const inicial = await fetch(`${API}/api/attendance/me`, { headers: c.headers }).then((x) => x.json());
    ok(inicial.estado === "ONLINE", "todo mundo começa online");

    const pausa = await fetch(`${API}/api/attendance/me`, {
      method: "PUT", headers: c.headers,
      body: JSON.stringify({ estado: "PAUSA", minutos: 15, recado: "Volto em 15 minutos" }),
    }).then((x) => x.json());
    ok(pausa.estado === "PAUSA" && pausa.disponivel === false, "a pausa vale");
    ok(pausa.recado === "Volto em 15 minutos", "com o recado");
    ok(!!pausa.disponivelAte, "e com a volta prometida guardada");

    const volta = await fetch(`${API}/api/attendance/me`, {
      method: "PUT", headers: c.headers, body: JSON.stringify({ estado: "ONLINE" }),
    }).then((x) => x.json());
    ok(volta.estado === "ONLINE" && volta.disponivelAte === null, "voltar apaga a promessa de retorno");
    ok(volta.recado === null, "e o recado");

    const invalido = await fetch(`${API}/api/attendance/me`, {
      method: "PUT", headers: c.headers, body: JSON.stringify({ estado: "DORMINDO" }),
    });
    ok(invalido.status === 400, "estado inventado é recusado");
  }

  console.log("\n9. A pausa vencida volta a valer como online");
  {
    const c = await conta("Vencida");
    await prisma.user.update({
      where: { id: c.user.id },
      data: { disponibilidade: "PAUSA", disponivelAte: new Date(Date.now() - 60000) },
    });
    const u = await prisma.user.findUnique({ where: { id: c.user.id } });
    ok(estadoDe(u) === "ONLINE", "passada a hora, conta como online de novo");
    ok(estaDisponivel(u) === true, "e volta a receber transferência");

    const meu = await fetch(`${API}/api/attendance/me`, { headers: c.headers }).then((x) => x.json());
    ok(meu.estado === "ONLINE" && meu.estadoGuardado === "PAUSA", "a tela vê os dois: o real e o guardado");
  }

  console.log("\n10. Transferir para quem está em pausa é recusado");
  {
    const c = await conta("Transfere");
    const colega = await prisma.user.create({
      data: {
        tenantId: c.tenant.id, name: "Ana Martins", email: `ana-${marca}-${++n}@teste.local`,
        password: await bcrypt.hash("x", 4), role: "USER", emailVerified: true,
        disponibilidade: "PAUSA", recadoDeAusencia: "Almoço",
      },
    });
    const { conv } = await conversaCom(c);
    await prisma.conversation.update({ where: { id: conv.id }, data: { phase: "HUMAN", assignedToId: c.user.id } });

    let erro = null;
    await AttendanceService.transfer(conv.id, { toUserId: colega.id, tenantId: c.tenant.id }).catch((e) => { erro = e.message; });
    ok(/em pausa/.test(erro || ""), "a transferência é recusada com o motivo");
    ok(/Almoço/.test(erro || ""), "e com o recado da pessoa");

    const depois = await prisma.conversation.findUnique({ where: { id: conv.id } });
    ok(depois.assignedToId === c.user.id, "a conversa continua com quem estava");

    await prisma.user.update({ where: { id: colega.id }, data: { disponibilidade: "ONLINE" } });
    await AttendanceService.transfer(conv.id, { toUserId: colega.id, tenantId: c.tenant.id });
    const agora = await prisma.conversation.findUnique({ where: { id: conv.id } });
    ok(agora.assignedToId === colega.id, "com ela online, a transferência passa");
  }

  console.log("\n11. A equipe mostra quem está disponível");
  {
    const c = await conta("Equipe");
    await prisma.user.create({
      data: {
        tenantId: c.tenant.id, name: "Fora do turno", email: `fora-${marca}-${++n}@teste.local`,
        password: await bcrypt.hash("x", 4), role: "USER", emailVerified: true, disponibilidade: "FORA",
      },
    });
    const equipe = await fetch(`${API}/api/attendance/team`, { headers: c.headers }).then((x) => x.json());
    ok(equipe.itens.length === 2, "a equipe inteira aparece");
    ok(equipe.itens.filter((i) => i.disponivel).length === 1, "com quem está disponível marcado");

    const disponiveis = await AvailabilityService.disponiveis(c.tenant.id);
    ok(disponiveis.length === 1, "e a fila só enxerga quem pode receber");
  }

  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam.` : "\n✅ Tudo certo.");
  await prisma.$disconnect();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
