-- Vídeos da área de membros. No banco porque quem publica é o dono do SaaS,
-- que não pode depender de deploy para subir uma aula nova.
CREATE TABLE "AcademyVideo" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "url" TEXT NOT NULL,
  "modulo" TEXT NOT NULL DEFAULT 'Primeiros passos',
  "duracao" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademyVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcademyVideo_modulo_order_idx" ON "AcademyVideo"("modulo", "order");
