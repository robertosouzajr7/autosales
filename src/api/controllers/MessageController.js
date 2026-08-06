import prisma from "../config/prisma.js";
import { touchConversation, markConversationRead, isWindowOpen, windowMinutesLeft } from "../services/ConversationService.js";
import { contactHandle } from "../services/ContactIdentity.js";
import { countVariables } from "./TemplateController.js";
import MessagingService from "../services/MessagingService.js";
import { EventEmitter } from "events";

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

    // Atendente respondeu alguém que estava na fila: isso É começar a
    // atender. Assumir a conversa aqui evita o contato ficar "esperando"
    // enquanto já está sendo respondido.
    if (conversation.phase === "QUEUE" && req.userId) {
      const { default: AttendanceService } = await import("../services/AttendanceService.js");
      conversation = await AttendanceService.assign(conversation.id, req.userId, {
        tenantId,
        avisarCliente: false,
      }).catch(() => conversation);
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
    const { accountId, channel, q, phase, assignedToId, queueId } = req.query;

    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        // Abas do inbox: fila, meus atendimentos, automático, encerradas.
        ...(phase ? { phase: { in: String(phase).split(",") } } : {}),
        ...(assignedToId ? { assignedToId } : {}),
        ...(queueId ? { queueId } : {}),
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
          select: {
            id: true, name: true, phone: true, email: true, channel: true,
            waAccountId: true, optedOut: true, igUsername: true, externalId: true,
          },
        },
        assignedTo: { select: { id: true, name: true } },
        queue: { select: { id: true, name: true, color: true } },
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

    // Fluxos em andamento por contato: é o que explica, no painel, por que a
    // IA está calada numa conversa. Uma consulta para o lote inteiro.
    const execucoes = await prisma.automationExecution.findMany({
      where: {
        leadId: { in: conversations.map((c) => c.leadId) },
        status: { in: ["RUNNING", "WAITING_INPUT", "WAITING_DELAY"] },
      },
      select: { leadId: true, status: true, resumeAt: true, automation: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
    });
    const fluxoPorLead = new Map();
    for (const e of execucoes) {
      if (!fluxoPorLead.has(e.leadId)) {
        fluxoPorLead.set(e.leadId, { name: e.automation?.name || "Fluxo", status: e.status, resumeAt: e.resumeAt });
      }
    }

    // Posição na fila calculada uma vez para todo o lote: ordem de entrada
    // dentro de cada fila. Consultar por conversa seria N consultas.
    const posicoes = new Map();
    const naFila = conversations
      .filter((c) => c.phase === "QUEUE" && c.queuedAt)
      .sort((a, b) => new Date(a.queuedAt) - new Date(b.queuedAt));
    const contadorPorFila = new Map();
    for (const c of naFila) {
      const chave = c.queueId || "_";
      const proxima = (contadorPorFila.get(chave) || 0) + 1;
      contadorPorFila.set(chave, proxima);
      posicoes.set(c.id, proxima);
    }

    res.json(
      conversations.map((c) => {
        const acc = c.lead?.waAccountId ? accountById.get(c.lead.waAccountId) : null;
        return {
          id: c.id,
          leadId: c.leadId,
          name: c.lead?.name || contactHandle(c.lead) || "Sem nome",
          phone: c.lead?.phone || "",
          email: c.lead?.email || "",
          igUsername: c.lead?.igUsername || null,
          // Contato a exibir conforme o canal: telefone, @usuario ou e-mail.
          handle: contactHandle(c.lead),
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
          // Fase do atendimento e quem é o dono dela.
          phase: c.phase || "BOT",
          queue: c.queue || null,
          queuedAt: c.queuedAt,
          queuePosition: posicoes.get(c.id) || null,
          handoffReason: c.handoffReason || null,
          assignedTo: c.assignedTo || null,
          assignedAt: c.assignedAt,
          // Fluxo conduzindo a conversa neste momento (se houver).
          activeFlow: fluxoPorLead.get(c.leadId) || null,
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
 * Contagem do que espera atenção humana, para o badge do menu.
 *
 * Existe como rota própria porque o menu aparece em toda tela: carregar a
 * lista inteira de conversas só para somar um número seria caro em cada
 * navegação. São duas agregações sobre índices, sem trazer linha nenhuma.
 */
export const getPendingCount = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.json({ pending: 0, queue: 0 });

  try {
    // `pending` conta conversas, não mensagens: uma conversa na fila com três
    // mensagens não lidas é um item para o atendente, não três. Somar fila +
    // não lidas contaria a mesma conversa duas vezes, porque quem está na
    // fila quase sempre também tem mensagem por ler.
    const [pendentes, naFila] = await Promise.all([
      prisma.conversation.count({
        where: {
          tenantId,
          phase: { not: "CLOSED" },
          OR: [{ phase: "QUEUE" }, { unreadCount: { gt: 0 } }],
        },
      }),
      prisma.conversation.count({ where: { tenantId, phase: "QUEUE" } }),
    ]);
    res.json({ pending: pendentes, queue: naFila });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Ficha do contato, exibida ao lado da conversa aberta.
 *
 * Fica aqui, e não em /leads/:id, porque quem atende no inbox tem a permissão
 * "conversations" e nem sempre a de "contacts" — e a ficha é parte da tela de
 * atendimento, não do CRM. Os dados que a lista de conversas já devolve não
 * são repetidos à toa: aqui vêm só os que exigem consulta extra (etapa, tags,
 * próximo agendamento, anotações).
 */
export const getConversationContact = async (req, res) => {
  const tenantId = req.tenantId;
  const { leadId } = req.params;

  try {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      select: {
        id: true, name: true, phone: true, email: true, channel: true,
        igUsername: true, externalId: true, source: true, notes: true,
        optedOut: true, createdAt: true, stageId: true,
        stage: { select: { id: true, name: true, color: true } },
        tags: { select: { id: true, name: true, color: true } },
      },
    });
    if (!lead) return res.status(404).json({ error: "Contato não encontrado" });

    // Próximo compromisso a partir de agora; um cancelado não conta.
    const proximo = await prisma.appointment.findFirst({
      where: {
        leadId, tenantId,
        date: { gte: new Date() },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      orderBy: { date: "asc" },
      select: { id: true, title: true, date: true, status: true, meetLink: true },
    });

    const conversa = await prisma.conversation.findFirst({
      where: { leadId, tenantId },
      select: { id: true, createdAt: true, _count: { select: { messages: true } } },
    });

    res.json({
      ...lead,
      handle: contactHandle(lead),
      nextAppointment: proximo || null,
      messageCount: conversa?._count?.messages || 0,
      firstContactAt: conversa?.createdAt || lead.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Grava o que a ficha deixa editar: etapa do funil e anotação interna.
 *
 * A lista de campos é fechada de propósito — o corpo da requisição não vira
 * um `data` livre para o Prisma, senão qualquer campo do Lead (inclusive
 * tenantId) viraria editável por quem só deveria mexer na ficha.
 */
export const updateConversationContact = async (req, res) => {
  const tenantId = req.tenantId;
  const { leadId } = req.params;
  const { stageId, notes } = req.body || {};

  try {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId }, select: { id: true } });
    if (!lead) return res.status(404).json({ error: "Contato não encontrado" });

    const data = {};
    if (stageId !== undefined) {
      if (stageId === null || stageId === "") {
        data.stageId = null;
      } else {
        // A etapa precisa ser do próprio tenant: aceitar o id cru deixaria
        // mover um contato para o funil de outra conta.
        const etapa = await prisma.pipelineStage.findFirst({
          where: { id: stageId, tenantId }, select: { id: true },
        });
        if (!etapa) return res.status(400).json({ error: "Etapa inválida" });
        data.stageId = etapa.id;
      }
    }
    if (notes !== undefined) data.notes = String(notes || "").slice(0, 5000) || null;

    if (Object.keys(data).length === 0) return res.json({ success: true });

    const atualizado = await prisma.lead.update({
      where: { id: leadId },
      data,
      select: {
        id: true, notes: true, stageId: true,
        stage: { select: { id: true, name: true, color: true } },
      },
    });
    res.json(atualizado);
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

    // A Meta exige EXATAMENTE o número de parâmetros que o template declara.
    // Mandar um a mais (ou a menos) derruba o envio com #132000.
    const esperados = countVariables(template.content);
    let vars = [];
    if (esperados > 0) {
      vars = Array.from({ length: esperados }, (_, i) => {
        const informado = variables[i];
        if (informado !== undefined && informado !== null && String(informado).trim()) {
          return String(informado);
        }
        // {{1}} sem valor assume o nome do contato, que é o uso mais comum.
        return i === 0 ? lead.name || "" : "";
      });
      const faltando = vars.findIndex((v) => !v);
      if (faltando >= 0) {
        return res.status(400).json({
          error: `Este template usa ${esperados} variável(is). Informe o valor de {{${faltando + 1}}}.`,
          variableCount: esperados,
        });
      }
    }

    const { MetaManager } = await import("../../../meta.js");
    const result = await MetaManager.sendTemplate(sender.phoneId, sender.accessToken, lead.phone, {
      name: template.name,
      language: template.language,
      variables: vars,
      // Cabeçalho de mídia precisa do arquivo no envio: o handle da aprovação
      // não serve aqui, por isso guardamos a cópia em mediaUrl.
      headerMediaUrl: template.headerType && template.headerType !== "TEXT" ? template.mediaUrl : null,
      headerType: template.headerType || "IMAGE",
    });
    if (!result.ok) return res.status(502).json({ error: result.error || "Falha ao enviar o template." });

    let conversation = await prisma.conversation.findUnique({ where: { leadId } });
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { leadId, tenantId, botActive: false } });
    }

    // Guarda o texto já com as variáveis aplicadas, para o histórico mostrar
    // o que o cliente realmente recebeu.
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
    // Gravação do navegador: convertida para OGG/Opus antes de sair.
    "audio/webm", "audio/webm;codecs=opus", "audio/wav", "audio/x-wav",
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

    const ext = (req.file.originalname?.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Áudio precisa sair em OGG/Opus, senão o WhatsApp mostra como arquivo.
    if (mime.startsWith("audio/")) {
      const { default: VoiceService } = await import("../services/VoiceService.js");
      const { url, opus } = await VoiceService.bufferToOpus(req.file.buffer, ext);
      if (!opus) {
        return res.status(500).json({ error: "Não foi possível converter o áudio para o formato do WhatsApp." });
      }
      return res.json({ url, kind: "AUDIO", name: req.file.originalname || "audio.ogg" });
    }

    const { saveMedia } = await import("../services/StorageService.js");
    const url = await saveMedia(req.file.buffer, ext, mime, req.tenantId, `${req.protocol}://${req.get("host")}`);

    const kind = mime.startsWith("image/") ? "IMAGE"
      : mime.startsWith("video/") ? "VIDEO" : "DOCUMENT";

    res.json({ url, kind, name: req.file.originalname });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
