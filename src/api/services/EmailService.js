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
 *   SMTP_FROM      (remetente, ex.: "Agentes Virtuais <no-reply@seu-dominio.com>")
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

async function send({ to, subject, html, text, icalEvent }) {
  // Padrão seguro: se SMTP_FROM não estiver setado, usa o próprio SMTP_USER
  // (evita rejeição por "sender not owned" em provedores como Hostinger).
  const from =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "Agentes Virtuais <no-reply@agentesvirtuais.local>";
  const t = transporter();
  if (!t) {
    console.log(
      `[EmailService] (SMTP não configurado) enviando SIMULADO -> ${to}\n  Subject: ${subject}\n  Text: ${text || html?.replace(/<[^>]+>/g, "").slice(0, 200)}`
    );
    return { simulated: true };
  }
  try {
    const info = await t.sendMail({ from, to, subject, text, html, ...(icalEvent ? { icalEvent } : {}) });
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

export async function sendTrialReminder({ to, name, daysLeft, planName }) {
  const link = `${publicUrl()}/assinatura`;
  const last = daysLeft <= 0;
  const heading = last
    ? "Seu teste grátis termina hoje ⏰"
    : `Faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} do seu teste grátis`;
  const lead = last
    ? "Este é o último dia do seu período de teste. Para o seu agente continuar atendendo, vendendo e agendando sem interrupção, ative sua assinatura agora."
    : `Seu período de teste${planName ? ` do plano ${planName}` : ""} está chegando ao fim. Ative sua assinatura para não perder o acesso ao seu agente de IA.`;

  const html = wrap(`
    <h2 style="margin:0 0 12px;font-size:20px;">${heading}</h2>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">
      ${name ? `Oi, ${name.split(" ")[0]}. ` : ""}${lead}
    </p>
    <p style="margin:0 0 24px;">
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;text-decoration:none;border-radius:12px;font-weight:600;">
        Ativar assinatura
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#64748b;">
      Você mantém tudo o que já configurou. Sem fidelidade — cancele quando quiser.
    </p>
  `);
  return send({
    to,
    subject: heading,
    html,
    text: `${heading}. Ative sua assinatura: ${link}`,
  });
}

/**
 * Link da reunião pouco antes do horário. Vai em paralelo ao WhatsApp: quem
 * está no computador costuma abrir a call pelo e-mail.
 */
export async function sendMeetingLinkEmail({ to, name, link, when, minutes = 10 }) {
  const heading = `Sua reunião começa em ${minutes} minutos`;
  const html = wrap(`
    <h2 style="margin:0 0 12px;font-size:20px;">${heading}</h2>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">
      ${name ? `Oi, ${name.split(" ")[0]}. ` : ""}Seu compromisso${when ? ` de <strong>${when}</strong>` : ""} está chegando.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;text-decoration:none;border-radius:12px;font-weight:600;">
        Entrar na reunião
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#64748b;word-break:break-all;">
      Ou copie este link: ${link}
    </p>
  `);
  return send({ to, subject: heading, html, text: `${heading}${when ? ` (${when})` : ""}. Entre por aqui: ${link}` });
}

/**
 * Convite de agendamento, com o anexo que o calendário entende.
 *
 * O Google já convida quem tem e-mail no evento, mas só quando o negócio
 * conectou a agenda — e boa parte não conectou. Sem isto, o cliente marcava
 * horário e não recebia nada no e-mail: ficava só a mensagem no WhatsApp, que
 * some no meio da conversa. O `.ics` é o que faz o compromisso entrar na
 * agenda do celular dele com um toque.
 */
export async function sendAppointmentInvite({ to, name, negocio, titulo, inicio, fim, link, uid, endereco }) {
  const quando = inicio.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short",
  });
  const remetente = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@agentesvirtuais.local";
  const emailDoRemetente = (remetente.match(/<([^>]+)>/) || [null, remetente])[1];

  const ics = montarIcs({
    uid, titulo, inicio, fim, link, endereco,
    organizadorNome: negocio || "Agentes Virtuais",
    organizadorEmail: emailDoRemetente,
    convidadoNome: name,
    convidadoEmail: to,
  });

  const html = wrap(`
    <h2 style="margin:0 0 12px;font-size:20px;">Agendamento confirmado</h2>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">
      ${name ? `Oi, ${escaparHtml(name.split(" ")[0])}. ` : ""}Seu horário${negocio ? ` com <strong>${escaparHtml(negocio)}</strong>` : ""} está marcado.
    </p>
    <table style="width:100%;font-size:15px;line-height:1.6;margin:0 0 24px;">
      <tr><td style="color:#64748b;padding:2px 0;">Quando</td><td style="font-weight:600;">${escaparHtml(quando)}</td></tr>
      <tr><td style="color:#64748b;padding:2px 0;">O quê</td><td style="font-weight:600;">${escaparHtml(titulo)}</td></tr>
      ${endereco ? `<tr><td style="color:#64748b;padding:2px 0;">Onde</td><td style="font-weight:600;">${escaparHtml(endereco)}</td></tr>` : ""}
    </table>
    ${link ? `<p style="margin:0 0 24px;">
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;text-decoration:none;border-radius:12px;font-weight:600;">
        Entrar na reunião
      </a>
    </p>` : ""}
    <p style="margin:0;font-size:13px;color:#64748b;">
      O convite em anexo adiciona o compromisso à sua agenda.
    </p>
  `);

  return send({
    to,
    subject: `Agendamento confirmado — ${quando}`,
    html,
    text: `Agendamento confirmado.
${titulo}
${quando}${link ? `
Link: ${link}` : ""}`,
    icalEvent: { filename: "convite.ics", method: "REQUEST", content: ics },
  });
}

function escaparHtml(texto) {
  return String(texto || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/** Data no formato do iCalendar: sempre UTC, sem separadores. */
function carimbo(data) {
  return new Date(data).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Vírgula, ponto-e-vírgula e quebra de linha têm significado no .ics. */
function escaparIcs(texto) {
  return String(texto || "").replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

export function montarIcs({ uid, titulo, inicio, fim, link, endereco, organizadorNome, organizadorEmail, convidadoNome, convidadoEmail }) {
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Agentes Virtuais//Agendamento//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}@agentesvirtuais`,
    `DTSTAMP:${carimbo(new Date())}`,
    `DTSTART:${carimbo(inicio)}`,
    `DTEND:${carimbo(fim)}`,
    `SUMMARY:${escaparIcs(titulo)}`,
    `DESCRIPTION:${escaparIcs(link ? `Link da reunião: ${link}` : "Agendado via Agentes Virtuais.")}`,
    `LOCATION:${escaparIcs(link || endereco || "")}`,
    `ORGANIZER;CN=${escaparIcs(organizadorNome)}:mailto:${organizadorEmail}`,
    `ATTENDEE;CN=${escaparIcs(convidadoNome || convidadoEmail)};RSVP=TRUE:mailto:${convidadoEmail}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // CRLF é exigência do formato; com \n puro alguns clientes ignoram o anexo.
  return linhas.join("\r\n");
}

export default {
  sendVerificationEmail, sendPasswordResetEmail, sendTrialReminder,
  sendMeetingLinkEmail, sendAppointmentInvite, montarIcs,
};
