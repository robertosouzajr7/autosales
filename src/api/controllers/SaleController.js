import prisma from "../config/prisma.js";
import ReceiptService, { lerMotivos, marcarPaga } from "../services/ReceiptService.js";
import { saveMedia } from "../services/StorageService.js";
import { tipoDoArquivo } from "../middlewares/upload.js";

/**
 * Gestão de vendas.
 *
 * A venda entra por dois caminhos: o agente, quando fecha na conversa, e o
 * painel, quando alguém registra na mão. Os dois caem na mesma tabela porque
 * o dono quer um número só de faturamento, não dois.
 */

const INCLUDE = {
  lead: { select: { id: true, name: true, phone: true } },
  items: true,
  receipts: { orderBy: { createdAt: "desc" } },
};

/** Prepara a venda para a tela: motivos já lidos, total conferido. */
function paraTela(venda) {
  return {
    ...venda,
    receipts: (venda.receipts || []).map((r) => ({ ...r, motivos: lerMotivos(r.reasons) })),
  };
}

/**
 * Cria a venda. Compartilhada com o agente, por isso devolve objeto em vez
 * de responder na hora.
 *
 * @returns {{ ok: boolean, venda?: object, erro?: string }}
 */
export async function registrarVenda(tenantId, { leadId = null, title = null, amount, items = [], paymentMethod = null, notes = null, source = "PANEL", createdBy = null } = {}) {
  const lista = Array.isArray(items) ? items : [];

  // Com itens, o total é a soma deles: valor digitado à parte é a origem
  // clássica de venda que não bate com o que foi vendido.
  const somaDosItens = lista.reduce(
    (t, i) => t + Number(i.unitPrice || 0) * Number(i.quantity || 1),
    0
  );
  const total = lista.length ? somaDosItens : Number(amount);

  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, erro: "Informe o valor da venda." };
  }

  const venda = await prisma.sale.create({
    data: {
      tenantId,
      leadId,
      title: title || null,
      amount: Number(total.toFixed(2)),
      paymentMethod: paymentMethod || null,
      notes: notes || null,
      source,
      createdBy,
      items: {
        create: lista.map((i) => ({
          productId: i.productId || null,
          name: String(i.name || "Item"),
          quantity: Number(i.quantity || 1),
          unitPrice: Number(i.unitPrice || 0),
        })),
      },
    },
    include: INCLUDE,
  });

  // Fechar a venda move o card, como o agendamento move.
  if (leadId) {
    try {
      const { default: PipelineAutomation } = await import("../services/PipelineAutomation.js");
      await PipelineAutomation.onEvent(tenantId, leadId, "SALE_CREATED");
    } catch (e) {
      console.error("[Vendas] Falha ao mover o lead no funil:", e.message);
    }
  }

  return { ok: true, venda };
}

