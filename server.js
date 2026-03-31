import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from "googleapis";
import dotenv from "dotenv";
import { WhatsAppManager, whatsappSessions } from "./whatsapp.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

const PORT = process.env.PORT || 3000;

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

app.get("/api/settings", async (req, res) => {
  try {
    let company = await prisma.company.findFirst();
    res.json(company || {});
  } catch(err) {
    res.status(500).json({ error: "Erro ao buscar config" });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const { name, systemPrompt, openAiKey } = req.body;
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({ data: { name: name || "Minha Empresa", email: "admin@empresa.com" } });
    }
    company = await prisma.company.update({
      where: { id: company.id },
      data: { name, systemPrompt, openAiKey }
    });
    res.json(company);
  } catch(err) {
    res.status(500).json({ error: "Erro ao salvar config" });
  }
});

// --- Analytics Endpoint
app.get("/api/analytics", async (req, res) => {
  try {
    const totalLeads = await prisma.lead.count();
    const scheduled = await prisma.lead.count({ where: { status: "APPOINTMENT" } });
    const converted = await prisma.lead.count({ where: { status: "CONVERTED" } });
    const activeBots = await prisma.conversation.count({ where: { botActive: true } });
    
    res.json({ totalLeads, scheduled, converted, activeBots });
  } catch (err) {
    res.status(500).json({ error: "Erro analytics" });
  }
});

// --- Conversations Endpoint (Helpdesk)
app.get("/api/conversations", async (req, res) => {
  try {
    const convs = await prisma.conversation.findMany({
      include: {
        lead: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: { updatedAt: "desc" }
    });
    res.json(convs);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get("/api/conversations/:id/messages", async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: "asc" }
    });
    res.json(messages);
  } catch(e) { res.status(500).json({error: e.message}); }
});

// --- Human Handoff (Enviar msg manual do CRM para o WhatsApp)
app.post("/api/conversations/:id/send", async (req, res) => {
  try {
    const { content } = req.body;
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id }, include: { lead: true }
    });
    
    if (!conversation) return res.status(404).json({error: "Not found"});
    
    // Desativa o bot (Handoff manual) para a IA não atropelar o atendente!
    await prisma.conversation.update({
       where: { id: conversation.id },
       data: { botActive: false }
    });

    const newMessage = await prisma.message.create({
      data: { conversationId: conversation.id, content, role: "system", messageType: "TEXT" }
    });

    const sock = whatsappSessions.get(conversation.lead.companyId);
    if (sock) {
       await sock.sendMessage(conversation.lead.phone + "@s.whatsapp.net", { text: content });
    }

    res.json(newMessage);
  } catch(e) { res.status(500).json({error: e.message}); }
});

// Endpoint SSE (Server-Sent Events) para gerar e transmitir o QR Code do WhatsApp nativamente para o Dashboard
app.get("/api/whatsapp/qr", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const company = await prisma.company.findFirst();
  if (!company) {
    res.write("data: ERROR_NO_COMPANY\n\n");
    return res.end();
  }
  
  if (whatsappSessions.has(company.id)) {
     res.write("data: CONNECTED\n\n");
     return res.end();
  }

  const onQrCode = (qrStr) => {
     res.write(`data: ${qrStr}\n\n`);
  };

  try {
     await WhatsAppManager.createSession(company.id, onQrCode);
     req.on("close", () => {});
  } catch (err) {
     res.write("data: ERROR_INIT\n\n");
     res.end();
  }
});

// --- Google Calendar OAuth2 Endpoints
app.get("/api/google/auth", async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(400).send("Credenciais do Google ausentes no arquivo .env");
  }
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:3000/api/google/callback" 
  );

  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', 
    scope: scopes,
    prompt: 'consent'
  });
  
  res.redirect(url);
});

app.get("/api/google/callback", async (req, res) => {
  const { code } = req.query;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:3000/api/google/callback"
  );
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    let company = await prisma.company.findFirst();
    if (company && tokens.refresh_token) {
        await prisma.company.update({
            where: { id: company.id },
            data: { googleRefreshToken: tokens.refresh_token }
        });
    }
    res.redirect("http://localhost:8080/settings?gcal=success");
  } catch (e) {
    console.error("Erro no callback OAuth", e);
    res.redirect("http://localhost:8080/settings?gcal=error");
  }
});

