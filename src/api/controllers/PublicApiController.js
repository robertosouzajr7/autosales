import prisma from "../config/prisma.js";
import { resolveContact, buildIdentifiers } from "../services/ContactIdentity.js";
import { pushContactAsync } from "../services/CrmSyncService.js";

/**
 * API pública de contatos (`/api/v1`), autenticada por chave de API.
 *
 * É por aqui que o CRM do cliente cadastra e atualiza contatos. Todo
 * cadastro passa pelo mesmo CDP das outras entradas — mandar o mesmo
 * contato dez vezes, com telefone escrito de dez jeitos, resulta em um
 * contato só.
 */

const MAX_LOTE = 200;

/** Formato de saída — estável, é contrato com o cliente. */
function apresentar(lead, identidades = []) {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone ? `+${lead.phone}` : null,
    status: lead.status,
    stageId: lead.stageId,
    source: lead.source,
    channel: lead.channel,
    notes: lead.notes,
    optedOut: lead.optedOut,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    identities: identidades.map((i) => ({ type: i.type, value: i.value })),
  };
}

async function comIdentidades(lead) {
  const ids = await prisma.contactIdentity.findMany({
    where: { leadId: lead.id },
    select: { type: true, value: true },
    orderBy: { createdAt: "asc" },
  });
  return apresentar(lead, ids);
}

/**
 * POST /api/v1/contacts — cria OU atualiza, sempre sem duplicar.
 * Responde 201 quando é contato novo e 200 quando já existia.
 */
export const upsertContact = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.email && !body.phone && !body.externalId && !body.crmId) {
      return res.status(400).json({
        error: "Informe pelo menos um identificador: email, phone, externalId ou crmId.",
      });
    }

    const { lead, criado, mesclados } = await resolveContact(req.tenantId, {
      name: body.name,
      email: body.email,
      phone: body.phone,
      document: body.document || body.cpf,
      channel: body.channel,
      externalId: body.externalId,
      crmProvider: body.crmProvider,
      crmId: body.crmId,
      notes: body.notes,
      status: body.status,
      source: body.source || "API",
      extraPhones: body.extraPhones,
      extraEmails: body.extraEmails,
      stageId: body.stageId,
    });

    // Campos que o cliente manda explicitamente sobrescrevem o que havia:
    // quem chamou a API sabe o que está fazendo.
    const patch = {};
    if (body.name && body.name !== lead.name) patch.name = String(body.name).trim();
    if (body.status && body.status !== lead.status) patch.status = body.status;
    if (body.notes !== undefined) patch.notes = body.notes || null;
    if (body.stageId && body.stageId !== lead.stageId) {
      const etapa = await prisma.pipelineStage.findFirst({ where: { id: body.stageId, tenantId: req.tenantId } });
      if (!etapa) return res.status(400).json({ error: "stageId não existe nesta conta." });
      patch.stageId = body.stageId;
    }
    const atualizado = Object.keys(patch).length
      ? await prisma.lead.update({ where: { id: lead.id }, data: patch })
      : lead;

    // Espelha no CRM só quando o dado veio de fora dele, para não ficar
    // devolvendo ao HubSpot o que o HubSpot acabou de mandar.
    if (!body.crmProvider) pushContactAsync(req.tenantId, atualizado.id, "API");

    const saida = await comIdentidades(atualizado);
    res.status(criado ? 201 : 200).json({ ...saida, created: criado, merged: mesclados });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** POST /api/v1/contacts/batch — até 200 por chamada. */
export const upsertBatch = async (req, res) => {
  try {
    const lista = req.body?.contacts;
    if (!Array.isArray(lista) || !lista.length) {
      return res.status(400).json({ error: "Envie um array em `contacts`." });
    }
    if (lista.length > MAX_LOTE) {
      return res.status(400).json({ error: `Máximo de ${MAX_LOTE} contatos por chamada.` });
    }

    const resultado = { criados: 0, atualizados: 0, mesclados: 0, ignorados: [], ids: [] };
    for (let i = 0; i < lista.length; i++) {
      const c = lista[i] || {};
      if (!c.email && !c.phone && !c.externalId && !c.crmId) {
        resultado.ignorados.push({ indice: i, motivo: "sem identificador" });
        continue;
      }
      try {
        const { lead, criado, mesclados } = await resolveContact(req.tenantId, {
          name: c.name, email: c.email, phone: c.phone, document: c.document || c.cpf,
          channel: c.channel, externalId: c.externalId,
          crmProvider: c.crmProvider, crmId: c.crmId,
          notes: c.notes, status: c.status, source: c.source || "API_BATCH",
        });
        criado ? resultado.criados++ : resultado.atualizados++;
        resultado.mesclados += mesclados;
        resultado.ids.push(lead.id);
      } catch (e) {
        resultado.ignorados.push({ indice: i, motivo: e.message });
      }
    }
    res.json({ success: true, ...resultado });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** GET /api/v1/contacts — lista paginada, com busca por identificador. */
export const listContacts = async (req, res) => {
  try {
    const take = Math.min(Number(req.query.limit) || 50, 200);
    const skip = Number(req.query.offset) || 0;

    // Busca por identificador usa a mesma normalização da gravação: quem
    // procura "(71) 98888-7777" acha o contato salvo como 5571988887777.
    let where = { tenantId: req.tenantId };
    const busca = req.query.email || req.query.phone || req.query.q;
    if (busca) {
      const chaves = buildIdentifiers({ email: req.query.email || busca, phone: req.query.phone || busca });
      const porIdentidade = chaves.length
        ? await prisma.contactIdentity.findMany({
            where: { tenantId: req.tenantId, OR: chaves.map((c) => ({ type: c.type, value: c.value })) },
            select: { leadId: true },
          })
        : [];
      const ids = [...new Set(porIdentidade.map((i) => i.leadId))];
      where = ids.length
        ? { tenantId: req.tenantId, id: { in: ids } }
        : { tenantId: req.tenantId, OR: [{ name: { contains: String(busca), mode: "insensitive" } }] };
    }
    if (req.query.updatedSince) {
      const desde = new Date(req.query.updatedSince);
      if (!isNaN(desde)) where.updatedAt = { gte: desde };
    }

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({ where, orderBy: { updatedAt: "desc" }, take, skip, include: { identities: true } }),
    ]);

    res.json({
      total, limit: take, offset: skip,
      contacts: leads.map((l) => apresentar(l, l.identities)),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** GET /api/v1/contacts/:id */
export const getContact = async (req, res) => {
  try {
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!lead) return res.status(404).json({ error: "Contato não encontrado." });
    res.json(await comIdentidades(lead));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** DELETE /api/v1/contacts/:id — respeita a LGPD: marca opt-out, não some com o histórico. */
export const optOutContact = async (req, res) => {
  try {
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!lead) return res.status(404).json({ error: "Contato não encontrado." });
    const atualizado = await prisma.lead.update({
      where: { id: lead.id },
      data: { optedOut: true, optOutAt: new Date() },
    });
    res.json(await comIdentidades(atualizado));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export default { upsertContact, upsertBatch, listContacts, getContact, optOutContact };
