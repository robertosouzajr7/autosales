-- Conhecimento extraído de um material, esperando o dono confirmar antes de
-- entrar na base do agente.
CREATE TABLE "KnowledgeDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sdrId" TEXT NOT NULL,
    "lote" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "arquivo" TEXT,
    "pergunta" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "trecho" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "KnowledgeDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeDraft_tenantId_sdrId_status_idx" ON "KnowledgeDraft"("tenantId", "sdrId", "status");
CREATE INDEX "KnowledgeDraft_lote_idx" ON "KnowledgeDraft"("lote");

ALTER TABLE "KnowledgeDraft" ADD CONSTRAINT "KnowledgeDraft_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
