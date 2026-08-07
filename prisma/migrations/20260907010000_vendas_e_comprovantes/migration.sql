-- Vendas fechadas e a conferência do comprovante de pagamento.

CREATE TABLE IF NOT EXISTS "Sale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "title" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'AGENT',
    "createdBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Sale_tenantId_status_idx" ON "Sale"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Sale_leadId_idx" ON "Sale"("leadId");

CREATE TABLE IF NOT EXISTS "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SaleItem_saleId_idx" ON "SaleItem"("saleId");

CREATE TABLE IF NOT EXISTS "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT,
    "leadId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileKind" TEXT NOT NULL DEFAULT 'image',
    "status" TEXT NOT NULL DEFAULT 'REVIEW',
    "reasons" TEXT,
    "amount" DOUBLE PRECISION,
    "paidAt" TIMESTAMP(3),
    "pixKey" TEXT,
    "payerName" TEXT,
    "receiverName" TEXT,
    "receiverDoc" TEXT,
    "endToEndId" TEXT,
    "scheduled" BOOLEAN NOT NULL DEFAULT false,
    "rawText" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentReceipt_tenantId_status_idx" ON "PaymentReceipt"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "PaymentReceipt_saleId_idx" ON "PaymentReceipt"("saleId");

ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_tenantId_fkey";
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_leadId_fkey";
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SaleItem" DROP CONSTRAINT IF EXISTS "SaleItem_saleId_fkey";
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" DROP CONSTRAINT IF EXISTS "SaleItem_productId_fkey";
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentReceipt" DROP CONSTRAINT IF EXISTS "PaymentReceipt_tenantId_fkey";
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" DROP CONSTRAINT IF EXISTS "PaymentReceipt_saleId_fkey";
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" DROP CONSTRAINT IF EXISTS "PaymentReceipt_leadId_fkey";
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
