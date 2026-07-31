-- Canal de WhatsApp por plano (oficial x QR Code) e o custo da infra do QR.
-- BOTH é o padrão: nenhuma conexão que já funciona pode parar por causa disto.

ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "whatsappMode" TEXT NOT NULL DEFAULT 'BOTH';
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "baileysNumberCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
