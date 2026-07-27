-- Recarga de tokens: saldo extra por tenant + catálogo de pacotes do admin
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "extraTokens" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "TokenPackage" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokens" INTEGER NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TokenPackage_pkey" PRIMARY KEY ("id")
);
