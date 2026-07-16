import prisma from "../config/prisma.js";
import { saveMedia } from "../services/StorageService.js";

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
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const MIME_KIND = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  audio: ["audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/mp4", "audio/aac"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
};

export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    if (req.file.size > MAX_BYTES) return res.status(400).json({ error: "Arquivo maior que 25 MB." });

    // Determina o tipo (image/audio/video) pelo mimetype.
    let kind = null;
    for (const [k, mimes] of Object.entries(MIME_KIND)) {
      if (mimes.includes(req.file.mimetype)) { kind = k; break; }
    }
    if (!kind) return res.status(400).json({ error: "Formato não suportado. Use imagem, áudio ou vídeo." });

    const ext = (req.file.originalname.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const publicBase = `${req.protocol}://${req.get("host")}`;
    // StorageService decide entre S3/R2 (produção) e disco local (fallback).
    const url = await saveMedia(req.file.buffer, ext, req.file.mimetype, req.tenantId, publicBase);
    res.json({ url, kind });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
