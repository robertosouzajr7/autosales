import prisma from "../config/prisma.js";
import { WhatsAppManager } from "../../../whatsapp.js";

export const getAccounts = async (req, res) => {
  try {
    // Filtro opcional por canal (?channel=WHATSAPP|INSTAGRAM).
    const channel = req.query.channel;
    const where = { tenantId: req.tenantId };
    if (channel === "WHATSAPP" || channel === "INSTAGRAM") where.channel = channel;

    const accounts = await prisma.whatsAppAccount.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const formatted = accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      phone: acc.phone || "",
      status: acc.status,
      channel: acc.channel || "WHATSAPP",
      handle: acc.igId ? `@${acc.name}` : (acc.phone || ""),
      instance: acc.id.substring(0, 8),
      lastActive: acc.updatedAt.toLocaleString()
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createAccount = async (req, res) => {
  try {
    const { name } = req.body;
    const account = await prisma.whatsAppAccount.create({
      data: {
        name,
        tenantId: req.tenantId,
        status: "DISCONNECTED"
      }
    });
    res.json({ id: account.id, name: account.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Disconnect session if running
    await WhatsAppManager.disconnectSession(id);
    
    await prisma.whatsAppAccount.delete({
      where: { id, tenantId: req.tenantId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createMetaAccount = async (req, res) => {
  try {
    const { name, phone, phoneId, wabaId, accessToken } = req.body;
    const account = await prisma.whatsAppAccount.create({
      data: {
        name,
        phone,
        phoneId,
        wabaId,
        accessToken,
        channel: "WHATSAPP",
        status: "CONNECTED", // Meta is immediately "connected" if token is valid
        tenantId: req.tenantId
      }
    });
    res.json({ id: account.id, name: account.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Conecta uma conta do Instagram Direct (via Meta). O usuário informa o
// Instagram Business Account ID, a Page ID vinculada e o Page Access Token.
export const createInstagramAccount = async (req, res) => {
  try {
    const { name, igId, pageId, accessToken } = req.body;
    if (!name || !igId || !pageId || !accessToken) {
      return res.status(400).json({ error: "Nome, IG Account ID, Page ID e Page Token são obrigatórios." });
    }
    const dup = await prisma.whatsAppAccount.findFirst({ where: { igId, channel: "INSTAGRAM" } });
    if (dup) return res.status(409).json({ error: "Esta conta do Instagram já está conectada." });

    const account = await prisma.whatsAppAccount.create({
      data: {
        name,
        igId,
        pageId,
        accessToken,
        channel: "INSTAGRAM",
        status: "CONNECTED",
        tenantId: req.tenantId
      }
    });
    res.json({ id: account.id, name: account.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const qrCodeStream = async (req, res) => {
  const { id } = req.params;
  
  // SSE Setup
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendEvent = (data) => {
    res.write(`data: ${data}\n\n`);
  };

  sendEvent(JSON.stringify({ status: "WAITING" }));

  try {
    // Check if account belongs to user
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id, tenantId: req.tenantId }
    });
    if (!account) {
      sendEvent(JSON.stringify({ status: "ERROR", message: "Conta não encontrada" }));
      return res.end();
    }

    // Attempt to connect and emit QR codes
    WhatsAppManager.createSession(id, (dataStr) => {
      sendEvent(dataStr);
    });

    req.on('close', () => {
      // Don't disconnect session just because SSE closed, they might just close modal
    });

  } catch (error) {
    sendEvent(JSON.stringify({ status: "ERROR", message: error.message }));
    res.end();
  }
};
