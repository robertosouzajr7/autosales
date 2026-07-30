import prisma from "../config/prisma.js";
import { MetaManager } from "../../../meta.js";

/**
 * Templates de mensagem do WhatsApp.
 *
 * Eles vivem na WABA (conta da Meta), não no nosso banco — aqui guardamos um
 * espelho para poder listar, editar rascunho e acompanhar o status de
 * aprovação sem bater na Meta a cada tela. A fonte da verdade sobre o status
 * é sempre a Meta, por isso existe a sincronia.
 */

/** Conexão oficial que tem WABA — de onde saem wabaId e token. */
async function resolveWabaAccount(tenantId, accountId = null) {
  const accounts = await prisma.whatsAppAccount.findMany({
    where: { tenantId, channel: { not: "INSTAGRAM" } },
    orderBy: { createdAt: "asc" },
  });
  const usable = accounts.filter((a) => a.wabaId && a.accessToken && a.phoneId);
  if (accountId) return usable.find((a) => a.id === accountId) || null;
  return usable[0] || null;
}

// Valores de amostra para os {{n}}. A Meta usa só para revisar o template —
// no envio real cada variável recebe o valor de verdade.
const EXEMPLOS_VARIAVEL = ["Maria", "10/08 às 14h", "R$ 150,00", "Pedido 1234", "Centro"];

/** Monta o array `components` da Meta a partir dos campos do formulário. */
export function buildComponents({ headerType, headerText, content, footerText, buttons, headerHandle }) {
  const components = [];

  if (headerType === "TEXT" && headerText) {
    const header = { type: "HEADER", format: "TEXT", text: headerText };
    // Variável no cabeçalho também exige exemplo (aqui é array simples).
    const varsHeader = countVariables(headerText);
    if (varsHeader > 0) {
      header.example = {
        header_text: Array.from({ length: varsHeader }, (_, i) => EXEMPLOS_VARIAVEL[i] || `exemplo${i + 1}`),
      };
    }
    components.push(header);
  } else if (headerType && headerType !== "TEXT") {
    // Cabeçalho de mídia exige um exemplo: a Meta valida o template com um
    // arquivo de amostra, cujo handle vem da Resumable Upload API. Sem o
    // header_handle a criação é rejeitada.
    const header = { type: "HEADER", format: headerType };
    if (headerHandle) header.example = { header_handle: [headerHandle] };
    components.push(header);
  }

  // A Meta exige um exemplo para CADA variável do corpo — sem isso a criação
  // volta como "Invalid parameter". body_text é array de arrays: um conjunto
  // de valores por exemplo.
  const body = { type: "BODY", text: content };
  const totalVars = countVariables(content);
  if (totalVars > 0) {
    const exemplos = Array.from({ length: totalVars }, (_, i) => EXEMPLOS_VARIAVEL[i] || `exemplo${i + 1}`);
    body.example = { body_text: [exemplos] };
  }
  components.push(body);

  if (footerText) components.push({ type: "FOOTER", text: footerText });

  const parsed = parseButtons(buttons);
  if (parsed.length) {
    components.push({
      type: "BUTTONS",
      buttons: parsed.map((b) =>
        b.type === "URL"
          ? { type: "URL", text: b.text, url: b.url }
          : b.type === "PHONE_NUMBER"
          ? { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone }
          : { type: "QUICK_REPLY", text: b.text }
      ),
    });
  }
  return components;
}

function parseButtons(buttons) {
  if (!buttons) return [];
  try {
    const arr = typeof buttons === "string" ? JSON.parse(buttons) : buttons;
    return Array.isArray(arr) ? arr.filter((b) => b?.text) : [];
  } catch {
    return [];
  }
}

/** Quantos {{n}} o corpo usa — a UI precisa disso para pedir as variáveis. */
export function countVariables(content) {
  const found = new Set();
  for (const m of String(content || "").matchAll(/\{\{(\d+)\}\}/g)) found.add(Number(m[1]));
  return found.size;
}

/** A Meta exige nome em minúsculo, sem acento, com underscore. */
function normalizeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove os acentos separados pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);
}

/**
 * Recebe o arquivo do cabeçalho e devolve a URL (para preview/envio) e o
 * handle da Meta (exigido na criação do template).
 *
 * Guardamos os dois porque servem a momentos diferentes: o handle valida o
 * template na aprovação e expira em ~24h; a URL é o arquivo que vai de fato
 * em cada disparo.
 */
