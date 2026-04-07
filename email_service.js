import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const prisma = new PrismaClient();

export class EmailService {
  static transporter = null;

  /**
   * Obtém ou cria o transportador SMTP
   */
  static async getTransporter() {
    if (this.transporter) return this.transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      console.log(`[EmailService] ✅ Conectado ao SMTP: ${process.env.SMTP_HOST}`);
    } else {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      console.log(`[EmailService] 🧪 Usando Ethereal: ${testAccount.user}`);
    }
    return this.transporter;
  }

  /**
   * Envia um e-mail de prospecção redigido pela IA
   */
  static async sendProspectingEmail(lead, tenantId) {
    try {
      if (!lead.email) {
        console.warn(`[EmailService] ⚠️ Ignorando prospecção para ${lead.name}: Sem e-mail cadastrado.`);
        return null;
      }

      // Buscar configurações de IA e SDR do Tenant
      const [tenant, sdr] = await Promise.all([
        prisma.tenant.findUnique({ where: { id: tenantId } }),
        prisma.sdrBot.findFirst({ where: { tenantId, active: true } })
      ]);

      if (!sdr) {
        console.warn(`[EmailService] ⚠️ Nenhum SDR ativo para o tenant ${tenantId}.`);
        return null;
      }

      const apiKey = tenant?.aiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Chave de IA não configurada para prospecção.");

      // Redigir e-mail personalizado com Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        Você é um SDR de elite da empresa "${tenant.name}".
        Seu objetivo é redigir um e-mail de abordagem inicial (Cold Mail) para o lead abaixo.
        
        INFORMAÇÕES:
        - Lead: ${lead.name}
        - Empresa: ${lead.company || 'Geral'}
        - Objetivo do SDR: ${sdr.goal || 'Agendar uma reunião de apresentação'}
        - Estilo: Profissional, conciso, focado em ajudar e gerar curiosidade.
        
        REGRAS:
        - O e-mail deve ter um ASSUNTO magnético e curto
        - O corpo deve ser curto (máximo 3 parágrafos)
        - Use o nome do lead para personalizar
        - Não pareça um robô de spam
        - Responda apenas com o JSON abaixo:
        { "subject": "Assunto aqui", "body": "Corpo do e-mail em HTML (use <p>, <br>, etc)" }
      `;

      const result = await model.generateContent(prompt);
      const response = result.response.text();
      const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const { subject, body } = JSON.parse(cleaned);

      // Enviar e-mail
      const transport = await this.getTransporter();
      const info = await transport.sendMail({
        from: `"${tenant.name} | SDR AI" <${process.env.SMTP_FROM || 'prospeccao@autosales.ai'}>`,
        to: lead.email,
        subject,
        html: body
      });

      // Registrar no histórico da conversa
      await prisma.message.create({
        data: {
          content: `📧 [EMAIL ENVIADO]\nAssunto: ${subject}\n\n${body.replace(/<[^>]*>?/gm, '')}`,
          role: 'ASSISTANT',
          source: 'EMAIL',
          tenantId,
          conversation: {
            connectOrCreate: {
              where: { leadId: lead.id },
              create: { leadId: lead.id, tenantId }
            }
          }
        }
      });

      console.log(`[EmailService] ✅ Email enviado para ${lead.email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('[EmailService] ❌ Falha no envio:', error);
      return { success: false, error: error.message };
    }
  }
}
