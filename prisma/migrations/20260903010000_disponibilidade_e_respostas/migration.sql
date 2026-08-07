-- Disponibilidade do atendente: é o que decide para quem a fila transfere.
ALTER TABLE "User" ADD COLUMN "disponibilidade" TEXT NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "User" ADD COLUMN "disponivelAte" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "recadoDeAusencia" TEXT;

-- Respostas rápidas: antes eram quatro frases fixas no código do painel.
CREATE TABLE "QuickReply" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "atalho" TEXT,
    "categoria" TEXT,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadaPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuickReply_tenantId_ativa_idx" ON "QuickReply"("tenantId", "ativa");

ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
