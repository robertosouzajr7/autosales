import prisma from "../config/prisma.js";

export const getAnalytics = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || req.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Tenant ID missing" });

  try {
    const leads = await prisma.lead.count({ where: { tenantId } });
    const convertedLeads = await prisma.lead.count({ where: { tenantId, status: "WON" } });
    
    // Simulate complex metrics
    const funnelData = [
      { name: "Visitantes", value: leads * 3 || 100 },
      { name: "Leads Capturados", value: leads || 0 },
      { name: "Qualificados (SDR)", value: Math.floor(leads * 0.4) || 0 },
      { name: "Reuniões Agendadas", value: Math.floor(leads * 0.2) || 0 },
      { name: "Vendas Fechadas", value: convertedLeads || 0 }
    ];

    const conversionRate = leads > 0 ? ((convertedLeads / leads) * 100).toFixed(1) : 0;

    res.json({
      funnelData,
      metrics: {
        totalLeads: leads,
        converted: convertedLeads,
        conversionRate,
        roi: "150%" // Mock value for now
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
