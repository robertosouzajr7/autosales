import app, { initDB } from "./src/api/app.js";
import { WhatsAppManager } from "./whatsapp.js";

const PORT = process.env.PORT || 3000;

async function startServer() {
  await initDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Servidor SaaS Agentes Virtuais (Modular) ON: http://localhost:${PORT}`);
    WhatsAppManager.bootExistingSessions().catch(e => console.error("Err boot sessions:", e));
  });
}

startServer();

// Prevenir queda do processo por erros internos do Baileys/Socket
process.on('unhandledRejection', (reason, promise) => {
  console.error(' [CRÍTICO] Rejeição não tratada:', reason);
});

process.on('uncaughtException', (err) => {
  console.error(' [CRÍTICO] Exceção não capturada:', err);
});
