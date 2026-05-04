import prisma from "../config/prisma.js";

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
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { name: true, logoUrl: true }
    });
    
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    
    res.json({ tenant });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const submitChat = async (req, res) => {
  const { tenantId, message, visitorId, name, email, phone } = req.body;
  try {
    // 1. Find or create lead
    let lead;
    if (email) lead = await prisma.lead.findFirst({ where: { email, tenantId } });
    if (!lead && phone) lead = await prisma.lead.findFirst({ where: { phone, tenantId } });
    
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          tenantId,
          name: name || "Visitante Web",
          email,
          phone,
          source: "WEBCHAT",
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
        data: { leadId: lead.id, tenantId, botActive: true }
      });
    }

    // 3. Save message
    const newMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId,
        content: message,
        role: "USER"
      }
    });

    res.json({ success: true, message: newMessage, leadId: lead.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const bookAppointment = async (req, res) => {
  const { tenantId, name, email, phone, date, title } = req.body;
  try {
    let lead = await prisma.lead.findFirst({ where: { email, tenantId } });
    if (!lead) {
      lead = await prisma.lead.create({
        data: { tenantId, name, email, phone, source: "PUBLIC_BOOKING" }
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

    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
