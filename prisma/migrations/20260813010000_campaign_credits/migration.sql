-- Franquia de disparo em dinheiro, no lugar de quantidade por categoria.
--
-- A tarifa da Meta varia ~9x entre marketing (US$ 0,0625) e utilidade
-- (US$ 0,0068). Com franquia em quantidade, o plano tinha de ser precificado
-- pelo pior caso — daí campaignCategory nascer como MARKETING "para o plano
-- nunca ser vendido abaixo do custo". Quem só mandava lembrete pagava como se
-- mandasse promoção, e ninguém podia misturar categorias.
--
-- Em crédito, o cliente escolhe onde gastar e o custo continua coberto,
-- porque o débito usa o preço vigente no momento do envio.

-- ── Plano ───────────────────────────────────────────────────────────────
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "campaignCreditsBrl" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Converte a franquia que cada plano já vendia para o crédito equivalente,
-- pelo preço de venda da categoria dele. Ninguém perde o que contratou.
--
-- Tarifa em USD × câmbio × margem. Câmbio e margem saem de PlatformSettings
-- quando houver; senão, os mesmos padrões do WhatsAppPricingService.
UPDATE "Plan"
SET "campaignCreditsBrl" = ROUND((
  "maxCampaignMessages"
  * CASE UPPER(COALESCE("campaignCategory", 'MARKETING'))
      WHEN 'MARKETING' THEN 0.0625
      ELSE 0.0068
    END
  * COALESCE((SELECT "usdToBrl" FROM "PlatformSettings" WHERE id = 'singleton' AND "usdToBrl" > 0), 5.5)
  * COALESCE((SELECT "waMarkup" FROM "PlatformSettings" WHERE id = 'singleton' AND "waMarkup" > 0), 2.0)
)::numeric, 2)
WHERE "maxCampaignMessages" > 0;

ALTER TABLE "Plan" DROP COLUMN IF EXISTS "maxCampaignMessages";
ALTER TABLE "Plan" DROP COLUMN IF EXISTS "campaignCategory";

-- ── Conta ───────────────────────────────────────────────────────────────
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "usedCampaignCreditsBrl" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "extraCampaignCreditsBrl" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "alertasEnviados" TEXT;

-- ── Pacotes de recarga ──────────────────────────────────────────────────
-- O mesmo modelo passa a servir tokens de IA e crédito de disparo.
ALTER TABLE "TokenPackage" ADD COLUMN IF NOT EXISTS "tipo" TEXT NOT NULL DEFAULT 'TOKENS';
ALTER TABLE "TokenPackage" ADD COLUMN IF NOT EXISTS "creditsBrl" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "TokenPackage" ALTER COLUMN "tokens" SET DEFAULT 0;
