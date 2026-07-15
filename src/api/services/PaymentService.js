import axios from "axios";
import Stripe from "stripe";
import prisma from "../config/prisma.js";
import { audit } from "./AuditService.js";

/**
 * Camada de pagamento — provider-agnostic, com adaptadores para
 * Mercado Pago e Stripe.
 *
 * Princípios (DEFINICAO_MVP §5, "BUY"):
 * - PCI fora do nosso escopo: usamos checkout HOSPEDADO. O cartão nunca
 *   toca nosso backend.
 * - A fatura só vira PAID pelo WEBHOOK do gateway, nunca por chamada do
 *   cliente. `markInvoicePaid` é idempotente.
 * - O gateway ativo é escolhido no painel admin (PlatformSettings);
 *   credenciais do banco têm precedência, env é fallback.
 */
class PaymentService {
  async getSettings() {
    try {
      return await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    } catch {
      return null;
    }
  }

  /** Provider ativo: "STRIPE" ou "MERCADO_PAGO" (default). */
  async getProvider() {
    const s = await this.getSettings();
    return s?.paymentProvider || process.env.PAYMENT_PROVIDER || "MERCADO_PAGO";
  }

  async getMpAccessToken() {
    const s = await this.getSettings();
    return s?.mpAccessToken || process.env.MP_ACCESS_TOKEN || null;
  }

  async getStripeSecretKey() {
    const s = await this.getSettings();
    return s?.stripeSecretKey || process.env.STRIPE_SECRET_KEY || null;
  }

  /**
   * Cria um checkout hospedado para a fatura e devolve a URL. Despacha
   * para o adaptador do provider ativo. Sem credenciais, cai no sandbox
   * interno para o piloto testar o fluxo ponta-a-ponta.
   */
  async createCheckout(tenant, invoice) {
    const frontend = process.env.FRONTEND_URL || "http://localhost:8080";
    const provider = await this.getProvider();

    if (provider === "STRIPE") {
      const key = await this.getStripeSecretKey();
      if (key) return this._stripeCheckout(key, tenant, invoice, frontend);
      console.warn("[PaymentService] STRIPE selecionado mas sem secret key — usando sandbox.");
    } else {
      const accessToken = await this.getMpAccessToken();
      if (accessToken) return this._mercadoPagoCheckout(accessToken, tenant, invoice, frontend);
      console.warn("[PaymentService] MERCADO_PAGO selecionado mas sem access token — usando sandbox.");
    }

    // Sandbox: sem credenciais. A confirmação real ainda passa pelo webhook.
    return { checkoutUrl: `${frontend}/checkout/sandbox?invoice=${invoice.id}`, gatewayId: null };
  }

  async _mercadoPagoCheckout(accessToken, tenant, invoice, frontend) {
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
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 }
    );
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { gatewayId: res.data.id }
    });
    return { checkoutUrl: res.data.init_point, gatewayId: res.data.id };
  }

  async _stripeCheckout(secretKey, tenant, invoice, frontend) {
    const stripe = new Stripe(secretKey);
    // client_reference_id carrega o id da fatura de volta no webhook.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: invoice.id,
      customer_email: tenant.email || undefined,
      line_items: [{
        price_data: {
          currency: "brl",
          product_data: { name: `Assinatura ${tenant.name}` },
          unit_amount: Math.round(Number(invoice.amount) * 100), // centavos
        },
        quantity: 1,
      }],
      metadata: { invoiceId: invoice.id, tenantId: tenant.id },
      success_url: `${frontend}/billing?status=success`,
      cancel_url: `${frontend}/billing?status=failure`,
    });
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { gatewayId: session.id }
    });
    return { checkoutUrl: session.url, gatewayId: session.id };
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
