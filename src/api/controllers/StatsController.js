import prisma from "../config/prisma.js";

export const getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true }
    });

    // 1. Basic counts
    const totalLeads = await prisma.lead.count({ where: { tenantId } });
    const totalAppointments = await prisma.appointment.count({ where: { tenantId } });
    const completedAppointments = await prisma.appointment.count({ 
      where: { tenantId, status: "COMPLETED" } 
    });
    
    const activeSdrs = await prisma.sdrBot.count({ where: { tenantId, active: true } });

    // 2. Qualified Leads Calculation (leads in stages that suggest qualification)
    const qualifiedLeads = await prisma.lead.count({
      where: {
        tenantId,
        stage: {
          name: {
            contains: "Qualificad",
            // Note: contains is case-sensitive in some DBs, but Prisma with SQLite/PG handles this differently.
            // We'll use a more robust way if possible, or just assume standard naming.
          }
        }
      }
    });

    // Alternatively, also count those already with appointments as qualified
    const leadsWithAppointments = await prisma.lead.count({
      where: {
        tenantId,
        appointments: { some: {} }
      }
    });

    const finalQualifiedCount = Math.max(qualifiedLeads, leadsWithAppointments, tenant.qualifiedLeadsCount || 0);

    // 3. Funnel data logic
    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId },
      include: { _count: { select: { leads: true } } },
      orderBy: { order: 'asc' }
    });

    const funnelData = stages.map(s => ({
      name: s.name,
      value: s._count.leads
    }));

    // 4. Performance Metrics
    const showRate = totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;
    const conversionRate = totalLeads > 0 ? ((finalQualifiedCount / totalLeads) * 100) : 0;

    // 5. Message counts
    const emailsSent = await prisma.message.count({ 
      where: { tenantId, messageType: "EMAIL" } 
    });
    const whatsappFollowups = await prisma.message.count({ 
      where: { tenantId, role: "assistant", messageType: "TEXT" } 
    });

    res.json({
      stats: {
        totalLeads,
        appointments: totalAppointments,
        completedAppointments,
        showRate,
        activeSdrs,
        usedTokens: tenant.usedTokens || 0,
        maxTokens: tenant.plan?.maxTokens || 1000,
        maxSdrs: tenant.plan?.maxSdrs || 1,
        usedMessages: tenant.usedMessages || 0,
        maxMessages: tenant.plan?.maxMessages || 1000,
        planName: tenant.plan?.name || "Básico",
        qualifiedLeadsCount: finalQualifiedCount,
        conversionRate,
        emailsSent,
        whatsappFollowups,
        trends: {
          leads: 0, 
          qualified: 0,
          appointments: 0,
          conversion: 0
        }
      },
      funnelData
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Painel de resultados da clínica — a prova de ROI que sustenta a renovação.
 * Métricas do período: consultas agendadas, conversas atendidas e tempo médio
 * de primeira resposta do agente. Aceita ?days=N (default 30).
 */
export const getResults = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [appointmentsScheduled, appointmentsCompleted, conversationsHandled, optOuts] = await Promise.all([
      prisma.appointment.count({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.appointment.count({ where: { tenantId, status: "COMPLETED", createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { tenantId, messages: { some: { createdAt: { gte: since } } } } }),
      prisma.lead.count({ where: { tenantId, optedOut: true } })
    ]);

    // Tempo médio de 1ª resposta: para cada conversa recente, diferença entre
    // a 1ª mensagem do lead (USER) e a 1ª resposta do agente (ASSISTANT).
    const conversations = await prisma.conversation.findMany({
      where: { tenantId, messages: { some: { createdAt: { gte: since } } } },
      select: {
        messages: {
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "asc" },
          select: { role: true, createdAt: true }
        }
      },
      take: 500
    });

    // Coleta o tempo (s) da 1ª resposta em cada conversa. Usamos a MEDIANA (e
    // ignoramos intervalos > 6h, que são atendimento humano/handoff, não a
    // resposta automática) para não distorcer com outliers.
    const MAX_REASONABLE_S = 6 * 60 * 60;
    const diffs = [];
    for (const conv of conversations) {
      const firstUser = conv.messages.find(m => m.role === "USER");
      if (!firstUser) continue;
      const firstReply = conv.messages.find(m => m.role === "ASSISTANT" && m.createdAt > firstUser.createdAt);
      if (!firstReply) continue;
      const sec = (new Date(firstReply.createdAt) - new Date(firstUser.createdAt)) / 1000;
      if (sec >= 0 && sec <= MAX_REASONABLE_S) diffs.push(sec);
    }
    let avgResponseSeconds = null;
    if (diffs.length) {
      diffs.sort((a, b) => a - b);
      const mid = Math.floor(diffs.length / 2);
      const median = diffs.length % 2 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;
      avgResponseSeconds = Math.round(median);
    }

    res.json({
      periodDays: days,
      appointmentsScheduled,
      appointmentsCompleted,
      conversationsHandled,
      avgResponseSeconds,
      optOuts
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
