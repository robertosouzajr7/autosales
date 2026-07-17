-- Assinatura Stripe recorrente com trial
ALTER TABLE "Tenant" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "Plan" ADD COLUMN "stripePriceId" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN "stripePublishableKey" TEXT;
