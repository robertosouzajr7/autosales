import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "simulado" });

const PORT = process.env.PORT || 3000;

// 1. Endpoint para Listar Leads do Kanban
app.get("/api/leads", async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        conversations: {
          include: { messages: true }
        }
      }
    });
    res.json(leads);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar leads" });
  }
});

// 2. Simular recebimento de Mensagem no WhatsApp (Webhook)
app.post("/api/webhook/whatsapp", async (req, res) => {
  const { phone, name, content, source } = req.body;

  try {
    // 2.1 Encontrar ou Criar o Lead e Empresa
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({
        data: { name: "Minha Empresa SaaS", email: "admin@minhaempresa.com" }
      });
    }

    let lead = await prisma.lead.findFirst({ where: { phone, companyId: company.id } });
    if (!lead) {
      lead = await prisma.lead.create({
        data: { name, phone, source: source || "WhatsApp", companyId: company.id, status: "NEW" }
      });
    }

    // 2.2 Encontrar ou Criar Conversação
    let conversation = await prisma.conversation.findFirst({ where: { leadId: lead.id } });
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { leadId: lead.id } });
    }

    // 2.3 Salvar a mensagem do Lead
    await prisma.message.create({
      data: { conversationId: conversation.id, content, role: "user" }
    });

    // 2.4 Lógica do SDR - IA
    let aiResponseContent = "Olá! Como o nosso SDR AI não está com a KEY da OpenAI real configurada, estou retornando essa mensagem simulada. Que bom que você chamou!";
    
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "simulado") {
      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Você é um SDR amigável de vendas focado em conversão de serviços." },
          { role: "user", content }
        ]
      });
      aiResponseContent = gptResponse.choices[0].message.content || aiResponseContent;
    }

    // 2.5 Salvar a Resposta da IA
    if (conversation.botActive) {
      await prisma.message.create({
        data: { conversationId: conversation.id, content: aiResponseContent, role: "assistant" }
      });

      // Atualiza o Lead para Em Andamento
      if (lead.status === "NEW") {
        await prisma.lead.update({ where: { id: lead.id }, data: { status: "QUALIFYING" } });
      }

      // (Em produção, aqui você chamaria a Evolution API / Baileys para enviar o aiResponseContent para o WhatsApp da pessoa)
      console.log(`Mensagem AI enviada para ${phone}: ${aiResponseContent}`);
    }

    res.json({ success: true, ai_response: aiResponseContent });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Erro interno no webhook" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend Express AI rodando na porta ${PORT}`);
});
