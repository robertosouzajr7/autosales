import prisma from "../config/prisma.js";
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
    const planos = await prisma.plan.findMany({
      where: { active: true, priceMonthly: { gt: 0 } },
      orderBy: { priceMonthly: "asc" },
    });
    const modo = (p) => String(p.whatsappMode || "BOTH").toUpperCase();
    const oficial = planos.find((p) => ["OFFICIAL", "BOTH"].includes(modo(p))) || null;
    const qrcode = planos.find((p) => ["BAILEYS", "BOTH"].includes(modo(p))) || null;
    res.json({ oficial, qrcode, total: planos.length });
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
    const planos = await prisma.plan.findMany({
      where: { active: true, priceMonthly: { gt: 0 } },
      orderBy: { priceMonthly: "asc" },
    });
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
    }

    if (!lead) {
      // O visitorId identifica a sessão do site — não é telefone. O telefone só
      // entra se o visitante realmente informou um, e é validado antes.
      const identity = buildIdentity("SITE", visitorId, { name, email });
      const { normalizePhone } = await import("../services/ContactIdentity.js");
      identity.phone = normalizePhone(phone);
      const r = await findOrCreateLead(resolvedTenantId, identity, { source: "WEBCHAT" });
      lead = r.lead;
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
    }

    res.json({ 
      success: true, 
      message: newMessage, 
      leadId: lead.id,
      response: aiResponse || "Desculpe, não consegui processar a resposta agora." 
    });
  } catch (error) {
    console.error("[PublicWebchat] Erro ao enviar mensagem:", error);
    res.status(500).json({ error: error.message });
  }
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
