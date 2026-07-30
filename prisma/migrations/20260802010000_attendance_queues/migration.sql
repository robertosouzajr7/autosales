-- Filas de atendimento e fase da conversa.
--
-- Antes só existia `botActive`: ou o bot respondia, ou não respondia. Não
-- havia fila, nem dono do atendimento, nem histórico de quem assumiu.

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "phase"         TEXT NOT NULL DEFAULT 'BOT';
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "queueId"       TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "queuedAt"      TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "handoffReason" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "assignedToId"  TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "assignedAt"    TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "closedAt"      TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "closedById"    TEXT;

-- Conversa com o bot desligado antes desta versão já estava, na prática,
-- em atendimento humano: preserva o estado em vez de zerar tudo para BOT.
UPDATE "Conversation" SET "phase" = 'HUMAN' WHERE "botActive" = false AND "phase" = 'BOT';

CREATE INDEX IF NOT EXISTS "Conversation_tenantId_phase_queuedAt_idx"
  ON "Conversation" ("tenantId", "phase", "queuedAt");

CREATE TABLE IF NOT EXISTS "ServiceQueue" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "color"       TEXT DEFAULT '#2563EB',
  "order"       INTEGER NOT NULL DEFAULT 0,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "isDefault"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServiceQueue_tenantId_active_idx" ON "ServiceQueue" ("tenantId", "active");

CREATE TABLE IF NOT EXISTS "QueueMember" (
  "id"        TEXT NOT NULL,
  "queueId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QueueMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "QueueMember_queueId_userId_key" ON "QueueMember" ("queueId", "userId");

CREATE TABLE IF NOT EXISTS "ConversationEvent" (
  "id"             TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "tenantId"       TEXT NOT NULL,
  "type"           TEXT NOT NULL,
  "fromPhase"      TEXT,
  "toPhase"        TEXT,
  "actorUserId"    TEXT,
  "actorName"      TEXT,
  "note"           TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConversationEvent_conversationId_createdAt_idx"
  ON "ConversationEvent" ("conversationId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ServiceQueue" ADD CONSTRAINT "ServiceQueue_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QueueMember" ADD CONSTRAINT "QueueMember_queueId_fkey"
    FOREIGN KEY ("queueId") REFERENCES "ServiceQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QueueMember" ADD CONSTRAINT "QueueMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ConversationEvent" ADD CONSTRAINT "ConversationEvent_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_queueId_fkey"
    FOREIGN KEY ("queueId") REFERENCES "ServiceQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
