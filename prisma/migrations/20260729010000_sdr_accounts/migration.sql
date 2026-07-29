-- Conexões atendidas por cada agente (JSON array de WhatsAppAccount.id).
-- Nulo = atende todas, preservando o comportamento de quem tem um só número.
ALTER TABLE "SdrBot" ADD COLUMN IF NOT EXISTS "accountIds" TEXT;
