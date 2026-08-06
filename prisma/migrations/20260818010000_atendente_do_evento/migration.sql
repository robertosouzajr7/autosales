-- Quem passou a atender a conversa, além de quem executou a ação.
ALTER TABLE "ConversationEvent" ADD COLUMN "targetUserId" TEXT;
ALTER TABLE "ConversationEvent" ADD COLUMN "targetName" TEXT;

-- Retroativo possível: num "assumir" quem age é o próprio atendente, então
-- para os eventos ASSIGNED antigos o ator É o alvo. Transferências feitas por
-- outra pessoa não têm como ser atribuídas — ficam nulas, e o relatório cai
-- no dono atual da conversa para não perdê-las.
UPDATE "ConversationEvent"
   SET "targetUserId" = "actorUserId", "targetName" = "actorName"
 WHERE "type" = 'ASSIGNED' AND "actorUserId" IS NOT NULL;

CREATE INDEX "ConversationEvent_targetUserId_createdAt_idx"
    ON "ConversationEvent"("targetUserId", "createdAt");
