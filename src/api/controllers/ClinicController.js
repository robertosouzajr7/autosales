import prisma from "../config/prisma.js";

/**
 * Gestão da base de conhecimento estruturada da clínica.
 * Tudo escopado por req.tenantId (deriva do JWT). É esse dado que alimenta
 * o agente de IA com informação verdadeira sobre a clínica.
 */

// GET /api/clinic — retorna o perfil + todas as coleções de uma vez.
export const getClinic = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const [tenant, professionals, services, insurances, businessHours, faqs] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { clinicAbout: true, clinicAddress: true, clinicPayment: true, clinicExtraInfo: true, name: true, phone: true }
      }),
      prisma.professional.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      prisma.clinicService.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      prisma.insuranceProvider.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      prisma.businessHour.findMany({ where: { tenantId }, orderBy: { weekday: "asc" } }),
      prisma.clinicFaq.findMany({ where: { tenantId }, orderBy: { order: "asc" } })
    ]);
    res.json({ profile: tenant, professionals, services, insurances, businessHours, faqs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// PUT /api/clinic/profile — dados livres da clínica.
export const updateProfile = async (req, res) => {
  const tenantId = req.tenantId;
  const { clinicAbout, clinicAddress, clinicPayment, clinicExtraInfo } = req.body;
  try {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { clinicAbout, clinicAddress, clinicPayment, clinicExtraInfo },
      select: { clinicAbout: true, clinicAddress: true, clinicPayment: true, clinicExtraInfo: true }
    });
    res.json(tenant);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// PUT /api/clinic/hours — substitui a grade de horários (7 dias) de uma vez.
export const updateBusinessHours = async (req, res) => {
  const tenantId = req.tenantId;
  const { hours } = req.body; // [{ weekday, openTime, closeTime, isClosed }]
  if (!Array.isArray(hours)) return res.status(400).json({ error: "hours deve ser um array" });
  try {
    await prisma.$transaction(
      hours.map(h => prisma.businessHour.upsert({
        where: { tenantId_weekday: { tenantId, weekday: h.weekday } },
        update: { openTime: h.openTime || null, closeTime: h.closeTime || null, isClosed: !!h.isClosed },
        create: { tenantId, weekday: h.weekday, openTime: h.openTime || null, closeTime: h.closeTime || null, isClosed: !!h.isClosed }
      }))
    );
    const updated = await prisma.businessHour.findMany({ where: { tenantId }, orderBy: { weekday: "asc" } });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── Fábrica de CRUD genérico escopado por tenant ──────────────────
function crud(model, allowed) {
  const pick = (body) => {
    const out = {};
    for (const k of allowed) if (body[k] !== undefined) out[k] = body[k];
    return out;
  };
  return {
    create: async (req, res) => {
      try {
        const item = await prisma[model].create({ data: { ...pick(req.body), tenantId: req.tenantId } });
        res.json(item);
      } catch (e) { res.status(500).json({ error: e.message }); }
    },
    update: async (req, res) => {
      try {
        // Escopo por tenant: só atualiza se o registro for do tenant.
        const item = await prisma[model].update({
          where: { id: req.params.id, tenantId: req.tenantId },
          data: pick(req.body)
        });
        res.json(item);
      } catch (e) { res.status(500).json({ error: e.message }); }
    },
    remove: async (req, res) => {
      try {
        await prisma[model].delete({ where: { id: req.params.id, tenantId: req.tenantId } });
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    }
  };
}

export const professional = crud("professional", ["name", "specialty", "registration", "bio", "active"]);
export const service = crud("clinicService", ["name", "description", "durationMin", "price", "prep", "active"]);
export const insurance = crud("insuranceProvider", ["name", "notes", "active"]);
export const faq = crud("clinicFaq", ["question", "answer", "order"]);
