import prisma from "../config/prisma.js";
import { saveMedia } from "../services/StorageService.js";
import { analisar, MODELO_CSV } from "../services/CatalogImport.js";

/**
 * Catálogo de produtos/serviços com mídia (imagem/áudio/vídeo).
 * O agente de IA usa estes itens via skill "send_catalog" (list_catalog /
 * send_catalog_item). Tudo escopado por req.tenantId.
 */

const ALLOWED = new Set(["name", "type", "category", "description", "price", "size", "buyUrl", "imageUrl", "audioUrl", "videoUrl", "isActive"]);

function pick(body) {
  const out = {};
  for (const k of Object.keys(body || {})) {
    if (!ALLOWED.has(k)) continue;
    if (k === "price") out.price = body.price === "" || body.price == null ? null : Number(body.price);
    else out[k] = body[k];
  }
  return out;
}

export const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "desc" },
    });
    res.json(products);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createProduct = async (req, res) => {
  try {
    const product = await prisma.product.create({
      data: { ...pick(req.body), tenantId: req.tenantId },
    });
    res.json(product);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: pick(req.body),
    });
    res.json(product);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteProduct = async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// Upload de mídia. Recebe um arquivo (multer memoryStorage) e grava em
// public/uploads/<tenant>/. Devolve a URL pública para salvar no produto.
export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    // Pelo mimetype ou pela extensão: o navegador manda octet-stream sempre
    // que o sistema não reconhece o arquivo, e uma foto boa era recusada.
    const { tipoDoArquivo } = await import("../middlewares/upload.js");
    const kind = tipoDoArquivo(req.file.originalname, req.file.mimetype);
    if (!kind || kind === "document") {
      return res.status(415).json({
        error: `"${req.file.originalname}" não é imagem, áudio nem vídeo. O catálogo aceita só mídia.`,
      });
    }

    const ext = (req.file.originalname.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const publicBase = `${req.protocol}://${req.get("host")}`;
    // StorageService decide entre S3/R2 (produção) e disco local (fallback).
    const url = await saveMedia(req.file.buffer, ext, req.file.mimetype, req.tenantId, publicBase);
    res.json({ url, kind });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── Importação em massa ───────────────────────────────────────────

/** O modelo para baixar, preencher e devolver. */
export const importTemplate = async (req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="modelo-catalogo.csv"');
  // BOM: sem ele o Excel abre "Estética" como "EstÃ©tica".
  res.send("﻿" + MODELO_CSV);
};

/**
 * Importa catálogo de CSV ou TXT.
 *
 * Duas passagens de propósito. Com `?preview=1` o arquivo é lido e devolvido
 * como seria gravado, com os erros por linha — o dono confere antes. Sem
 * preview, grava.
 *
 * Item com o mesmo nome é atualizado, não duplicado: quem reenvia a planilha
 * corrigida espera corrigir o catálogo, não ficar com duas cópias de tudo.
 */
export const importProducts = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Envie um arquivo CSV ou TXT." });

    const leitura = analisar(req.file.buffer.toString("utf8").replace(/^﻿/, ""));
    if (leitura.erro) return res.status(400).json({ error: leitura.erro });
    if (!leitura.itens.length) {
      return res.status(400).json({ error: "Não encontrei nenhum item no arquivo." });
    }

    const validos = leitura.itens.filter((i) => !i.erros.length);
    const invalidos = leitura.itens.filter((i) => i.erros.length);

    if (req.query.preview === "1") {
      return res.json({
        preview: true,
        formato: leitura.formato,
        colunasIgnoradas: leitura.naoReconhecidas,
        total: leitura.itens.length,
        validos: validos.length,
        // A prévia mostra os 20 primeiros: a tela não precisa de mil linhas
        // para o dono decidir se o arquivo está certo.
        amostra: validos.slice(0, 20).map((i) => i.dados),
        invalidos: invalidos.slice(0, 50),
        invalidosTotal: invalidos.length,
      });
    }

    const existentes = await prisma.product.findMany({
      where: { tenantId: req.tenantId },
      select: { id: true, name: true },
    });
    const porNome = new Map(existentes.map((p) => [p.name.trim().toLowerCase(), p.id]));

    const resultado = { criados: 0, atualizados: 0, invalidos: invalidos.slice(0, 50), invalidosTotal: invalidos.length };
    const vistosNoArquivo = new Set();

    for (const item of validos) {
      const nome = item.dados.name.trim();
      const chaveNome = nome.toLowerCase();
      // Nome repetido dentro do próprio arquivo: a última linha vence, e não
      // vira dois cadastros iguais.
      const jaVisto = vistosNoArquivo.has(chaveNome);
      vistosNoArquivo.add(chaveNome);

      const id = porNome.get(chaveNome);
      if (id) {
        await prisma.product.update({ where: { id }, data: { ...item.dados, name: nome } });
        if (!jaVisto) resultado.atualizados++;
      } else {
        const criado = await prisma.product.create({
          data: { ...item.dados, name: nome, tenantId: req.tenantId },
        });
        porNome.set(chaveNome, criado.id);
        resultado.criados++;
      }
    }

    res.json({ success: true, formato: leitura.formato, total: leitura.itens.length, ...resultado });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
