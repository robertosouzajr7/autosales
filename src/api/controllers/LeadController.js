import prisma from "../config/prisma.js";
import AutomationEngine from "../../../automation_engine.js";

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
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
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
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  const { contacts } = req.body;
  
  try {
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
          tenantId
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
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    // Destructure only known scalar fields to avoid Prisma relation errors (tags is a relation, not a string)
    const { name, phone, email, notes, status, source, stageId, isToEnrich } = req.body;
    const data = {
      name,
      tenantId,
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(notes !== undefined && { notes }),
      ...(status !== undefined && { status }),
      ...(source !== undefined && { source }),
      ...(stageId !== undefined && stageId !== null && stageId !== '' && { stageId }),
      ...(isToEnrich !== undefined && { isToEnrich }),
    };
    const lead = await prisma.lead.upsert({
      where: { 
        phone_tenantId: { phone, tenantId } 
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
    const oldLead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    
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

    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: dataToUpdate });

    if (oldLead && req.body.stageId && oldLead.stageId !== req.body.stageId) {
      const stage = await prisma.pipelineStage.findUnique({ where: { id: req.body.stageId } });
      const qualifiedNames = ["interessados", "agendados", "convertidos", "qualificado", "appointment", "converted"];
      
      if (stage && qualifiedNames.some(n => stage.name.toLowerCase().includes(n))) {
        await prisma.tenant.update({
          where: { id: lead.tenantId },
          data: { qualifiedLeadsCount: { increment: 1 } }
        });
      }

      AutomationEngine.dispatchTrigger("PIPELINE_MOVE", {
        lead, tenantId: lead.tenantId,
        oldStageId: oldLead.stageId, newStageId: req.body.stageId
      }).catch(e => console.error("[Leads] PIPELINE_MOVE trigger error:", e));
    }
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteLead = async (req, res) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const bulkDeleteLeads = async (req, res) => {
  try {
    const { ids } = req.body;
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/**
 * Webhook interno: recebe mensagens do WhatsApp (via Baileys) e processa o fluxo SDR.
 * Salva a mensagem do lead no banco e aciona a IA para gerar resposta.
 * Rota: POST /api/webhook/whatsapp (pública, autenticada por tenantId no body)
 */
export const receiveWhatsappWebhook = async (req, res) => {
  const { tenantId, phone, name, content, source = 'WhatsApp', skipNewLeadTrigger, messageType = 'TEXT' } = req.body;

  if (!tenantId || !phone || !content) {
    return res.status(400).json({ success: false, error: "Parâmetros obrigatórios: tenantId, phone, content" });
  }

  try {
    // 1. Upsert do Lead (Garante que não existam duplicados por telefone + tenantId)
    const lead = await prisma.lead.upsert({
      where: { 
        phone_tenantId: { phone, tenantId } 
      },
      update: { 
        name: name || undefined, 
        source: source || undefined 
      },
      create: { 
        name: name || phone, 
        phone, 
        tenantId, 
        source, 
        status: "NEW" 
      }
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

    // 3. Salva a mensagem do LEAD no banco (role: USER)
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId,
        content,
        role: "USER",
        messageType: messageType
      }
    });

    // 4. Emite evento SSE para atualizar a UI em tempo real
    try {
      const { messageEvents } = await import("./MessageController.js");
      messageEvents.emit("new_message", { tenantId, message: userMessage });
    } catch (_) {}

    // 5. Verifica se o bot está ativo para esta conversa
    if (!conversation.botActive) {
      console.log(`[Webhook] 🤖 Bot desativado para ${phone}. Mensagem salva mas sem resposta automática.`);
      return res.json({ success: true, ai_response: null });
    }

    // 6. Aciona o SDR para gerar resposta via IA
    const aiResponse = await AutomationEngine.handleIncomingMessage(lead, content, tenantId);

    // 7. Se houve resposta da IA, salva no banco também
    if (aiResponse) {
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          tenantId,
          content: aiResponse,
          role: "ASSISTANT",
          messageType: "TEXT"
        }
      });
      try {
        const { messageEvents } = await import("./MessageController.js");
        messageEvents.emit("new_message", { tenantId, message: assistantMessage });
      } catch (_) {}
    }

    res.json({ success: true, ai_response: aiResponse || null });

  } catch (error) {
    console.error("[Webhook] Erro ao processar mensagem WhatsApp:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

