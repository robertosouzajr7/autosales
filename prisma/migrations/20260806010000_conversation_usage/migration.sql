-- Limite de conversas por plano, contadores de consumo e razão de uso.

ALTER TABLE "Plan"   ADD COLUMN IF NOT EXISTS "maxConversations"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "usedConversations"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "usedServiceMessages" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "usedCostBrl"         DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "UsageEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "costBrl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceBrl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leadId" TEXT,
    "conversationId" TEXT,
    "campaignId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UsageEvent_tenantId_createdAt_idx" ON "UsageEvent"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageEvent_tenantId_type_createdAt_idx" ON "UsageEvent"("tenantId", "type", "createdAt");

DO $$ BEGIN
  ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
