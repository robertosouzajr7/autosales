import prisma from "../config/prisma.js";
import { normalizePhone, resolveContact, mergeLeads } from "../services/ContactIdentity.js";
import ContactCleanup from "../services/ContactCleanup.js";

/**
 * Seleção de contatos para disparo.
 *
 * A tela de campanha precisa de busca paginada com filtro por texto, tag,
 * canal e etapa do funil — e de saber quais contatos têm telefone válido, já
 * que só esses podem receber disparo.
 */

const LIMITE_MAX = 200;

/** Monta o `where` a partir dos filtros da tela. */
function buildWhere(tenantId, { q, tagIds, channel, stageId, apenasComTelefone, incluirOptOut }) {
  const where = { tenantId };

  if (q && q.trim()) {
    const texto = q.trim();
    // Telefone é comparado só por dígitos: o usuário digita com máscara.
    const digitos = texto.replace(/\D/g, "");
    where.OR = [
      { name: { contains: texto, mode: "insensitive" } },
      { email: { contains: texto, mode: "insensitive" } },
      { igUsername: { contains: texto, mode: "insensitive" } },
      ...(digitos.length >= 3 ? [{ phone: { contains: digitos } }] : []),
    ];
  }

  if (Array.isArray(tagIds) && tagIds.length) where.tags = { some: { id: { in: tagIds } } };
  if (channel) where.channel = channel;
  if (stageId) where.stageId = stageId;
  if (apenasComTelefone) where.phone = { not: null };
  if (!incluirOptOut) where.optedOut = false;

  return where;
}

function parseLista(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  return String(valor).split(",").map((v) => v.trim()).filter(Boolean);
}