export const uploadHeaderMedia = async (req, res) => {
  const LIMITES = {
    IMAGE: { mimes: ["image/jpeg", "image/png"], max: 5 * 1024 * 1024, rotulo: "imagem JPG ou PNG até 5 MB" },
    VIDEO: { mimes: ["video/mp4", "video/3gpp"], max: 16 * 1024 * 1024, rotulo: "vídeo MP4 até 16 MB" },
    DOCUMENT: { mimes: ["application/pdf"], max: 100 * 1024 * 1024, rotulo: "PDF até 100 MB" },
  };

  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    const mime = req.file.mimetype;
    const tipo = mime.startsWith("image/") ? "IMAGE" : mime.startsWith("video/") ? "VIDEO" : "DOCUMENT";
    const regra = LIMITES[tipo];
    if (!regra.mimes.includes(mime)) {
      return res.status(400).json({ error: `Formato não aceito pela Meta em cabeçalho. Use ${regra.rotulo}.` });
    }
    if (req.file.size > regra.max) {
      return res.status(400).json({ error: `Arquivo grande demais. Limite: ${regra.rotulo}.` });
    }

    const account = await resolveWabaAccount(req.tenantId, req.body?.accountId);
    if (!account) {
      return res.status(400).json({ error: "Nenhuma conexão oficial com WABA configurada." });
    }

    const up = await MetaManager.uploadTemplateMedia(
      account.accessToken, req.file.buffer, mime, req.file.originalname || "header"
    );
    if (up.error) return res.status(502).json({ error: up.error });

    // Guarda uma cópia servível: o handle não pode ser reutilizado no envio.
    const { saveMedia } = await import("../services/StorageService.js");
    const ext = (req.file.originalname?.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const url = await saveMedia(req.file.buffer, ext, mime, req.tenantId, `${req.protocol}://${req.get("host")}`);

    res.json({ handle: up.handle, url, headerType: tipo, name: req.file.originalname });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const listTemplates = async (req, res) => {
  try {
    const templates = await prisma.messageTemplate.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { updatedAt: "desc" },
    });
    res.json(
      templates.map((t) => ({
        ...t,
        variableCount: countVariables(t.content),
        usable: t.status === "APPROVED",
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Puxa os templates da Meta e espelha no banco. É o que traz para o painel os
 * templates criados direto no Gerenciador da Meta, e atualiza os status de
 * aprovação dos que criamos daqui.
 */
export const syncTemplates = async (req, res) => {
  try {
    const account = await resolveWabaAccount(req.tenantId, req.body?.accountId);
    if (!account) {
      return res.status(400).json({
        error: "Nenhuma conexão oficial com WABA configurada. Conecte o WhatsApp Business API primeiro.",
      });
    }

    const remote = await MetaManager.listTemplates(account.wabaId, account.accessToken);
    if (remote === null) {
      return res.status(502).json({ error: "Não foi possível consultar os templates na Meta." });
    }

    let criados = 0;
    let atualizados = 0;
    for (const t of remote) {
      const body = (t.components || []).find((c) => c.type === "BODY");
      const header = (t.components || []).find((c) => c.type === "HEADER");
      const footer = (t.components || []).find((c) => c.type === "FOOTER");
      const btns = (t.components || []).find((c) => c.type === "BUTTONS");

      const data = {
        tenantId: req.tenantId,
        accountId: account.id,
        metaId: t.id,
        name: t.name,
        language: t.language || "pt_BR",
        category: t.category || "UTILITY",
        status: t.status || "PENDING",
        content: body?.text || "",
        headerType: header?.format || null,
        headerText: header?.format === "TEXT" ? header?.text || null : null,
        footerText: footer?.text || null,
        buttons: btns?.buttons ? JSON.stringify(btns.buttons) : null,
        rejectedReason: t.rejected_reason || null,
        lastSyncedAt: new Date(),
      };

      const existing = await prisma.messageTemplate.findFirst({
        where: { tenantId: req.tenantId, name: t.name, language: data.language },
      });
      if (existing) {
        await prisma.messageTemplate.update({ where: { id: existing.id }, data });
        atualizados++;
      } else {
        await prisma.messageTemplate.create({ data });
        criados++;
      }
    }

    res.json({ success: true, criados, atualizados, total: remote.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Cria o template. Sem `submit`, fica como rascunho local — útil para montar
 * com calma antes de mandar para a fila de aprovação da Meta, que não permite
 * editar depois de enviada.
 */
export const createTemplate = async (req, res) => {
  try {
    const { name, content, category, language, headerType, headerText, footerText, buttons, accountId, submit, headerHandle, mediaUrl } = req.body;
    if (!name || !content) return res.status(400).json({ error: "Nome e corpo são obrigatórios." });

    const normalized = normalizeName(name);
    const lang = language || "pt_BR";

    const duplicate = await prisma.messageTemplate.findFirst({
      where: { tenantId: req.tenantId, name: normalized, language: lang },
    });
    if (duplicate) return res.status(409).json({ error: `Já existe um template chamado "${normalized}" em ${lang}.` });

    const data = {
      tenantId: req.tenantId,
      name: normalized,
      content,
      language: lang,
      category: category || "UTILITY",
      headerType: headerType || null,
      headerText: headerType === "TEXT" ? headerText || null : null,
      footerText: footerText || null,
      buttons: buttons ? (typeof buttons === "string" ? buttons : JSON.stringify(buttons)) : null,
      status: "DRAFT",
      accountId: accountId || null,
      mediaUrl: mediaUrl || null,
    };

    // Cabeçalho de mídia sem arquivo é rejeitado pela Meta na criação.
    if (submit && headerType && headerType !== "TEXT" && !headerHandle) {
      return res.status(400).json({
        error: "Cabeçalho de mídia exige o envio de um arquivo de exemplo antes de submeter à Meta.",
      });
    }

    if (!submit) {
      const created = await prisma.messageTemplate.create({ data });
      return res.json(created);
    }

    const account = await resolveWabaAccount(req.tenantId, accountId);
    if (!account) return res.status(400).json({ error: "Nenhuma conexão oficial com WABA para enviar à aprovação." });

    const result = await MetaManager.createTemplate(account.wabaId, account.accessToken, {
      name: normalized,
      language: lang,
      category: data.category,
      components: buildComponents({ ...data, headerHandle }),
    });
    if (result.error) return res.status(400).json({ error: result.error });

    const created = await prisma.messageTemplate.create({
      data: {
        ...data,
        accountId: account.id,
        metaId: result.id,
        status: result.status || "PENDING",
        // A Meta pode recategorizar; vale o que ela devolveu.
        category: result.category || data.category,
        lastSyncedAt: new Date(),
      },
    });
    res.json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Edita o template. A Meta não permite alterar template já submetido, então
 * só rascunho é editável — para o resto, o caminho é duplicar.
 */
export const updateTemplate = async (req, res) => {
  try {
    const existing = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ error: "Template não encontrado." });
    if (existing.status !== "DRAFT") {
      return res.status(400).json({
        error: "Template já enviado à Meta não pode ser editado. Duplique para criar uma nova versão.",
      });
    }

    const { name, content, category, language, headerType, headerText, footerText, buttons, submit, accountId, headerHandle, mediaUrl } = req.body;
    const data = {
      ...(name !== undefined ? { name: normalizeName(name) } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(language !== undefined ? { language } : {}),
      ...(headerType !== undefined ? { headerType: headerType || null } : {}),
      ...(headerText !== undefined ? { headerText: headerText || null } : {}),
      ...(footerText !== undefined ? { footerText: footerText || null } : {}),
      ...(buttons !== undefined
        ? { buttons: buttons ? (typeof buttons === "string" ? buttons : JSON.stringify(buttons)) : null }
        : {}),
      ...(mediaUrl !== undefined ? { mediaUrl: mediaUrl || null } : {}),
    };

    if (!submit) {
      const updated = await prisma.messageTemplate.update({ where: { id: existing.id }, data });
      return res.json(updated);
    }

    const merged = { ...existing, ...data };
    if (merged.headerType && merged.headerType !== "TEXT" && !headerHandle) {
      return res.status(400).json({
        error: "Cabeçalho de mídia exige o envio de um arquivo de exemplo antes de submeter à Meta.",
      });
    }
    const account = await resolveWabaAccount(req.tenantId, accountId || existing.accountId);
    if (!account) return res.status(400).json({ error: "Nenhuma conexão oficial com WABA para enviar à aprovação." });

    const result = await MetaManager.createTemplate(account.wabaId, account.accessToken, {
      name: merged.name,
      language: merged.language,
      category: merged.category,
      components: buildComponents({ ...merged, headerHandle }),
    });
    if (result.error) return res.status(400).json({ error: result.error });

    const updated = await prisma.messageTemplate.update({
      where: { id: existing.id },
      data: {
        ...data,
        accountId: account.id,
        metaId: result.id,
        status: result.status || "PENDING",
        category: result.category || merged.category,
        lastSyncedAt: new Date(),
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Duplica como rascunho — o caminho para versionar um template aprovado. */
export const duplicateTemplate = async (req, res) => {
  try {
    const original = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!original) return res.status(404).json({ error: "Template não encontrado." });

    // Nome precisa ser único na WABA; acha o primeiro sufixo livre.
    let name = `${original.name}_copia`;
    let n = 2;
    while (
      await prisma.messageTemplate.findFirst({
        where: { tenantId: req.tenantId, name, language: original.language },
      })
    ) {
      name = `${original.name}_copia_${n++}`;
    }

    const copy = await prisma.messageTemplate.create({
      data: {
        tenantId: req.tenantId,
        name,
        content: original.content,
        language: original.language,
        category: original.category,
        headerType: original.headerType,
        headerText: original.headerText,
        footerText: original.footerText,
        buttons: original.buttons,
        mediaUrl: original.mediaUrl,
        accountId: original.accountId,
        status: "DRAFT", // a cópia nasce local, sem metaId
      },
    });
    res.json(copy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Remove local e, se já existir na Meta, lá também. */
export const deleteTemplate = async (req, res) => {
  try {
    const existing = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ error: "Template não encontrado." });

    const emUso = await prisma.campaign.count({
      where: { templateId: existing.id, status: { in: ["RUNNING", "DRAFT"] } },
    });
    if (emUso > 0) {
      return res.status(409).json({ error: `Template usado por ${emUso} campanha(s). Remova as campanhas primeiro.` });
    }

    if (existing.metaId && existing.accountId) {
      const account = await resolveWabaAccount(req.tenantId, existing.accountId);
      if (account) await MetaManager.deleteTemplate(account.wabaId, account.accessToken, existing.name);
    }

    await prisma.messageTemplate.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
