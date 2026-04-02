import { PrismaClient } from "@prisma/client";
import { WhatsAppManager } from "./whatsapp.js";

const prisma = new PrismaClient();

class AutomationEngine {
  constructor() {
    this.checkInterval = setInterval(() => this.processPendingProgressions(), 30 * 1000);
    this.routineInterval = setInterval(() => this.processGlobalRoutines(), 5 * 60 * 1000);
  }

  async sendMessage(phone, content, tenantId) {
    // Agora centralizado no WhatsAppManager que suporta tanto Baileys quanto Meta Official
    await WhatsAppManager.sendMessage(tenantId, phone, content);
  }

  // --- 1. PROCESSAMENTO DE WORKFLOWS VISUAIS ---
  async processPendingProgressions() {
    const now = new Date();
    try {
      const pendings = await prisma.automationProgress.findMany({
        where: {
          status: "WAITING_DELAY",
          nextRun: { lte: now }
        },
        include: { automation: true, lead: true }
      });

      for (const progress of pendings) {
        await this.continueFlow(progress);
      }
    } catch (e) {
      console.error("[AutomationEngine] Erro no scheduler:", e);
    }
  }

  // --- 2. ROTINAS GLOBAIS SDR (AUDIO REQUIREMENTS) ---
  async processGlobalRoutines() {
    console.log("[SDR-Routine] 🔍 Iniciando processamento de rotinas proativas...");
    const now = new Date();
    
    try {
      const configs = await prisma.automationConfig.findMany();
      
      for (const config of configs) {
        const tenantId = config.tenantId;

        // A. PRÉ-CONFIRMAÇÃO (Noite Anterior)
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const appointmentsToConfirm = await prisma.appointment.findMany({
          where: {
            tenantId,
            status: "SCHEDULED",
            date: {
              gte: new Date(tomorrow.setHours(0,0,0,0)),
              lte: new Date(tomorrow.setHours(23,59,59,999))
            }
          },
          include: { lead: true }
        });

        for (const appt of appointmentsToConfirm) {
           const timeStr = appt.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
           const template = config.confirmMsgTemplate || "Olá {name}! Passando para confirmar seu atendimento de amanhã às {time}.";
           const msg = template.replace("{name}", appt.lead.name).replace("{time}", timeStr);
           
           await this.sendMessage(appt.lead.phone, msg, tenantId);
           await prisma.appointment.update({ where: { id: appt.id }, data: { status: "CONFIRM_SENT" } });
        }

        // B. NO-SHOW (Alerta de Atraso)
        const graceMinutes = config.lateToleranceMin || 15;
        const delayedLimit = new Date(now.getTime() - (graceMinutes * 60 * 1000));
        
        const delayedAppts = await prisma.appointment.findMany({
          where: {
            tenantId,
            status: "CONFIRM_SENT", 
            date: { lte: delayedLimit, gte: new Date(now.setHours(0,0,0,0)) }
          },
          include: { lead: true }
        });

        for (const appt of delayedAppts) {
           const timeStr = appt.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
           const template = config.lateMsgTemplate || "Oi {name}! Notamos que você ainda não chegou para o seu horário das {time}. Está tudo bem?";
           const msg = template.replace("{name}", appt.lead.name).replace("{time}", timeStr);
           
           await this.sendMessage(appt.lead.phone, msg, tenantId);
           await prisma.appointment.update({ where: { id: appt.id }, data: { status: "LATE_NOTIFIED" } });
        }

        // C. PÓS-VENDA (Feedback 24h)
        const postCheckHours = config.postServiceHours || 24;
        const postLimit = new Date(now.getTime() - (postCheckHours * 60 * 1000));
        
        const completedAppts = await prisma.appointment.findMany({
          where: {
            tenantId,
            status: "COMPLETED",
            updatedAt: { lte: postLimit }
          },
          include: { lead: true }
        });

        for (const appt of completedAppts) {
           const template = config.postServiceMsgTemplate || "Oi {name}! Esperamos que tenha gostado do atendimento! ✨ Como foi sua experiência?";
           const msg = template.replace("{name}", appt.lead.name);
           
           await this.sendMessage(appt.lead.phone, msg, tenantId);
           await prisma.appointment.update({ where: { id: appt.id }, data: { status: "FEEDBACK_SENT" } });
        }
      }
    } catch (e) {
      console.error("[SDR-Routine] Erro nas rotinas:", e);
    }
  }

