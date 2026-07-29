-- Sincronia dos templates com a Meta (WABA).
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "metaId" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'pt_BR';
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'UTILITY';
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "headerType" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "headerText" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "footerText" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);

-- Nomes duplicados impediriam o índice único; desambigua antes de criá-lo.
UPDATE "MessageTemplate" t SET "name" = t."name" || '_' || SUBSTRING(t."id", 1, 6)
WHERE EXISTS (
  SELECT 1 FROM "MessageTemplate" o
  WHERE o."tenantId" = t."tenantId" AND o."name" = t."name" AND o."id" < t."id"
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageTemplate_tenantId_name_language_key"
  ON "MessageTemplate" ("tenantId", "name", "language");
CREATE INDEX IF NOT EXISTS "MessageTemplate_tenantId_status_idx"
  ON "MessageTemplate" ("tenantId", "status");
