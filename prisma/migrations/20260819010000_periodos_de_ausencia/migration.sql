-- Períodos em que o negócio não atende (feriado, recesso, plantão) e o aviso
-- automático enviado a quem escrever nesse intervalo.
CREATE TABLE "AwayPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pauseAi" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AwayPeriod_pkey" PRIMARY KEY ("id")
);

-- Um aviso por contato por período: sem isto, toda mensagem do cliente
-- durante o recesso traria a mesma resposta automática de volta.
CREATE TABLE "AwayNotice" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AwayNotice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AwayPeriod_tenantId_active_startsAt_endsAt_idx"
    ON "AwayPeriod"("tenantId", "active", "startsAt", "endsAt");
CREATE UNIQUE INDEX "AwayNotice_periodId_leadId_key" ON "AwayNotice"("periodId", "leadId");

ALTER TABLE "AwayPeriod" ADD CONSTRAINT "AwayPeriod_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AwayNotice" ADD CONSTRAINT "AwayNotice_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "AwayPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
