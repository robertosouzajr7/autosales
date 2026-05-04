import prisma from "../config/prisma.js";
import { WhatsAppManager } from "../../../whatsapp.js";

export const getAccounts = async (req, res) => {
  try {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Format response to match frontend expectations
    const formatted = accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      phone: acc.phone || "",
      status: acc.status,
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
    const { name, phone, phoneId, wabaId, verifyToken, accessToken } = req.body;
    const account = await prisma.whatsAppAccount.create({
      data: {
        name,
        phone,
        phoneId,
        wabaId,
        verifyToken,
        accessToken,
        status: "CONNECTED", // Meta is immediately "connected" if token is valid
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
