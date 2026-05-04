import prisma from "../config/prisma.js";

export const getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

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
        usedProspects: tenant.usedProspects || 0,
        maxProspects: tenant.plan?.maxProspects || 100,
        usedResearch: tenant.usedResearch || 0,
        maxResearch: tenant.plan?.maxResearch || 20,
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
