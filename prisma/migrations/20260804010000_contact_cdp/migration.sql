-- CDP: identidade única do contato + integrações com CRM

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "mergedCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "ContactIdentity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "rawValue" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContactIdentity_tenantId_type_value_key" ON "ContactIdentity"("tenantId", "type", "value");
CREATE INDEX IF NOT EXISTS "ContactIdentity_leadId_idx" ON "ContactIdentity"("leadId");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_email_idx" ON "Lead"("tenantId", "email");

CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT 'contacts:read,contacts:write',
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_hash_key" ON "ApiKey"("hash");
CREATE INDEX IF NOT EXISTS "ApiKey_tenantId_idx" ON "ApiKey"("tenantId");

CREATE TABLE IF NOT EXISTS "CrmConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "config" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'BOTH',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fieldMap" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "syncedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmConnection_tenantId_provider_key" ON "CrmConnection"("tenantId", "provider");

CREATE TABLE IF NOT EXISTS "CrmSyncLog" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "leadId" TEXT,
    "externalId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmSyncLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CrmSyncLog_connectionId_createdAt_idx" ON "CrmSyncLog"("connectionId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CrmConnection" ADD CONSTRAINT "CrmConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CrmSyncLog" ADD CONSTRAINT "CrmSyncLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CrmConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
