import cron from "node-cron";
import prisma from "../config/prisma.js";
import { EmailService } from "../../../email_service.js";
import { sendTrialReminder } from "./EmailService.js";

class BillingService {
  constructor() {
    this.cronJob = null;
  }

  initialize() {
    console.log("[BillingService] 🕒 Inicializando cron de faturamento recorrente (executado diariamente às 00:00)...");
    
    // Run daily at midnight
    this.cronJob = cron.schedule("0 0 * * *", async () => {
      try {
        await this.runBillingCheck();
      } catch (error) {
        console.error("[BillingService] ❌ Erro ao executar rotina diária de faturamento:", error);
      }
      try {
        await this.runTrialReminders();
      } catch (error) {
        console.error("[BillingService] ❌ Erro ao enviar lembretes de trial:", error);
      }
    });
  }

  /**
   * Lembretes de fim de teste por e-mail (D-3, D-1 e D-0) para tenants em
   * TRIAL sem assinatura ativa. Idempotente por dia via AuditLog, então roda
   * uma vez por marco mesmo se o cron disparar mais de uma vez.
   */
  async runTrialReminders() {
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const dayMs = 86_400_000;

    const tenants = await prisma.tenant.findMany({
      where: {
        active: true,
        subscriptionStatus: "TRIAL",
        stripeSubscriptionId: null,
        trialEnd: { not: null },
      },
      include: { plan: true },
    });

    for (const t of tenants) {
      const end = new Date(t.trialEnd); end.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((end.getTime() - startOfToday.getTime()) / dayMs);
      if (![3, 1, 0].includes(daysLeft)) continue;
      if (!t.email) continue;

      // Já enviou um lembrete hoje? (evita duplicar em reinícios/re-execuções)
      const already = await prisma.auditLog.findFirst({
        where: { tenantId: t.id, action: "TRIAL_REMINDER", createdAt: { gte: startOfToday } },
      });
      if (already) continue;

      try {
        await sendTrialReminder({ to: t.email, name: t.name, daysLeft, planName: t.plan?.name });
        await prisma.auditLog.create({
          data: {
            tenantId: t.id, action: "TRIAL_REMINDER", entity: "Tenant", entityId: t.id,
            metadata: JSON.stringify({ daysLeft }),
          },
        });
        console.log(`[BillingService] ✉️ Lembrete de trial (D-${daysLeft}) enviado para ${t.email}`);
      } catch (e) {
        console.error(`[BillingService] Falha ao enviar lembrete para ${t.email}:`, e.message);
      }
    }
  }

  async runBillingCheck() {
    console.log("[BillingService] 🔍 Iniciando processamento de faturamento...");
    const now = new Date();

    try {
      // 1. Check for expired/overdue invoices
      const pendingInvoices = await prisma.invoice.findMany({
        where: {
          status: "PENDING",
          dueDate: { lte: now }
        },
        include: { tenant: true }
      });

      for (const invoice of pendingInvoices) {
        console.log(`[BillingService] ⚠️ Fatura #${invoice.id.slice(0,8)} está vencida para o tenant ${invoice.tenant.name}`);
        
        // Update invoice status to OVERDUE
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "OVERDUE" }
        });

        // Update tenant subscription status to PAST_DUE
        await prisma.tenant.update({
          where: { id: invoice.tenantId },
          data: { subscriptionStatus: "PAST_DUE" }
        });

        // Send warning email
        await EmailService.sendBillingNotification(
          invoice.tenant.email,
          invoice.tenant.name,
          { ...invoice, status: "OVERDUE" }
        );
      }

      // 2. Generate new recurring invoices for tenants whose billing date has arrived
      const tenantsToBill = await prisma.tenant.findMany({
        where: {
          active: true,
          planId: { not: null },
          nextBillingDate: { lte: now }
        },
        include: {
          plan: true,
          invoices: {
            where: { status: { in: ["PENDING", "OVERDUE"] } }
          }
        }
      });

      for (const tenant of tenantsToBill) {
        if (!tenant.plan) continue;

        // If they already have an active pending or overdue invoice, block and change status to PAST_DUE
        if (tenant.invoices.length > 0) {
          console.log(`[BillingService] 🛑 Tenant ${tenant.name} tem faturas pendentes de pagamento. Assinatura suspensa.`);
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { subscriptionStatus: "PAST_DUE" }
          });
          continue;
        }

        // Período de competência = mês da cobrança (YYYY-MM). A constraint
        // única (tenantId, billingPeriod) garante que, se o cron rodar duas
        // vezes no mesmo mês (retry, reboot), a segunda tentativa falhe em vez
        // de duplicar a fatura.
        const billingPeriod = now.toISOString().slice(0, 7);

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3); // 3 days to pay

        let newInvoice;
        try {
          newInvoice = await prisma.invoice.create({
            data: {
              tenantId: tenant.id,
              amount: tenant.plan.priceMonthly,
              status: "PENDING",
              dueDate,
              billingPeriod
            }
          });
        } catch (e) {
          // P2002 = violação de unique → já existe fatura desse período. Idempotente.
          if (e.code === "P2002") {
            console.log(`[BillingService] ↩️ Fatura de ${billingPeriod} já existe para ${tenant.name}. Ignorando (idempotência).`);
            continue;
          }
          throw e;
        }

        console.log(`[BillingService] 💸 Nova fatura mensal para ${tenant.name} (${tenant.plan.name}) — período ${billingPeriod}`);

        // We push the billing date by another 30 days
        const nextBilling = new Date(tenant.nextBillingDate || now);
        nextBilling.setDate(nextBilling.getDate() + 30);

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            nextBillingDate: nextBilling
            // Note: Consumptions are reset only when they pay the invoice (handled in BillingController)
          }
        });

        // Send email alert
        await EmailService.sendBillingNotification(
          tenant.email,
          tenant.name,
          newInvoice
        );
      }

      console.log("[BillingService] ✅ Processamento de faturamento concluído.");
    } catch (e) {
      console.error("[BillingService] ❌ Falha catastrófica na rotina de faturamento:", e);
      throw e;
    }
  }
}

export default new BillingService();
