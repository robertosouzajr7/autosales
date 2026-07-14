import prisma from "../config/prisma.js";
import { getVerticalTemplate } from "../services/VerticalTemplates.js";

/**
 * Gestão da base de conhecimento estruturada do negócio.
 * Vocabulário genérico servindo qualquer vertical (clínicas, salões,
 * academias, restaurantes, serviços). Tudo escopado por req.tenantId.
 */

// GET /api/business — retorna perfil + coleções.
export const getBusiness = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const [tenant, teamMembers, services, paymentMethods, businessHours, faqs] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          phone: true,
          businessType: true,
          businessAbout: true,
          businessAddress: true,
          businessPayment: true,
          businessExtraInfo: true,
          labelOverrides: true,
        },
      }),
      prisma.teamMember.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      prisma.service.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      prisma.paymentMethod.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      prisma.businessHour.findMany({ where: { tenantId }, orderBy: { weekday: "asc" } }),
      prisma.faq.findMany({ where: { tenantId }, orderBy: { order: "asc" } }),
    ]);
    res.json({ profile: tenant, teamMembers, services, paymentMethods, businessHours, faqs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// PUT /api/business/profile — dados livres do negócio.
export const updateProfile = async (req, res) => {
  const tenantId = req.tenantId;
  const {
    businessType,
    businessAbout,
    businessAddress,
    businessPayment,
    businessExtraInfo,
    labelOverrides,
  } = req.body;
  try {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        businessType,
        businessAbout,
        businessAddress,
        businessPayment,
        businessExtraInfo,
        labelOverrides: labelOverrides
          ? typeof labelOverrides === "string"
            ? labelOverrides
            : JSON.stringify(labelOverrides)
          : undefined,
      },
      select: {
        businessType: true,
        businessAbout: true,
        businessAddress: true,
        businessPayment: true,
        businessExtraInfo: true,
        labelOverrides: true,
      },
    });
    res.json(tenant);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// PUT /api/business/hours — substitui a grade dos 7 dias de uma vez.
export const updateBusinessHours = async (req, res) => {
  const tenantId = req.tenantId;
  const { hours } = req.body;
  if (!Array.isArray(hours)) return res.status(400).json({ error: "hours deve ser um array" });
  try {
    await prisma.$transaction(
      hours.map((h) =>
        prisma.businessHour.upsert({
          where: { tenantId_weekday: { tenantId, weekday: h.weekday } },
          update: {
            openTime: h.openTime || null,
            closeTime: h.closeTime || null,
            isClosed: !!h.isClosed,
          },
          create: {
            tenantId,
            weekday: h.weekday,
            openTime: h.openTime || null,
            closeTime: h.closeTime || null,
            isClosed: !!h.isClosed,
          },
        })
      )
    );
    const updated = await prisma.businessHour.findMany({
      where: { tenantId },
      orderBy: { weekday: "asc" },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// POST /api/business/apply-template — pré-carrega FAQs/serviços da vertical.
// Não sobrescreve nada que já exista; apenas insere itens quando as coleções
// estão vazias. Seguro para chamar múltiplas vezes.
export const applyTemplate = async (req, res) => {
  const tenantId = req.tenantId;
  const { businessType, overwrite } = req.body || {};
  if (!businessType) return res.status(400).json({ error: "businessType é obrigatório" });

  const template = getVerticalTemplate(businessType);
  if (!template) return res.status(400).json({ error: "Vertical não suportada" });

  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { businessType },
    });

    // Insere apenas se coleção estiver vazia (a não ser que overwrite=true).
    const [serviceCount, faqCount] = await Promise.all([
      prisma.service.count({ where: { tenantId } }),
      prisma.faq.count({ where: { tenantId } }),
    ]);

    if (overwrite || serviceCount === 0) {
      if (overwrite) await prisma.service.deleteMany({ where: { tenantId } });
      if (template.services?.length) {
        await prisma.service.createMany({
          data: template.services.map((s) => ({ ...s, tenantId })),
        });
      }
    }

    if (overwrite || faqCount === 0) {
      if (overwrite) await prisma.faq.deleteMany({ where: { tenantId } });
      if (template.faqs?.length) {
        await prisma.faq.createMany({
          data: template.faqs.map((f, i) => ({ ...f, order: i, tenantId })),
        });
      }
    }

    res.json({ success: true, applied: template.name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Fábrica de CRUD genérico escopado por tenant.
function crud(model, allowed) {
  const pick = (body) => {
    const out = {};
    for (const k of allowed) if (body[k] !== undefined) out[k] = body[k];
    return out;
  };
  return {
    create: async (req, res) => {
      try {
        const item = await prisma[model].create({
          data: { ...pick(req.body), tenantId: req.tenantId },
        });
        res.json(item);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
    update: async (req, res) => {
      try {
        const item = await prisma[model].update({
          where: { id: req.params.id, tenantId: req.tenantId },
          data: pick(req.body),
        });
        res.json(item);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
    remove: async (req, res) => {
      try {
        await prisma[model].delete({
          where: { id: req.params.id, tenantId: req.tenantId },
        });
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  };
}

export const teamMember = crud("teamMember", ["name", "role", "credentials", "bio", "active"]);
export const service = crud("service", [
  "name",
  "description",
  "durationMin",
  "price",
  "prep",
  "active",
]);
export const paymentMethod = crud("paymentMethod", ["name", "notes", "active"]);
export const faq = crud("faq", ["question", "answer", "order"]);
