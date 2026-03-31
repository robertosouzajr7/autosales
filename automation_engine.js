import { PrismaClient } from "@prisma/client";
import { whatsappSessions } from "./whatsapp.js";

const prisma = new PrismaClient();

class AutomationEngine {
  constructor() {
    this.checkInterval = setInterval(() => this.processPendingProgressions(), 30 * 1000); // Every 30s
  }

  async sendMessage(phone, content, companyId) {
    const sock = whatsappSessions.get(companyId);
    if (!sock) {
      console.error(`[AutomationEngine] Sessão não encontrada para empresa ${companyId}`);
      return;
    }
    const remoteJid = `${phone}@s.whatsapp.net`;
    await sock.sendMessage(remoteJid, { text: content });
  }

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

  async trigger(lead, triggerType) {
    try {
      const automations = await prisma.automation.findMany({
        where: { trigger: triggerType, active: true, companyId: lead.companyId }
      });

      for (const auto of automations) {
        const progress = await prisma.automationProgress.upsert({
          where: { automationId_leadId: { automationId: auto.id, leadId: lead.id } },
          create: { automationId: auto.id, leadId: lead.id, status: "RUNNING", currentStepId: null },
          update: { status: "RUNNING", currentStepId: null, nextRun: null }
        });
        await this.continueFlow({ ...progress, automation: auto, lead });
      }
    } catch (e) {
      console.error("[AutomationEngine] Erro no trigger:", e);
    }
  }

  async continueFlow(progress) {
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
    console.log(`[Automation] Fluxo ${progress.automation.name} executando passo: ${nextNode.type}`);

    try {
      switch (nextNode.type) {
        case "message":
          await this.sendMessage(progress.lead.phone, nextNode.content, progress.lead.companyId);
          await this.advance(progress, nextNode.id);
          break;

        case "delay":
          const delayMs = this.calculateDelay(nextNode.delayValue, nextNode.delayUnit);
          await prisma.automationProgress.update({
            where: { id: progress.id },
            data: { 
              status: "WAITING_DELAY", 
              currentStepId: nextNode.id,
              nextRun: new Date(Date.now() + delayMs)
            }
          });
          break;

        case "tag":
          const currentTags = progress.lead.tags ? progress.lead.tags.split(",") : [];
          if (!currentTags.includes(nextNode.tagName)) {
             currentTags.push(nextNode.tagName);
             await prisma.lead.update({
               where: { id: progress.lead.id },
               data: { tags: currentTags.join(",") }
             });
          }
          await this.advance(progress, nextNode.id);
          break;

        case "condition":
          await prisma.automationProgress.update({
            where: { id: progress.id },
            data: { status: "WAITING_CONDITION", currentStepId: nextNode.id }
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
    if (unit === "hour") return val * base * base;
    if (unit === "day") return val * base * base * 24;
    return 5000;
  }

  async handleIncoming(phone, text, companyId) {
    const lead = await prisma.lead.findFirst({ where: { phone, companyId } });
    if (!lead) return;

    const waitingProgress = await prisma.automationProgress.findFirst({
      where: { leadId: lead.id, status: "WAITING_CONDITION" },
      include: { automation: true, lead: true }
    });

    if (waitingProgress) {
        const nodes = JSON.parse(waitingProgress.automation.nodes || "[]");
        const node = nodes.find(n => n.id === waitingProgress.currentStepId);
        if (node && text.toLowerCase().includes((node.conditionValue || "").toLowerCase())) {
            await this.advance(waitingProgress, node.id);
            return true; // Mensagem foi processada por automação
        }
    }

    const keywords = await prisma.automation.findMany({
        where: { trigger: "KEYWORD_MATCH", active: true, companyId }
    });

    for (const auto of keywords) {
        if (text.toLowerCase().includes(auto.name.toLowerCase())) {
            await this.trigger(lead, "KEYWORD_MATCH");
            return true;
        }
    }
    return false;
  }
}

export default new AutomationEngine();
