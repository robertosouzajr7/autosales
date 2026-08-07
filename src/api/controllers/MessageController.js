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

    if (!lead) return res.status(400).json({ error: "Contato não encontrado." });

    // Fora da janela de 24h o WhatsApp recusa texto livre — só template
    // aprovado inicia conversa. Barramos aqui para o atendente receber uma
    // orientação clara em vez de um erro genérico da Meta.
    const conv = await prisma.conversation.findUnique({
      where: { leadId },
      select: { lastInboundAt: true },
    });
    // A janela de 24h é regra da Meta. O chat do site é canal próprio: não
    // existe janela para fechar nem template para reabrir.
    const canalDoContato = String(lead.channel || "WHATSAPP").toUpperCase();
    if (canalDoContato !== "SITE" && conv && !isWindowOpen(conv.lastInboundAt)) {
      // A saída da janela é diferente em cada canal: no WhatsApp existe o
      // template aprovado, no Instagram não existe nada — só esperar.
      return res.status(409).json({
        error: canalDoContato === "INSTAGRAM"
          ? "Passaram-se mais de 24h desde a última mensagem do contato. O Instagram só permite responder de novo quando ele escrever."
          : "A janela de 24h fechou. Use um template aprovado para reabrir a conversa.",
        windowClosed: true,
      });
    }

    // O canal do contato decide o transporte: WhatsApp usa telefone, Instagram
    // usa o IGSID. Quem sabe disso é o MessagingService.
    const MEDIA = { AUDIO: 'audio', IMAGE: 'image', VIDEO: 'video', DOCUMENT: 'document' };
    const envio = MEDIA[messageType]
      // Áudio herda o comportamento antigo (URL vinha em content); os demais
      // trazem o arquivo em mediaUrl e o texto vira legenda.
      ? await MessagingService.sendToLead(lead, content, {
          mediaUrl: mediaUrl || content,
          mediaType: MEDIA[messageType],
          caption: mediaUrl ? content : '',
        })
      : await MessagingService.sendToLead(lead, content);

    if (!envio.ok) {
      return res.status(502).json({ error: envio.erro || "Falha ao enviar a mensagem." });
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
    Connection: "keep-alive",
    // Sem isto o nginx segura o fluxo em buffer e o "tempo real" chega em lotes.
    "X-Accel-Buffering": "no",
  });
  res.write(": conectado\n\n");

  const onMessage = (data) => {
    if (data.tenantId === tenantId) {
      res.write(`data: ${JSON.stringify(data.message)}\n\n`);
    }
  };

  messageEvents.on("new_message", onMessage);

  // Um fluxo sem tráfego é um fluxo ocioso, e proxy derruba conexão ociosa
  // em torno de 60s. Quando isso acontecia, o EventSource reconectava a cada
  // três segundos, para sempre — era o que enchia o balde do rate limit e
  // fazia a próxima ação do usuário levar 429.
  const batida = setInterval(() => res.write(": ping\n\n"), 25000);

  req.on("close", () => {
    clearInterval(batida);
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
        // O vocabulário do banco é NOSHOW (ReminderService), sem underscore.
        status: { notIn: ["CANCELLED", "NOSHOW"] },
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
  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    const mime = req.file.mimetype;
    // A lista de mimetypes sozinha recusava arquivo bom: o navegador manda
    // `application/octet-stream` sempre que o sistema não reconhece a
    // extensão, e aí um .ogg ou um .webp legítimo era barrado. O tipo agora
    // sai do mimetype OU da extensão — o formato em si já foi conferido pelo
    // middleware que recebeu o arquivo.
    const { tipoDoArquivo } = await import("../middlewares/upload.js");
    const tipo = tipoDoArquivo(req.file.originalname, mime);
    if (!tipo) {
      return res.status(415).json({
        error: `Não reconheci o formato de "${req.file.originalname}". Envie imagem, vídeo, áudio ou documento.`,
      });
    }

    const ext = (req.file.originalname?.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Áudio precisa sair em OGG/Opus, senão o WhatsApp mostra como arquivo.
    if (tipo === "audio") {
      const { default: VoiceService } = await import("../services/VoiceService.js");
      const { url, opus } = await VoiceService.bufferToOpus(req.file.buffer, ext);
      if (!opus) {
        return res.status(500).json({ error: "Não foi possível converter o áudio para o formato do WhatsApp." });
      }
      return res.json({ url, kind: "AUDIO", name: req.file.originalname || "audio.ogg" });
    }

    const { saveMedia } = await import("../services/StorageService.js");
    const url = await saveMedia(req.file.buffer, ext, mime, req.tenantId, `${req.protocol}://${req.get("host")}`);

    const kind = tipo === "image" ? "IMAGE" : tipo === "video" ? "VIDEO" : "DOCUMENT";

    res.json({ url, kind, name: req.file.originalname });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Abre conversa com um contato do CRM.
 *
 * Até aqui a conversa só nascia quando o cliente escrevia primeiro: um
 * contato cadastrado e nunca contatado não tinha por onde ser abordado no
 * painel. Isto cria a conversa e — mais importante — devolve, ANTES de
 * qualquer tentativa, o que dá e o que não dá para fazer neste contato:
 * se o número tem WhatsApp, se a janela de 24 h está aberta e se o caminho
 * é texto livre ou template aprovado.
 *
 * Quem abre a conversa assume o atendimento. É uma pessoa começando a falar
 * com outra; deixar a IA no comando de uma conversa que o atendente iniciou
 * faria as duas vozes se atropelarem na primeira resposta do cliente.
 */
export const startConversation = async (req, res) => {
  const tenantId = req.tenantId;
  const { leadId } = req.body || {};

  try {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) return res.status(404).json({ error: "Contato não encontrado." });
    if (lead.optedOut) {
      return res.status(403).json({ error: "Este contato pediu para não receber mensagens." });
    }

    const canal = String(lead.channel || "WHATSAPP").toUpperCase();
    const jaTem = await prisma.conversation.findUnique({ where: { leadId: lead.id } });

    const conversa = jaTem
      ? await prisma.conversation.update({
          where: { id: jaTem.id },
          // Conversa encerrada volta ao ar; a que já estava com outro
          // atendente não muda de dono só porque alguém abriu a ficha.
          data:
            jaTem.phase === "CLOSED" || jaTem.phase === "BOT"
              ? { phase: "HUMAN", assignedToId: req.userId, assignedAt: new Date(), botActive: false, closedAt: null }
              : {},
          include: { assignedTo: { select: { id: true, name: true } } },
        })
      : await prisma.conversation.create({
          data: {
            leadId: lead.id,
            tenantId,
            phase: "HUMAN",
            assignedToId: req.userId,
            assignedAt: new Date(),
            botActive: false,
          },
          include: { assignedTo: { select: { id: true, name: true } } },
        });

    const janelaAberta = canal === "SITE" || isWindowOpen(conversa.lastInboundAt);
    const transporte = await MessagingService.transportOf(tenantId, lead.waAccountId);

    // Número nunca verificado: verifica agora, já que o atendente está
    // prestes a tentar falar com ele.
    let whatsapp = lead.whatsappStatus || null;
    if (canal === "WHATSAPP" && !whatsapp) {
      const { default: ChannelDetection } = await import("../services/ChannelDetection.js");
      whatsapp = await ChannelDetection.detectar(lead.id).catch(() => null);
    }

    // Template só existe no WhatsApp oficial. Na conexão por QR Code não há
    // janela de 24 h para respeitar, e no Instagram não existe template.
    const oficial = transporte === "cloud";
    const precisaTemplate = canal === "WHATSAPP" && oficial && !janelaAberta;

    let templates = [];
    if (precisaTemplate) {
      templates = await prisma.messageTemplate.findMany({
        where: { tenantId, status: "APPROVED" },
        select: { id: true, name: true, content: true, language: true, headerType: true },
        orderBy: { name: "asc" },
      });
    }

    res.json({
      conversationId: conversa.id,
      leadId: lead.id,
      channel: canal,
      transporte,
      whatsapp,
      janelaAberta,
      minutosRestantes: windowMinutesLeft(conversa.lastInboundAt),
      precisaTemplate,
      templates,
      assignedTo: conversa.assignedTo || null,
      aviso: avisoDeAbertura({ canal, whatsapp, precisaTemplate, oficial, templates }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** A frase que explica ao atendente o que ele tem pela frente. */
function avisoDeAbertura({ canal, whatsapp, precisaTemplate, oficial, templates }) {
  if (canal === "WHATSAPP" && whatsapp === "NAO") {
    return "Este número não tem WhatsApp. A mensagem não vai chegar por aqui.";
  }
  if (precisaTemplate && !templates.length) {
    return "Fora da janela de 24 h só é possível iniciar com template aprovado, e nenhum está aprovado ainda. Aprove um em Modelos de mensagem.";
  }
  if (precisaTemplate) {
    return "Passaram-se mais de 24 h desde a última mensagem do cliente. Na conexão oficial, só um template aprovado reabre a conversa.";
  }
  if (canal === "WHATSAPP" && whatsapp === "DESCONHECIDO" && oficial) {
    return "Não dá para confirmar se o número tem WhatsApp: a API oficial não oferece essa consulta. Se a mensagem não chegar, é isso.";
  }
  return null;
}

/**
 * A resposta que a IA sugere para o atendente revisar.
 *
 * Nada é enviado aqui. O que volta é texto para o atendente ler, editar e
 * decidir — sugestão que envia sozinha não é sugestão.
 */
export const suggestReply = async (req, res) => {
  try {
    const { default: SuggestionService } = await import("../services/SuggestionService.js");
    const r = await SuggestionService.sugerir(req.tenantId, req.params.leadId);
    // Sem sugestão não é erro: o atendente segue escrevendo como antes, e a
    // tela precisa do motivo para explicar em vez de piscar um alerta.
    res.json(r);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Envia um item do catálogo na conversa.
 *
 * A IA já sabia fazer isso (`send_catalog_item`); o atendente não tinha por
 * onde — ele abria o catálogo em outra tela, copiava nome e preço e digitava
 * de novo no chat, com o preço saindo errado de vez em quando.
 *
 * A mídia vai junto quando existe: item de catálogo sem foto é uma frase, e
 * uma frase não vende.
 */
export const sendCatalogItem = async (req, res) => {
  const tenantId = req.tenantId;
  const { leadId } = req.params;
  const { productId } = req.body || {};

  try {
    const [lead, item] = await Promise.all([
      prisma.lead.findFirst({ where: { id: leadId, tenantId } }),
      prisma.product.findFirst({ where: { id: productId, tenantId, isActive: true } }),
    ]);
    if (!lead) return res.status(404).json({ error: "Contato não encontrado." });
    if (!item) return res.status(404).json({ error: "Item não encontrado no catálogo." });
    if (lead.optedOut) {
      return res.status(403).json({ error: "Este contato pediu para não receber mensagens." });
    }

    const preco = item.price != null
      ? item.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "sob consulta";
    const legenda = `*${item.name}* — ${preco}${item.description ? `\n${item.description}` : ""}`;

    const midia = item.imageUrl
      ? { url: item.imageUrl, tipo: "image" }
      : item.videoUrl
        ? { url: item.videoUrl, tipo: "video" }
        : null;

    // O chat do site não tem transporte externo: a entrega é a própria linha
    // no histórico, e a imagem aparece porque `mediaUrl` fica na mensagem.
    // Mandar isso pelo caminho do WhatsApp falharia por não haver conexão.
    const canal = String(lead.channel || "WHATSAPP").toUpperCase();
    const envio = midia && canal !== "SITE"
      ? await MessagingService.sendMedia(tenantId, lead.phone, midia.url, midia.tipo, legenda, {
          accountId: lead.waAccountId,
        }).then((ok) => ({ ok: !!ok, erro: ok ? null : "Não consegui enviar a mídia pelo canal do cliente." }))
      : await MessagingService.sendToLead(lead, legenda, { accountId: lead.waAccountId });

    if (!envio?.ok) {
      return res.status(502).json({ error: envio?.erro || "Não consegui enviar o item pelo canal do cliente." });
    }

    const conversa = await prisma.conversation.upsert({
      where: { leadId: lead.id },
      update: {},
      create: { leadId: lead.id, tenantId },
    });
    const message = await prisma.message.create({
      data: {
        conversationId: conversa.id,
        tenantId,
        role: "ASSISTANT",
        content: legenda,
        messageType: midia ? (midia.tipo === "video" ? "VIDEO" : "IMAGE") : "TEXT",
        mediaUrl: midia?.url || null,
      },
    });
    await touchConversation(message);
    messageEvents.emit("new_message", { tenantId, message });

    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
