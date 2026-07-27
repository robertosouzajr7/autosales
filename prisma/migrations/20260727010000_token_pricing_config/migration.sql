-- Precificação de tokens: câmbio e markup padrão configuráveis pelo admin
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "usdToBrl" DOUBLE PRECISION NOT NULL DEFAULT 5.5;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "tokenMarkup" DOUBLE PRECISION NOT NULL DEFAULT 5.0;