app.post("/api/webhook/whatsapp", async (req, res) => {
  const { companyId, phone, name, content, source } = req.body;

  try {
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

    let conversation = await prisma.conversation.findFirst({ where: { leadId: lead.id } });
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { leadId: lead.id } });
    }

    await prisma.message.create({
      data: { conversationId: conversation.id, content, role: "user" }
    });

    let aiResponseContent = "Olá! Como o nosso SDR AI não está com a KEY atual configurada... Por favor, adicione a chave do Gemini em Configurações no Dash!";
    const useKey = company.openAiKey || process.env.GEMINI_API_KEY;
    
    if (useKey && useKey !== "simulado") {
      const genAI = new GoogleGenerativeAI(useKey);
      const systemPrompt = company.systemPrompt || "Você é um SDR amigável de vendas focado em conversão de serviços. Responda de forma concisa e muito humana.";
      
      const tools = [{
        functionDeclarations: [
          {
            name: "agendar_reuniao",
            description: "Altera o status do cliente atual no funil do CRM para 'Reunião Agendada'. Dispare IMEDIATAMENTE após o usuário aceitar agendar uma reunião, acessar o link da agenda ou se comprometer com um horário.",
            parameters: {
              type: "OBJECT",
              properties: { reason: { type: "STRING", description: "O motivo que levou ao agendamento" } },
              required: ["reason"]
            }
          },
          {
            name: "marcar_venda",
            description: "Altera o status do cliente atual no funil do CRM para 'Cliente Convertido'. Dispare quando o cliente fechar negócio, fizer o pagamento ou confirmar a contratação final.",
            parameters: {
              type: "OBJECT",
              properties: { reason: { type: "STRING" } },
              required: ["reason"]
            }
          }
        ]
      }];

      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt + "\nVocê tem ferramentas (Tools) para mover este lead no CRM. Use-as SEMPRE que o cliente atingir o objetivo.",
        tools: tools
      });
      
      const memory = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "asc" },
        take: 15
      });

      const contents = memory.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

      try {
        const result = await model.generateContent({ contents });
        const calls = typeof result.response.functionCalls === 'function' ? result.response.functionCalls() : null;
        const call = calls && calls[0];
        
        if (call) {
           console.log(`[Function Calling] ⚡ Gemini acionou a skill: ${call.name}`);
           let novoStatus = lead.status;
           
           if (call.name === "agendar_reuniao") novoStatus = "APPOINTMENT";
           if (call.name === "marcar_venda") novoStatus = "CONVERTED";
           
           if (novoStatus !== lead.status) {
              await prisma.lead.update({ where: { id: lead.id }, data: { status: novoStatus } });
              lead.status = novoStatus; // local update so it doesn't trigger QUALIFYING later
              console.log(`✅ Lead movido com sucesso no Kanban para: ${novoStatus}`);
           }
           
           // Retorna o resultado para o gemini para ele enviar a mensagem final de confirmação
           const functionCallPart = result.response.candidates[0].content;
           contents.push(functionCallPart);
           contents.push({
             role: "user",
             parts: [{ functionResponse: { name: call.name, response: { success: true, status_atualizado: novoStatus } } }]
           });
           
           const secondResult = await model.generateContent({ contents });
           aiResponseContent = secondResult.response.text();
        } else {
           aiResponseContent = result.response.text() || aiResponseContent;
        }
      } catch(e) {
         console.error("Gemini erro:", e);
         aiResponseContent = "Tive um probleminha de conexão com a minha memória (Gemini Key Incorreta ou Sem Saldo).";
      }
    }

    if (conversation.botActive) {
      await prisma.message.create({
        data: { conversationId: conversation.id, content: aiResponseContent, role: "assistant" }
      });

      if (lead.status === "NEW") {
        await prisma.lead.update({ where: { id: lead.id }, data: { status: "QUALIFYING" } });
      }
      console.log(`Mensagem AI enviada para ${phone}: ${aiResponseContent}`);
    }

    res.json({ success: true, ai_response: aiResponseContent });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Erro interno no webhook" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend SaaS rodando na porta ${PORT}`);
  // Inicia todas as contas das empresas automaticamente do banco de instâncias
  WhatsAppManager.bootExistingSessions().catch(err => console.error("Erro no boot do SaaS:", err));
});
