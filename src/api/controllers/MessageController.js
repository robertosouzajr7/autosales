import prisma from "../config/prisma.js";
import { WhatsAppManager } from "../../../whatsapp.js";
import { EventEmitter } from "events";

export const messageEvents = new EventEmitter();

export const getMessages = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  const { leadId } = req.params;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { leadId }
    });

    if (!conversation) return res.json([]);

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id, tenantId },
      orderBy: { createdAt: "asc" }
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  const { leadId, content } = req.body;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId, tenantId }
    });

    if (!lead || !lead.phone) {
      return res.status(400).json({ error: "Lead inválido ou sem telefone" });
    }

    // Try sending via WhatsApp Manager
    const success = await WhatsAppManager.sendMessage(tenantId, lead.phone, content);
    
    if (!success) {
      return res.status(500).json({ error: "Falha ao enviar mensagem pelo WhatsApp" });
    }

    let conversation = await prisma.conversation.findUnique({
      where: { leadId }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { leadId, tenantId, botActive: false }
      });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId,
        content,
        role: "ASSISTANT",
        messageType: "TEXT"
      }
    });

    // Notify connected clients
    messageEvents.emit("new_message", { tenantId, message });

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const toggleBot = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  const { leadId } = req.params;
  const { botActive } = req.body;

  try {
    const conversation = await prisma.conversation.upsert({
      where: { leadId },
      update: { botActive },
      create: { leadId, tenantId, botActive }
    });

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const sseEvents = (req, res) => {
  const tenantId = req.query.tenantId || req.tenantId || req.headers["x-tenant-id"];
  
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  const onMessage = (data) => {
    if (data.tenantId === tenantId) {
      res.write(`data: ${JSON.stringify(data.message)}\n\n`);
    }
  };

  messageEvents.on("new_message", onMessage);

  req.on("close", () => {
    messageEvents.off("new_message", onMessage);
  });
};

export const callIntent = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  const { leadId, customMessage } = req.body;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId, tenantId }
    });

    if (!lead || !lead.phone) {
      return res.status(400).json({ error: "Lead inválido ou sem telefone" });
    }

    const notificationText = customMessage ||
      `Olá, ${lead.name?.split(" ")[0] || "tudo bem"}! 👋\n\nPosso te chamar agora por aqui para uma conversa rápida? Tenho algumas novidades que podem te interessar! 📞\n\nResponda com "SIM" se estiver disponível ou me diga o melhor horário. 😊`;

    // Send via WhatsApp through the existing WhatsApp Manager
    const { WhatsAppManager } = await import("../../../whatsapp.js");
    const sent = await WhatsAppManager.sendMessage(tenantId, lead.phone, notificationText);

    if (!sent) {
      return res.status(500).json({ error: "Falha ao enviar mensagem. Verifique a conexão WhatsApp." });
    }

    // Save to conversation history
    let conversation = await prisma.conversation.findUnique({ where: { leadId } });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { leadId, tenantId, botActive: false }
      });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId,
        content: notificationText,
        role: "ASSISTANT",
        messageType: "TEXT"
      }
    });

    // Notify SSE clients
    messageEvents.emit("new_message", { tenantId, message });

    res.json({ 
      success: true, 
      message,
      waLink: `https://wa.me/${lead.phone.replace(/\D/g, "")}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
