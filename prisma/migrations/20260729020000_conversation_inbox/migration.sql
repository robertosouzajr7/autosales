-- Ordenação, não-lidas e janela de 24h no inbox.
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lastMessagePreview" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "unreadCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lastInboundAt" TIMESTAMP(3);

-- Backfill a partir das mensagens existentes, para a lista já abrir ordenada.
UPDATE "Conversation" c SET
  "lastMessageAt" = m."createdAt",
  "lastMessagePreview" = LEFT(m."content", 120)
FROM (
  SELECT DISTINCT ON ("conversationId") "conversationId", "content", "createdAt"
  FROM "Message" ORDER BY "conversationId", "createdAt" DESC
) m
WHERE m."conversationId" = c."id";

UPDATE "Conversation" c SET "lastInboundAt" = m."createdAt"
FROM (
  SELECT DISTINCT ON ("conversationId") "conversationId", "createdAt"
  FROM "Message" WHERE "role" = 'USER' ORDER BY "conversationId", "createdAt" DESC
) m
WHERE m."conversationId" = c."id";

CREATE INDEX IF NOT EXISTS "Conversation_tenantId_lastMessageAt_idx"
  ON "Conversation" ("tenantId", "lastMessageAt" DESC);
