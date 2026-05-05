import prisma from "./src/api/config/prisma.js";
import { WhatsAppManager } from "./whatsapp.js";
import { EmailService } from "./email_service.js";
import CalendarService from "./calendar_service.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import TTSService from "./src/api/services/TTSService.js";
import cron from "node-cron";
const MAX_STEPS = 100;
const MAX_CONCURRENT_EXECUTIONS = 10;
const RATE_LIMIT_PER_MINUTE = 20; // max msgs per tenant per minute

class AutomationEngine {
  constructor() {
    // Job Queue
    this.executionQueue = [];
    this.runningCount = 0;

    // Rate Limiter (per tenant)
    this.rateLimiter = new Map(); // tenantId -> { count, resetAt }

    // Schedulers
    this.checkInterval = setInterval(() => this.processPendingDelays(), 30 * 1000);
    this.routineInterval = setInterval(() => this.processGlobalRoutines(), 5 * 60 * 1000);
    this.inactivityInterval = setInterval(() => this.processInactivityTriggers(), 5 * 60 * 1000);
    this.queueInterval = setInterval(() => this.processQueue(), 1000);
    // Varredura de prospecção (novos leads) - a cada 1 min (mais proativo)
    setInterval(() => {
      this.runGlobalProspecting();
    }, 1 * 60 * 1000);
    this.enrichmentInterval = setInterval(() => this.processEnrichmentRoutine(), 15 * 60 * 1000); // 15 min
    console.log(`[AutoEngine] ✅ Engine iniciado (concurrency: ${MAX_CONCURRENT_EXECUTIONS}, rate: ${RATE_LIMIT_PER_MINUTE} msg/min).`);
    this.cronJobs = new Map();
    setTimeout(() => this.bootSchedulers(), 2000); // Startup delay
  }

  setEventEmitter(ee) {
    this.ee = ee;
    this.ee.on("new_lead", async ({ tenantId, lead }) => {
       console.log(`[AutoEngine] 🆕 Novo lead detectado: ${lead.name} (${tenantId}). Buscando automações...`);
       await this.executeEventAutomation("NEW_LEAD", lead);
    });
  }

  async executeEventAutomation(trigger, lead) {
    try {
      const auts = await prisma.automation.findMany({
        where: { tenantId: lead.tenantId, trigger: trigger, active: true }
      });
      for (const aut of auts) {
        console.log(`[AutoEngine] ⚡ Disparando automação '${aut.name}' para o lead ${lead.name}`);
        this.enqueueExecution(aut, lead);
      }
    } catch (err) {
      console.error(`[AutoEngine] Erro ao disparar evento ${trigger}:`, err);
    }
  }

  // ========== CRON SCHEDULERS ==========

  async reloadSchedulers() {
    this.cronJobs.forEach(job => job.stop());
    this.cronJobs.clear();
    await this.bootSchedulers();
  }

  async bootSchedulers() {
    try {
      const scheduledAuts = await prisma.automation.findMany({
        where: { trigger: "SCHEDULE", active: true }
      });

      for (const aut of scheduledAuts) {
        if (!aut.triggerConfig) continue;
        let config;
        try { config = JSON.parse(aut.triggerConfig); } catch(e) { continue; }
        
        if (config.schedule && cron.validate(config.schedule)) {
           const job = cron.schedule(config.schedule, async () => {
              console.log(`[Engine - SCHEDULE] Disparando automação CRON: ${aut.name}`);
              await this.executeScheduledAutomation(aut, config.targetFilter);
           });
           this.cronJobs.set(aut.id, job);
        }
      }
      console.log(`[Engine] 🗓 Schedulers (CRON) carregados no momento: ${this.cronJobs.size}`);
    } catch (e) {
      console.error("[Engine] Erro ao carregar Schedulers", e);
    }
  }

  async executeScheduledAutomation(automation, filter) {
     const tenantId = automation.tenantId;
     
     let whereClause = { tenantId };
     
     // Application of filter dynamically based on DB state
     if (filter?.status === "NEW") {
        whereClause.status = "NEW"; 
        whereClause.conversations = { none: {} }; // A lead is technically brand new effectively if NO conversations started 
     } else if (filter?.status === "INACTIVE_7_DAYS") {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        whereClause.updatedAt = { lt: sevenDaysAgo };
     } // ALL applies the default tenantId filter only

     try {
       const leadsToProcess = await prisma.lead.findMany({ where: whereClause, take: 500 }); // limit 500 max per sweep
       for (const lead of leadsToProcess) {
          this.enqueueExecution(automation, lead);
       }
       console.log(`[Engine - SCHEDULE] Automação '${automation.name}' enfileirou ${leadsToProcess.length} leads.`);
     } catch(e) {
       console.error("[Engine - SCHEDULE] Erro ao buscar leads:", e);
     }
  }

  // ========== JOB QUEUE ==========

  enqueueExecution(automation, lead) {
    return new Promise((resolve, reject) => {
      this.executionQueue.push({ automation, lead, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    while (this.runningCount < MAX_CONCURRENT_EXECUTIONS && this.executionQueue.length > 0) {
      const job = this.executionQueue.shift();
      this.runningCount++;
      this.startExecution(job.automation, job.lead)
        .then(job.resolve)
        .catch(job.reject)
        .finally(() => { this.runningCount--; });
    }
  }

  // ========== RATE LIMITER ==========

  async rateLimitedSend(tenantId, phone, content, mediaUrl = null, mediaType = null) {
    const now = Date.now();
    let bucket = this.rateLimiter.get(tenantId);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + 60000 };
      this.rateLimiter.set(tenantId, bucket);
    }

    if (bucket.count >= RATE_LIMIT_PER_MINUTE) {
      const waitMs = bucket.resetAt - now;
      console.log(`[RateLimit] Tenant ${tenantId}: esperando ${waitMs}ms (${bucket.count}/${RATE_LIMIT_PER_MINUTE} msgs)`);
      await new Promise(r => setTimeout(r, waitMs));
      bucket = { count: 0, resetAt: Date.now() + 60000 };
      this.rateLimiter.set(tenantId, bucket);
    }

    // Check Plan Monthly Message Limit
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } });
    if (tenant?.plan && tenant.usedMessages >= tenant.plan.maxMessages) {
       console.log(`[AutoEngine] 🛑 Limite mensal de mensagens atingido para o tenant ${tenantId}`);
       return { error: "LIMIT_REACHED" };
    }

    bucket.count++;
    
