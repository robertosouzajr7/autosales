-- Motor de IA configurável no painel admin (multi-provedor: Gemini, OpenAI, Anthropic)
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT DEFAULT 'GEMINI';
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "geminiApiKey" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "openaiApiKey" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "anthropicApiKey" TEXT;
