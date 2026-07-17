import Stripe from "stripe";
import prisma from "../config/prisma.js";
import PaymentService from "../services/PaymentService.js";

/**
 * Webhook do Stripe.
 *
 * A verificação de assinatura é feita pelo próprio SDK do Stripe
 * (stripe.webhooks.constructEvent) sobre o corpo CRU (req.rawBody) e o
 * header `stripe-signature`, contra o webhook secret (whsec_…).
 *
 * A fatura só vira PAID aqui — nunca por chamada do cliente. Reage a
 * `checkout.session.completed` (pagamento aprovado no checkout hospedado).
 */
async function getStripeConfig() {
  let secretKey = process.env.STRIPE_SECRET_KEY || null;
  let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null;
  try {
    const s = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    if (s?.stripeSecretKey) secretKey = s.stripeSecretKey;
    if (s?.stripeWebhookSecret) webhookSecret = s.stripeWebhookSecret;
  } catch {
    /* usa env */
  }
  return { secretKey, webhookSecret };
}

export const receiveStripeWebhook = async (req, res) => {
  const { secretKey, webhookSecret } = await getStripeConfig();
  if (!secretKey || !webhookSecret) {
    console.error("[Stripe Webhook] Secret key ou webhook secret ausente — rejeitando.");
    return res.sendStatus(403);
  }
  const signature = req.get("stripe-signature");
  if (!signature || !req.rawBody) return res.sendStatus(400);

  const stripe = new Stripe(secretKey);
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[Stripe Webhook] Assinatura inválida:", err.message);
    return res.sendStatus(403);
  }

  try {
    switch (event.type) {
      // ── Checkout concluído ───────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;

        // (A) Assinatura recorrente com trial (checkout embutido).
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const tenantId = await PaymentService.syncSubscription(subscription);
          console.log(`[Stripe Webhook] Assinatura ${subscription.id} vinculada ao tenant ${tenantId}.`);
          return res.status(200).json({ received: true, subscription: subscription.id });
        }

        // (B) Fatura avulsa (fluxo legado, mode: payment).
        if (session.payment_status && session.payment_status !== "paid") {
          return res.status(200).json({ received: true, unpaid: session.payment_status });
        }
        const invoiceId = session.client_reference_id || session.metadata?.invoiceId;
        let resolvedId = invoiceId;
        if (!resolvedId && session.id) {
          const inv = await prisma.invoice.findFirst({ where: { gatewayId: session.id } });
          resolvedId = inv?.id;
        }
        if (!resolvedId) {
          return res.status(200).json({ received: true, resolved: false });
        }
        const result = await PaymentService.markInvoicePaid(resolvedId, session.id);
        return res.status(200).json({ received: true, alreadyPaid: result.alreadyPaid });
      }

      // ── Ciclo de vida da assinatura ──────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const tenantId = await PaymentService.syncSubscription(subscription);
        return res.status(200).json({ received: true, tenant: tenantId, status: subscription.status });
      }

      // ── Cobrança recorrente paga (após o trial) ──────────────────
      case "invoice.paid": {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await PaymentService.recordSubscriptionInvoicePaid(invoice);
        }
        return res.status(200).json({ received: true });
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        if (invoice.customer) {
          const tenant = await prisma.tenant.findFirst({ where: { stripeCustomerId: invoice.customer } });
          if (tenant) {
            await prisma.tenant.update({ where: { id: tenant.id }, data: { subscriptionStatus: "PAST_DUE" } });
          }
        }
        return res.status(200).json({ received: true });
      }

      default:
        return res.status(200).json({ received: true, ignored: event.type });
    }
  } catch (err) {
    console.error("[Stripe Webhook] Erro ao processar evento:", err.message);
    return res.status(500).json({ error: "internal" });
  }
};
