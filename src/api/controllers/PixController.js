import prisma from "../config/prisma.js";
import {
  normalizarChave,
  montarBrCode,
  qrCodeDataUrl,
  gerarCodigo,
  linkDaCobranca,
  conferirCadastro,
  TIPOS_DE_CHAVE,
} from "../services/PixService.js";

/**
 * Cobranças por Pix.
 *
 * A plataforma não intermedeia o dinheiro: quem recebe é a conta do dono. O
 * que fica aqui é o BR Code montado a partir da chave cadastrada, para que o
 * cliente possa pagar pelo QR Code, pelo copia e cola ou por um link — os três
 * formatos saem do mesmo payload.
 */

const SELECAO_PIX = {
  name: true,
  pixKey: true,
  pixKeyType: true,
  pixHolderName: true,
  pixHolderDoc: true,
  pixCity: true,
  pixBank: true,
};

/**
 * Cria a cobrança e devolve os três formatos.
 * Usada tanto pelo painel quanto pelo agente.
 *
 * @returns {{ ok: boolean, cobranca?: object, erro?: string }}
 */
export async function criarCobranca(tenantId, { amount = null, description = null, leadId = null, txid = null } = {}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: SELECAO_PIX });
  const cadastro = conferirCadastro(tenant);
  if (!cadastro.ok) return { ok: false, erro: cadastro.erro };

  const chave = normalizarChave(tenant.pixKeyType, tenant.pixKey);
  const valor = amount == null || amount === "" ? null : Number(amount);
  if (valor != null && (!Number.isFinite(valor) || valor <= 0)) {
    return { ok: false, erro: "O valor da cobrança precisa ser maior que zero." };
  }

  const code = gerarCodigo();
  const brcode = montarBrCode({
    chave: chave.chave,
    nome: tenant.pixHolderName || tenant.name,
    cidade: tenant.pixCity,
    valor,
    txid: txid || code,
    descricao: description,
  });
  if (!brcode.ok) return { ok: false, erro: brcode.erro };

  const cobranca = await prisma.pixCharge.create({
    data: {
      tenantId,
      leadId: leadId || null,
      code,
      amount: valor,
      description: description || null,
      txid: txid || code,
      payload: brcode.payload,
    },
  });

  return {
    ok: true,
    cobranca: {
      ...cobranca,
      link: linkDaCobranca(code),
      recebedor: tenant.pixHolderName || tenant.name,
      chave: chave.chave,
    },
  };
}

// POST /api/pix/charges
export const create = async (req, res) => {
  const r = await criarCobranca(req.tenantId, req.body || {});
  if (!r.ok) return res.status(400).json({ error: r.erro });
  const qrCode = await qrCodeDataUrl(r.cobranca.payload);
  res.status(201).json({ ...r.cobranca, qrCode });
};

// GET /api/pix/charges
export const list = async (req, res) => {
  try {
    const { status } = req.query;
    const charges = await prisma.pixCharge.findMany({
      where: { tenantId: req.tenantId, ...(status ? { status: String(status).toUpperCase() } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { lead: { select: { id: true, name: true, phone: true } } },
    });
    res.json(charges.map((c) => ({ ...c, link: linkDaCobranca(c.code) })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// PATCH /api/pix/charges/:id — baixa manual ou cancelamento.
export const update = async (req, res) => {
  try {
    const status = String(req.body?.status || "").toUpperCase();
    if (!["PENDING", "PAID", "CANCELED"].includes(status)) {
      return res.status(400).json({ error: "Status inválido. Use PENDING, PAID ou CANCELED." });
    }
    const { count } = await prisma.pixCharge.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { status, paidAt: status === "PAID" ? new Date() : null },
    });
    if (!count) return res.status(404).json({ error: "Cobrança não encontrada." });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET /api/business/pix — o que está cadastrado, para a tela e para o preview.
export const getSettings = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: SELECAO_PIX });
    const cadastro = conferirCadastro(tenant);
    let preview = null;
    if (cadastro.ok) {
      const chave = normalizarChave(tenant.pixKeyType, tenant.pixKey);
      const brcode = montarBrCode({
        chave: chave.chave,
        nome: tenant.pixHolderName || tenant.name,
        cidade: tenant.pixCity,
      });
      // Preview sem valor: é a chave do negócio, não uma cobrança.
      if (brcode.ok) preview = { payload: brcode.payload, qrCode: await qrCodeDataUrl(brcode.payload) };
    }
    res.json({ ...tenant, tipos: TIPOS_DE_CHAVE, completo: cadastro.ok, aviso: cadastro.erro || null, preview });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// PUT /api/business/pix
export const updateSettings = async (req, res) => {
  try {
    const { pixKey, pixKeyType, pixHolderName, pixHolderDoc, pixCity, pixBank } = req.body || {};

    // Chave vazia = o dono está tirando o Pix do ar. Não é erro.
    if (pixKey) {
      const n = normalizarChave(pixKeyType, pixKey);
      if (!n.ok) return res.status(400).json({ error: n.erro });
    }

    const tenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: {
        pixKey: pixKey ? normalizarChave(pixKeyType, pixKey).chave : null,
        pixKeyType: pixKey ? String(pixKeyType).toUpperCase() : null,
        pixHolderName: pixHolderName || null,
        pixHolderDoc: pixHolderDoc ? String(pixHolderDoc).replace(/\D/g, "") : null,
        pixCity: pixCity || null,
        pixBank: pixBank || null,
      },
      select: SELECAO_PIX,
    });
    res.json(tenant);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET /api/public/pix/:code — a página de pagamento, sem login.
export const publicCharge = async (req, res) => {
  try {
    const cobranca = await prisma.pixCharge.findUnique({
      where: { code: String(req.params.code || "") },
      include: { tenant: { select: { name: true, pixHolderName: true } } },
    });
    if (!cobranca) return res.status(404).json({ error: "Cobrança não encontrada." });
    if (cobranca.status === "CANCELED") return res.status(410).json({ error: "Esta cobrança foi cancelada." });

    res.json({
      code: cobranca.code,
      amount: cobranca.amount,
      description: cobranca.description,
      status: cobranca.status,
      payload: cobranca.payload,
      qrCode: await qrCodeDataUrl(cobranca.payload),
      negocio: cobranca.tenant?.pixHolderName || cobranca.tenant?.name || null,
      criadaEm: cobranca.createdAt,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export default { create, list, update, getSettings, updateSettings, publicCharge, criarCobranca };
