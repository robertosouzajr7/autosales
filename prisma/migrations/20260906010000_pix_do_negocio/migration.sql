-- Dados de recebimento por Pix do negócio.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pixKey" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pixKeyType" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pixHolderName" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pixHolderDoc" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pixCity" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pixBank" TEXT;

-- Cobranças por Pix (QR Code, copia e cola e link público).
CREATE TABLE IF NOT EXISTS "PixCharge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "code" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "description" TEXT,
    "txid" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PixCharge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PixCharge_code_key" ON "PixCharge"("code");
CREATE INDEX IF NOT EXISTS "PixCharge_tenantId_status_idx" ON "PixCharge"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "PixCharge_leadId_idx" ON "PixCharge"("leadId");

ALTER TABLE "PixCharge" DROP CONSTRAINT IF EXISTS "PixCharge_tenantId_fkey";
ALTER TABLE "PixCharge" ADD CONSTRAINT "PixCharge_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PixCharge" DROP CONSTRAINT IF EXISTS "PixCharge_leadId_fkey";
ALTER TABLE "PixCharge" ADD CONSTRAINT "PixCharge_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
