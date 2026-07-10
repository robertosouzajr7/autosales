import crypto from "crypto";
import PaymentService from "../services/PaymentService.js";
import prisma from "../config/prisma.js";

/**
 * Webhook de confirmação de pagamento.
 *
 * A fatura só vira PAID aqui — nunca por chamada do cliente. O corpo é
 * autenticado por HMAC-SHA256 (mesmo padrão do webhook da Meta) sobre o
 * corpo cru, contra PAYMENT_WEBHOOK_SECRET.
 *
 * Payload normalizado esperado (o adaptador do gateway traduz para isto):
 *   { invoiceId?, external_reference?, gatewayId?, status: "approved"|... }
 */
export function isValidPaymentSignature(req) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Payment Webhook] PAYMENT_WEBHOOK_SECRET não configurado — rejeitando.");
    return false;
  }
  const signature = req.get("x-signature-256") || req.get("x-signature");
  if (!signature) return false;
  if (!req.rawBody) return false;

  const normalized = signature.startsWith("sha256=") ? signature : `sha256=${signature}`;
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(req.rawBody)
    .digest("hex");

  const a = Buffer.from(normalized);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const APPROVED = new Set(["approved", "paid", "PAID", "APPROVED", "success"]);

export const receivePaymentWebhook = async (req, res) => {
  if (!isValidPaymentSignature(req)) {
    return res.sendStatus(403);
  }

  const body = req.body || {};
  const status = body.status || body.action;

  if (!APPROVED.has(status)) {
    // Evento não-terminal (pending, criado, etc.) — apenas confirma recebimento.
    return res.status(200).json({ received: true, ignored: status });
  }

  try {
    // Resolve a fatura por id direto, external_reference ou gatewayId.
    let invoiceId = body.invoiceId || body.external_reference;
    if (!invoiceId && body.gatewayId) {
      const inv = await prisma.invoice.findFirst({ where: { gatewayId: body.gatewayId } });
      invoiceId = inv?.id;
    }
    if (!invoiceId) {
      console.warn("[Payment Webhook] Evento aprovado sem fatura resolvível:", JSON.stringify(body).slice(0, 200));
      return res.status(200).json({ received: true, resolved: false });
    }

    const result = await PaymentService.markInvoicePaid(invoiceId, body.gatewayId || null);
    console.log(`[Payment Webhook] Fatura ${invoiceId} ${result.alreadyPaid ? "já estava paga" : "confirmada"}.`);
    return res.status(200).json({ received: true, alreadyPaid: result.alreadyPaid });
  } catch (err) {
    console.error("[Payment Webhook] Erro ao processar pagamento:", err.message);
    return res.status(500).json({ error: "internal" });
  }
};