    // Increment Usage
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { usedMessages: { increment: 1 } }
    });

    if (mediaUrl && mediaType) {
      return WhatsAppManager.sendMedia(tenantId, phone, mediaUrl, mediaType, content);
    }
    return WhatsAppManager.sendMessage(tenantId, phone, content);
  }

  // ========== VARIABLE RESOLUTION ==========

  resolveTemplate(template, context) {
    if (!template || typeof template !== "string") return template || "";
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const keys = path.trim().split(".");
      let val = context?.variables;
      for (const k of keys) {
        if (val == null) return match;
        val = val[k];
      }
      return val != null ? String(val) : match;
    });
  }

  async buildContext(lead, tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const conv = await prisma.conversation.findFirst({
      where: { leadId: lead.id },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 5 } }
    });
    const appt = await prisma.appointment.findFirst({
      where: { leadId: lead.id },
      orderBy: { date: "desc" }
    });

    const now = new Date();
    const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    return {
      variables: {
        lead: {
          id: lead.id,
          name: lead.name || "",
          phone: lead.phone || "",
          email: lead.email || "",
          status: lead.status || "NEW",
          source: lead.source || "",
          notes: lead.notes || ""
        },
        tenant: { name: tenant?.name || "", id: tenantId },
        conversation: {
          last_message: conv?.messages?.[0]?.content || "",
          count: conv?.messages?.length || 0
        },
        appointment: {
          date: appt ? appt.date.toLocaleDateString("pt-BR") : "",
          time: appt ? appt.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
          title: appt?.title || "",
          status: appt?.status || ""
        },
        current: {
          date: now.toLocaleDateString("pt-BR"),
          time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          day_of_week: days[now.getDay()]
        },
        input: {},
        ai: { response: "" },
        http: { response: "" },
        custom: {}
      }
    };
  }

  async updateExecutionContext(executionId, path, value) {
    const exec = await prisma.automationExecution.findUnique({ where: { id: executionId } });
    const ctx = JSON.parse(exec?.context || '{"variables":{}}');
    const keys = path.split(".");
    let obj = ctx.variables;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { context: JSON.stringify(ctx) }
    });
    return ctx;
  }

  // ========== DAG NAVIGATION ==========

  getNextNodes(currentNodeId, edges, sourceHandle) {
    if (!edges || !currentNodeId) return [];
    return edges
      .filter(e => e.source === currentNodeId && (!sourceHandle || e.sourceHandle === sourceHandle))
      .map(e => e.target);
  }

  findStartNode(nodes, edges) {
    if (!nodes?.length) return null;
    const targets = new Set((edges || []).map(e => e.target));
    const start = nodes.find(n => !targets.has(n.id));
    return start || nodes[0];
  }

  // ========== CONDITION EVALUATOR ==========

  evaluateCondition(rules, logic, context) {
    if (!rules?.length) return true;

    const results = rules.map(rule => {
      const fieldVal = this.resolveTemplate(rule.field, context);
      const compareVal = this.resolveTemplate(rule.value || "", context);

      switch (rule.operator) {
        case "equals": return fieldVal === compareVal;
        case "not_equals": return fieldVal !== compareVal;
        case "contains": return String(fieldVal).toLowerCase().includes(String(compareVal).toLowerCase());
        case "not_contains": return !String(fieldVal).toLowerCase().includes(String(compareVal).toLowerCase());
        case "starts_with": return String(fieldVal).toLowerCase().startsWith(String(compareVal).toLowerCase());
        case "ends_with": return String(fieldVal).toLowerCase().endsWith(String(compareVal).toLowerCase());
        case "gt": return parseFloat(fieldVal) > parseFloat(compareVal);
        case "lt": return parseFloat(fieldVal) < parseFloat(compareVal);
        case "gte": return parseFloat(fieldVal) >= parseFloat(compareVal);
        case "lte": return parseFloat(fieldVal) <= parseFloat(compareVal);
        case "empty": return !fieldVal || fieldVal === "";
        case "not_empty": return !!fieldVal && fieldVal !== "";
        case "regex":
          try { return new RegExp(compareVal, "i").test(fieldVal); }
          catch { return false; }
        case "in": {
          const list = String(compareVal).split(",").map(s => s.trim().toLowerCase());
          return list.includes(String(fieldVal).toLowerCase());
        }
        default: return fieldVal === compareVal;
      }
    });

    return logic === "OR" ? results.some(Boolean) : results.every(Boolean);
  }

  // ========== NODE PROCESSORS ==========

  async executeNode(node, execution, lead, tenant) {
    const config = node.data?.config || {};
    const ctx = JSON.parse(execution.context || '{"variables":{}}');
    const startTime = Date.now();
    let result = { success: true, output: null, nextHandle: null };

    // 🚦 Segurança: Interromper envio de mensagens se o bot estiver pausado para este lead (Handoff Humano)
    const conv = await prisma.conversation.findUnique({ where: { leadId: lead.id } });
    if (conv && !conv.botActive) {
      const messagingNodes = ["SEND_MSG", "AI_RESPONSE", "COLLECT_INPUT", "AI_TOOLS"];
      if (messagingNodes.includes(node.type)) {
        console.log(`[AutoEngine] 🤖 Bot pausado para o lead ${lead.phone}. Pulando nó de mensagem/IA.`);
        return { success: true, skip: true };
      }
    }

    try {
      switch (node.type) {
        case "SEND_MSG": {
          const msg = this.resolveTemplate(config.message || node.data?.label || "Olá!", ctx);
          await this.rateLimitedSend(lead.tenantId, lead.phone, msg);
          result.output = { message: msg };
          break;
        }

        case "WAIT": {
          const delayMs = this.calculateDelay(config.value || 1, config.unit || "hour");
          await prisma.automationExecution.update({
            where: { id: execution.id },
            data: {
              status: "WAITING_DELAY",
              currentNodeId: node.id,
              resumeAt: new Date(Date.now() + delayMs)
            }
          });
          result.output = { delay: `${config.value} ${config.unit}`, resumeAt: new Date(Date.now() + delayMs) };
          result.pause = true;
          break;
        }

        case "CONDITION": {
          const condResult = this.evaluateCondition(config.rules || [], config.logic || "AND", ctx);
          result.nextHandle = condResult ? "true" : "false";
          result.output = { conditionResult: condResult, rules: config.rules?.length || 0 };
          break;
        }

        case "COLLECT_INPUT": {
          const prompt = this.resolveTemplate(config.prompt || "Por favor, responda:", ctx);
          await this.rateLimitedSend(lead.tenantId, lead.phone, prompt);
          await prisma.automationExecution.update({
            where: { id: execution.id },
            data: {
              status: "WAITING_INPUT",
              currentNodeId: node.id,
              waitingForInput: true,
              inputVariable: config.variable || "resposta"
            }
          });
          result.output = { prompt, variable: config.variable };
          result.pause = true;
          break;
        }

        case "AI_RESPONSE": {
          const aiPrompt = this.resolveTemplate(config.prompt || "", ctx);
          const aiResponse = await this.callAI(aiPrompt, lead, ctx);
          if (!aiResponse) {
             result.output = { skipped: "No active SDR or null AI response" };
             break;
          }
          await this.updateExecutionContext(execution.id, "ai.response", aiResponse);
          if (config.sendToLead !== false) {
             await this.rateLimitedSend(lead.tenantId, lead.phone, aiResponse);
          }
          result.output = { response: aiResponse.substring(0, 200) };
          break;
        }

        case "ADD_TAG": {
          const tagName = this.resolveTemplate(config.tag || "", ctx);
          if (tagName) {
            let tag = await prisma.tag.findFirst({ where: { name: tagName } });
            if (!tag) tag = await prisma.tag.create({ data: { name: tagName } });
            await prisma.lead.update({
              where: { id: lead.id },
              data: { tags: { connect: { id: tag.id } } }
            });
          }
          result.output = { tag: tagName };
          break;
        }

        case "MOVE_STAGE": {
          const stageName = this.resolveTemplate(config.stageName || "", ctx);
          const stageId = config.stageId;
          let stage = null;
          if (stageId) {
            stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
          } else if (stageName) {
            stage = await prisma.pipelineStage.findFirst({
              where: { name: { contains: stageName }, tenantId: lead.tenantId }
            });
          }
          if (stage) {
            await prisma.lead.update({ where: { id: lead.id }, data: { stageId: stage.id } });
          }
          result.output = { stage: stage?.name || stageName };
          break;
        }

        case "TRANSFER_HUMAN": {
          const msg = this.resolveTemplate(
            config.message || "Transferindo para atendimento humano...", ctx
          );
          await prisma.conversation.updateMany({
            where: { leadId: lead.id },
            data: { botActive: false }
          });
          await WhatsAppManager.sendMessage(lead.tenantId, lead.phone, msg);
          result.output = { transferred: true };
          break;
        }

        case "SCHEDULE_APPOINTMENT": {
          const title = this.resolveTemplate(config.title || "Agendamento automático", ctx);
          const dateStr = this.resolveTemplate(config.date || "", ctx);
          if (dateStr) {
            const appt = await prisma.appointment.create({
              data: {
                leadId: lead.id,
                tenantId: lead.tenantId,
                title,
                date: new Date(dateStr),
                status: "SCHEDULED"
              }
            });
            result.output = { appointmentId: appt.id, title, date: dateStr };
          } else {
            result.output = { error: "Data não fornecida" };
            result.success = false;
          }
          break;
        }

        case "UPDATE_LEAD": {
          const updates = {};
          if (config.name) updates.name = this.resolveTemplate(config.name, ctx);
          if (config.email) updates.email = this.resolveTemplate(config.email, ctx);
          if (config.notes) updates.notes = this.resolveTemplate(config.notes, ctx);
          if (config.source) updates.source = this.resolveTemplate(config.source, ctx);
          if (Object.keys(updates).length > 0) {
            await prisma.lead.update({ where: { id: lead.id }, data: updates });
          }
          result.output = { updated: Object.keys(updates) };
          break;
        }

        case "HTTP_REQUEST": {
          const url = this.resolveTemplate(config.url || "", ctx);
          const method = (config.method || "GET").toUpperCase();
          const headers = { "Content-Type": "application/json" };
          const body = config.body ? this.resolveTemplate(config.body, ctx) : undefined;
          try {
            const resp = await fetch(url, {
              method, headers,
              body: method !== "GET" ? body : undefined
            });
            const data = await resp.text();
            await this.updateExecutionContext(execution.id, "http.response", data);
            result.output = { status: resp.status, body: data.substring(0, 500) };
          } catch (e) {
            result.output = { error: e.message };
            result.success = false;
          }
          break;
        }

        case "SEND_EMAIL": {
          const resEmail = await EmailService.sendProspectingEmail(lead, lead.tenantId);
          result.output = { success: resEmail?.success, messageId: resEmail?.messageId, error: resEmail?.error };
          break;
        }

        case "PROSPECT_LEAD": {
           // Lógica de Prospecção (E-mail primeiro, depois WhatsApp se não houver e-mail)
           if (lead.email) {
              const resEmail = await EmailService.sendProspectingEmail(lead, lead.tenantId);
              result.output = { channel: 'EMAIL', success: resEmail?.success };
           } else {
              // Fallback para WhatsApp se o lead não tiver e-mail cadastrado
              const sdr = await prisma.sdrBot.findFirst({ where: { tenantId: lead.tenantId, active: true } });
              if (sdr) {
                 const { model } = await this._getAIModel(lead.tenantId);
                 const icp = await prisma.icpProfile.findFirst({ where: { tenantId: lead.tenantId } });
                 const prompt = `Você é um SDR e deve iniciar um contato a frio pelo WhatsApp com ${lead.name}. Use o ICP: ${icp?.name || 'Geral'} como base. Seja curto e direto.`;
                 const resultAi = await model.generateContent(prompt);
                 const text = resultAi.response.text();
                 await WhatsAppManager.sendMessage(lead.tenantId, lead.phone, text);
                 result.output = { channel: 'WHATSAPP', text: text.substring(0, 50) };
              }
           }
           break;
        }

        case "AI_TOOLS": {
          const aiPrompt = this.resolveTemplate(config.prompt || "", ctx);
          const toolsConfig = config.tools || ["search_leads", "create_appointment", "move_stage"];
          const aiResult = await this.callAIWithTools(aiPrompt, lead, ctx, toolsConfig);
          await this.updateExecutionContext(execution.id, "ai.response", aiResult.text);
          await this.updateExecutionContext(execution.id, "ai.tool_calls", JSON.stringify(aiResult.toolCalls));
          if (config.sendToLead !== false && aiResult.text) {
            await this.rateLimitedSend(lead.tenantId, lead.phone, aiResult.text);
          }
          result.output = { response: aiResult.text?.substring(0, 200), toolCalls: aiResult.toolCalls };
          break;
        }

        case "EXTRACT_DATA": {
          const fields = config.fields || ["nome", "empresa", "cargo", "email", "telefone", "interesse"];
          const sourceText = this.resolveTemplate(config.sourceText || "{{conversation.last_message}}", ctx);
          const extracted = await this.extractStructuredData(sourceText, fields, lead);
          // Save each field to context
          for (const [key, value] of Object.entries(extracted)) {
            await this.updateExecutionContext(execution.id, `extracted.${key}`, value);
          }
          // Persist to Lead.extractedData
          const existingData = JSON.parse(lead.extractedData || "{}");
          const merged = { ...existingData, ...extracted };
          await prisma.lead.update({
            where: { id: lead.id },
            data: { extractedData: JSON.stringify(merged) }
          });
          result.output = { extracted };
          break;
        }

        case "CLASSIFY_INTENT": {
          const intents = config.intents || [
            { id: "comprar", description: "Lead quer comprar ou contratar" },
            { id: "duvida", description: "Lead tem dúvidas sobre o produto" },
            { id: "suporte", description: "Lead precisa de suporte técnico" },
            { id: "cancelar", description: "Lead quer cancelar" },
            { id: "outro", description: "Nenhuma das anteriores" }
          ];
          const textToClassify = this.resolveTemplate(config.sourceText || "{{conversation.last_message}}", ctx);
          const classification = await this.classifyIntent(textToClassify, intents, lead);
          await this.updateExecutionContext(execution.id, "ai.intent", classification.intent);
          await this.updateExecutionContext(execution.id, "ai.confidence", String(classification.confidence));
          await prisma.lead.update({
            where: { id: lead.id },
            data: { lastIntentClassification: classification.intent }
          });
          // Route by intent: use sourceHandle = intent id
          result.nextHandle = classification.intent;
          result.output = { intent: classification.intent, confidence: classification.confidence, reasoning: classification.reasoning };
          break;
        }

        case "AB_TEST": {
          const variants = config.variants || [
            { id: "A", message: "Versão A da mensagem" },
            { id: "B", message: "Versão B da mensagem" }
          ];
          // Weighted random or pure random
          const selected = variants[Math.floor(Math.random() * variants.length)];
          const resolvedMsg = this.resolveTemplate(selected.message, ctx);
          await this.rateLimitedSend(lead.tenantId, lead.phone, resolvedMsg);
          await this.updateExecutionContext(execution.id, "ab.variant", selected.id);
          await this.updateExecutionContext(execution.id, "ab.message", resolvedMsg);
          // Log variant for analytics
          result.output = { variant: selected.id, message: resolvedMsg, totalVariants: variants.length };
          break;
        }

        case "AI_SCORE": {
          const criteria = config.criteria || "Avalie o lead com base em: interesse demonstrado, urgência de compra, fit com o produto, engajamento na conversa.";
          const scoreResult = await this.scoreLeadQualification(lead, ctx, criteria);
          await this.updateExecutionContext(execution.id, "ai.score", String(scoreResult.score));
          await this.updateExecutionContext(execution.id, "ai.score_reasoning", scoreResult.reasoning);
          
          await prisma.lead.update({
            where: { id: lead.id },
            data: { qualificationScore: scoreResult.score }
          });

          // AÇÃO EXTRA FASE 3: Alerta de Lead Quente (Modo Comando)
          if (scoreResult.score >= 80) {
            const alert = await CommandCenter.sendLeadAlert(lead.tenantId, lead, scoreResult.reasoning);
            if (alert) {
               const sessions = Array.from(whatsappSessions.entries()).filter(([_, s]) => s.tenantId === lead.tenantId);
               if (sessions.length > 0) {
                  const [_, session] = sessions[0];
                  await session.sock.sendMessage(`${alert.adminPhone}@s.whatsapp.net`, { text: alert.alertText });
               }
            }
          }

          // Route by score range: "hot" (>= 75), "warm" (40-74), "cold" (< 40)
          if (scoreResult.score >= 75) result.nextHandle = "hot";
          else if (scoreResult.score >= 40) result.nextHandle = "warm";
          else result.nextHandle = "cold";
          
          result.output = { score: scoreResult.score, reasoning: scoreResult.reasoning, category: result.nextHandle, bant: scoreResult.bant };
          break;
        }

        case "LIST_CALENDAR": {
           const slots = await CalendarService.listAvailableSlots(lead.tenantId);
           const text = slots.length > 0 
             ? `Olá ${lead.name}! Tenho estes horários livres:\n${slots.slice(0,3).map(s => `- ${s.toLocaleString()}`).join('\n')}\nQual fica melhor para você?`
             : "Infelizmente estamos com a agenda lotada para hoje. Posso sugerir amanhã?";
           
           await WhatsAppManager.sendMessage(lead.tenantId, lead.phone, text);
           result.output = { slots: slots.length, text };
           break;
        }

        case "BOOK_CALENDAR": {
           const dateStr = this.resolveTemplate(config.date || "", ctx);
           if (!dateStr) { result.output = { error: "Data não fornecida" }; break; }
           
           try {
             const appt = await CalendarService.createAppointment(lead.tenantId, lead, new Date(dateStr));
             await WhatsAppManager.sendMessage(lead.tenantId, lead.phone, `Confirmado! ✅ Agendei nosso papo para ${new Date(dateStr).toLocaleString()}. Te vejo lá! 🚀`);
             result.output = { success: true, eventId: appt.id };
           } catch (e) {
             result.output = { error: e.message };
             result.success = false;
           }
           break;
        }

        case "END": {
          result.output = { ended: true };
          break;
        }

        // ========== FASE 4 NODES ==========

        case "SUBFLOW": {
          const targetAutoId = config.automationId;
          if (!targetAutoId) { result.output = { error: "automationId não configurado" }; break; }
          const targetAuto = await prisma.automation.findUnique({ where: { id: targetAutoId } });
          if (!targetAuto) { result.output = { error: `Subfluxo ${targetAutoId} não encontrado` }; break; }
          // Queue the subflow execution (non-blocking)
          this.enqueueExecution(targetAuto, lead);
          result.output = { subflow: targetAuto.name, queued: true };
          break;
        }

        case "SEND_MEDIA": {
          const caption = this.resolveTemplate(config.caption || "", ctx);
          const mediaUrl = this.resolveTemplate(config.mediaUrl || "", ctx);
          const mediaType = config.mediaType || "image"; // image, video, document, audio
          await this.rateLimitedSend(lead.tenantId, lead.phone, caption, mediaUrl, mediaType);
          result.output = { mediaUrl, mediaType, caption };
          break;
        }

        default:
          console.log(`[AutoEngine] Tipo de nó desconhecido: ${node.type}`);
          result.output = { skipped: true };
      }
    } catch (err) {
      console.error(`[AutoEngine] Erro ao executar ${node.type}:`, err);
      result.success = false;
      result.output = { error: err.message };
    }

    // Log the step
    await prisma.automationStepLog.create({
      data: {
        executionId: execution.id,
        nodeId: node.id,
        nodeType: node.type,
        status: result.success ? "SUCCESS" : "FAILED",
        input: JSON.stringify(config),
        output: JSON.stringify(result.output),
        duration: Date.now() - startTime
      }
    });

    return result;
  }

  // ========== AI METHODS ==========

  async _getAIModel(tenantId) {
    // 1. Buscar configurações do Tenant no banco
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { aiProvider: true, aiApiKey: true, openAiKey: true }
    });

    const provider = tenant?.aiProvider || "GEMINI";
    const apiKey = tenant?.aiApiKey || tenant?.openAiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn(`[AutoEngine] ⚠️ Nenhuma API Key configurada para o tenant ${tenantId}. Usando fallback Gemini (env).`);
    } else {
      console.log(`[AutoEngine] 🔑 Usando API Key: ${apiKey.substring(0, 8)}...`);
    }

    // 2. Retornar modelo baseado no provedor
    if (provider === "GEMINI") {
      // Forçamos v1 para evitar erros de v1beta não encontrar modelos em certas regiões
      const genAI = new GoogleGenerativeAI(apiKey);
      return { 
        provider: "GEMINI", 
        genAI,
        apiKey
      };
    }

    if (provider === "OPENAI") {
       return { provider: "OPENAI", apiKey };
    }

    // Fallback padrão: Gemini
    const defaultAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return { provider: "GEMINI", genAI: defaultAI, apiKey: process.env.GEMINI_API_KEY };
  }

  async _getLeadFullContext(lead, context) {
    const tid = lead.tenantId || context.tenantId;
    console.log(`[AutoEngine] 🔍 Buscando SDR para Tenant: ${tid}`);
    
    const sdr = await prisma.sdrBot.findFirst({ 
      where: { 
        tenantId: tid, 
        active: true 
      } 
    });

    if (!sdr) {
      const allSdrs = await prisma.sdrBot.findMany({ where: { tenantId: tid } });
      console.log(`[AutoEngine] ⚠️ Nenhum SDR ativo para o tenant ${tid}. (Total: ${allSdrs.length})`);
      return { sdr: null, history: "Sem histórico", kb: "" };
    }

    const conv = await prisma.conversation.findFirst({
      where: { leadId: lead.id },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 15 } }
    });
    const history = conv?.messages?.reverse()?.map(m =>
      `${m.role === "USER" ? "LEAD" : "SDR"}: ${m.content}`
    ).join("\n") || "Sem histórico";

    return { sdr, history, kb: sdr?.knowledgeBase || "" };
  }

  async callAI(customPrompt, lead, context) {
    try {
      const ai = await this._getAIModel(lead.tenantId);
      const { sdr, history, kb } = await this._getLeadFullContext(lead, context);
      
      if (!sdr) {
          console.log(`[AutoEngine] SDR is globally disabled for tenant ${lead.tenantId}. Skipping AI Node.`);
          return null;
      }

      if (ai.provider === "GEMINI") {
        console.log(`[AutoEngine] 🧪 Diagnóstico AI Object:`, Object.keys(ai.genAI || {}));
        const modelsToTry = [
          "gemini-2.5-flash",
          "gemini-1.5-flash-latest",
          "gemini-1.5-flash", 
          "gemini-1.5-pro", 
          "gemini-1.0-pro",
          "gemini-pro"
        ];
        let lastError = null;
        
        for (let modelName of modelsToTry) {
          try {
            console.log(`[AutoEngine] 🤖 Tentando modelo: ${modelName}...`);
            const model = ai.genAI.getGenerativeModel({ model: modelName });
            
            console.log(`[AutoEngine] 📝 Gerando conteúdo para ${lead.name}...`);
            const systemPrompt = customPrompt || sdr.prompt || "Você é um SDR profissional.";
            const fullPrompt = `${systemPrompt}\n\nBase de conhecimento:\n${kb}\n\nDados do lead:\n- Nome: ${lead.name}\n- Telefone: ${lead.phone}\n\nHistórico:\n${history}\n\nResponda de forma curta e humana.`;

            const result = await model.generateContent(fullPrompt);
            const text = result.response.text();

            console.log(`[AutoEngine] ✅ Resposta gerada com sucesso (${modelName})`);
            
            // Track usage
            const tokens = Math.ceil((fullPrompt.length + text.length) / 4);
            await prisma.tenant.update({
              where: { id: lead.tenantId },
              data: { usedTokens: { increment: tokens } }
            }).catch(() => {});

            return text;
          } catch (err) {
            lastError = err;
            console.warn(`[AutoEngine] ⚠️ Falha no modelo ${modelName}: ${err.message}`);
            if (err.message.includes("404") || err.message.includes("not found")) {
              continue;
            }
            throw err; 
          }
        }

        // DIAGNÓSTICO: Se chegou aqui, nenhum dos modelos funcionou.
        console.error(`[AutoEngine] 🛑 Nenhum modelo padrão funcionou.`);
        try {
           if (typeof ai.genAI.listModels === "function") {
              const modelList = await ai.genAI.listModels();
              console.log(`[AutoEngine] 📋 Modelos disponíveis:`, modelList.models.map(m => m.name).join(", "));
           } else {
              console.log(`[AutoEngine] ❌ genAI.listModels não é uma função. Métodos disponíveis:`, Object.getOwnPropertyNames(Object.getPrototypeOf(ai.genAI)));
           }
        } catch(listErr) {
           console.error(`[AutoEngine] ❌ Falha ao listar modelos:`, listErr.message);
        }

        throw lastError;
      }

      return "Provedor de IA não suportado.";
    } catch (e) {
      console.error("[AutoEngine] Erro na IA:", e);
      return "Desculpe, tive um problema técnico. Pode repetir?";
    }
  }

  // IA COM TOOL USE (Function Calling)
  async callAIWithTools(customPrompt, lead, context, enabledTools) {
    try {
      const { model } = await this._getAIModel(lead.tenantId);
      const { sdr, history, kb } = await this._getLeadFullContext(lead, context);
      if (!sdr) return { text: null, toolCalls: [] };

      // Check Plan Feature: AI
      const tenantUsage = await prisma.tenant.findUnique({
        where: { id: lead.tenantId },
        include: { plan: true }
      });
      let aiEnabled = false;
      if (tenantUsage && tenantUsage.plan && tenantUsage.plan.features) {
         try { aiEnabled = JSON.parse(tenantUsage.plan.features).aiEnabled === true; } catch(e){}
      }
      if (!aiEnabled) return { text: "IA Desabilitada no Plano", toolCalls: [] };

      const toolDeclarations = [
        {
          name: "search_leads",
          description: "Busca leads no CRM por nome, telefone ou email.",
          parameters: {
            type: "object",
            properties: { query: { type: "string", description: "Termo de busca" } },
            required: ["query"]
          }
        },
        {
          name: "create_appointment",
          description: "Cria um agendamento para o lead atual.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Título do agendamento" },
              iso_date: { type: "string", description: "Data e hora em ISO 8601" }
            },
            required: ["title", "iso_date"]
          }
        },
        {
          name: "move_lead_stage",
          description: "Move o lead para outra etapa do pipeline de vendas.",
          parameters: {
            type: "object",
            properties: { stage_name: { type: "string", description: "Nome da etapa destino" } },
            required: ["stage_name"]
          }
        },
        {
          name: "add_tag",
          description: "Adiciona uma tag ao lead para segmentação.",
          parameters: {
            type: "object",
            properties: { tag_name: { type: "string", description: "Nome da tag" } },
            required: ["tag_name"]
          }
        },
        {
          name: "get_availability",
          description: "Consulta horários disponíveis na agenda.",
          parameters: { type: "object", properties: {} }
        }
      ].filter(t => enabledTools.includes(t.name));

      const systemPrompt = customPrompt || sdr?.prompt || "Você é um SDR inteligente com acesso a ferramentas do CRM.";
      const { apiKey: tApiKey } = await this._getAIModel(lead.tenantId);

      const genAI = new GoogleGenerativeAI(tApiKey || process.env.GEMINI_API_KEY);
      const toolModel = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        tools: [{ functionDeclarations: toolDeclarations }]
      });

      const fullPrompt = `${systemPrompt}\n\nBase de conhecimento:\n${kb}\n\nDados do lead:\n- Nome: ${lead.name}\n- Telefone: ${lead.phone}\n- Status: ${lead.status}\n\nHistórico:\n${history}\n\nUse as ferramentas quando necessário para atender o lead.`;

      // Check Token Limit
      if (tenantUsage && tenantUsage.plan && tenantUsage.usedTokens >= tenantUsage.plan.maxTokens) {
        console.log(`[AutoEngine] 🛑 Limite de tokens atingido para o tenant ${lead.tenantId}.`);
        return { text: "Limite de processamento atingido.", toolCalls: [] };
      }

      const chat = toolModel.startChat();
      const result = await chat.sendMessage(fullPrompt);
      const response = result.response;

      // Track initial tokens
      let totalTokens = Math.ceil((fullPrompt.length + (response.text?.() || "").length) / 4);

      const toolCalls = [];
      const parts = response.candidates?.[0]?.content?.parts || [];

      for (const part of parts) {
        if (part.functionCall) {
          const fc = part.functionCall;
          let toolResult = {};
          try {
            toolResult = await this._executeTool(fc.name, fc.args, lead);
          } catch (e) { toolResult = { error: e.message }; }
          toolCalls.push({ name: fc.name, args: fc.args, result: toolResult });
          totalTokens += Math.ceil(JSON.stringify(toolResult).length / 4);
        }
      }

      // If there were tool calls, send results back to get final response
      let finalText = response.text?.() || "";
      if (toolCalls.length > 0) {
        const toolResponses = toolCalls.map(tc => ({
          functionResponse: { name: tc.name, response: tc.result }
        }));
        const followUp = await chat.sendMessage(toolResponses);
        finalText = followUp.response.text?.() || finalText;
        totalTokens += Math.ceil(finalText.length / 4);
      }

      // Track DB usage
      await prisma.tenant.update({
        where: { id: lead.tenantId },
        data: { usedTokens: { increment: totalTokens } }
      });

      return { text: finalText, toolCalls };
    } catch (e) {
      console.error("[AutoEngine] Erro AI_TOOLS:", e);
      return { text: "Desculpe, tive um problema técnico.", toolCalls: [] };
    }
  }

  async _executeTool(name, args, lead) {
    switch (name) {
      case "search_leads": {
        const leads = await prisma.lead.findMany({
          where: { tenantId: lead.tenantId, OR: [{ name: { contains: args.query } }, { phone: { contains: args.query } }, { email: { contains: args.query } }] },
          take: 5
        });
        return { leads: leads.map(l => ({ name: l.name, phone: l.phone, status: l.status })) };
      }
      case "create_appointment": {
        const appt = await prisma.appointment.create({
          data: { leadId: lead.id, tenantId: lead.tenantId, title: args.title, date: new Date(args.iso_date), status: "SCHEDULED" }
        });
        return { success: true, appointmentId: appt.id, date: args.iso_date };
      }
      case "move_lead_stage": {
        const stage = await prisma.pipelineStage.findFirst({ where: { name: { contains: args.stage_name }, tenantId: lead.tenantId } });
        if (stage) await prisma.lead.update({ where: { id: lead.id }, data: { stageId: stage.id } });
        return { success: !!stage, stage: stage?.name || args.stage_name };
      }
      case "add_tag": {
        let tag = await prisma.tag.findFirst({ where: { name: args.tag_name } });
        if (!tag) tag = await prisma.tag.create({ data: { name: args.tag_name } });
        await prisma.lead.update({ where: { id: lead.id }, data: { tags: { connect: { id: tag.id } } } });
        return { success: true, tag: args.tag_name };
      }
      case "get_availability": {
        const now = new Date();
        const slots = [];
        for (let i = 1; i <= 5; i++) {
          const d = new Date(now); d.setDate(d.getDate() + i); d.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0);
          slots.push({ id: String(i), date: d.toISOString(), label: d.toLocaleString("pt-BR") });
        }
        return { slots };
      }
      default: return { error: `Tool ${name} not found` };
    }
  }

  // EXTRAÇÃO DE DADOS (NER)
  async extractStructuredData(text, fields, lead) {
    try {
      // Check Plan Feature: AI
      const tenantUsage = await prisma.tenant.findUnique({ where: { id: lead.tenantId }, include: { plan: true } });
      let aiEnabled = false;
      if (tenantUsage?.plan?.features) {
         try { aiEnabled = JSON.parse(tenantUsage.plan.features).aiEnabled === true; } catch(e){}
      }
      if (!aiEnabled) return fields.reduce((acc, f) => ({ ...acc, [f]: null }), {});

      const { model } = await this._getAIModel(lead.tenantId);
      const prompt = `Extraia os seguintes dados do texto abaixo. Retorne APENAS um JSON válido com as chaves solicitadas. Se um dado não estiver presente, use null.

Campos para extrair: ${JSON.stringify(fields)}

Texto:
"${text}"

Contexto adicional:
- Lead atual: ${lead.name} (${lead.phone})

Retorne apenas o JSON, sem markdown, sem explicação.`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      // Track tokens
      const tokens = Math.ceil((prompt.length + responseText.length) / 4);
      await prisma.tenant.update({
        where: { id: lead.tenantId },
        data: { usedTokens: { increment: tokens } }
      });

      // Clean markdown code blocks if present
      const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.error("[AutoEngine] Erro NER:", e);
      return fields.reduce((acc, f) => ({ ...acc, [f]: null }), {});
    }
  }

  // CLASSIFICAÇÃO DE INTENT
  async classifyIntent(text, intents, lead) {
    try {
      // Check Plan Feature: AI
      const tenantUsage = await prisma.tenant.findUnique({ where: { id: lead.tenantId }, include: { plan: true } });
      let aiEnabled = false;
      if (tenantUsage?.plan?.features) {
         try { aiEnabled = JSON.parse(tenantUsage.plan.features).aiEnabled === true; } catch(e){}
      }
      if (!aiEnabled) return { intent: intents[intents.length - 1].id, confidence: 0, reasoning: "IA Desabilitada" };

      const { model } = await this._getAIModel(lead.tenantId);
      const prompt = `Classifique a intenção da mensagem abaixo em uma das categorias listadas.

Categorias:
${intents.map(i => `- "${i.id}": ${i.description}`).join("\n")}

Mensagem do lead:
"${text}"

Contexto: Lead ${lead.name}, status ${lead.status}

Retorne APENAS um JSON com: { "intent": "id_da_categoria", "confidence": 0.0-1.0, "reasoning": "explicação breve" }`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      // Track tokens
      const tokens = Math.ceil((prompt.length + responseText.length) / 4);
      await prisma.tenant.update({
        where: { id: lead.tenantId },
        data: { usedTokens: { increment: tokens } }
      });

      const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return {
        intent: parsed.intent || intents[intents.length - 1].id,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || ""
      };
    } catch (e) {
      console.error("[AutoEngine] Erro classifyIntent:", e);
      return { intent: intents[intents.length - 1].id, confidence: 0, reasoning: "Erro na classificação" };
    }
  }

  // SCORE DE QUALIFICAÇÃO
  async scoreLeadQualification(lead, context, criteria) {
    try {
      // Check Plan Feature: AI
      const tenantUsage = await prisma.tenant.findUnique({ where: { id: lead.tenantId }, include: { plan: true } });
      let aiEnabled = false;
      if (tenantUsage?.plan?.features) {
         try { aiEnabled = JSON.parse(tenantUsage.plan.features).aiEnabled === true; } catch(e){}
      }
      if (!aiEnabled) return { score: 50, reasoning: "IA Desabilitada no Plano", bant: {}, signals: [] };

      const { model } = await this._getAIModel(lead.tenantId);
      const { history } = await this._getLeadFullContext(lead, context);

      const prompt = `Você é um CRO (Chief Revenue Officer) especialista em qualificação de leads B2B e B2C. 
      Sua tarefa é avaliar a conversa abaixo e dar uma nota de 0 a 100 baseada no potencial de fechamento imediato.

      USE O MÉTODO BANT PARA AVALIAÇÃO:
      1. BUDGET (Orçamento): O lead demonstrou condições financeiras ou perguntou sobre preço de forma qualificada?
      2. AUTHORITY (Autoridade): O lead é o decisor ou tem influência na compra?
      3. NEED (Necessidade): O problema que o lead tem é resolvido pela nossa solução?
      4. TIMELINE (Prazo): O lead tem urgência em resolver?

      Critérios adicionais do negócio:
      ${criteria}

      Dados do lead:
      - Nome: ${lead.name}
      - Status: ${lead.status}
      - Dados extraídos: ${lead.extractedData || "N/A"}

      Histórico da conversa:
      ${history}

      REGRAS DE RESPOSTA:
      - Retorne APENAS um JSON válido.
      - "score": 0-100 (Sendo 100 o lead pronto para comprar agora).
      - "reasoning": 2-3 linhas explicando a nota.
      - "bant": { "budget": 0-5, "authority": 0-5, "need": 0-5, "timeline": 0-5 } (Sendo 5 o máximo).
      - "signals": ["sinal 1", "sinal 2"]

      JSON:`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      // Track tokens
      const tokens = Math.ceil((prompt.length + responseText.length) / 4);
      await prisma.tenant.update({
        where: { id: lead.tenantId },
        data: { usedTokens: { increment: tokens } }
      });

      const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      // Se o score for muito alto, sinalizar para alerta humano
      if (parsed.score >= 80) {
        console.log(`[AutoEngine] 🔥 LEAD QUENTE DETECTADO: ${lead.name} (Score: ${parsed.score})`);
      }

      return {
        score: Math.min(100, Math.max(0, parseInt(parsed.score) || 50)),
        reasoning: parsed.reasoning || "",
        bant: parsed.bant || {},
        signals: parsed.signals || []
      };
    } catch (e) {
      console.error("[AutoEngine] Erro AI_SCORE:", e);
      return { score: 50, reasoning: "Erro na pontuação - score padrão", signals: [] };
    }
  }

  // ========== FLOW EXECUTION ==========

  async startExecution(automation, lead) {
    const nodes = JSON.parse(automation.nodes || "[]");
    const edges = JSON.parse(automation.edges || "[]");
    if (!nodes.length) return;

    // --- Monetization Check: Max Executions / Month ---
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: automation.tenantId }, include: { plan: true } });
      if (tenant && tenant.plan && tenant.plan.features) {
         let maxExecutions = 1000;
         try {
           const features = JSON.parse(tenant.plan.features);
           if (features.maxExecutions !== undefined) maxExecutions = features.maxExecutions;
         } catch(e){}

         if (maxExecutions !== -1) {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0,0,0,0);
            
            const currentExecutions = await prisma.automationExecution.count({
              where: {
                automation: { tenantId: automation.tenantId },
                createdAt: { gte: startOfMonth }
              }
            });

            if (currentExecutions >= maxExecutions) {
              console.log(`[AutoEngine] 🛑 Blocked: Tenant ${tenant.id} exceeded monthly executions limit (${maxExecutions})`);
              return;
            }
         }
      }
    } catch (e) {
      console.error("[AutoEngine] Erro ao validar limites de monetização:", e);
    }

    const context = await this.buildContext(lead, automation.tenantId);

    const execution = await prisma.automationExecution.create({
      data: {
        automationId: automation.id,
        leadId: lead.id,
        status: "RUNNING",
        context: JSON.stringify(context)
      }
    });

    await prisma.automation.update({
      where: { id: automation.id },
      data: {
        totalExecutions: { increment: 1 },
        lastExecutedAt: new Date()
      }
    });

    console.log(`[AutoEngine] ▶ Execução ${execution.id} do fluxo "${automation.name}" para lead ${lead.name}`);

    const startNode = this.findStartNode(nodes, edges);
    if (startNode) {
      await this.runNode(startNode.id, execution.id, nodes, edges, lead, 0);
    }
  }

  async runNode(nodeId, executionId, nodes, edges, lead, stepCount) {
    if (stepCount >= MAX_STEPS) {
      console.error(`[AutoEngine] Max steps (${MAX_STEPS}) alcançado para execução ${executionId}`);
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { status: "FAILED", error: "Max steps exceeded", completedAt: new Date() }
      });
      return;
    }

    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { status: "COMPLETED", completedAt: new Date() }
      });
      return;
    }

    const execution = await prisma.automationExecution.findUnique({ where: { id: executionId } });
    if (!execution || execution.status === "CANCELLED" || execution.status === "FAILED") return;

    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { currentNodeId: nodeId, status: "RUNNING" }
    });

    const result = await this.executeNode(node, execution, lead, null);

    // If paused (WAIT or COLLECT_INPUT), stop and let scheduler resume
    if (result.pause) return;

    if (!result.success) {
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { status: "FAILED", error: JSON.stringify(result.output), completedAt: new Date() }
      });
      return;
    }

    // Follow edges to next node(s)
    const nextNodeIds = this.getNextNodes(nodeId, edges, result.nextHandle);

    if (nextNodeIds.length === 0) {
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { status: "COMPLETED", completedAt: new Date() }
      });
      return;
    }

    // Execute next nodes (for conditions, might have single path)
    for (const nextId of nextNodeIds) {
      await this.runNode(nextId, executionId, nodes, edges, lead, stepCount + 1);
    }
  }

  // ========== TRIGGER DISPATCHER ==========

  async dispatchTrigger(triggerType, data) {
    const { lead, tenantId } = data;
    if (!lead || !tenantId) return;

    try {
      const automations = await prisma.automation.findMany({
        where: { tenantId, active: true, trigger: triggerType }
      });

      for (const auto of automations) {
        // For KEYWORD trigger, check if message matches
        if (triggerType === "KEYWORD" && data.message) {
          const config = JSON.parse(auto.triggerConfig || "{}");
          const keywords = config.keywords || [];
          const msgLower = data.message.toLowerCase();
          if (!keywords.some(k => msgLower.includes(k.toLowerCase()))) continue;
        }

        // Check if already running for this lead
        const existing = await prisma.automationExecution.findFirst({
          where: {
            automationId: auto.id,
            leadId: lead.id,
            status: { in: ["RUNNING", "WAITING_DELAY", "WAITING_INPUT"] }
          }
        });
        if (existing) continue;

        // Use job queue instead of direct execution
        this.enqueueExecution(auto, lead);
      }
    } catch (e) {
      console.error(`[AutoEngine] Erro no dispatchTrigger(${triggerType}):`, e);
    }
  }

  // ========== SCHEDULERS ==========

  async processPendingDelays() {
    try {
      const now = new Date();
      const pendings = await prisma.automationExecution.findMany({
        where: { status: "WAITING_DELAY", resumeAt: { lte: now } },
        include: { automation: true, lead: true }
      });

      for (const exec of pendings) {
        const nodes = JSON.parse(exec.automation.nodes || "[]");
        const edges = JSON.parse(exec.automation.edges || "[]");
        const nextNodeIds = this.getNextNodes(exec.currentNodeId, edges);

        if (nextNodeIds.length > 0) {
          await prisma.automationExecution.update({
            where: { id: exec.id },
            data: { status: "RUNNING", resumeAt: null }
          });
          for (const nextId of nextNodeIds) {
            await this.runNode(nextId, exec.id, nodes, edges, exec.lead, 0);
          }
        } else {
          await prisma.automationExecution.update({
            where: { id: exec.id },
            data: { status: "COMPLETED", completedAt: new Date() }
          });
        }
      }
    } catch (e) {
      console.error("[AutoEngine] Erro no processPendingDelays:", e);
    }
  }

  async processInactivityTriggers() {
    try {
      const automations = await prisma.automation.findMany({
        where: { trigger: "INACTIVITY", active: true }
      });

      for (const auto of automations) {
        const config = JSON.parse(auto.triggerConfig || "{}");
        const minutes = config.inactivityMinutes || 1440; // default 24h
        const cutoff = new Date(Date.now() - minutes * 60 * 1000);

        const inactiveLeads = await prisma.lead.findMany({
          where: {
            tenantId: auto.tenantId,
            conversations: {
              some: {
                messages: { every: { createdAt: { lt: cutoff } } }
              }
            }
          },
          take: 50
        });

        for (const lead of inactiveLeads) {
          const existing = await prisma.automationExecution.findFirst({
            where: {
              automationId: auto.id,
              leadId: lead.id,
              status: { in: ["RUNNING", "WAITING_DELAY", "WAITING_INPUT", "COMPLETED"] }
            }
          });
          if (existing) continue;
          await this.startExecution(auto, lead);
        }
      }
    } catch (e) {
      console.error("[AutoEngine] Erro no processInactivityTriggers:", e);
    }
  }


  // ========== INCOMING MESSAGE HANDLER ==========

  async handleIncoming(phone, text, tenantId) {
    const lead = await prisma.lead.findFirst({ where: { phone, tenantId } });
    if (!lead) return false;

    // A. TRIAGEM DE CRISE (Handoff Humano)
    const config = await prisma.automationConfig.findUnique({ where: { tenantId } });
    if (config?.humanHandoffTags) {
      const keywords = config.humanHandoffTags.split(",").map(k => k.trim().toLowerCase());
      if (keywords.some(k => text.toLowerCase().includes(k))) {
        console.log(`[AutoEngine] ⚠️ Crise detectada para ${phone}. Handoff humano.`);
        await prisma.conversation.upsert({
          where: { leadId: lead.id },
          update: { botActive: false },
          create: { leadId: lead.id, tenantId, botActive: false }
        });
        await WhatsAppManager.sendMessage(tenantId, phone,
          "Entendi perfeitamente. Vou conectar você com nossa equipe agora! 🙏"
        );
        return true;
      }
    }

    // B. CHECK WAITING_INPUT executions
    const waitingExec = await prisma.automationExecution.findFirst({
      where: { leadId: lead.id, status: "WAITING_INPUT", waitingForInput: true },
      include: { automation: true }
    });

    if (waitingExec) {
      const varName = waitingExec.inputVariable || "resposta";
      await this.updateExecutionContext(waitingExec.id, `input.${varName}`, text);

      await prisma.automationExecution.update({
        where: { id: waitingExec.id },
        data: { status: "RUNNING", waitingForInput: false, inputVariable: null }
      });

      const nodes = JSON.parse(waitingExec.automation.nodes || "[]");
      const edges = JSON.parse(waitingExec.automation.edges || "[]");
      const nextNodeIds = this.getNextNodes(waitingExec.currentNodeId, edges);

      for (const nextId of nextNodeIds) {
        await this.runNode(nextId, waitingExec.id, nodes, edges, lead, 0);
      }
      return true;
    }

    // C. KEYWORD triggers
    await this.dispatchTrigger("KEYWORD", { lead, tenantId, message: text });

    // D. NEW_MSG triggers
    await this.dispatchTrigger("NEW_MSG", { lead, tenantId, message: text });

    return false;
  }

  // ========== GLOBAL ROUTINES (appointment lifecycle) ==========
  // --- SDR PROSPECTING ROUTINE ---
  async processProspectingRoutines() {
    try {
      // Find all active ICP profiles meant for prospecting
      const activeIcps = await prisma.icpProfile.findMany({
        where: { isActive: true, isProspectingActive: true }
      });

      for (const icp of activeIcps) {
        const tenantId = icp.tenantId;

        // Verify if there is an active SDR for this tenant
        const sdr = icp.sdrId ? await prisma.sdrBot.findFirst({ where: { id: icp.sdrId, active: true } }) : await prisma.sdrBot.findFirst({ where: { tenantId, active: true } });
        if (!sdr) continue; // SDR paused locally

        // Find leads without conversations (purely new leads ready for cold outreach)
        const coldLeads = await prisma.lead.findMany({
          where: {
             tenantId,
             status: "NEW", // Must be fresh
             conversations: { none: {} } // No prior chat
          },
          take: 5 // Process in small batches to avoid rate limits
        });

        for (const lead of coldLeads) {
           console.log(`[Prospecting] Iniciando contato com lead ${lead.name} (${lead.phone}) baseado no ICP: ${icp.name}`);
           
           // Generate specific prospecting first message via AI
           const icpContext = `O Público Alvo (ICP) deste contato é:
           Indústria: ${icp.industry || 'Geral'}
           Tamanho da Empresa: ${icp.companySize || 'Qualquer'}
           Cargo do Contato: ${icp.role || 'Geral'}
           Dores do Cliente: ${icp.painPoints || 'Não especificado'}
           Objetivo do Cliente: ${icp.goals || 'Não especificado'}`;

           const prompt = `
             # IDENTIDADE
             NOME DO AGENTE: ${sdr.name}
             FUNÇÃO: ${sdr.role}
             TOM DE VOZ: ${sdr.voiceTone}
             
             # OBJETIVO DA MENSAGEM
             Você é um SDR e deve iniciar um contato a frio (Cold Outreach) pelo WhatsApp com o lead abaixo.
             O objetivo é "quebrar o gelo", conectar com a dor do perfil dele e gerar uma resposta inicial.
             Seja extremamente curto, casual e humano. Como uma mensagem real de WhatsApp. 
             Não mande "textão". NÃO SE DESPEÇA.
             
             ${icpContext}
             
             # DADOS DO LEAD
             Nome do Lead: ${lead.name}
             
             Crie a mensagem de introdução perfeita.
           `;

           try {
             const aiMsg = await this.callAI(prompt, lead, { tenantId });
             
             if (aiMsg && lead.phone) {
                // Ensure conversation marked as botActive=true exists
                const conv = await prisma.conversation.upsert({
                  where: { leadId: lead.id },
                  update: { botActive: true },
                  create: { leadId: lead.id, botActive: true, tenantId }
                });

                // Fill notes with prospecting context
                 await prisma.lead.update({
                    where: { id: lead.id },
                    data: { 
                      notes: `${lead.notes || ""}\n[Auto-SDR] Prospecção via ICP: ${icp.name}. Alvo: ${icp.role}.`.trim(),
                      status: "PROSPECTING"
                    }
                 });

                 await this.sendMessage(tenantId, lead.phone, aiMsg);

                // Save in DB
                await prisma.message.create({
                  data: { conversationId: conv.id, content: aiMsg, role: "ASSISTANT", tenantId }
                });
             }
           } catch(e) {
              console.error("[Prospecting] Erro na IA para lead " + lead.id, e);
           }
        }
      }
    } catch(err) {
       console.error("[Prospecting] Erro geraleoutine:", err);
    }
  }

  // --- AI ENRICHMENT ROUTINE (Deep Research) ---
  async processEnrichmentRoutine() {
    try {
      const leadsToEnrich = await prisma.lead.findMany({
        where: { isToEnrich: true },
        take: 3 // Small batch to avoid API costs/limits
      });

      for (const lead of leadsToEnrich) {
        console.log(`[Enrichment] Iniciando pesquisa profunda para: ${lead.name}`);
        await this.enrichLeadWithAI(lead);
      }
    } catch (err) {
      console.error("[Enrichment] Erro na rotina:", err);
    }
  }

  async enrichLeadWithAI(lead) {
    const serperKey = process.env.SERPER_API_KEY;
    if (!serperKey) return;

    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: lead.tenantId }, include: { plan: true } });
      const icp = await prisma.icpProfile.findFirst({ where: { tenantId: lead.tenantId, isActive: true } });
      
      // A. Check Plan Monthly Research Limit
      if (tenant?.plan && tenant.usedResearch >= tenant.plan.maxResearch) {
        console.log(`[Enrichment] 🛑 Limite MENSAL do plano atingido para o tenant ${lead.tenantId}`);
        return;
      }

      // B. Check ICP Daily Research Limit
      const today = new Date();
      today.setHours(0,0,0,0);
      const researchCountToday = await prisma.lead.count({
        where: { 
          tenantId: lead.tenantId, 
          updatedAt: { gte: today },
          isToEnrich: false,
          extractedData: { contains: "lastEnrichedAt" }
        }
      });

      const limit = icp?.dailyResearchLimit || 10;
      if (researchCountToday >= limit) {
        console.log(`[Enrichment] 🛑 Limite diário do ICP atingido para o tenant ${lead.tenantId} (${researchCountToday}/${limit})`);
        return;
      }

      // 1. Search for info using ICP Keywords
      const keywords = icp?.searchKeywords || "linkedin profile news";
      const query = `${lead.name} ${lead.company || ''} ${keywords}`;
      const searchRes = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: 5 })
      });
      const searchData = await searchRes.json();
      const organic = searchData.organic || [];
      const context = organic.map(o => `Título: ${o.title}\nSnippet: ${o.snippet}\nLink: ${o.link}`).join('\n\n');

      // 2. Process with Gemini (Strategic Analysis)
      const { model } = await this._getAIModel(lead.tenantId);
      const sdr = await prisma.sdrBot.findFirst({ where: { tenantId: lead.tenantId, active: true } });

      const prompt = `
        Você é um Estrategista de Vendas Outbound de Alta Performance. 
        Recebi os seguintes resultados de pesquisa sobre o lead "${lead.name}":
        
        ${context}
        
        PERFIL DE CLIENTE IDEAL (ICP) DA EMPRESA:
        ${icp ? `Nicho: ${icp.niche}, Cargo: ${icp.role}, Objetivo: ${icp.name}` : "Não definido"}
        
        INFORMAÇÕES RELEVANTES PARA BUSCAR (FOCO):
        ${icp?.relevantInfo || "Informações gerais de negócio e contato"}
        
        INSTRUÇÕES:
        1. Analise se o lead tem fit com o ICP.
        2. Extraia informações estruturadas focando no que foi pedido nas INFORMAÇÕES RELEVANTES.
        3. Crie uma MENSAGEM DE ABERTURA (ICE BREAKER) para WhatsApp que seja:
           - Curta (máximo 3 frases)
           - Extremamente personalizada citando um dado real encontrado na pesquisa.
           - Sem parecer um robô ou spam.
           - Com uma pergunta aberta no final para gerar conversa.

        Retorne APENAS um JSON no formato:
        {
          "companyName": "...",
          "role": "...",
          "industry": "...",
          "potentialPains": "...",
          "summary": "...",
          "iceBreaker": "Mensagem personalizada para o WhatsApp",
          "strategy": "Explicação da abordagem recomendada"
        }
      `;

      const result = await model.generateContent(prompt);
      let aiJson = {};
      try {
        const text = result.response.text().replace(/```json|```/g, "").trim();
        aiJson = JSON.parse(text);
      } catch(e) { console.error("Erro parse AI Strategy:", e); }

      // 3. Update Lead
      const currentData = JSON.parse(lead.extractedData || "{}");
      const newData = { ...currentData, ...aiJson, lastEnrichedAt: new Date() };
      
      let newNotes = lead.notes || "";
      if (aiJson.summary) {
        newNotes += `\n\n--- ESTRATÉGIA IA (${new Date().toLocaleDateString()}) ---\n${aiJson.summary}\n\nABORDAGEM: ${aiJson.strategy || 'N/A'}`;
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          extractedData: JSON.stringify(newData),
          notes: newNotes,
          isToEnrich: false,
          status: "PROSPECTING"
        }
      });

      // Increment Research Usage
      await prisma.tenant.update({
        where: { id: lead.tenantId },
        data: { usedResearch: { increment: 1 } }
      });

      // 4. Autonomously Initiate Outreach if SDR is active
      if (sdr && aiJson.iceBreaker && lead.phone) {
        console.log(`[Outreach] 🚀 Iniciando contato proativo com ${lead.name}`);
        
        const conv = await prisma.conversation.upsert({
          where: { leadId: lead.id },
          update: { botActive: true },
          create: { leadId: lead.id, botActive: true, tenantId: lead.tenantId }
        });

        await this.sendMessage(lead.tenantId, lead.phone, aiJson.iceBreaker);

        await prisma.message.create({
          data: {
            conversationId: conv.id,
            content: aiJson.iceBreaker,
            role: "ASSISTANT",
            tenantId: lead.tenantId
          }
        });
      }

      console.log(`[Enrichment] ✅ Sucesso e Outreach iniciado para ${lead.name}`);
    } catch (e) {
      console.error(`[Enrichment] Falha ao enriquecer lead ${lead.id}:`, e);
    }
  }

  // ========== GLOBAL ROUTINES (appointment lifecycle) ==========

  async processGlobalRoutines() {
    const now = new Date();
    try {
      const configs = await prisma.automationConfig.findMany();

      for (const config of configs) {
        const tenantId = config.tenantId;

        // A. PRÉ-CONFIRMAÇÃO
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tStart = new Date(tomorrow); tStart.setHours(0, 0, 0, 0);
        const tEnd = new Date(tomorrow); tEnd.setHours(23, 59, 59, 999);

        const toConfirm = await prisma.appointment.findMany({
          where: { tenantId, status: "SCHEDULED", date: { gte: tStart, lte: tEnd } },
          include: { lead: true }
        });

        for (const appt of toConfirm) {
          const timeStr = appt.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const template = config.confirmMsgTemplate || "Olá {name}! Confirmando seu atendimento amanhã às {time}. ✅";
          const msg = template.replace("{name}", appt.lead.name).replace("{time}", timeStr);
          await WhatsAppManager.sendMessage(tenantId, appt.lead.phone, msg);
          await prisma.appointment.update({ where: { id: appt.id }, data: { status: "CONFIRM_SENT" } });
        }

        // B. NO-SHOW
        const grace = config.lateToleranceMin || 15;
        const delayLimit = new Date(now.getTime() - grace * 60 * 1000);
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

        const delayed = await prisma.appointment.findMany({
          where: { tenantId, status: "CONFIRM_SENT", date: { lte: delayLimit, gte: todayStart } },
          include: { lead: true }
        });

        for (const appt of delayed) {
          const timeStr = appt.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const template = config.lateMsgTemplate || "Oi {name}! Notamos que você ainda não chegou para as {time}. Tudo bem?";
          const msg = template.replace("{name}", appt.lead.name).replace("{time}", timeStr);
          await WhatsAppManager.sendMessage(tenantId, appt.lead.phone, msg);
          await prisma.appointment.update({ where: { id: appt.id }, data: { status: "LATE_NOTIFIED" } });
        }

        // C. PÓS-VENDA (corrigido: usa horas, não minutos)
        const postHours = config.postServiceHours || 24;
        const postLimit = new Date(now.getTime() - postHours * 60 * 60 * 1000);

        const completed = await prisma.appointment.findMany({
          where: { tenantId, status: "COMPLETED", updatedAt: { lte: postLimit } },
          include: { lead: true }
        });

        for (const appt of completed) {
          const template = config.postServiceMsgTemplate || "Oi {name}! Como foi sua experiência? ✨";
          const msg = template.replace("{name}", appt.lead.name);
          await WhatsAppManager.sendMessage(tenantId, appt.lead.phone, msg);
          await prisma.appointment.update({ where: { id: appt.id }, data: { status: "FEEDBACK_SENT" } });
        }
      }
    } catch (e) {
      console.error("[AutoEngine] Erro nas rotinas globais:", e);
    }
  }

  // ========== UTILS ==========

  calculateDelay(val, unit) {
    const base = 60 * 1000;
    if (unit === "min") return val * base;
    if (unit === "hour") return val * base * 60;
    if (unit === "day") return val * base * 60 * 24;
    return 5000;
  }

  async sendMessage(tenantId, phone, content) {
    await WhatsAppManager.sendMessage(tenantId, phone, content);
  }

  /**
   * Aciona automações baseadas em eventos (NEW_LEAD, PIPELINE_MOVE, etc.)
   */
  async dispatchTrigger(trigger, payload) {
    try {
      const { lead, tenantId } = payload;
      const auts = await prisma.automation.findMany({
        where: { tenantId: tenantId || lead?.tenantId, trigger, active: true }
      });
      for (const aut of auts) {
        console.log(`[AutoEngine] ⚡ Disparando automação '${aut.name}' (trigger: ${trigger})`);
        this.enqueueExecution(aut, lead);
      }
    } catch (err) {
      console.error(`[AutoEngine] Erro ao disparar trigger ${trigger}:`, err);
    }
  }

  /**
   * Processa mensagem recebida de um lead e retorna resposta da IA (SDR).
   * Usado pelo webhook /api/webhook/whatsapp.
   */
  async handleIncomingMessage(lead, content, tenantId) {
    try {
      // Verifica se há automações INCOMING_MESSAGE ativas
      const auts = await prisma.automation.findMany({
        where: { tenantId, trigger: "INCOMING_MESSAGE", active: true }
      });
      for (const aut of auts) {
        this.enqueueExecution(aut, lead);
      }

      // Gera resposta do SDR ativo via callAI (que já tem retry logic)
      const aiResponse = await this.callAI(null, lead, { tenantId });
      if (!aiResponse) return null;

      // Lógica de Áudio (ElevenLabs)
      const { sdr } = await this._getLeadFullContext(lead, {});
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      
      let audioUrl = null;
      if (sdr && (sdr.responseMode === "AUDIO" || sdr.responseMode === "BOTH") && tenant?.elevenLabsKey) {
        audioUrl = await TTSService.generateSpeech(aiResponse, sdr.voiceId, tenant.elevenLabsKey);
      }

      return { 
        text: aiResponse, 
        audioUrl, 
        responseMode: sdr?.responseMode || "TEXT" 
      };
    } catch (err) {
      console.error("[AutoEngine] Erro em handleIncomingMessage:", err.message);
      return null;
    }
  }
}

export default new AutomationEngine();
