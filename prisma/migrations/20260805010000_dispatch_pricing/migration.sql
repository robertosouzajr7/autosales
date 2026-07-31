-- Precificação de disparos: categoria de referência do plano e custo real
-- do disparo (separado do preço, para o relatório mostrar a margem).

ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "campaignCategory" TEXT NOT NULL DEFAULT 'MARKETING';
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "realCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
