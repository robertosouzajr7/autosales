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
