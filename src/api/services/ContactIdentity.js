import prisma from "../config/prisma.js";

/**
 * Identidade única do contato (CDP).
 *
 * O problema: a mesma pessoa chegava por vários caminhos — WhatsApp,
 * Instagram, formulário do site, importação de CSV, CRM — e cada caminho
 * criava um contato novo. `Lead.phone` era a única chave, e ela falhava em
 * três frentes: o telefone chega formatado de mil jeitos ("(71) 98888-7777"
 * vs "5571988887777"), nem todo canal tem telefone, e quem tem e-mail mas
 * não tem telefone escapava da unicidade.
 *
 * A solução é o modelo clássico de CDP: um contato tem VÁRIOS
 * identificadores (telefone, e-mail, IGSID, id do CRM…), cada um
 * normalizado e único por conta. Quando um evento chega com um conjunto de
 * identificadores que já apontam para contatos diferentes, isso significa
 * que eram duplicatas — e os contatos são fundidos, não multiplicados.
 */

// Telefone brasileiro tem 10–11 dígitos + DDI; internacionais chegam a 15
// (limite do E.164). Fora dessa faixa não é telefone.
const MIN_DIGITOS = 10;
const MAX_DIGITOS = 15;

export const IDENTITY_TYPES = {
  PHONE: "PHONE",
  EMAIL: "EMAIL",
  WHATSAPP: "WHATSAPP",
  INSTAGRAM: "INSTAGRAM",
  SITE: "SITE",
  CPF: "CPF",
  CRM: "CRM",
  EXTERNAL: "EXTERNAL",
};

/**
 * Telefone em forma canônica (E.164 sem o "+"), ou null se não for telefone.
 *
 * Só normalizar "tirar o que não é dígito" não resolvia: o MESMO celular
 * aparece como 11 dígitos (DDD+9+número), 12 (55+DDD+8, sem o nono dígito)
 * e 13 (55+DDD+9+número). Aqui tudo converge para 13 dígitos no Brasil.
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

  let digitos = local.replace(/\D/g, "");
  if (digitos.length < MIN_DIGITOS || digitos.length > MAX_DIGITOS) return null;

  // Sequência repetida (000000000000) é lixo, não telefone.
  if (/^(\d)\1+$/.test(digitos)) return null;

  digitos = canonicalizarBrasil(digitos);
  return digitos;
}

/**
 * Converge as variações brasileiras para 55 + DDD + 9 dígitos.
 * Números de outros países passam intactos — mexer neles sem saber o plano
 * de numeração local faria mais estrago do que deduplicação.
 */
function canonicalizarBrasil(digitos) {
  // 10 ou 11 dígitos sem DDI: assume Brasil (é o público do produto).
  if (digitos.length === 10 || digitos.length === 11) {
    digitos = `55${digitos}`;
  }
  if (!digitos.startsWith("55")) return digitos;

  const resto = digitos.slice(2);
  const ddd = resto.slice(0, 2);
  let numero = resto.slice(2);

  // Celular antigo, sem o nono dígito: 8 dígitos começando em 6–9.
  if (numero.length === 8 && /^[6-9]/.test(numero)) numero = `9${numero}`;

  // Só valida o formato brasileiro completo; qualquer outro tamanho volta
  // como veio, para não corromper um número estrangeiro que comece com 55.
  if (ddd.length === 2 && (numero.length === 8 || numero.length === 9)) {
    return `55${ddd}${numero}`;
  }
  return digitos;
}

/** E-mail comparável: sem espaços e sem diferença de caixa. */
export function normalizeEmail(valor) {
  if (!valor) return null;
  const limpo = String(valor).trim().toLowerCase();
  // Validação mínima: sem isso, "não informado" virava identidade única.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) return null;
  return limpo;
}

/** Só os dígitos do CPF, quando tem cara de CPF. */
export function normalizeDocument(valor) {
  if (!valor) return null;
  const digitos = String(valor).replace(/\D/g, "");
  if (digitos.length !== 11 || /^(\d)\1+$/.test(digitos)) return null;
  return digitos;
}

