import prisma from "../config/prisma.js";

/**
 * Identidade do contato por canal.
 *
 * O campo `phone` era usado como chave de identidade de TODOS os canais, e por
 * isso acabava recebendo IGSID do Instagram, id de visitante do site e LID do
 * WhatsApp — nada disso é telefone. Aqui separamos:
 *
 *   phone      → só número de telefone de verdade, normalizado
 *   externalId → identificador cru do canal (IGSID, visitorId, LID)
 *   igUsername → @usuario do Instagram
 *   email      → e-mail, quando o canal fornece
 */

// Telefone brasileiro tem 10–11 dígitos + DDI; internacionais chegam a 15
// (limite do E.164). Fora dessa faixa não é telefone.
const MIN_DIGITOS = 10;
const MAX_DIGITOS = 15;

/**
 * Devolve o telefone em dígitos puros, ou null se não parecer telefone.
 * Rejeita explicitamente o que aparecia por engano no campo: texto com letras,
 * ids longos do Instagram e strings vazias.
 */
export function normalizePhone(valor) {
  if (valor === null || valor === undefined) return null;
  const bruto = String(valor).trim();
  if (!bruto) return null;

  // Primeiro descarta o domínio do JID ("5571…@s.whatsapp.net") e o sufixo de
  // dispositivo ("…:12@…"). Só depois vale checar letras — na ordem inversa,
  // o próprio "s.whatsapp.net" reprovava telefones válidos.
  const local = bruto.split("@")[0].split(":")[0];

  // Letra na parte do identificador descarta: nome nunca é telefone.
  if (/[a-zA-Z]/.test(local)) return null;

  const digitos = local.replace(/\D/g, "");
  if (digitos.length < MIN_DIGITOS || digitos.length > MAX_DIGITOS) return null;

  // Sequência repetida (000000000000) é lixo, não telefone.
  if (/^(\d)\1+$/.test(digitos)) return null;

  return digitos;
}

/** É um JID de LID? Nesse formato o número NÃO é o telefone do contato. */
export function isLidJid(jid) {
  return typeof jid === "string" && jid.includes("@lid");
}

/**
 * Monta os campos de identidade a partir do que o canal entregou.
 * @param channel WHATSAPP | INSTAGRAM | SITE
 * @param rawId identificador cru do remetente no canal
 */
export function buildIdentity(channel, rawId, { name, email, igUsername } = {}) {
  const canal = (channel || "WHATSAPP").toUpperCase();
  const externalId = rawId ? String(rawId).trim() || null : null;

  // Só o WhatsApp entrega telefone no identificador. Instagram manda IGSID e
  // o site manda id de visitante — tratar como telefone é o que sujava a base.
  const phone = canal === "WHATSAPP" ? normalizePhone(rawId) : null;

  return {
    channel: canal,
    externalId,
    phone,
    email: email || null,
    igUsername: canal === "INSTAGRAM" ? igUsername || null : null,
    // Nunca usa o identificador como nome: era daí que vinha "nome" numérico.
    name: name && String(name).trim() ? String(name).trim() : rotuloPadrao(canal),
  };
}

function rotuloPadrao(canal) {
  if (canal === "INSTAGRAM") return "Contato do Instagram";
  if (canal === "SITE") return "Visitante do site";
  return "Contato do WhatsApp";
}

/**
 * Acha o lead do contato ou cria. A busca é por canal + identificador, que é
 * estável; telefone e e-mail entram como reforço, não como chave única.
 */
export async function findOrCreateLead(tenantId, identity, extras = {}) {
  const { channel, externalId, phone, email } = identity;

  let lead = null;
  if (externalId) {
    lead = await prisma.lead.findFirst({ where: { tenantId, channel, externalId } });
  }
  // Contato antigo, salvo antes de existir externalId: casa pelo telefone.
  if (!lead && phone) {
    lead = await prisma.lead.findFirst({ where: { tenantId, phone } });
  }
  if (!lead && email) {
    lead = await prisma.lead.findFirst({ where: { tenantId, email } });
  }

  if (lead) {
    // Completa o que faltava sem sobrescrever dado bom já existente.
    const patch = {};
    if (!lead.externalId && externalId) patch.externalId = externalId;
    if (!lead.phone && phone) patch.phone = phone;
    if (!lead.email && email) patch.email = email;
    if (!lead.igUsername && identity.igUsername) patch.igUsername = identity.igUsername;
    if (identity.name && ehNomeGenerico(lead.name)) patch.name = identity.name;
    if (extras.waAccountId && !lead.waAccountId) patch.waAccountId = extras.waAccountId;

    if (Object.keys(patch).length) {
      lead = await prisma.lead.update({ where: { id: lead.id }, data: patch });
    }
    return { lead, criado: false };
  }

  lead = await prisma.lead.create({
    data: {
      tenantId,
      name: identity.name,
      phone,
      email,
      channel,
      externalId,
      igUsername: identity.igUsername,
      source: extras.source || channel,
      waAccountId: extras.waAccountId || null,
      status: "NEW",
      stageId: extras.stageId || null,
      consentAt: new Date(),
    },
  });
  return { lead, criado: true };
}

// Nome que veio de rótulo automático pode ser substituído pelo nome real.
function ehNomeGenerico(nome) {
  if (!nome) return true;
  const n = String(nome).trim();
  if (/^\d+$/.test(n)) return true; // era o identificador virando nome
  return [
    "Contato do WhatsApp", "Contato do Instagram", "Visitante do site",
    "Lead (Meta)", "Lead (Instagram)", "Visitante Web", "Novo Lead", "Sem nome",
  ].includes(n);
}

/** Rótulo de contato para exibir, conforme o canal. */
export function contactHandle(lead) {
  if (!lead) return "";
  if (lead.channel === "INSTAGRAM") return lead.igUsername ? `@${lead.igUsername}` : "Instagram";
  if (lead.channel === "SITE") return lead.email || "Site";
  return lead.phone || "";
}

export default { normalizePhone, isLidJid, buildIdentity, findOrCreateLead, contactHandle };
