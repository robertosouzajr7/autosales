-- Prova do aceite dos Termos e da Política de Privacidade.
--
-- Guardar só um booleano "aceitou" não prova nada: numa disputa é preciso
-- dizer QUANDO, QUAL VERSÃO do texto e DE ONDE veio o aceite. As contas que
-- já existem ficam com os campos nulos — elas assinaram antes da regra, e
-- inventar uma data de aceite que não aconteceu seria pior que não ter.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedIp" TEXT;
