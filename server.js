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

app.put("/api/leads/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json(lead);
  } catch(e) {
    res.status(500).json({error: e.message});
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

// --- Dashboard Endpoint (Home)
app.get("/api/dashboard", async (req, res) => {
  try {
     const totalLeads = await prisma.lead.count();
     const activeBots = await prisma.conversation.count({ where: { botActive: true } });
     
     const hoje = new Date(); hoje.setHours(0,0,0,0);
     const agendamentosHoje = await prisma.lead.count({ where: { status: "APPOINTMENT", updatedAt: { gte: hoje } } });
     
     const convertidos = await prisma.lead.count({ where: { status: "CONVERTED" } });
     const taxa = totalLeads ? Math.round((convertidos / totalLeads) * 100) : 0;
     
     const rConv = await prisma.conversation.findMany({
        include: { lead: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: { updatedAt: "desc" }, take: 5
     });
     
     const recentConversations = rConv.map((c, index) => ({
        id: c.id || index,
        name: c.lead.name, 
        initials: c.lead.name.substring(0,2).toUpperCase(),
        lastMessage: c.messages[0]?.content || "Sessão Iniciada",
        time: new Date(c.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        status: c.botActive ? "Ativo" : "Aguardando"
     }));
     
     res.json({
        stats: { totalLeads, activeBots, agendamentosHoje, taxa, convertidos },
        recentConversations
     });
  } catch(e) { res.status(500).json({ error: e.message }); }
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

app.get("/api/calendar/events", async (req, res) => {
  try {
     let company = await prisma.company.findFirst();
     if (!company || !company.googleRefreshToken) return res.json([]);
     
     const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
     oauth2Client.setCredentials({ refresh_token: company.googleRefreshToken });
     const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
     
     const timeMin = new Date(); timeMin.setDate(timeMin.getDate() - 7);
     const timeMax = new Date(); timeMax.setDate(timeMax.getDate() + 30);
     
     const response = await calendar.events.list({
         calendarId: 'primary',
         timeMin: timeMin.toISOString(),
         timeMax: timeMax.toISOString(),
         singleEvents: true,
         orderBy: 'startTime'
     });

     const formattedEvents = response.data.items.map(e => {
        const start = new Date(e.start.dateTime || e.start.date);
        const end = new Date(e.end.dateTime || e.end.date);
        const diffMins = Math.round((end.getTime() - start.getTime()) / 60000);
        return {
           id: e.id,
           client: e.summary || "Reunião SDR",
           type: "Reunião",
           status: "Confirmado",
           date: start.toISOString().split("T")[0],
           startHour: start.getHours(),
           startMinute: start.getMinutes() >= 30 ? 30 : 0,
           durationSlots: Math.max(1, Math.round(diffMins / 30))
        };
     });
     res.json(formattedEvents);
  } catch(e) { res.status(500).json({error: e.message}); }
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
      const getGoogleCalendar = async () => {
         if (!company.googleRefreshToken) return null;
         const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
         oauth2Client.setCredentials({ refresh_token: company.googleRefreshToken });
         return google.calendar({ version: 'v3', auth: oauth2Client });
      };

      const genAI = new GoogleGenerativeAI(useKey);
      const systemPrompt = company.systemPrompt || "Você é um SDR amigável de vendas focado em conversão de serviços. Responda de forma concisa e muito humana. Nunca agende fora do horário comercial.";
      
      const tools = [{
        functionDeclarations: [
          {
            name: "agendar_reuniao_offline",
            description: "Altera o status do lead para 'Reunião Agendada' caso a empresa nâo tenha calendário do Google habilitado. Confirme isso antes.",
            parameters: { type: "OBJECT", properties: { reason: { type: "STRING" } }, required: ["reason"] }
          },
          {
            name: "marcar_venda",
            description: "Altera o status do cliente atual no funil do CRM para 'Cliente Convertido'. Dispare quando fechar.",
            parameters: { type: "OBJECT", properties: { reason: { type: "STRING" } }, required: ["reason"] }
          },
          {
            name: "consultar_horarios_livres",
            description: "Consulta o Google Calendar da agência em tempo real e retorna os intervalos de horários ocupados dos próximos 5 dias. Use-o quando o cliente demonstrar interesse na reunião para sugerir de forma precisa os buracos vazios da agenda. Assuma 9h às 18h como jornada de trabalho, ignorando fins de semana.",
            parameters: { type: "OBJECT", properties: {} }
          },
          {
            name: "criar_evento_google",
            description: "Chame esta função APÓS você e o cliente concordarem com um horário exato. Essa skill insere a reunião diretamente no Google Calendar oficial e move o Kanban.",
            parameters: {
              type: "OBJECT",
              properties: { 
                dateTimeStart: { type: "STRING", description: "Data e hora de inicio em ISO (ex: 2026-10-25T14:00:00-03:00)" },
                dateTimeEnd:   { type: "STRING", description: "Data e hora de termino em ISO (ex: 2026-10-25T15:00:00-03:00)" },
                summary:       { type: "STRING", description: "Título do evento, use o nome do cliente" }
              },
              required: ["dateTimeStart", "dateTimeEnd", "summary"]
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
           let functionResponsePayload = null;
           
           if (call.name === "agendar_reuniao_offline") {
               novoStatus = "APPOINTMENT";
               functionResponsePayload = { success: true };
           }
           if (call.name === "marcar_venda") {
               novoStatus = "CONVERTED";
               functionResponsePayload = { success: true };
           }
           
           if (call.name === "consultar_horarios_livres") {
               const calendar = await getGoogleCalendar();
               if (!calendar) {
                   functionResponsePayload = { success: false, error: "Serviço indisponível (O dono da conta não vinculou o Google no SaaS). Invente horários genéricos ou peça para acessar amanhã." };
               } else {
                   try {
                       const timeMin = new Date();
                       const timeMax = new Date(); timeMax.setDate(timeMax.getDate() + 5);
                       const resCal = await calendar.freebusy.query({
                           requestBody: { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: 'primary' }] }
                       });
                       functionResponsePayload = { success: true, hoje: new Date().toISOString(), ocupados: resCal.data.calendars.primary.busy, regra: "Sugerir sempre os slots vazios em horário comercial util." };
                   } catch(err) { functionResponsePayload = { success: false, error: err.message }; }
               }
           }
           
           if (call.name === "criar_evento_google") {
               const calendar = await getGoogleCalendar();
               if (!calendar) {
                   functionResponsePayload = { success: false, error: "Calendario nao vinculado." };
               } else {
                   try {
                       await calendar.events.insert({
                           calendarId: 'primary',
                           requestBody: {
                               summary: call.args.summary || `Agendamento - ${lead.name}`,
                               description: `Reunião automática via AI SaaS.\nTelefone do lead: ${lead.phone}`,
                               start: { dateTime: call.args.dateTimeStart },
                               end: { dateTime: call.args.dateTimeEnd }
                           }
                       });
                       functionResponsePayload = { success: true };
                       novoStatus = "APPOINTMENT";
                   } catch(err) { functionResponsePayload = { success: false, error: err.message }; }
               }
           }
           
           if (novoStatus !== lead.status) {
              await prisma.lead.update({ where: { id: lead.id }, data: { status: novoStatus } });
              lead.status = novoStatus;
              console.log(`✅ Lead movido com sucesso no Kanban para: ${novoStatus}`);
           }
           
           const functionCallPart = result.response.candidates[0].content;
           contents.push(functionCallPart);
           contents.push({
             role: "user",
             parts: [{ functionResponse: { name: call.name, response: functionResponsePayload } }]
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
