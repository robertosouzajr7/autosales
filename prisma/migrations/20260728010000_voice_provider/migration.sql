-- Motor de voz global: provedor, chave da ElevenLabs e vozes liberadas
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "voiceProvider" TEXT DEFAULT 'GEMINI';
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "elevenLabsApiKey" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "enabledVoices" TEXT;
