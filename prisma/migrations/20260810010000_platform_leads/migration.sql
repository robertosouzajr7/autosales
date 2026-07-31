-- Lead da plataforma: quem pede o diagnóstico na landing antes de existir
-- conta. Vive fora de qualquer tenant porque pertence ao dono do SaaS.
CREATE TABLE "PlatformLead" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "origem" TEXT NOT NULL DEFAULT 'QUIZ',
  "respostas" TEXT,
  "planoQrCode" TEXT,
  "planoOficial" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NOVO',
  "notes" TEXT,
  "convertedAt" TIMESTAMP(3),
  "importedLeadId" TEXT,
  "importedAt" TIMESTAMP(3),
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformLead_pkey" PRIMARY KEY ("id")
);

-- Refazer o diagnóstico atualiza o mesmo registro em vez de duplicar.
CREATE UNIQUE INDEX "PlatformLead_email_key" ON "PlatformLead"("email");
CREATE INDEX "PlatformLead_status_createdAt_idx" ON "PlatformLead"("status", "createdAt");