/** @usuario do Instagram sem arroba e sem caixa. */
export function normalizeHandle(valor) {
  if (!valor) return null;
  const limpo = String(valor).trim().replace(/^@/, "").toLowerCase();
  return limpo || null;
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
    email: normalizeEmail(email),
    igUsername: canal === "INSTAGRAM" ? normalizeHandle(igUsername) : null,
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
 * Traduz o que se sabe do contato numa lista de chaves de identidade.
 * Devolve pares { type, value, rawValue } já normalizados; o que não
 * normaliza fica de fora (não vira chave, para não juntar quem não deve).
 */
export function buildIdentifiers(traits = {}) {
  const chaves = [];
  const push = (type, value, rawValue) => {
    if (!value) return;
    if (chaves.some((c) => c.type === type && c.value === value)) return;
    chaves.push({ type, value, rawValue: rawValue ? String(rawValue) : null });
  };

  push(IDENTITY_TYPES.PHONE, normalizePhone(traits.phone), traits.phone);
  push(IDENTITY_TYPES.EMAIL, normalizeEmail(traits.email), traits.email);
  push(IDENTITY_TYPES.CPF, normalizeDocument(traits.document), traits.document);

  const canal = (traits.channel || "").toUpperCase();
  if (traits.externalId && canal) {
    const tipo = IDENTITY_TYPES[canal] || IDENTITY_TYPES.EXTERNAL;
    // O identificador do canal só vale dentro do canal: o IGSID "123" e o
    // visitante "123" do site não são a mesma pessoa.
    push(tipo, `${canal}:${String(traits.externalId).trim()}`, traits.externalId);
  }
  if (traits.igUsername) {
    push(IDENTITY_TYPES.INSTAGRAM, `HANDLE:${normalizeHandle(traits.igUsername)}`, traits.igUsername);
  }
  if (traits.crmProvider && traits.crmId) {
    push(IDENTITY_TYPES.CRM, `${String(traits.crmProvider).toUpperCase()}:${traits.crmId}`, traits.crmId);
  }
  // Telefones e e-mails secundários também identificam a pessoa.
  for (const extra of listaDe(traits.extraPhones)) push(IDENTITY_TYPES.PHONE, normalizePhone(extra), extra);
  for (const extra of listaDe(traits.extraEmails)) push(IDENTITY_TYPES.EMAIL, normalizeEmail(extra), extra);

  return chaves;
}

function listaDe(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  try {
    const parsed = JSON.parse(valor);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* texto simples */
  }
  return String(valor).split(/[,;\n]/).map((v) => v.trim()).filter(Boolean);
}

/**
 * Coração do CDP: acha o contato dono destes identificadores, funde
 * duplicatas se houver mais de um, cria se não houver nenhum.
 *
 * @returns { lead, criado, mesclados }
 */
export async function resolveContact(tenantId, traits = {}, opts = {}) {
  if (!tenantId) throw new Error("resolveContact exige tenantId.");
  const chaves = buildIdentifiers(traits);

  const candidatos = await buscarCandidatos(tenantId, chaves, traits);

  let lead;
  let criado = false;
  let mesclados = 0;

  if (candidatos.length === 0) {
    try {
      lead = await criarContato(tenantId, traits, chaves);
      criado = true;
    } catch (e) {
      // Corrida: duas mensagens do mesmo contato chegando juntas. O índice
      // único barrou a segunda — refaz a busca em vez de duplicar.
      if (e?.code !== "P2002") throw e;
      const denovo = await buscarCandidatos(tenantId, chaves, traits);
      if (!denovo.length) throw e;
      lead = denovo[0];
    }
  } else {
    // O mais antigo vira o canônico: preserva histórico, id e vínculos.
    lead = candidatos[0];
    if (candidatos.length > 1) {
      mesclados = candidatos.length - 1;
      for (const perdedor of candidatos.slice(1)) {
        await mergeLeads(lead.id, perdedor.id);
      }
      lead = await prisma.lead.findUnique({ where: { id: lead.id } });
    }
  }

  await registrarIdentidades(tenantId, lead.id, chaves, traits.source);
  lead = await completarCampos(lead, traits, chaves);

  return { lead, criado, mesclados };
}

/** Contatos que já respondem por alguma destas chaves, do mais antigo ao mais novo. */
async function buscarCandidatos(tenantId, chaves, traits) {
  const ids = new Set();

  if (chaves.length) {
    const achadas = await prisma.contactIdentity.findMany({
      where: { tenantId, OR: chaves.map((c) => ({ type: c.type, value: c.value })) },
      select: { leadId: true },
    });
    achadas.forEach((i) => ids.add(i.leadId));
  }

  // Base antiga, anterior à tabela de identidades: casa pelos campos do Lead.
  const ou = [];
  const telefone = chaves.find((c) => c.type === IDENTITY_TYPES.PHONE)?.value;
  const email = chaves.find((c) => c.type === IDENTITY_TYPES.EMAIL)?.value;
  if (telefone) ou.push({ phone: telefone });
  if (email) ou.push({ email });
  if (traits.externalId && traits.channel) {
    ou.push({ channel: String(traits.channel).toUpperCase(), externalId: String(traits.externalId) });
  }
  if (ou.length) {
    const legados = await prisma.lead.findMany({ where: { tenantId, OR: ou }, select: { id: true } });
    legados.forEach((l) => ids.add(l.id));
  }

  if (!ids.size) return [];
  return prisma.lead.findMany({
    where: { id: { in: [...ids] }, tenantId },
    orderBy: { createdAt: "asc" },
  });
}

async function criarContato(tenantId, traits, chaves) {
  const telefone = chaves.find((c) => c.type === IDENTITY_TYPES.PHONE)?.value || null;
  const email = chaves.find((c) => c.type === IDENTITY_TYPES.EMAIL)?.value || null;
  const canal = (traits.channel || "WHATSAPP").toUpperCase();

  let stageId = traits.stageId;
  if (stageId === undefined) {
    const primeira = await prisma.pipelineStage.findFirst({ where: { tenantId }, orderBy: { order: "asc" } });
    stageId = primeira?.id || null;
  }

  return prisma.lead.create({
    data: {
      tenantId,
      name: nomeValido(traits.name) || rotuloPadrao(canal),
      phone: telefone,
      email,
      channel: canal,
      externalId: traits.externalId ? String(traits.externalId) : null,
      igUsername: normalizeHandle(traits.igUsername),
      source: traits.source || canal,
      waAccountId: traits.waAccountId || null,
      status: traits.status || "NEW",
      stageId,
      notes: traits.notes || null,
      consentAt: new Date(),
    },
  });
}

/** Grava as chaves que ainda não existem, apontando para este contato. */
async function registrarIdentidades(tenantId, leadId, chaves, source) {
  for (const chave of chaves) {
    try {
      await prisma.contactIdentity.upsert({
        where: { tenantId_type_value: { tenantId, type: chave.type, value: chave.value } },
        update: {},
        create: { tenantId, leadId, type: chave.type, value: chave.value, rawValue: chave.rawValue, source: source || null },
      });
    } catch (e) {
      // Chave já pertence a outro contato (corrida). Não sobrescreve: a
      // próxima resolução vai enxergar os dois e fundir.
      if (e?.code !== "P2002") throw e;
    }
  }
}

/**
 * Completa o cadastro sem apagar dado bom.
 * Regra: campo vazio recebe o que chegou; campo preenchido só muda se o que
 * estava lá era rótulo automático.
 */
async function completarCampos(lead, traits, chaves) {
  const patch = {};
  const telefone = chaves.find((c) => c.type === IDENTITY_TYPES.PHONE)?.value;
  const email = chaves.find((c) => c.type === IDENTITY_TYPES.EMAIL)?.value;

  if (!lead.phone && telefone) patch.phone = telefone;
  if (!lead.email && email) patch.email = email;
  if (!lead.externalId && traits.externalId) patch.externalId = String(traits.externalId);
  if (!lead.igUsername && traits.igUsername) patch.igUsername = normalizeHandle(traits.igUsername);
  if (!lead.waAccountId && traits.waAccountId) patch.waAccountId = traits.waAccountId;
  if (!lead.notes && traits.notes) patch.notes = traits.notes;

  const nome = nomeValido(traits.name);
  if (nome && ehNomeGenerico(lead.name)) patch.name = nome;

  // Telefone guardado em formato antigo passa a valer no formato canônico.
  if (telefone && lead.phone && lead.phone !== telefone) {
    const conflito = await prisma.lead.findFirst({
      where: { tenantId: lead.tenantId, phone: telefone, id: { not: lead.id } },
      select: { id: true },
    });
    if (!conflito) patch.phone = telefone;
  }

  if (!Object.keys(patch).length) return lead;
  return prisma.lead.update({ where: { id: lead.id }, data: patch });
}

function nomeValido(nome) {
  if (!nome) return null;
  const limpo = String(nome).trim();
  if (!limpo) return null;
  // Nome que é só o identificador não é nome.
  if (/^\+?\d[\d\s()\-.]*$/.test(limpo)) return null;
  return limpo;
}

/**
 * Funde dois contatos: o perdedor entrega histórico e dados ao canônico e
 * deixa de existir. Nada é jogado fora — conversa, agendamento, automação e
 * fila de espera mudam de dono.
 */
export async function mergeLeads(canonicalId, loserId) {
  if (!canonicalId || !loserId || canonicalId === loserId) return null;

  const [canonico, perdedor] = await Promise.all([
    prisma.lead.findUnique({ where: { id: canonicalId }, include: { tags: true } }),
    prisma.lead.findUnique({ where: { id: loserId }, include: { tags: true } }),
  ]);
  if (!canonico || !perdedor) return null;
  if (canonico.tenantId !== perdedor.tenantId) return null;

  // 1. Conversa: o vínculo é 1-para-1, então a do perdedor não pode ser só
  // reapontada — as mensagens migram e a conversa vazia é removida.
  const [convCanon, convPerd] = await Promise.all([
    prisma.conversation.findUnique({ where: { leadId: canonicalId } }),
    prisma.conversation.findUnique({ where: { leadId: loserId } }),
  ]);

  if (convPerd && convCanon) {
    await prisma.message.updateMany({ where: { conversationId: convPerd.id }, data: { conversationId: convCanon.id } });
    await prisma.conversationEvent.updateMany({ where: { conversationId: convPerd.id }, data: { conversationId: convCanon.id } });
    const dados = {};
    if (mais(convPerd.lastMessageAt, convCanon.lastMessageAt)) {
      dados.lastMessageAt = convPerd.lastMessageAt;
      dados.lastMessagePreview = convPerd.lastMessagePreview;
    }
    if (mais(convPerd.lastInboundAt, convCanon.lastInboundAt)) dados.lastInboundAt = convPerd.lastInboundAt;
    dados.unreadCount = (convCanon.unreadCount || 0) + (convPerd.unreadCount || 0);
    await prisma.conversation.update({ where: { id: convCanon.id }, data: dados });
    await prisma.conversation.delete({ where: { id: convPerd.id } });
  } else if (convPerd) {
    await prisma.conversation.update({ where: { id: convPerd.id }, data: { leadId: canonicalId } });
  }

  // 2. Registros que aceitam simplesmente trocar de dono.
  await prisma.appointment.updateMany({ where: { leadId: loserId }, data: { leadId: canonicalId } });
  await prisma.automationExecution.updateMany({ where: { leadId: loserId }, data: { leadId: canonicalId } });
  await prisma.waitlist.updateMany({ where: { leadId: loserId }, data: { leadId: canonicalId } });

  // 3. Progresso de automação tem chave única (automação + contato): o que
  // colidir fica com o registro do canônico e o duplicado é descartado.
  const progressos = await prisma.automationProgress.findMany({ where: { leadId: loserId } });
  for (const p of progressos) {
    const existe = await prisma.automationProgress.findFirst({
      where: { automationId: p.automationId, leadId: canonicalId },
    });
    if (existe) await prisma.automationProgress.delete({ where: { id: p.id } });
    else await prisma.automationProgress.update({ where: { id: p.id }, data: { leadId: canonicalId } });
  }

  // 4. Identidades e histórico de campanha.
  await prisma.contactIdentity.updateMany({ where: { leadId: loserId }, data: { leadId: canonicalId } });
  await prisma.campaignRecipient.updateMany({ where: { leadId: loserId }, data: { leadId: canonicalId } });

  // 5. Campos: o canônico preenche buracos com o que o perdedor tinha.
  const patch = { mergedCount: (canonico.mergedCount || 0) + 1 };
  for (const campo of ["phone", "email", "externalId", "igUsername", "waAccountId", "notes",
                       "website", "socialLinks", "source", "stageId", "qualificationScore"]) {
    if (!canonico[campo] && perdedor[campo]) patch[campo] = perdedor[campo];
  }
  if (ehNomeGenerico(canonico.name) && !ehNomeGenerico(perdedor.name)) patch.name = perdedor.name;
  // Opt-out é decisão do titular: se qualquer um dos dois pediu para sair, vale.
  if (perdedor.optedOut) {
    patch.optedOut = true;
    patch.optOutAt = perdedor.optOutAt || new Date();
  }
  const tagsNovas = (perdedor.tags || []).filter((t) => !(canonico.tags || []).some((c) => c.id === t.id));
  if (tagsNovas.length) patch.tags = { connect: tagsNovas.map((t) => ({ id: t.id })) };

  // Conflito de telefone entre os dois: o canônico já tem, o perdedor some.
  if (patch.phone) {
    const conflito = await prisma.lead.findFirst({
      where: { tenantId: canonico.tenantId, phone: patch.phone, id: { notIn: [canonicalId, loserId] } },
      select: { id: true },
    });
    if (conflito) delete patch.phone;
  }

  await prisma.lead.delete({ where: { id: loserId } });
  const atualizado = await prisma.lead.update({ where: { id: canonicalId }, data: patch });

  // Contato que veio da base antiga pode nunca ter tido identidade gravada.
  // Depois da fusão ele passa a responder por todas as chaves — inclusive as
  // suas próprias, senão a próxima busca cairia no caminho legado.
  await registrarIdentidades(
    atualizado.tenantId,
    atualizado.id,
    buildIdentifiers({
      phone: atualizado.phone,
      email: atualizado.email,
      channel: atualizado.channel,
      externalId: atualizado.externalId,
      igUsername: atualizado.igUsername,
    }),
    "MERGE"
  );

  await prisma
    .auditLog.create({
      data: {
        tenantId: canonico.tenantId,
        action: "CONTACT_MERGED",
        entity: "Lead",
        entityId: canonicalId,
        metadata: JSON.stringify({ absorvido: loserId, nome: perdedor.name, phone: perdedor.phone, email: perdedor.email }),
      },
    })
    .catch(() => {});

  return atualizado;
}

function mais(a, b) {
  if (!a) return false;
  if (!b) return true;
  return new Date(a) > new Date(b);
}

// Nome que veio de rótulo automático pode ser substituído pelo nome real.
function ehNomeGenerico(nome) {
  if (!nome) return true;
  const n = String(nome).trim();
  if (/^\d+$/.test(n)) return true; // era o identificador virando nome
  return [
    "Contato do WhatsApp", "Contato do Instagram", "Visitante do site",
    "Lead (Meta)", "Lead (Instagram)", "Visitante Web", "Novo Lead", "Sem nome",
    "Contato", "Contato Importado", "Contato CSV",
  ].includes(n);
}

/**
 * Compatibilidade: assinatura antiga usada pelos canais.
 * Continua existindo porque o webhook do WhatsApp e o do Instagram chamam
 * assim — por dentro é o mesmo CDP.
 */
export async function findOrCreateLead(tenantId, identity, extras = {}) {
  const { lead, criado } = await resolveContact(tenantId, {
    channel: identity.channel,
    externalId: identity.externalId,
    phone: identity.phone,
    email: identity.email,
    igUsername: identity.igUsername,
    name: identity.name,
    source: extras.source,
    waAccountId: extras.waAccountId,
    stageId: extras.stageId,
  });
  return { lead, criado };
}

/** Rótulo de contato para exibir, conforme o canal. */
export function contactHandle(lead) {
  if (!lead) return "";
  if (lead.channel === "INSTAGRAM") return lead.igUsername ? `@${lead.igUsername}` : "Instagram";
  if (lead.channel === "SITE") return lead.email || "Site";
  return lead.phone || "";
}

export default {
  normalizePhone, normalizeEmail, normalizeDocument, normalizeHandle,
  isLidJid, buildIdentity, buildIdentifiers, resolveContact, mergeLeads,
  findOrCreateLead, contactHandle, IDENTITY_TYPES,
};
