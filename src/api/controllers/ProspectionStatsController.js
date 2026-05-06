import prisma from "../config/prisma.js";
import engine from "../../../automation_engine.js";

export const getProspectionStats = async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;

    // 1. Logs de prospecção (as últimas 50 buscas)
    const logs = await prisma.prospectionLog.findMany({
      where: { tenantId },
      include: { icp: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    // 2. Estatísticas Gerais
    const totalLeadsFound = await prisma.lead.count({
      where: { tenantId, source: "AUTO-HUNTER" }
    });

    const totalContacted = await prisma.lead.count({
      where: { 
        tenantId, 
        source: "AUTO-HUNTER",
        status: { in: ["PROSPECTING", "CONTACTED", "QUALIFIED"] }
      }
    });

    const enrichmentRate = await prisma.lead.count({
      where: {
        tenantId,
        source: "AUTO-HUNTER",
        extractedData: { not: "null" }
      }
    });

    // 3. Leads por ICP
    const leadsByIcp = await prisma.icpProfile.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            prospectionLogs: true
          }
        }
      }
    });

    // 4. Últimos leads encontrados
    const latestLeads = await prisma.lead.findMany({
      where: { tenantId, source: "AUTO-HUNTER" },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    res.json({
      logs,
      stats: {
        totalLeadsFound,
        totalContacted,
        enrichmentRate,
        contactRate: totalLeadsFound > 0 ? (totalContacted / totalLeadsFound) * 100 : 0
      },
      leadsByIcp,
      latestLeads
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const triggerManualHunt = async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] || req.tenantId;
    
    // Dispara a rotina em background para não travar a resposta
    engine.processAutoHunterRoutines(tenantId);
    
    res.json({ message: "🚀 Busca manual iniciada com sucesso. Os leads aparecerão em breve no feed." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
