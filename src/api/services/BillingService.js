import cron from "node-cron";
import prisma from "../config/prisma.js";
import { EmailService } from "../../../email_service.js";

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
    });
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

        // Generate a new invoice
        console.log(`[BillingService] 💸 Gerando nova fatura mensal para ${tenant.name} (${tenant.plan.name})`);
        
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3); // 3 days to pay

        const newInvoice = await prisma.invoice.create({
          data: {
            tenantId: tenant.id,
            amount: tenant.plan.priceMonthly,
            status: "PENDING",
            dueDate
          }
        });

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
