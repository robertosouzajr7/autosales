import prisma from "../config/prisma.js";
import { WhatsAppManager } from "../../../whatsapp.js";
import nodemailer from "nodemailer";
import axios from "axios";

export const getCampaigns = async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId },
      include: { template: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(campaigns);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createCampaign = async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const { name, channel, message, scheduledAt, targetTagIds } = req.body;

    const template = await prisma.messageTemplate.create({
      data: { name: `Template ${name}`, content: message, tenantId }
    });

    const campaign = await prisma.campaign.create({
      data: {
        name,
        channel,
        templateId: template.id,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        targetTagIds: JSON.stringify(targetTagIds || []),
        tenantId,
        status: scheduledAt ? "SCHEDULED" : "DRAFT"
      }
    });

    res.json(campaign);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const sendCampaign = async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const { leadIds } = req.body;
    
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: { template: true }
    });
    if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

    const tenant = await prisma.tenant.findUnique({ 
      where: { id: tenantId },
      include: { plan: true }
    });
    const leads = await prisma.lead.findMany({ where: { id: { in: leadIds }, tenantId } });

    // 🛡️ VERIFICAÇÃO DE COTA (Limite por Plano)
    const maxMessages = tenant.plan?.maxMessages || 1000;
    const remainingQuota = maxMessages - tenant.monthlyMessagesCount;

    if (leads.length > remainingQuota) {
      return res.status(403).json({ 
        error: `Cota insuficiente. Seu plano permite ${maxMessages} envios/mês. Você já usou ${tenant.monthlyMessagesCount}.` 
      });
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "RUNNING" }
    });

    let sent = 0;
    let errors = 0;
    let transporter = null;

    if (campaign.channel === "EMAIL" && tenant.smtpHost) {
      transporter = nodemailer.createTransport({
        host: tenant.smtpHost,
        port: tenant.smtpPort,
        secure: tenant.smtpPort === 465,
        auth: {
          user: tenant.smtpUser,
          pass: tenant.smtpPass,
        },
      });
    }

    // Processamento assíncrono para não travar o request
    (async () => {
      // 🚀 MODALIDADE: LISTMONK (High Performance)
      if (campaign.channel === "EMAIL" && tenant.listmonkUrl && tenant.listmonkToken) {
        try {
          console.log(`[Bulk] Iniciando envio via Listmonk para campanha: ${campaign.name}`);
          const auth = {
            username: "api", // Listmonk default API user usually requires basic auth or specific token
            password: tenant.listmonkToken
          };
          
          // 1. Criar Campanha no Listmonk
          const campaignRes = await axios.post(`${tenant.listmonkUrl}/api/campaigns`, {
            name: campaign.name,
            subject: campaign.name,
            from_email: tenant.smtpFrom || tenant.smtpUser,
            lists: [parseInt(tenant.listmonkListId || "1")],
            content_type: "html",
            body: campaign.template.content,
            type: "regular"
          }, { auth });

          const listmonkId = campaignRes.data.data.id;

          // 2. Sincronizar Leads (Subscribers)
          for (const lead of leads) {
            if (!lead.email) continue;
            await axios.post(`${tenant.listmonkUrl}/api/subscribers`, {
              email: lead.email,
              name: lead.name,
              status: "enabled",
              lists: [parseInt(tenant.listmonkListId || "1")]
            }, { auth }).catch(() => {}); // Ignorar erro se já existe
          }

          // 3. Iniciar Campanha
          await axios.put(`${tenant.listmonkUrl}/api/campaigns/${listmonkId}/status`, {
            status: "running"
          }, { auth });

          sent = leads.length;
        } catch (err) {
          console.error("[Bulk] Erro Listmonk:", err.response?.data || err.message);
          errors = leads.length;
        }
      } 
      // 🐌 MODALIDADE: SMTP INDIVIDUAL (Fallback)
      else {
        for (const lead of leads) {
          try {
            const personalizedMessage = campaign.template.content
              .replace("[nome]", lead.name || "")
              .replace("[email]", lead.email || "")
              .replace("[empresa]", lead.company || "");

            if (campaign.channel === "WHATSAPP" && lead.phone) {
              const success = await WhatsAppManager.sendMessage(tenantId, lead.phone, personalizedMessage);
              if (success) sent++; else errors++;
            } else if (campaign.channel === "EMAIL" && lead.email && transporter) {
              await transporter.sendMail({
                from: tenant.smtpFrom || tenant.smtpUser,
                to: lead.email,
                subject: campaign.name,
                html: personalizedMessage
              });
              sent++;
            } else {
              errors++;
            }
          } catch (err) {
            console.error(`[Bulk] Erro ao enviar para ${lead.id}:`, err);
            errors++;
          }
          await new Promise(r => setTimeout(r, campaign.channel === "WHATSAPP" ? 15000 : 1000));
        }
      }

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { 
          status: "COMPLETED",
          sentCount: sent,
          errorCount: errors,
          deliveredCount: sent,
          readCount: 0
        }
      });

      // 📈 ATUALIZAR CONSUMO DO TENANT
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { 
          monthlyMessagesCount: { increment: sent }
        }
      });
    })();

    res.json({ success: true, message: "Campanha em processamento" });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const importCSV = async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    const { contacts } = req.body;
    const createdLeads = [];
    for (const c of contacts) {
      if (!c.phone && !c.email) continue;
      const lead = await prisma.lead.create({
        data: {
          name: c.name || "Contato CSV",
          phone: c.phone || null,
          email: c.email || null,
          source: "CSV_IMPORT",
          tenantId
        }
      });
      createdLeads.push(lead.id);
    }
    res.json({ success: true, count: createdLeads.length, leadIds: createdLeads });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
