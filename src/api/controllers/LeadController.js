import prisma from "../config/prisma.js";
import AutomationEngine from "../../../automation_engine.js";
import fs from "fs";
import path from "path";
import VoiceService from "../services/VoiceService.js";
import MessagingService from "../services/MessagingService.js";
import { stopwatch } from "../utils/timing.js";
import { touchConversation } from "../services/ConversationService.js";
import { buildIdentity, findOrCreateLead } from "../services/ContactIdentity.js";

// Palavras que sinalizam pedido de descadastro (LGPD opt-out).
const STOP_KEYWORDS = ["parar", "sair", "cancelar", "descadastrar", "stop", "remover", "pare"];

function isStopKeyword(text) {
  if (!text) return false;
  const normalized = text.trim().toLowerCase().replace(/[.!?]/g, "");
  // Casa quando a mensagem é exatamente a keyword (evita falso positivo em frases).
  return STOP_KEYWORDS.includes(normalized);
}

export const getLeads = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.json([]);
    const leads = await prisma.lead.findMany({
      where: { tenantId },
      include: { conversations: { include: { messages: true } } }
    });
    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportContacts = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const leads = await prisma.lead.findMany({ where: { tenantId } });
    const csvContent = [
      "Nome,Email,Telefone,Status,Origem",
      ...leads.map(l => `"${l.name || ""}","${l.email || ""}","${l.phone || ""}","${l.status}","${l.source}"`)
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=contatos.csv");
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const importBulk = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { contacts } = req.body;
  
  try {
    const firstStage = await prisma.pipelineStage.findFirst({
      where: { tenantId },
      orderBy: { order: 'asc' }
    });

    const createdLeads = [];
    for (const c of contacts) {
      if (!c.phone && !c.email) continue;
      const lead = await prisma.lead.upsert({
        where: { 
          phone_tenantId: { phone: c.phone, tenantId } 
        },
        update: {
          name: c.name || undefined,
          email: c.email || undefined,
        },
        create: {
          name: c.name || "Contato Importado",
          phone: c.phone || null,
          email: c.email || null,
          source: "BULK_IMPORT",
          tenantId,
          stageId: firstStage?.id
        }
      });
      createdLeads.push(lead.id);
    }
    res.json({ success: true, count: createdLeads.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createLead = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { name, phone, email, notes, status, source, stageId, isToEnrich } = req.body;

    // Buscar primeira etapa se não informada
    let finalStageId = stageId;
    if (!finalStageId) {
      const firstStage = await prisma.pipelineStage.findFirst({
        where: { tenantId },
        orderBy: { order: 'asc' }
      });
      finalStageId = firstStage?.id;
    }

    const data = {
      name: name || "Novo Lead",
      tenantId,
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(notes !== undefined && { notes }),
      ...(status !== undefined && { status }),
      ...(source !== undefined && { source }),
      ...(finalStageId && { stageId: finalStageId }),
      ...(isToEnrich !== undefined && { isToEnrich }),
    };

    const lead = await prisma.lead.upsert({
      where: { 
        phone_tenantId: { phone: phone || "", tenantId } 
      },
      update: data,
      create: data
    });
    
    if (lead.createdAt >= new Date(Date.now() - 2000)) {
      AutomationEngine.dispatchTrigger("NEW_LEAD", { lead, tenantId }).catch(console.error);
    }
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updateLead = async (req, res) => {
  try {
    const oldLead = await prisma.lead.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!oldLead) return res.status(404).json({ error: "Lead não encontrado" });

    const { name, phone, email, notes, status, source, stageId, isToEnrich, qualificationScore, extractedData, lastIntentClassification } = req.body;
    
    // Build update data with only defined scalar fields (tags is a relation — cannot be set as string)
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (email !== undefined) dataToUpdate.email = email;
    if (notes !== undefined) dataToUpdate.notes = notes;
    if (status !== undefined) dataToUpdate.status = status;
    if (source !== undefined) dataToUpdate.source = source;
    if (isToEnrich !== undefined) dataToUpdate.isToEnrich = isToEnrich;
    if (qualificationScore !== undefined) dataToUpdate.qualificationScore = qualificationScore;
    if (extractedData !== undefined) dataToUpdate.extractedData = extractedData;
    if (lastIntentClassification !== undefined) dataToUpdate.lastIntentClassification = lastIntentClassification;
    // stageId: only set if it's a non-empty string
    if (stageId !== undefined && stageId !== null && stageId !== '') dataToUpdate.stageId = stageId;
    else if (stageId === null) dataToUpdate.stageId = null;

    const lead = await prisma.lead.update({ where: { id: req.params.id, tenantId: req.tenantId }, data: dataToUpdate });

    if (oldLead && req.body.stageId && oldLead.stageId !== req.body.stageId) {
      const stage = await prisma.pipelineStage.findFirst({ where: { id: req.body.stageId, tenantId: req.tenantId } });
      const qualifiedNames = ["interessados", "agendados", "convertidos", "qualificado", "appointment", "converted"];
      
      if (stage && qualifiedNames.some(n => stage.name.toLowerCase().includes(n))) {
        await prisma.tenant.update({
          where: { id: lead.tenantId },
          data: { qualifiedLeadsCount: { increment: 1 } }
        });
      }

      // O nome da etapa vai junto: é por ele que o fluxo filtra "só quando
      // entrar em Agendados".
      AutomationEngine.dispatchTrigger("PIPELINE_MOVE", {
        lead, tenantId: lead.tenantId, channel: lead.channel,
        oldStageId: oldLead.stageId, newStageId: req.body.stageId,
        stageName: stage?.name || null,
      }).catch(e => console.error("[Leads] PIPELINE_MOVE trigger error:", e));
    }
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteLead = async (req, res) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const bulkEnrichLeads = async (req, res) => {
  try {
    const { ids } = req.body;
    await prisma.lead.updateMany({
      where: { id: { in: ids }, tenantId: req.tenantId },
      data: { isToEnrich: true }
    });
    res.json({ success: true, message: "🚀 Investigação profunda iniciada para os leads selecionados." });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const bulkDeleteLeads = async (req, res) => {
  try {
    const { ids } = req.body;
    await prisma.lead.deleteMany({ where: { id: { in: ids }, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/**
 * Webhook interno: recebe mensagens do WhatsApp (via Baileys) e processa o fluxo SDR.
 * Salva a mensagem do lead no banco e aciona a IA para gerar resposta.
 * Rota: POST /api/webhook/whatsapp (pública, autenticada por tenantId no body)
 */
export const receiveWhatsappWebhook = async (req, res) => {
  const { tenantId, phone, name, content, source = 'WhatsApp', skipNewLeadTrigger, messageType = 'TEXT', channel = 'WHATSAPP', accountId, mediaMime, mediaCaption, fileName, replyId, replyTitle, igUsername, email } = req.body;

  if (!tenantId || !phone || !content) {
    return res.status(400).json({ success: false, error: "Parâmetros obrigatórios: tenantId, phone, content" });
  }

  const sw = stopwatch("webhook");

  try {
    // Buscar primeira etapa se for um novo lead
    const firstStage = await prisma.pipelineStage.findFirst({
      where: { tenantId },
      orderBy: { order: 'asc' }
    });

    // 1. Resolve o contato pelo identificador DO CANAL, não pelo telefone.
    // `phone` só recebe telefone de verdade: o identificador cru (IGSID do
    // Instagram, id de visitante do site, LID do WhatsApp) vai em externalId.
    // consentAt registra o opt-in na primeira interação inbound (LGPD).
    const identity = buildIdentity(channel || "WHATSAPP", phone, { name, email, igUsername });
    const { lead } = await findOrCreateLead(tenantId, identity, {
      source,
      waAccountId: accountId || null,
      stageId: firstStage?.id || null,
    });

    if (lead.createdAt >= new Date(Date.now() - 5000) && !skipNewLeadTrigger) {
      // Somente dispara se foi criado agora (nos últimos 5 segundos)
      AutomationEngine.dispatchTrigger("NEW_LEAD", { lead, tenantId }).catch(console.error);
    }

    // 2. Upsert da Conversa
    let conversation = await prisma.conversation.findUnique({ where: { leadId: lead.id } });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { leadId: lead.id, tenantId, botActive: true }
      });
    }

    // 2.5 🎙️ Áudio recebido: transcreve (STT) quando o plano tem voz.
    // content, p/ AUDIO, chega como caminho do arquivo (ex.: /uploads/x.ogg).
    let effectiveContent = content; // texto usado pela IA / stop-keyword
    let displayContent = content;   // texto exibido/salvo no histórico
    let audioMediaUrl = null;       // áudio original (p/ tocar no painel)

    if (messageType === "AUDIO") {
      audioMediaUrl = content;
      const planVoice = await prisma.tenant
        .findUnique({ where: { id: tenantId }, select: { plan: { select: { enableVoice: true } } } })
        .then((t) => !!t?.plan?.enableVoice)
        .catch(() => false);

      if (!planVoice) {
        // Plano sem voz: não transcreve; pede texto e encerra (sem custo de IA).
        // A resposta volta no payload — quem chamou (Baileys ou Meta) entrega
        // pelo canal certo. Só usamos o Baileys diretamente quando é ele.
        const aviso = "Ainda não consigo ouvir áudios por aqui 🙏 Pode me enviar sua mensagem por texto?";
        if (source === "WhatsApp") {
          try {
            await MessagingService.sendText(tenantId, phone, aviso);
          } catch (_) {}
        }
        await prisma.message.create({
          data: { conversationId: conversation.id, tenantId, content: "🎙️ (áudio recebido)", mediaUrl: audioMediaUrl, role: "USER", messageType: "AUDIO" },
        }).then(touchConversation).catch(() => {});
        return res.json({
          success: true,
          voice_disabled: true,
          // Canal oficial (Meta) usa este campo para responder ao cliente.
          ai_response: source === "WhatsApp" ? null : aviso,
          response_mode: "TEXT",
        });
      }

      // Transcreve o arquivo local (content = /api/uploads/audio_xxx.ogg).
      try {
        const { localPathFor } = await import("../services/StorageService.js");
        const abs = localPathFor(content) || path.join(process.cwd(), "public", content.replace(/^\/+/, ""));
        if (fs.existsSync(abs)) {
          const buf = fs.readFileSync(abs);
          // Usa o mimetype real quando o canal informou (Meta manda audio/ogg,
          // audio/mpeg, etc.); Baileys entrega ogg.
          const transcript = await VoiceService.transcribeAudio(buf, mediaMime || "audio/ogg");
          sw.lap("stt");
          effectiveContent = transcript || "";
          displayContent = transcript ? `🎙️ ${transcript}` : "🎙️ (áudio sem transcrição)";
        }
      } catch (e) {
        console.error("[Webhook] Falha ao transcrever áudio:", e.message);
      }
    }

    // 2.6 🖼️/📄 Imagem ou documento: o agente "lê" o conteúdo via IA multimodal
    // (Gemini). PDF/imagem vão inline; arquivos de texto são lidos direto.
    if (messageType === "IMAGE" || messageType === "DOCUMENT") {
      audioMediaUrl = content; // guarda a URL do arquivo p/ exibir/baixar no painel
      const label = messageType === "IMAGE" ? "🖼️ imagem" : `📄 ${fileName || "documento"}`;
      try {
        const { localPathFor } = await import("../services/StorageService.js");
        const abs = localPathFor(content) || path.join(process.cwd(), "public", content.replace(/^\/+/, ""));
        const mime = mediaMime || (messageType === "IMAGE" ? "image/jpeg" : "application/octet-stream");
        let extracted = "";
        if (fs.existsSync(abs)) {
          const buf = fs.readFileSync(abs);
          if (mime.startsWith("text/") || /\.(txt|csv|md|json)$/i.test(fileName || "")) {
            extracted = buf.toString("utf8").slice(0, 8000); // limita p/ não estourar contexto
          } else if (mime.startsWith("image/")) {
            extracted = await VoiceService.describeMedia(buf, mime,
              "Descreva de forma objetiva o que há nesta imagem, focando no que é útil para o atendimento (produto, comprovante, documento, print de tela, etc.). Se houver texto, transcreva-o.") || "";
          } else if (mime === "application/pdf" || /\.pdf$/i.test(fileName || "")) {
            extracted = await VoiceService.describeMedia(buf, "application/pdf",
              "Extraia e resuma de forma objetiva o conteúdo relevante deste documento.") || "";
          } else {
            extracted = "";
          }
        }
        const caption = mediaCaption ? `\nLegenda do cliente: ${mediaCaption}` : "";
        effectiveContent = extracted
          ? `O cliente enviou ${label}. Conteúdo:\n${extracted}${caption}`
          : (mediaCaption || `O cliente enviou ${label} (não consegui ler o conteúdo).`);
        displayContent = mediaCaption ? `${label} — ${mediaCaption}` : label;
      } catch (e) {
        console.error("[Webhook] Falha ao ler mídia:", e.message);
        effectiveContent = mediaCaption || `O cliente enviou ${label}.`;
        displayContent = label;
      }
    }

    // 3. Salva a mensagem do LEAD no banco (role: USER)
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId,
        content: displayContent,
        mediaUrl: audioMediaUrl,
        role: "USER",
        messageType: messageType
      }
    });
    await touchConversation(userMessage);

    // 4. Emite evento SSE para atualizar a UI em tempo real
    try {
      const { messageEvents } = await import("./MessageController.js");
      messageEvents.emit("new_message", { tenantId, message: userMessage });
    } catch (_) {}

    // 4.5 🛑 Stop-keyword (LGPD): honra o pedido de descadastro. Marca o lead
    // como optedOut, suprime respostas e futuros envios, e confirma uma vez.
    if (isStopKeyword(effectiveContent)) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { optedOut: true, optOutAt: new Date() }
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { botActive: false }
      }).catch(() => {});
      console.log(`[Webhook] 🛑 Opt-out registrado para ${phone}.`);
      AutomationEngine.dispatchTrigger("OPT_OUT", { lead, tenantId, channel: lead.channel }).catch(() => {});
      // Confirmação curta e única (não passa pela IA).
      try {
        await MessagingService.sendText(tenantId, phone, "Pronto! Você não receberá mais mensagens nossas. Se mudar de ideia, é só escrever.");
      } catch (_) {}
      return res.json({ success: true, opted_out: true, ai_response: null });
    }

    // 4.6 Se o lead já optou por sair, não responder automaticamente.
    if (lead.optedOut) {
      console.log(`[Webhook] Lead ${phone} está em opt-out. Mensagem salva, sem resposta.`);
      return res.json({ success: true, opted_out: true, ai_response: null });
    }

    // 4.7 Conversa encerrada que recebe mensagem volta ao automático: sem
    // isso ela ficaria travada em CLOSED e o cliente falaria sozinho.
    if (conversation.phase === "CLOSED") {
      const { default: AttendanceService } = await import("../services/AttendanceService.js");
      conversation = (await AttendanceService.onInbound(conversation.id)) || conversation;
    }

    // 5. Na fila ou em atendimento humano quem responde é a pessoa, não a IA.
    if (!conversation.botActive || ["QUEUE", "HUMAN"].includes(conversation.phase)) {
      console.log(
        `[Webhook] 🤖 Sem resposta automática para ${phone} (fase ${conversation.phase || "BOT"}). Mensagem salva.`
      );
      return res.json({ success: true, ai_response: null, phase: conversation.phase });
    }

    // 5.5 Contexto que alimenta os gatilhos de conversa. `primeiraMensagem`
    // olha o histórico ANTES desta (por isso <= 1) e `respostaDeCampanha`
    // marca quem está respondendo a um disparo recente.
    const recebidasAntes = await prisma.message.count({
      where: { conversationId: conversation.id, role: "USER" },
    });
    const disparoRecente = await prisma.campaignRecipient
      .findFirst({
        where: {
          leadId: lead.id,
          status: "SENT",
          sentAt: { gte: new Date(Date.now() - 72 * 60 * 60 * 1000) },
        },
        select: { id: true },
      })
      .catch(() => null);

    // 6. Aciona o SDR para gerar resposta via IA (texto transcrito, se áudio)
    const aiData = await AutomationEngine.handleIncomingMessage(lead, effectiveContent || content, tenantId, {
      replyId,
      replyTitle: req.body?.replyTitle || null,
      messageType,
      primeiraMensagem: recebidasAntes <= 1,
      respostaDeCampanha: !!disparoRecente,
    });
    sw.lap("engine");

    // 7. Se houve resposta da IA, salva no banco também
    if (aiData && aiData.text) {
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          tenantId,
          content: aiData.text,
          mediaUrl: aiData.audioUrl,
          role: "ASSISTANT",
          messageType: aiData.audioUrl ? "AUDIO" : "TEXT"
        }
      });
      await touchConversation(assistantMessage);
      try {
        const { messageEvents } = await import("./MessageController.js");
        messageEvents.emit("new_message", { tenantId, message: assistantMessage });
      } catch (_) {}
    }

    sw.lap("db");
    sw.done(messageType);

    res.json({
      success: true,
      ai_response: aiData?.text || null,
      ai_audio_url: aiData?.audioUrl || null,
      response_mode: aiData?.responseMode || "TEXT"
    });

  } catch (error) {
    console.error("[Webhook] Erro ao processar mensagem WhatsApp:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

