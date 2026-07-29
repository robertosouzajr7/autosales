-- Vozes premium (ElevenLabs) liberadas por plano / contratação adicional
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "enablePremiumVoice" BOOLEAN NOT NULL DEFAULT false;
