-- Identidade do contato por canal. Antes o campo `phone` era usado como chave
-- de identidade de todos os canais e acabava recebendo IGSID, id de visitante
-- e LID — valores que não são telefone.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "igUsername" TEXT;

CREATE INDEX IF NOT EXISTS "Lead_tenantId_channel_externalId_idx"
  ON "Lead" ("tenantId", "channel", "externalId");

-- Preserva o identificador atual antes da limpeza: o que está em `phone` hoje
-- é o identificador do canal, mesmo quando não é telefone.
UPDATE "Lead" SET "externalId" = "phone"
WHERE "externalId" IS NULL AND "phone" IS NOT NULL AND "phone" <> '';

-- Limpa o que não é telefone: com letra, curto//longo demais ou repetição.
-- Só dígitos de 10 a 15 posições permanecem.
UPDATE "Lead" SET "phone" = NULL
WHERE "phone" IS NOT NULL
  AND (
    "phone" = ''
    OR "phone" ~ '[A-Za-z]'
    OR LENGTH(REGEXP_REPLACE("phone", '\D', '', 'g')) < 10
    OR LENGTH(REGEXP_REPLACE("phone", '\D', '', 'g')) > 15
    OR REGEXP_REPLACE("phone", '\D', '', 'g') ~ '^(.)\1+$'
  );

-- Normaliza os que sobraram para dígitos puros.
UPDATE "Lead" SET "phone" = REGEXP_REPLACE("phone", '\D', '', 'g')
WHERE "phone" IS NOT NULL AND "phone" ~ '\D';

-- Nome que ficou igual ao identificador (só dígitos) vira rótulo por canal.
UPDATE "Lead" SET "name" = CASE
    WHEN "channel" = 'INSTAGRAM' THEN 'Contato do Instagram'
    WHEN "channel" = 'SITE' THEN 'Visitante do site'
    ELSE 'Contato do WhatsApp'
  END
WHERE "name" ~ '^\d+$';
