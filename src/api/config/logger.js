import pino from "pino";

// Logger estruturado. Em produção emite JSON (consumível por qualquer
// coletor); em dev, formato legível se pino-pretty estiver disponível.
const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  // Nunca logar segredos comuns, mesmo que apareçam em objetos.
  redact: {
    paths: [
      "req.headers.authorization",
      "password", "*.password",
      "accessToken", "*.accessToken",
      "apiKey", "*.apiKey",
      "cardNumber", "*.cardNumber"
    ],
    censor: "[REDACTED]"
  }
});

/**
 * Reporta uma exceção. Pronto para Sentry: se SENTRY_DSN estiver definido e o
 * pacote @sentry/node instalado, encaminha; caso contrário, loga estruturado.
 * Não cria dependência dura de Sentry.
 */
let sentryClient = null;
let sentryTried = false;

export async function captureException(err, context = {}) {
  logger.error({ err, ...context }, err?.message || "Exceção");

  if (!process.env.SENTRY_DSN) return;
  try {
    if (!sentryTried) {
      sentryTried = true;
      const Sentry = await import("@sentry/node").catch(() => null);
      if (Sentry) {
        Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || "development" });
        sentryClient = Sentry;
      } else {
        logger.warn("SENTRY_DSN definido mas @sentry/node não está instalado.");
      }
    }
    if (sentryClient) sentryClient.captureException(err, { extra: context });
  } catch (e) {
    logger.warn({ err: e }, "Falha ao reportar ao Sentry");
  }
}

export default logger;
