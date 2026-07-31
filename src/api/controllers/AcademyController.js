import prisma from "../config/prisma.js";

/**
 * Área de membros: vídeos publicados pelo dono do SaaS.
 *
 * Leitura é para qualquer cliente logado — material de treinamento não é
 * recurso pago, é o que faz a pessoa conseguir usar o que ela já pagou.
 * A escrita fica no admin.
 */

/** Aceita link de YouTube/Vimeo em qualquer formato e devolve o de embed. */
export function urlDeEmbed(url) {
  const u = String(url || "").trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return u;
}

export const listVideos = async (_req, res) => {
  try {
    const videos = await prisma.academyVideo.findMany({
      where: { active: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    // Os vídeos chegam agrupados por módulo para a tela não ter que agrupar.
    const modulos = [];
    for (const v of videos) {
      let m = modulos.find((x) => x.titulo === v.modulo);
      if (!m) { m = { titulo: v.modulo, videos: [] }; modulos.push(m); }
      m.videos.push({ ...v, embedUrl: urlDeEmbed(v.url) });
    }
    // A ordem dos MÓDULOS sai do menor número dentro de cada um. Ordenar por
    // nome punia o conteúdo certo: "Disparos" vinha antes de "Primeiros
    // passos", que é exatamente a ordem inversa de quem está aprendendo.
    const menor = (m) => Math.min(...m.videos.map((v) => v.order ?? 0));
    modulos.sort((a, b) => menor(a) - menor(b) || a.titulo.localeCompare(b.titulo, "pt-BR"));
    res.json({ modulos, total: videos.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Administração ──────────────────────────────────────────────────────

export const adminListVideos = async (_req, res) => {
  try {
    const videos = await prisma.academyVideo.findMany({
      orderBy: [{ modulo: "asc" }, { order: "asc" }],
    });
    res.json(videos);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

function normalizar(body) {
  const d = {};
  if (body.title !== undefined) d.title = String(body.title).slice(0, 200);
  if (body.description !== undefined) d.description = String(body.description || "").slice(0, 2000) || null;
  if (body.url !== undefined) d.url = String(body.url).trim();
  if (body.modulo !== undefined) d.modulo = String(body.modulo || "Primeiros passos").slice(0, 100);
  if (body.duracao !== undefined) d.duracao = String(body.duracao || "").slice(0, 30) || null;
  if (body.order !== undefined) d.order = Number(body.order) || 0;
  if (body.active !== undefined) d.active = !!body.active;
  return d;
}

export const createVideo = async (req, res) => {
  try {
    const data = normalizar(req.body || {});
    if (!data.title || !data.url) {
      return res.status(400).json({ error: "Título e link do vídeo são obrigatórios." });
    }
    res.json(await prisma.academyVideo.create({ data }));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updateVideo = async (req, res) => {
  try {
    res.json(await prisma.academyVideo.update({ where: { id: req.params.id }, data: normalizar(req.body || {}) }));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteVideo = async (req, res) => {
  try {
    await prisma.academyVideo.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
