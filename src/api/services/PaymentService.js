import axios from "axios";
import prisma from "../config/prisma.js";
import { audit } from "./AuditService.js";

/**
 * Camada de pagamento — provider-agnostic, com adaptador para Mercado Pago.
 *
 * Princípios (DEFINICAO_MVP §5, "BUY"):
 * - PCI fora do nosso escopo: usamos checkout HOSPEDADO. O cartão nunca
 *   toca nosso backend.
 * - A fatura só vira PAID pelo WEBHOOK do gateway, nunca por chamada do
 *   cliente. `markInvoicePaid` é idempotente.
 */
class PaymentService {
  get isConfigured() {
    return !!process.env.MP_ACCESS_TOKEN;
  }

  /**
   * Cria uma preferência de checkout hospedado para a fatura e devolve a URL.
   * Com Mercado Pago configurado, cria a preference real; sem ele, devolve um
   * link de sandbox interno para o piloto testar o fluxo ponta-a-ponta.
   */
  async createCheckout(tenant, invoice) {
    const frontend = process.env.FRONTEND_URL || "http://localhost:8080";

    if (this.isConfigured) {
      const res = await axios.post(
        "https://api.mercadopago.com/checkout/preferences",
        {
          items: [{
            title: `Assinatura ${tenant.name}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(invoice.amount)
          }],
          external_reference: invoice.id,
          back_urls: {
            success: `${frontend}/billing?status=success`,
            failure: `${frontend}/billing?status=failure`,
            pending: `${frontend}/billing?status=pending`
          },
          auto_return: "approved",
          notification_url: `${process.env.PUBLIC_URL || frontend}/api/webhook/payment`
        },
        { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }, timeout: 15000 }
      );

      // Guarda o id da preference para reconciliar no webhook.
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { gatewayId: res.data.id }
      });

      return { checkoutUrl: res.data.init_point, gatewayId: res.data.id };
    }

    // Sandbox: sem credenciais de gateway. O link aponta para uma tela de
    // confirmação de teste; a confirmação real ainda passa pelo webhook.
    console.warn("[PaymentService] MP_ACCESS_TOKEN ausente — usando checkout sandbox.");
    return { checkoutUrl: `${frontend}/checkout/sandbox?invoice=${invoice.id}`, gatewayId: null };
  }

  /**
   * Confirma o pagamento de uma fatura de forma IDEMPOTENTE. Chamada apenas
   * pelo webhook do gateway. Ativa o tenant e reinicia o ciclo de consumo.
   * Retorna { alreadyPaid } quando a fatura já estava quitada.
   */
  async markInvoicePaid(invoiceId, gatewayId = null) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new Error(`Fatura ${invoiceId} não encontrada`);
    if (invoice.status === "PAID") return { alreadyPaid: true, invoice };

    const paidInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: new Date(), gatewayId: gatewayId || invoice.gatewayId }
    });

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 30);

    const tenant = await prisma.tenant.update({
      where: { id: invoice.tenantId },
      data: {
        subscriptionStatus: "ACTIVE",
        nextBillingDate: nextDate,
        // Reinicia consumo no início do ciclo pago
        usedTokens: 0,
        usedProspects: 0,
        usedResearch: 0,
        usedMessages: 0,
        lastUsageReset: new Date()
      },
      include: { plan: true }
    });

    // Registro financeiro (fluxo de caixa)
    await prisma.financialRecord.create({
      data: {
        description: `Mensalidade Plano ${tenant.plan?.name || "SaaS"} - Fatura #${invoiceId.slice(0, 8)}`,
        amount: invoice.amount,
        type: "REVENUE",
        category: "Plano SaaS",
        dueDate: invoice.dueDate,
        paidAt: new Date(),
        tenantId: tenant.id
      }
    });

    await audit({
      tenantId: tenant.id, action: "INVOICE_PAID", entity: "Invoice", entityId: invoiceId,
      metadata: { amount: invoice.amount, gatewayId: gatewayId || invoice.gatewayId }
    });

    return { alreadyPaid: false, invoice: paidInvoice, tenant };
  }
}

export default new PaymentService();
