import prisma from "../config/prisma.js";

/**
 * Respostas rápidas do atendimento.
 *
 * Antes eram quatro frases fixas no código do painel — as mesmas para todo
 * mundo, sem como criar, editar ou saber qual funciona. O atalho é o que faz
 * valer a pena: digitar "/orc" é mais rápido do que procurar numa lista.
 */

/** Semente para quem nunca cadastrou nenhuma: lista vazia não ensina nada. */
const PADRAO = [
  { titulo: "Confirmar horário", atalho: "/conf", texto: "Consigo confirmar seu horário. Qual dia e período ficam melhores para você?" },
  { titulo: "Enviar valores", atalho: "/valor", texto: "Vou te passar os valores agora mesmo." },
  { titulo: "Pedir documento", atalho: "/doc", texto: "Para seguir, você pode me enviar o documento por aqui?" },
  { titulo: "Um momento", atalho: "/mom", texto: "Só um momento, já verifico isso para você." },
];

function limpar(corpo = {}) {
  const dados = {};
  if (corpo.titulo !== undefined) dados.titulo = String(corpo.titulo).trim();
  if (corpo.texto !== undefined) dados.texto = String(corpo.texto).trim();
  if (corpo.categoria !== undefined) dados.categoria = String(corpo.categoria || "").trim() || null;
  if (corpo.ativa !== undefined) dados.ativa = !!corpo.ativa;
  if (corpo.atalho !== undefined) {
    const a = String(corpo.atalho || "").trim().toLowerCase().replace(/\s+/g, "");
    // Atalho sempre com barra: é o que o atendente digita, e sem a barra ele
    // se confunde com uma palavra qualquer da mensagem.
    dados.atalho = a ? (a.startsWith("/") ? a : `/${a}`) : null;
  }
  return dados;
}

/**
 * Lista as respostas ativas.
 *
 * Ordenadas por uso: a lista de utilidade real, não a de ordem de cadastro.
 * Na primeira vez, semeia as quatro padrão — o painel já usava essas frases,
 * então ninguém perde nada e a tela não abre vazia.
 */
export const listar = async (req, res) => {
  try {
    const total = await prisma.quickReply.count({ where: { tenantId: req.tenantId } });
    if (!total) {
      await prisma.quickReply.createMany({
        data: PADRAO.map((p) => ({ ...p, tenantId: req.tenantId })),
      });
    }
    const itens = await prisma.quickReply.findMany({
      where: { tenantId: req.tenantId, ...(req.query.todas === "1" ? {} : { ativa: true }) },
      orderBy: [{ usos: "desc" }, { titulo: "asc" }],
    });
    res.json({ total: itens.length, itens });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const criar = async (req, res) => {
  try {
    const dados = limpar(req.body);
    if (!dados.titulo || !dados.texto) {
      return res.status(400).json({ error: "Informe o título e o texto da resposta." });
    }
    if (dados.atalho) {
      const jaExiste = await prisma.quickReply.findFirst({
        where: { tenantId: req.tenantId, atalho: dados.atalho },
      });
      if (jaExiste) {
        return res.status(409).json({ error: `O atalho ${dados.atalho} já é de "${jaExiste.titulo}".` });
      }
    }
    const item = await prisma.quickReply.create({
      data: { ...dados, tenantId: req.tenantId, criadaPor: req.userId || null },
    });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const atualizar = async (req, res) => {
  try {
    const atual = await prisma.quickReply.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!atual) return res.status(404).json({ error: "Resposta não encontrada." });

    const dados = limpar(req.body);
    if (dados.atalho && dados.atalho !== atual.atalho) {
      const jaExiste = await prisma.quickReply.findFirst({
        where: { tenantId: req.tenantId, atalho: dados.atalho, id: { not: atual.id } },
      });
      if (jaExiste) {
        return res.status(409).json({ error: `O atalho ${dados.atalho} já é de "${jaExiste.titulo}".` });
      }
    }
    const item = await prisma.quickReply.update({ where: { id: atual.id }, data: dados });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const remover = async (req, res) => {
  try {
    const atual = await prisma.quickReply.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!atual) return res.status(404).json({ error: "Resposta não encontrada." });
    await prisma.quickReply.delete({ where: { id: atual.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Marca que foi usada. É o que ordena a lista pela utilidade real.
 * Falhar aqui não pode atrapalhar o envio da mensagem, então responde
 * sucesso mesmo quando a contagem não sobe.
 */
export const registrarUso = async (req, res) => {
  try {
    await prisma.quickReply.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { usos: { increment: 1 } },
    });
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
};
