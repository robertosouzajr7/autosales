import app, { initDB } from "./src/api/app.js";
import { WhatsAppManager } from "./whatsapp.js";
import BillingService from "./src/api/services/BillingService.js";
import prisma from "./src/api/config/prisma.js";
import { logger, captureException } from "./src/api/config/logger.js";

const PORT = process.env.PORT || 3000;
let server;

async function startServer() {
  await initDB();

  server = app.listen(PORT, () => {
    logger.info(`🚀 Servidor SaaS ON: http://localhost:${PORT}`);
    WhatsAppManager.bootExistingSessions().catch(e => logger.error({ err: e }, "Erro ao bootar sessões"));
    BillingService.initialize();
  });
}

startServer().catch((e) => {
  logger.fatal({ err: e }, "Falha ao iniciar o servidor");
  process.exit(1);
});

// ===== Shutdown limpo =====
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Recebido ${signal}. Encerrando graciosamente...`);

  // Para de aceitar novas conexões; drena as em andamento.
  const forceExit = setTimeout(() => {
    logger.error("Timeout no shutdown — forçando saída.");
    process.exit(1);
  }, 10000);

  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
    clearTimeout(forceExit);
    logger.info("Shutdown concluído.");
    process.exit(0);
  } catch (e) {
    logger.error({ err: e }, "Erro no shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Erros fatais: reporta (Sentry-ready) e sai para o orquestrador reiniciar
// (restart: unless-stopped no compose). Baileys agora é opcional e não é mais
// razão para engolir exceções e mascarar estado corrompido.
process.on("unhandledRejection", (reason) => {
  captureException(reason instanceof Error ? reason : new Error(String(reason)), { kind: "unhandledRejection" });
});

process.on("uncaughtException", (err) => {
  captureException(err, { kind: "uncaughtException" });
  shutdown("uncaughtException");
});