  // --- 3. LÓGICA DE WORKFLOWS ---
  async trigger(lead, triggerType) {
    try {
      const automations = await prisma.automation.findMany({
        where: { trigger: triggerType, active: true, tenantId: lead.tenantId }
      });

      for (const auto of automations) {
        await prisma.automationProgress.upsert({
          where: { automationId_leadId: { automationId: auto.id, leadId: lead.id } },
          create: { automationId: auto.id, leadId: lead.id, status: "RUNNING", currentStepId: null },
          update: { status: "RUNNING", currentStepId: null, nextRun: null }
        });
        const progress = await prisma.automationProgress.findUnique({
           where: { automationId_leadId: { automationId: auto.id, leadId: lead.id } },
           include: { automation: true, lead: true }
        });
        await this.continueFlow(progress);
      }
    } catch (e) {
      console.error("[AutomationEngine] Erro no trigger:", e);
    }
  }

  async continueFlow(progress) {
    if (!progress.automation.nodes) return;
    const nodes = JSON.parse(progress.automation.nodes || "[]");
    const currentIndex = nodes.findIndex(n => n.id === progress.currentStepId);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= nodes.length) {
      await prisma.automationProgress.update({
        where: { id: progress.id },
        data: { status: "COMPLETED", currentStepId: null }
      });
      return;
    }

    const nextNode = nodes[nextIndex];
    
    try {
      switch (nextNode.type) {
        case "SEND_MSG":
          await this.sendMessage(progress.lead.phone, nextNode.label || "Olá!", progress.lead.tenantId);
          await this.advance(progress, nextNode.id);
          break;

        case "WAIT":
          const delayMs = this.calculateDelay(nextNode.config?.value || 1, nextNode.config?.unit || "hour");
          await prisma.automationProgress.update({
            where: { id: progress.id },
            data: { 
              status: "WAITING_DELAY", 
              currentStepId: nextNode.id,
              nextRun: new Date(Date.now() + delayMs)
            }
          });
          break;

        default:
          await this.advance(progress, nextNode.id);
      }
    } catch (err) {
      console.error(`[AutomationEngine] Erro ao processar ${nextNode.type}:`, err);
    }
  }

  async advance(progress, stepId) {
    const updated = await prisma.automationProgress.update({
      where: { id: progress.id },
      data: { currentStepId: stepId, status: "RUNNING" },
      include: { automation: true, lead: true }
    });
    await this.continueFlow(updated);
  }

  calculateDelay(val, unit) {
    const base = 60 * 1000;
    if (unit === "min") return val * base;
    if (unit === "hour") return val * base * 60;
    if (unit === "day") return val * base * 60 * 24;
    return 5000;
  }

  async handleIncoming(phone, text, tenantId) {
    const lead = await prisma.lead.findFirst({ where: { phone, tenantId } });
    if (!lead) return false;

    // A. TRIAGEM DE CRISE E TRANSBORDO (Audio Requirement)
    const config = await prisma.automationConfig.findUnique({ where: { tenantId } });
    if (config?.humanHandoffTags) {
       const keywords = config.humanHandoffTags.split(",").map(k => k.trim().toLowerCase());
       const matched = keywords.some(k => text.toLowerCase().includes(k));
       
       if (matched) {
          console.log(`[SDR-Alert] ⚠️ Crise detectada para lead ${phone}. Pausando robô.`);
          // Pausa a IA para o lead
          await prisma.conversation.upsert({
            where: { leadId: lead.id },
            update: { botActive: false },
            create: { leadId: lead.id, botActive: false }
          });
          await this.sendMessage(phone, "Entendi perfeitamente sua situação. Vou conectar você com nossa equipe agora mesmo para te dar total atenção! 🙏", tenantId);
          return true;
       }
    }

    // B. PROCESSAMENTO DE RESPOSTA EM WORKFLOWS
    const waitingProgress = await prisma.automationProgress.findFirst({
      where: { leadId: lead.id, status: "WAITING_CONDITION" },
      include: { automation: true, lead: true }
    });

    if (waitingProgress) {
        const nodes = JSON.parse(waitingProgress.automation.nodes || "[]");
        const node = nodes.find(n => n.id === waitingProgress.currentStepId);
        if (node && text.toLowerCase().includes((node.config?.conditionValue || "").toLowerCase())) {
            await this.advance(waitingProgress, node.id);
            return true;
        }
    }

    return false;
  }
}

export default new AutomationEngine();
