-- Cardápio em arquivo (imagem ou PDF) para nichos de alimentação.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "menuUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "menuKind" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "menuFileName" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "menuUpdatedAt" TIMESTAMP(3);
