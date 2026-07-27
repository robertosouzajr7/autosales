-- Canal e conexão de origem da conversa (inbox multicanal)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "waAccountId" TEXT;
