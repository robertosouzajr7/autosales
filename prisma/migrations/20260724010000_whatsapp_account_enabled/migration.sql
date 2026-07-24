-- Toggle de habilitar/desabilitar conexões de canal (WhatsApp/Instagram)
ALTER TABLE "WhatsAppAccount" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;
