-- Franquia de disparos por plano (0 = recurso desligado).
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "maxCampaignMessages" INTEGER NOT NULL DEFAULT 0;

-- Consumo de disparos no ciclo (zera junto com o resto em lastUsageReset).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "usedCampaignMessages" INTEGER NOT NULL DEFAULT 0;

-- Tarifas da Meta e markup de revenda.
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "waRates" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "waMarkup" DOUBLE PRECISION NOT NULL DEFAULT 2.0;

-- Campanha: conexão usada e projeção congelada no momento da criação.
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "recipientCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "variables" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "errorLog" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);
