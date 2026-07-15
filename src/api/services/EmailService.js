import nodemailer from "nodemailer";

/**
 * Serviço central de envio de e-mails do sistema (verificação, reset
 * de senha, boas-vindas). Não é para marketing/broadcast — usa SMTP
 * único do produto configurado por env:
 *
 *   SMTP_HOST      (ex.: smtp.resend.com)
 *   SMTP_PORT      (ex.: 587)
 *   SMTP_USER      (usuário/API key)
 *   SMTP_PASS      (senha/API key)
 *   SMTP_FROM      (remetente, ex.: "AutoSales <no-reply@seu-dominio.com>")
 *   PUBLIC_URL     (URL do frontend, usada para gerar links)
 *
 * Se SMTP não estiver configurado, o serviço loga o e-mail no console
 * (útil pra dev). Nunca lança erro de "faltou config".
 */

let _transporter = null;
function transporter() {
  if (_transporter) return _transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
    secure: (SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return _transporter;
}

function publicUrl() {
  return (process.env.PUBLIC_URL || "http://localhost:8080").replace(/\/$/, "");
}

async function send({ to, subject, html, text }) {
  // Padrão seguro: se SMTP_FROM não estiver setado, usa o próprio SMTP_USER
  // (evita rejeição por "sender not owned" em provedores como Hostinger).
  const from =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "AutoSales <no-reply@autosales.local>";
  const t = transporter();
  if (!t) {
    console.log(
      `[EmailService] (SMTP não configurado) enviando SIMULADO -> ${to}\n  Subject: ${subject}\n  Text: ${text || html?.replace(/<[^>]+>/g, "").slice(0, 200)}`
    );
    return { simulated: true };
  }
  try {
    const info = await t.sendMail({ from, to, subject, text, html });
    return { messageId: info.messageId };
  } catch (e) {
    console.error("[EmailService] Falha ao enviar:", e.message);
    throw e;
  }
}

// Wrapper HTML minimalista, consistente com a paleta do produto.
function wrap(bodyHtml) {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
    <p style="font-size:12px;color:#64748b;margin:0;">
      Se você não solicitou esta mensagem, pode ignorá-la com segurança.
    </p>
  </div>
</body></html>`;
}

// ─── Templates ─────────────────────────────────────────────────

export async function sendVerificationEmail({ to, name, token }) {
  const link = `${publicUrl()}/verify-email/${token}`;
  const html = wrap(`
    <h2 style="margin:0 0 12px;font-size:20px;">Bem-vindo${name ? `, ${name.split(" ")[0]}` : ""}!</h2>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">
      Falta um passo pra ativar sua conta. Clique no botão abaixo para confirmar seu e-mail:
    </p>
    <p style="margin:0 0 24px;">
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;text-decoration:none;border-radius:12px;font-weight:600;">
        Confirmar meu e-mail
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#64748b;">
      Ou copie e cole este link: <br>
      <a href="${link}" style="color:#2563EB;word-break:break-all;">${link}</a>
    </p>
    <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">O link expira em 24 horas.</p>
  `);
  return send({
    to,
    subject: "Confirme seu e-mail",
    html,
    text: `Confirme seu e-mail: ${link}`,
  });
}

export async function sendPasswordResetEmail({ to, name, token }) {
  const link = `${publicUrl()}/reset-password/${token}`;
  const html = wrap(`
    <h2 style="margin:0 0 12px;font-size:20px;">Redefinir sua senha</h2>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">
      ${name ? `Oi, ${name.split(" ")[0]}. ` : ""}Recebemos um pedido para redefinir a senha da sua conta.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;text-decoration:none;border-radius:12px;font-weight:600;">
        Escolher nova senha
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#64748b;">
      Ou copie e cole este link: <br>
      <a href="${link}" style="color:#2563EB;word-break:break-all;">${link}</a>
    </p>
    <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">O link expira em 1 hora.</p>
  `);
  return send({
    to,
    subject: "Redefinir senha",
    html,
    text: `Para redefinir sua senha, acesse: ${link}`,
  });
}

export default { sendVerificationEmail, sendPasswordResetEmail };
