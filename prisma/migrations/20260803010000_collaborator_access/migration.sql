-- Gestão de colaboradores: ativação e permissões por módulo.
--
-- O campo `role` existia mas não era usado para nada: qualquer pessoa da
-- conta enxergava e mexia em tudo, inclusive um atendente.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "active"        BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions"   TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jobTitle"      TEXT;
