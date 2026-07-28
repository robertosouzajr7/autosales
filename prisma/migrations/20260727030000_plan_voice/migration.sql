-- Recurso de voz (transcrição de áudio + resposta em áudio) por plano
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "enableVoice" BOOLEAN NOT NULL DEFAULT false;
