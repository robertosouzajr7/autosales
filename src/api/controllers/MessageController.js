import prisma from "../config/prisma.js";
import { touchConversation, markConversationRead, isWindowOpen, windowMinutesLeft } from "../services/ConversationService.js";
import MessagingService from "../services/MessagingService.js";
import { EventEmitter } from "events";
import { messagesHeadroom } from "../middlewares/planLimits.js";

export const messageEvents = new EventEmitter();

export const getMessages = async (req, res) => {
  const tenantId = req.tenantId;
  const { leadId } = req.params;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { leadId, tenantId }
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
  const tenantId = req.tenantId;
  const { leadId, content, role = "ASSISTANT", messageType = "TEXT", mediaUrl } = req.body;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId, tenantId }
    });

    if (!lead || !lead.phone) {
      return res.status(400).json({ error: "Lead inválido ou sem telefone" });
    }

    // Gate: cota mensal de mensagens do plano.
    const headroom = await messagesHeadroom(tenantId);
    if (!headroom.ok) {
      return res.status(403).json({
        error: `Cota mensal de mensagens atingida (${headroom.used}/${headroom.max}). Faça upgrade do plano para continuar.`,
      });
    }

    // Fora da janela de 24h o WhatsApp recusa texto livre — só template
    // aprovado inicia conversa. Barramos aqui para o atendente receber uma
    // orientação clara em vez de um erro genérico da Meta.
    const conv = await prisma.conversation.findUnique({
      where: { leadId },
      select: { lastInboundAt: true },
    });
    if (conv && !isWindowOpen(conv.lastInboundAt)) {
      return res.status(409).json({
        error: "A janela de 24h fechou. Use um template aprovado para reabrir a conversa.",
        windowClosed: true,
      });
    }

    // Try sending via WhatsApp Manager
    let success = false;
    const MEDIA = { AUDIO: 'audio', IMAGE: 'image', VIDEO: 'video', DOCUMENT: 'document' };
    if (MEDIA[messageType]) {
      // Áudio herda o comportamento antigo (URL vinha em content); os demais
      // trazem o arquivo em mediaUrl e o texto vira legenda.
      const url = mediaUrl || content;
      success = await MessagingService.sendMedia(
        tenantId, lead.phone, url, MEDIA[messageType], mediaUrl ? content : ''
      );
    } else {
      success = await MessagingService.sendText(tenantId, lead.phone, content);
    }
    
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
        role,
        messageType,
        mediaUrl: mediaUrl || (messageType === "AUDIO" ? content : null)
      }
    });
    await touchConversation(message);

    // Notify connected clients
    messageEvents.emit("new_message", { tenantId, message });

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const toggleBot = async (req, res) => {
  const tenantId = req.tenantId;
  const { leadId } = req.params;
  const { botActive } = req.body;

  try {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

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
  const tenantId = req.tenantId;
  
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
  const tenantId = req.tenantId;
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
    const sent = await MessagingService.sendText(tenantId, lead.phone, notificationText);

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
    await touchConversation(message);

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

/**
 * Lista as conversas do inbox, mais recente primeiro — como no WhatsApp Web.
 * Traz prévia, não-lidas, canal/conexão e o estado da janela de 24h, para a
 * UI saber se pode digitar livremente ou se precisa de template.
 */
export const getConversations = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.json([]);

  try {
    const { accountId, channel, q } = req.query;

    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        ...(accountId || channel || q
          ? {
              lead: {
                ...(accountId ? { waAccountId: accountId } : {}),
                ...(channel ? { channel } : {}),
                ...(q
                  ? {
                      OR: [
                        { name: { contains: q, mode: "insensitive" } },
                        { phone: { contains: q } },
                      ],
                    }
                  : {}),
              },
            }
          : {}),
      },
      include: {
        lead: {
          select: { id: true, name: true, phone: true, channel: true, waAccountId: true, optedOut: true },
        },
      },
      // Conversa sem mensagem (lead recém-criado) vai para o fim.
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 200,
    });

    // Resolve o nome da conexão de uma vez só, em vez de por conversa.
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { tenantId },
      select: { id: true, name: true, channel: true, phone: true },
    });
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    res.json(
      conversations.map((c) => {
        const acc = c.lead?.waAccountId ? accountById.get(c.lead.waAccountId) : null;
        return {
          id: c.id,
          leadId: c.leadId,
          name: c.lead?.name || c.lead?.phone || "Sem nome",
          phone: c.lead?.phone || "",
          channel: c.lead?.channel || "WHATSAPP",
          optedOut: !!c.lead?.optedOut,
          botActive: c.botActive,
          unreadCount: c.unreadCount || 0,
          lastMessageAt: c.lastMessageAt,
          lastMessagePreview: c.lastMessagePreview || "",
          accountId: c.lead?.waAccountId || null,
          accountName: acc?.name || null,
          windowOpen: isWindowOpen(c.lastInboundAt),
          windowMinutesLeft: windowMinutesLeft(c.lastInboundAt),
        };
      })
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Zera as não-lidas quando o atendente abre a conversa. */
export const markRead = async (req, res) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { leadId: req.params.leadId, tenantId: req.tenantId },
      select: { id: true },
    });
    if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });
    await markConversationRead(conversation.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Envia um template aprovado para o lead. É o único caminho para reabrir a
 * conversa depois que a janela de 24h fechou.
 */
export const sendTemplateToLead = async (req, res) => {
  const tenantId = req.tenantId;
  const { leadId, templateId, variables = [] } = req.body;

  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId, tenantId } });
    if (!lead?.phone) return res.status(400).json({ error: "Lead inválido ou sem telefone." });
    if (lead.optedOut) return res.status(403).json({ error: "Este contato pediu para não receber mensagens." });

    const template = await prisma.messageTemplate.findFirst({ where: { id: templateId, tenantId } });
    if (!template) return res.status(404).json({ error: "Template não encontrado." });
    if (template.status !== "APPROVED") {
      return res.status(400).json({ error: "Só é possível enviar template aprovado pela Meta." });
    }

    // Template exige a conexão oficial: o Baileys não tem esse conceito.
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { tenantId, channel: { not: "INSTAGRAM" } },
      orderBy: { createdAt: "asc" },
    });
    const sender =
      accounts.find((a) => a.id === lead.waAccountId && a.phoneId && a.accessToken) ||
      accounts.find((a) => a.phoneId && a.accessToken);
    if (!sender) return res.status(400).json({ error: "Nenhuma conexão oficial disponível para enviar template." });

    const { MetaManager } = await import("../../../meta.js");
    const result = await MetaManager.sendTemplate(sender.phoneId, sender.accessToken, lead.phone, {
      name: template.name,
      language: template.language,
      variables: variables.length ? variables : [lead.name],
    });
    if (!result.ok) return res.status(502).json({ error: result.error || "Falha ao enviar o template." });

    let conversation = await prisma.conversation.findUnique({ where: { leadId } });
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { leadId, tenantId, botActive: false } });
    }

    // Guarda o texto já com as variáveis aplicadas, para o histórico mostrar
    // o que o cliente realmente recebeu.
    const vars = variables.length ? variables : [lead.name];
    const rendered = String(template.content || "").replace(/\{\{(\d+)\}\}/g, (_, n) => vars[Number(n) - 1] ?? "");

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId,
        content: rendered,
        role: "ASSISTANT",
        messageType: "TEXT",
      },
    });
    await touchConversation(message);
    messageEvents.emit("new_message", { tenantId, message });

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Upload de anexo do chat. Separado do upload do catálogo porque aqui o
 * atendente também manda documento (PDF, planilha, contrato), que lá não faz
 * sentido e por isso não é aceito.
 */
export const uploadAttachment = async (req, res) => {
  const MAX_BYTES = 25 * 1024 * 1024; // limite prático do WhatsApp
  const PERMITIDOS = [
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/3gpp",
    "audio/ogg", "audio/mpeg", "audio/mp4", "audio/aac",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv",
  ];

  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    if (req.file.size > MAX_BYTES) return res.status(400).json({ error: "Arquivo maior que 25 MB." });

    const mime = req.file.mimetype;
    if (!PERMITIDOS.includes(mime)) {
      return res.status(400).json({ error: `Formato não suportado pelo WhatsApp: ${mime}` });
    }

    const { saveMedia } = await import("../services/StorageService.js");
    const ext = (req.file.originalname.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const url = await saveMedia(req.file.buffer, ext, mime, req.tenantId, `${req.protocol}://${req.get("host")}`);

    const kind = mime.startsWith("image/") ? "IMAGE"
      : mime.startsWith("video/") ? "VIDEO"
      : mime.startsWith("audio/") ? "AUDIO" : "DOCUMENT";

    res.json({ url, kind, name: req.file.originalname });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
