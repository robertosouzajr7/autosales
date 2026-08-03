-- Guarda o último erro do Google por conta.
--
-- "Conectado" era só a existência de uma string de refresh token. Token
-- revogado, expirado (projeto OAuth em modo Testing expira em 7 dias) ou com
-- escopo errado deixava o painel afirmando que estava tudo certo enquanto toda
-- chamada falhava num console.error que ninguém lê.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "googleLastError" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "googleCheckedAt" TIMESTAMP(3);
