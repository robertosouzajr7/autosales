-- Seleção explícita de contatos na campanha.
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "targetLeadIds" TEXT;

-- Um registro por destinatário: base do relatório de disparo.
CREATE TABLE IF NOT EXISTS "CampaignRecipient" (
  "id"         TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "leadId"     TEXT,
  "name"       TEXT,
  "phone"      TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'PENDING',
  "error"      TEXT,
  "messageId"  TEXT,
  "sentAt"     TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CampaignRecipient_campaignId_status_idx"
  ON "CampaignRecipient" ("campaignId", "status");

DO $$ BEGIN
  ALTER TABLE "CampaignRecipient"
    ADD CONSTRAINT "CampaignRecipient_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