/** Lista contatos com filtros e paginação. */
export const searchContacts = async (req, res) => {
  try {
    const {
      q, channel, stageId, page = "1", limit = "50",
      tagIds, comTelefone, incluirOptOut,
    } = req.query;

    const take = Math.min(parseInt(limit) || 50, LIMITE_MAX);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where = buildWhere(req.tenantId, {
      q,
      tagIds: parseLista(tagIds),
      channel,
      stageId,
      apenasComTelefone: comTelefone === "true",
      incluirOptOut: incluirOptOut === "true",
    });

    const [total, contatos] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        select: {
          id: true, name: true, phone: true, email: true, channel: true,
          igUsername: true, optedOut: true,
          stage: { select: { id: true, name: true } },
          tags: { select: { id: true, name: true, color: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
        take,
        skip,
      }),
    ]);

    res.json({
      total,
      page: Math.max(parseInt(page) || 1, 1),
      limit: take,
      contatos: contatos.map((c) => ({
        ...c,
        // Marca quem pode receber disparo, para a tela desabilitar o resto.
        disparavel: !!normalizePhone(c.phone) && !c.optedOut,
        phoneFormatado: formatarTelefone(c.phone),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Ids de todos os contatos que casam com o filtro — para "selecionar todos". */
export const searchContactIds = async (req, res) => {
  try {
    const { q, channel, stageId, tagIds, comTelefone, incluirOptOut } = req.query;
    const where = buildWhere(req.tenantId, {
      q,
      tagIds: parseLista(tagIds),
      channel,
      stageId,
      apenasComTelefone: comTelefone === "true",
      incluirOptOut: incluirOptOut === "true",
    });
    const contatos = await prisma.lead.findMany({ where, select: { id: true, phone: true, optedOut: true } });
    // Só devolve quem realmente pode receber: selecionar todos não deve
    // arrastar contato sem telefone para dentro da campanha.
    const ids = contatos.filter((c) => normalizePhone(c.phone) && !c.optedOut).map((c) => c.id);
    res.json({ ids, total: ids.length, ignorados: contatos.length - ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Tags do tenant, para o filtro. */
export const listTags = async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      where: { leads: { some: { tenantId: req.tenantId } } },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    });
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Importa contatos de CSV. Aceita cabeçalho em português ou inglês e
 * normaliza os telefones — linha sem telefone válido é reportada, não
 * gravada, para não entrar na base algo que nunca poderia receber disparo.
 */
export const importContactsCsv = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Envie um arquivo CSV." });

    const texto = req.file.buffer.toString("utf8");
    const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
    if (!linhas.length) return res.status(400).json({ error: "Arquivo vazio." });

    const separador = (linhas[0].match(/;/g) || []).length > (linhas[0].match(/,/g) || []).length ? ";" : ",";
    const cabecalho = dividir(linhas[0], separador).map((h) => normalizarCabecalho(h));

    const idx = {
      name: acharColuna(cabecalho, ["nome", "name", "contato", "cliente"]),
      phone: acharColuna(cabecalho, ["telefone", "phone", "celular", "whatsapp", "fone"]),
      email: acharColuna(cabecalho, ["email", "e_mail", "mail"]),
    };
    if (idx.phone < 0) {
      return res.status(400).json({
        error: `Não encontrei a coluna de telefone. Cabeçalhos lidos: ${cabecalho.join(", ")}. Use "telefone" ou "phone".`,
      });
    }

    const firstStage = await prisma.pipelineStage.findFirst({
      where: { tenantId: req.tenantId },
      orderBy: { order: "asc" },
    });

    const resultado = { criados: 0, atualizados: 0, mesclados: 0, invalidos: [], duplicadosNoArquivo: 0 };
    const vistos = new Set();

    for (let i = 1; i < linhas.length; i++) {
      const cols = dividir(linhas[i], separador);
      const bruto = cols[idx.phone] || "";
      const telefone = normalizePhone(bruto);
      const nome = (idx.name >= 0 ? cols[idx.name] : "") || "";
      const email = (idx.email >= 0 ? cols[idx.email] : "") || "";

      if (!telefone) {
        // Guarda no máximo 50 para a resposta não ficar gigante.
        if (resultado.invalidos.length < 50) {
          resultado.invalidos.push({ linha: i + 1, telefone: bruto, nome, motivo: motivoInvalido(bruto) });
        }
        continue;
      }
      if (vistos.has(telefone)) { resultado.duplicadosNoArquivo++; continue; }
      vistos.add(telefone);

      // O CDP também casa por e-mail: a mesma pessoa cadastrada antes só
      // com e-mail não vira contato novo por ter aparecido com telefone.
      const { lead, criado, mesclados } = await resolveContact(req.tenantId, {
        name: nome,
        phone: telefone,
        email,
        channel: "WHATSAPP",
        source: "CSV_IMPORT",
        stageId: firstStage?.id || null,
      });
      if (criado) resultado.criados++;
      else resultado.atualizados++;
      resultado.mesclados += mesclados;
      // Nome vindo da planilha é informação nova do cliente: prevalece.
      if (!criado && nome && lead.name !== nome) {
        await prisma.lead.update({ where: { id: lead.id }, data: { name: nome } });
      }
    }

    res.json({
      success: true,
      ...resultado,
      totalLinhas: linhas.length - 1,
      invalidosTotal: (linhas.length - 1) - resultado.criados - resultado.atualizados - resultado.duplicadosNoArquivo,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Explica por que a linha foi recusada — evita "importou 0 e não sei por quê". */
function motivoInvalido(bruto) {
  const v = String(bruto || "").trim();
  if (!v) return "telefone em branco";
  if (/[a-zA-Z]/.test(v)) return "contém letras";
  const d = v.replace(/\D/g, "");
  if (d.length < 10) return `só ${d.length} dígito(s) — mínimo 10`;
  if (d.length > 15) return `${d.length} dígitos — máximo 15`;
  return "formato não reconhecido";
}

// Divide respeitando campo entre aspas ("Silva, João";...).
function dividir(linha, sep) {
  const out = [];
  let atual = "";
  let dentroDeAspas = false;
  for (const ch of linha) {
    if (ch === '"') { dentroDeAspas = !dentroDeAspas; continue; }
    if (ch === sep && !dentroDeAspas) { out.push(atual.trim()); atual = ""; continue; }
    atual += ch;
  }
  out.push(atual.trim());
  return out;
}

function normalizarCabecalho(h) {
  return String(h || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function acharColuna(cabecalho, nomes) {
  for (const n of nomes) {
    const i = cabecalho.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

/** Formato legível: +55 (71) 92042-802. */
export function formatarTelefone(phone) {
  const d = normalizePhone(phone);
  if (!d) return "";
  if (d.length >= 12 && d.startsWith("55")) {
    const ddd = d.slice(2, 4);
    const resto = d.slice(4);
    const meio = resto.length > 8 ? resto.slice(0, 5) : resto.slice(0, 4);
    return `+55 (${ddd}) ${meio}-${resto.slice(meio.length)}`;
  }
  return `+${d}`;
}

// ── CDP: identidades e duplicatas ─────────────────────────────────

/** Todos os identificadores conhecidos de um contato. */
export const contactIdentities = async (req, res) => {
  try {
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!lead) return res.status(404).json({ error: "Contato não encontrado." });
    const identidades = await prisma.contactIdentity.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "asc" },
    });
    res.json({
      leadId: lead.id,
      mergedCount: lead.mergedCount,
      identities: identidades.map((i) => ({
        id: i.id, type: i.type, value: i.value, rawValue: i.rawValue, source: i.source, createdAt: i.createdAt,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * O que ainda precisa de decisão humana.
 *
 * Cadastro com identificador repetido não aparece mais aqui: telefone ou
 * e-mail iguais são a mesma pessoa, e a unificação acontece sozinha — na
 * entrada pelo CDP, e de hora em hora sobre o que escapou. O que resta são
 * contatos que só dividem o NOME, sem nenhum identificador em comum: podem
 * ser a mesma pessoa em duas fichas ou dois homônimos, e juntar duas pessoas
 * diferentes não tem volta. Essa continua sendo uma escolha do dono.
 *
 * A resposta também traz quantos foram unificados automaticamente, para a
 * tela poder dizer que o trabalho está sendo feito em vez de mostrar zero e
 * parecer que nada acontece.
 */
export const listDuplicates = async (req, res) => {
  try {
    const grupos = await ContactCleanup.ambiguos(req.tenantId);

    const desdeOntem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const registros = await prisma.auditLog.findMany({
      where: { tenantId: req.tenantId, action: "CONTACTS_AUTO_MERGED", createdAt: { gte: desdeOntem } },
      select: { metadata: true },
    });
    let unificadosNoDia = 0;
    for (const r of registros) {
      try { unificadosNoDia += JSON.parse(r.metadata || "{}").fundidos || 0; } catch { /* registro antigo */ }
    }

    res.json({ total: grupos.length, grupos, unificadosNoDia });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Unifica agora, sem esperar a próxima passagem.
 *
 * A varredura automática roda de hora em hora sobre o que mudou. Quem acabou
 * de importar uma planilha antiga quer ver a base limpa na hora — e quem tem
 * base grande precisa de um jeito de varrer tudo, não só a janela recente.
 */
export const deduplicateNow = async (req, res) => {
  try {
    const resumo = await ContactCleanup.varrer(req.tenantId);
    res.json({ success: true, ...resumo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** Funde contatos escolhidos na tela. O primeiro da lista é o que fica. */
export const mergeContacts = async (req, res) => {
  try {
    const { canonicalId, ids } = req.body || {};
    if (!canonicalId || !Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: "Informe canonicalId e a lista de ids a fundir." });
    }

    const todos = await prisma.lead.findMany({
      where: { tenantId: req.tenantId, id: { in: [canonicalId, ...ids] } },
      select: { id: true },
    });
    const validos = new Set(todos.map((l) => l.id));
    if (!validos.has(canonicalId)) return res.status(404).json({ error: "Contato principal não encontrado." });

    let fundidos = 0;
    for (const id of ids) {
      if (id === canonicalId || !validos.has(id)) continue;
      await mergeLeads(canonicalId, id);
      fundidos++;
    }

    const lead = await prisma.lead.findUnique({ where: { id: canonicalId } });
    res.json({ success: true, fundidos, lead });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

