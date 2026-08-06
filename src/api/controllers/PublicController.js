import prisma from "../config/prisma.js";
import jwt from "jsonwebtoken";
import { touchConversation } from "../services/ConversationService.js";
import { buildIdentity, findOrCreateLead, normalizePhone, resolveContact } from "../services/ContactIdentity.js";
import MessagingService from "../services/MessagingService.js";
import AutomationEngine from "../../../automation_engine.js";
import { getFunctionPreset } from "../services/AgentFunctions.js";

export const getLandingPage = async (req, res) => {
  try {
    const settings = await prisma.landingPageSettings.findUnique({
      where: { id: "singleton" }
    });
    
    // We should probably fetch active plans too
    const plans = await prisma.plan.findMany({
      where: { active: true }
    });
    
    res.json({ settings, plans });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Perguntas do questionário de contratação. Vêm do servidor para a landing
 * e o wizard nunca discordarem sobre o que está sendo perguntado.
 */
export const getPlanQuestions = async (_req, res) => {
  const { PERGUNTAS } = await import("../services/PlanAdvisor.js");
  res.json({ perguntas: PERGUNTAS });
};

/** Recebe as respostas e devolve o plano ideal de cada canal. */
export const recommendPlan = async (req, res) => {
  try {
    const { recomendar } = await import("../services/PlanAdvisor.js");
    res.json(await recomendar(req.body?.respostas || req.body || {}));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Os planos de entrada para a página de preços: o mais barato de cada
 * canal. Cinco colunas fazem o visitante virar analista de si mesmo antes
 * de comprar — duas opções claras convertem mais.
 */
export const getEntryPlans = async (_req, res) => {
  try {
    const { publicar, precosVigentes } = await import("../services/PlanFeatures.js");
    const precos = await precosVigentes();
    const planos = await prisma.plan.findMany({
      where: { active: true, priceMonthly: { gt: 0 } },
      orderBy: { priceMonthly: "asc" },
    });
    const modo = (p) => String(p.whatsappMode || "BOTH").toUpperCase();
    const oficial = planos.find((p) => ["OFFICIAL", "BOTH"].includes(modo(p))) || null;
    const qrcode = planos.find((p) => ["BAILEYS", "BOTH"].includes(modo(p))) || null;
    res.json({ oficial: publicar(oficial, precos), qrcode: publicar(qrcode, precos), total: planos.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Catálogo completo para a página /planos.
 *
 * Só entra plano ativo e pago: plano de R$ 0 na base é fixture de teste ou
 * cortesia interna, e ninguém contrata da vitrine. A lista sai ordenada por
 * preço e separada por canal, que é a única divisão que muda o custo — a
 * tela não decide nada, ela mostra o que existe cadastrado.
 */
export const getAllPlans = async (_req, res) => {
  try {
    const { publicar, precosVigentes } = await import("../services/PlanFeatures.js");
    const precos = await precosVigentes();
    const linhas = await prisma.plan.findMany({
      where: { active: true, priceMonthly: { gt: 0 } },
      orderBy: { priceMonthly: "asc" },
    });
    // A descrição vem pronta do servidor: a página nunca inventa benefício
    // que o plano não tem, e desligar um módulo no admin some da vitrine.
    //
    // Só o que a vitrine precisa atravessa: os custos unitários do plano
    // (sdrUnitCost, tokenUnitCost, messageUnitCost) são a margem da operação
    // e não têm por que sair numa rota pública.
    const planos = linhas.map((p) => publicar(p, precos));
    const modo = (p) => String(p.whatsappMode || "BOTH").toUpperCase();
    res.json({
      planos,
      oficiais: planos.filter((p) => ["OFFICIAL", "BOTH"].includes(modo(p))),
      qrcode: planos.filter((p) => ["BAILEYS", "BOTH"].includes(modo(p))),
      total: planos.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Captura do lead antes do diagnóstico.
 *
 * O questionário é a melhor isca que a landing tem: quem responde cinco
 * perguntas sobre o próprio atendimento está comprando. Deixar essa pessoa
 * sair sem nome nem contato é jogar fora o lead mais quente do funil — daí
 * pedir os dados antes de começar.
 *
 * Refazer o diagnóstico atualiza o mesmo registro: o e-mail é a chave, do
 * mesmo jeito que a base de contatos não duplica ninguém.
 */
export const captureLead = async (req, res) => {
  try {
    const { validarEmail } = await import("../services/SignupPolicy.js");
    const { name, email, phone, origem } = req.body || {};

    const nome = String(name || "").trim();
    if (nome.length < 2) return res.status(400).json({ error: "Informe seu nome.", campo: "name" });

    const conferido = validarEmail(email);
    if (!conferido.ok) return res.status(400).json({ error: conferido.erro, campo: "email" });

    // Telefone é opcional na entrada, mas se vier tem que ser telefone.
    const telefone = normalizePhone(phone);
    if (phone && !telefone) {
      return res.status(400).json({ error: "Telefone inválido. Use DDD + número.", campo: "phone" });
    }

    const dados = {
      name: nome,
      phone: telefone,
      origem: ["QUIZ", "CHAT", "OUTRO"].includes(origem) ? origem : "QUIZ",
      ip: req.ip || null,
      userAgent: String(req.get("user-agent") || "").slice(0, 300) || null,
    };

    const lead = await prisma.platformLead.upsert({
      where: { email: conferido.email },
      // Quem volta não perde o histórico: status e anotações do vendedor ficam.
      update: { name: dados.name, phone: dados.phone || undefined },
      create: { email: conferido.email, ...dados },
    });

    res.json({ id: lead.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Guarda o que ele respondeu e o que foi recomendado, ao fim do quiz. */
export const saveLeadAnswers = async (req, res) => {
  try {
    const { respostas, planoQrCode, planoOficial } = req.body || {};
    await prisma.platformLead.update({
      where: { id: req.params.id },
      data: {
        respostas: respostas ? JSON.stringify(respostas) : undefined,
        planoQrCode: planoQrCode || undefined,
        planoOficial: planoOficial || undefined,
      },
    });
    res.json({ success: true });
  } catch {
    // Lead sumido não pode derrubar o wizard do visitante.
    res.json({ success: false });
  }
};

export const getWebchat = async (req, res) => {
  const { id } = req.params; // tenantId
  try {
    // OBS: o modelo Tenant não tem logoUrl — o logo (opcional) vem das
    // configurações da landing. Selecionar um campo inexistente derrubava o
    // endpoint (500) e o portal aparecia como "não encontrado".
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    // Fetch active SDR bot for the tenant to show in the webchat portal
    const sdr = await prisma.sdrBot.findFirst({
      where: { tenantId: id, active: true },
    });

    // Logo opcional (landing settings — singleton). Não bloqueia o portal.
    let logo = null;
    try {
      const lp = await prisma.landingPageSettings.findUnique({ where: { id: "singleton" }, select: { logoUrl: true } });
      logo = lp?.logoUrl || null;
    } catch { /* segue sem logo */ }

    // Rótulo do cargo do agente vem da FUNÇÃO escolhida (Vendedor, SDR,
    // Suporte, etc.) — dinâmico, não fixo em "SDR". Usa o role custom se houver.
    const roleLabel = sdr
      ? (sdr.role || getFunctionPreset(sdr.agentFunction).label)
      : null;

    res.json({
      tenantName: tenant.name,
      logo,
      sdr: sdr ? { ...sdr, roleLabel } : null,
      // Sinaliza ao portal quando não há agente ativo configurado.
      hasAgent: !!sdr,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const submitChat = async (req, res) => {
  const { tenantId, message, visitorId, name, email, phone, sdrId, leadId } = req.body;
  try {
    let resolvedTenantId = tenantId;
    
    // If tenantId is not provided, resolve it from the sdrId
    if (!resolvedTenantId && sdrId) {
      const sdr = await prisma.sdrBot.findUnique({ where: { id: sdrId } });
      if (sdr) {
        resolvedTenantId = sdr.tenantId;
      }
    }

    if (!resolvedTenantId) {
      return res.status(400).json({ error: "Falta tenantId ou sdrId na requisição." });
    }

    // 1. Find or create lead
    let lead;
    if (leadId) {
      lead = await prisma.lead.findUnique({ where: { id: leadId } });
      // Confere que o contato é deste negócio: o leadId vem da sessão do
      // navegador, que é do visitante e não do servidor.
      if (lead && lead.tenantId !== resolvedTenantId) lead = null;
    }

    const { normalizePhone, normalizeEmail } = await import("../services/ContactIdentity.js");
    const telefone = normalizePhone(phone);
    const eMail = normalizeEmail(email);

    if (!lead) {
      // Conversa nova só começa identificada. Sem isso o atendimento nasce
      // como "Visitante do site" e ninguém consegue retomar o contato depois
      // que a aba fecha — que é justamente o valor do chat público.
      if (!String(name || "").trim() || !eMail || !telefone) {
        return res.status(400).json({
          error: "Informe nome, e-mail e telefone para começar a conversa.",
          identificacaoNecessaria: true,
        });
      }
      // O visitorId identifica a sessão do site — não é telefone.
      const identity = buildIdentity("SITE", visitorId, { name, email });
      identity.phone = telefone;
      const r = await findOrCreateLead(resolvedTenantId, identity, { source: "WEBCHAT" });
      lead = r.lead;
    } else {
      // Contato que já existia (inclusive de antes desta tela pedir os dados):
      // completa o que estiver faltando, sem sobrescrever o que já se sabe.
      const faltando = {};
      if (!lead.email && eMail) faltando.email = eMail;
      if (!lead.phone && telefone) faltando.phone = telefone;
      if (name?.trim() && (!lead.name || lead.name === "Visitante do site")) faltando.name = name.trim();
      if (Object.keys(faltando).length) {
        lead = await prisma.lead.update({ where: { id: lead.id }, data: faltando });
      }
    }

    // 2. Find or create conversation
    let conversation = await prisma.conversation.findUnique({
      where: { leadId: lead.id }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { leadId: lead.id, tenantId: resolvedTenantId, botActive: true }
      });
    }

    // 3. Save message
    const newMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId: resolvedTenantId,
        content: message,
        role: "USER"
      }
    });
    await touchConversation(newMessage);
    // O inbox escuta a mesma fonte: sem isto, mensagem vinda do site só
    // aparecia para a equipe quando alguém recarregava a tela.
    const { messageEvents } = await import("./MessageController.js");
    messageEvents.emit("new_message", { tenantId: resolvedTenantId, message: newMessage });

    // 4. Generate AI SDR response
    const aiResponse = await AutomationEngine.callAI(null, lead, { tenantId: resolvedTenantId });
    
    // 5. Save assistant message if generated
    if (aiResponse) {
      const assistantMsg = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          tenantId: resolvedTenantId,
          content: aiResponse,
          role: "ASSISTANT"
        }
      });
      await touchConversation(assistantMsg);
      messageEvents.emit("new_message", { tenantId: resolvedTenantId, message: assistantMsg });
    }

    res.json({
      success: true,
      message: newMessage,
      leadId: lead.id,
      // Credencial da conversa: é com ela que o visitante lê o histórico e
      // escuta as respostas. O leadId sozinho não serve — ele viaja no
      // navegador e qualquer um que o adivinhasse leria a conversa alheia.
      chatToken: assinarTokenDoChat(lead.id, resolvedTenantId),
      response: aiResponse || "Desculpe, não consegui processar a resposta agora.",
    });
  } catch (error) {
    console.error("[PublicWebchat] Erro ao enviar mensagem:", error);
    res.status(500).json({ error: error.message });
  }
};


/**
 * Credencial da conversa do site.
 *
 * Assinada com o mesmo segredo do painel, mas com `tipo` próprio: um token
 * de webchat nunca pode ser confundido com um login. Vale 12h — o suficiente
 * para o visitante voltar à aba no mesmo dia e continuar de onde parou.
 */
function assinarTokenDoChat(leadId, tenantId) {
  return jwt.sign({ tipo: "webchat", leadId, tenantId }, process.env.JWT_SECRET, { expiresIn: "12h" });
}

function lerTokenDoChat(token) {
  try {
    const dados = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    return dados?.tipo === "webchat" && dados.leadId && dados.tenantId ? dados : null;
  } catch {
    return null;
  }
}

/**
 * Histórico da conversa do site.
 *
 * O visitante guardava as mensagens no próprio navegador, então tudo que o
 * atendente respondesse enquanto a aba estava fechada simplesmente não
 * existia para ele. Agora a conversa vem do servidor.
 */
export const getChatHistory = async (req, res) => {
  try {
    const dados = lerTokenDoChat(req.query.token);
    if (!dados) return res.status(401).json({ error: "Sessão de chat expirada. Recarregue a página." });

    const conversa = await prisma.conversation.findFirst({
      where: { leadId: dados.leadId, tenantId: dados.tenantId },
      select: { id: true },
    });
    if (!conversa) return res.json({ messages: [] });

    const messages = await prisma.message.findMany({
      where: { conversationId: conversa.id, role: { not: "SYSTEM" } },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, role: true, content: true, mediaUrl: true, messageType: true, createdAt: true },
    });
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Respostas chegando ao visitante em tempo real.
 *
 * Mesma fonte que o inbox escuta (messageEvents), filtrada pela conversa do
 * token. Só sai o que NÃO é do próprio visitante: a fala dele já está na
 * tela desde antes de o servidor confirmar.
 */
export const streamChat = async (req, res) => {
  const dados = lerTokenDoChat(req.query.token);
  if (!dados) return res.status(401).json({ error: "Sessão de chat expirada." });

  const conversa = await prisma.conversation.findFirst({
    where: { leadId: dados.leadId, tenantId: dados.tenantId },
    select: { id: true },
  });
  if (!conversa) return res.status(404).json({ error: "Conversa não encontrada." });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    // Sem isto o nginx segura o fluxo em buffer e o "tempo real" chega em lotes.
    "X-Accel-Buffering": "no",
  });
  res.write(": conectado\n\n");

  const { messageEvents } = await import("./MessageController.js");
  const aoReceber = (evento) => {
    const m = evento?.message;
    if (!m || evento.tenantId !== dados.tenantId) return;
    if (m.conversationId !== conversa.id) return;
    if (m.role === "USER") return;
    res.write(`data: ${JSON.stringify(m)}\n\n`);
  };
  messageEvents.on("new_message", aoReceber);

  // Proxies derrubam conexão ociosa; o comentário periódico mantém viva.
  const batida = setInterval(() => res.write(": ping\n\n"), 25000);

  req.on("close", () => {
    clearInterval(batida);
    messageEvents.off("new_message", aoReceber);
  });
};

/**
 * Agendamento pelo link público.
 *
 * Passa pelo CalendarService — e não mais por um `appointment.create` solto —
 * para herdar o mesmo comportamento do agendamento feito pelo agente:
 * checagem de conflito, evento no Google com link do Meet, régua de lembretes
 * e movimentação no funil.
 */
export const bookAppointment = async (req, res) => {
  const { tenantId, name, email, phone, date, title } = req.body;
  try {
    const { lead } = await resolveContact(tenantId, {
      name, email, phone,
      source: "PUBLIC_BOOKING",
      status: "SCHEDULED",
    });

    const { default: CalendarService } = await import("../../../calendar_service.js");
    let booked;
    try {
      booked = await CalendarService.createAppointment(tenantId, lead, date, title || "Reunião de Alinhamento");
    } catch (e) {
      if (e?.code === "SLOT_CONFLICT") {
        return res.status(409).json({ error: "Esse horário acabou de ser ocupado. Escolha outro, por favor." });
      }
      throw e;
    }

    const appointment = await prisma.appointment.findUnique({ where: { id: booked.appointmentId } });
    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addToWaitlist = async (req, res) => {
  const { tenantId, name, phone, email, notes } = req.body;
  try {
    const { lead } = await resolveContact(tenantId, { name, phone, email, source: "WAITLIST" });

    const waitlistEntry = await prisma.waitlist.create({
      data: {
        tenantId,
        leadId: lead.id,
        notes: notes || "Interesse em encaixe automático",
        status: "PENDING"
      }
    });

    res.json({ success: true, waitlistEntry });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
