import prisma from "../config/prisma.js";
import { touchConversation } from "../services/ConversationService.js";
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
    
    if (!lead && email) lead = await prisma.lead.findFirst({ where: { email, tenantId: resolvedTenantId } });
    if (!lead && phone) lead = await prisma.lead.findFirst({ where: { phone, tenantId: resolvedTenantId } });
    
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          tenantId: resolvedTenantId,
          name: name || "Visitante Web",
          email,
          phone,
          source: "WEBCHAT",
          channel: "SITE",
          status: "NEW"
        }
      });
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


export const bookAppointment = async (req, res) => {
  const { tenantId, name, email, phone, date, title } = req.body;
  try {
    let lead;
    if (email) lead = await prisma.lead.findFirst({ where: { email, tenantId } });
    if (!lead && phone) lead = await prisma.lead.findFirst({ where: { phone, tenantId } });
    
    if (!lead) {
      lead = await prisma.lead.create({
        data: { tenantId, name, email, phone, source: "PUBLIC_BOOKING", status: "SCHEDULED" }
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        leadId: lead.id,
        title: title || "Reunião de Alinhamento",
        date: new Date(date),
        status: "SCHEDULED"
      }
    });

    // Buscar a etapa "Agendado" ou similar para mover o lead
    let stage = await prisma.pipelineStage.findFirst({
      where: { tenantId, name: { contains: "Agendado" } }
    });

    // Se não achar pelo nome, pega a última etapa ou mantém a atual
    const updateData = { status: "SCHEDULED" };
    if (stage) {
      updateData.stageId = stage.id;
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: updateData
    });

    // Enviar confirmação instantânea via SDR (Assíncrono para não travar a resposta do site)
    setImmediate(async () => {
      try {
        const timeStr = new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const dateStr = new Date(date).toLocaleDateString();
        const sdrMsg = `Olá ${name}! Passando para confirmar que seu agendamento para o dia ${dateStr} às ${timeStr} foi recebido com sucesso. Já reservei aqui na minha agenda! ✅`;
        
        await MessagingService.sendText(tenantId, phone, sdrMsg);
        console.log(`[Booking] ✅ Confirmação instantânea enviada para ${name} (${phone})`);
        
        // Marcar como já avisado para a rotina global não repetir
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { notes: (appointment.notes || "") + "\n[CONFIRMED_BY_SDR]" }
        });
      } catch (e) {
        console.warn("[Booking] Falha ao enviar confirmação instantânea:", e.message);
      }
    });

    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addToWaitlist = async (req, res) => {
  const { tenantId, name, phone, email, notes } = req.body;
  try {
    let lead = await prisma.lead.findFirst({ where: { phone, tenantId } });
    if (!lead) {
      lead = await prisma.lead.create({
        data: { tenantId, name, phone, email, source: "WAITLIST" }
      });
    }

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