// GET /api/sales
export const list = async (req, res) => {
  try {
    const { status, leadId, desde, ate } = req.query;
    const where = { tenantId: req.tenantId };
    if (status) where.status = String(status).toUpperCase();
    if (leadId) where.leadId = String(leadId);
    if (desde || ate) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(String(desde));
      if (ate) where.createdAt.lte = new Date(String(ate));
    }

    const [vendas, pagas, pendentes] = await Promise.all([
      prisma.sale.findMany({ where, include: INCLUDE, orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.sale.aggregate({ where: { ...where, status: "PAID" }, _sum: { amount: true }, _count: true }),
      prisma.sale.aggregate({ where: { ...where, status: "PENDING" }, _sum: { amount: true }, _count: true }),
    ]);

    res.json({
      vendas: vendas.map(paraTela),
      resumo: {
        pago: pagas._sum.amount || 0,
        pagas: pagas._count || 0,
        pendente: pendentes._sum.amount || 0,
        pendentes: pendentes._count || 0,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// POST /api/sales
export const create = async (req, res) => {
  try {
    const r = await registrarVenda(req.tenantId, {
      ...req.body,
      source: "PANEL",
      createdBy: req.userId || null,
    });
    if (!r.ok) return res.status(400).json({ error: r.erro });
    res.status(201).json(paraTela(r.venda));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// PATCH /api/sales/:id
export const update = async (req, res) => {
  try {
    const venda = await prisma.sale.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!venda) return res.status(404).json({ error: "Venda não encontrada." });

    const { status, title, notes, paymentMethod, amount } = req.body || {};
    if (status && !["PENDING", "PAID", "CANCELED"].includes(String(status).toUpperCase())) {
      return res.status(400).json({ error: "Status inválido. Use PENDING, PAID ou CANCELED." });
    }

    // Baixar pelo painel passa pelo mesmo caminho do comprovante aprovado:
    // marca a venda e move o lead. Duas rotas para o mesmo fato dariam dois
    // comportamentos diferentes no funil.
    if (String(status || "").toUpperCase() === "PAID" && venda.status !== "PAID") {
      await marcarPaga(venda);
    } else if (status) {
      await prisma.sale.update({
        where: { id: venda.id },
        data: { status: String(status).toUpperCase(), paidAt: null },
      });
    }

    const dados = {};
    if (title !== undefined) dados.title = title || null;
    if (notes !== undefined) dados.notes = notes || null;
    if (paymentMethod !== undefined) dados.paymentMethod = paymentMethod || null;
    if (amount !== undefined && Number(amount) > 0) dados.amount = Number(amount);
    if (Object.keys(dados).length) {
      await prisma.sale.update({ where: { id: venda.id }, data: dados });
    }

    const atual = await prisma.sale.findUnique({ where: { id: venda.id }, include: INCLUDE });
    res.json(paraTela(atual));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// DELETE /api/sales/:id
export const remove = async (req, res) => {
  try {
    const { count } = await prisma.sale.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!count) return res.status(404).json({ error: "Venda não encontrada." });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// POST /api/sales/:id/receipt — o dono sobe o comprovante e o sistema confere.
export const uploadReceipt = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Envie a imagem ou o PDF do comprovante." });

    const venda = await prisma.sale.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!venda) return res.status(404).json({ error: "Venda não encontrada." });

    const kind = tipoDoArquivo(req.file.originalname, req.file.mimetype);
    if (kind !== "image" && kind !== "document") {
      return res.status(415).json({ error: "O comprovante precisa ser uma imagem ou um PDF." });
    }

    const ext = (req.file.originalname.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const fileUrl = await saveMedia(req.file.buffer, ext, req.file.mimetype, req.tenantId);

    const r = await ReceiptService.conferirEGravar({
      tenantId: req.tenantId,
      leadId: venda.leadId,
      saleId: venda.id,
      fileUrl,
      fileKind: kind,
      buffer: req.file.buffer,
      mimetype: req.file.mimetype || (kind === "image" ? "image/jpeg" : "application/pdf"),
    });
    if (!r.ok) return res.status(422).json({ error: r.erro, fileUrl });

    const atual = await prisma.sale.findUnique({ where: { id: venda.id }, include: INCLUDE });
    res.status(201).json({
      comprovante: { ...r.comprovante, motivos: r.veredito.motivos },
      venda: paraTela(atual),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// PATCH /api/sales/receipts/:id — a palavra final é do dono.
export const reviewReceipt = async (req, res) => {
  try {
    const status = String(req.body?.status || "").toUpperCase();
    if (!["APPROVED", "REJECTED", "REVIEW"].includes(status)) {
      return res.status(400).json({ error: "Status inválido. Use APPROVED, REJECTED ou REVIEW." });
    }
    const comprovante = await prisma.paymentReceipt.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!comprovante) return res.status(404).json({ error: "Comprovante não encontrado." });

    const motivos = lerMotivos(comprovante.reasons);
    motivos.push({ codigo: "DECISAO_MANUAL", texto: `Decidido no painel: ${status}.` });

    await prisma.paymentReceipt.update({
      where: { id: comprovante.id },
      data: { status, reasons: JSON.stringify(motivos) },
    });

    if (status === "APPROVED" && comprovante.saleId) {
      const venda = await prisma.sale.findUnique({ where: { id: comprovante.saleId } });
      if (venda && venda.status !== "PAID") await marcarPaga(venda, comprovante.paidAt || new Date());
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export default { list, create, update, remove, uploadReceipt, reviewReceipt, registrarVenda };
