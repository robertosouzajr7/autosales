-- Régua de lembretes do agendamento.
--
-- Antes o ciclo de vida do agendamento era marcado com flags dentro de
-- Appointment.notes ("[REMINDER_SENT]"), o que impedia saber QUANDO cada
-- lembrete deveria sair, reenviar o que falhou ou mostrar a régua na tela.

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "meetLink"      TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "confirmedAt"   TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "cancelledAt"   TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AppointmentReminder" (
  "id"            TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "kind"          TEXT NOT NULL,
  "runAt"         TIMESTAMP(3) NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "sentAt"        TIMESTAMP(3),
  "channel"       TEXT,
  "error"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

-- Uma linha por momento da régua: é o que torna o envio idempotente.
CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentReminder_appointmentId_kind_key"
  ON "AppointmentReminder" ("appointmentId", "kind");

CREATE INDEX IF NOT EXISTS "AppointmentReminder_status_runAt_idx"
  ON "AppointmentReminder" ("status", "runAt");

DO $$ BEGIN
  ALTER TABLE "AppointmentReminder"
    ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Régua e automações de funil configuráveis por tenant.
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "remindersEnabled"    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "bookedEnabled"       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "confirmEnabled"      BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "meetLinkEnabled"     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "finalEnabled"        BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "noShowEnabled"       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "postServiceEnabled"  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "pipelineAutoEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "meetLinkMinutes"  INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "confirmTemplateId" TEXT;
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "bookedMsgTemplate" TEXT;
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "meetMsgTemplate"   TEXT;
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "finalMsgTemplate"  TEXT;
ALTER TABLE "AutomationConfig" ADD COLUMN IF NOT EXISTS "stageMap"          TEXT;
