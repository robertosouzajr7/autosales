-- A confirmação de e-mail passou a travar o painel. Quem já usa a plataforma
-- assinou antes dessa regra existir e não pode ser trancado do lado de fora
-- por uma exigência criada depois: as contas que já existem entram como
-- confirmadas. A trava vale só para quem se cadastrar a partir de agora.
UPDATE "User"
SET "emailVerified" = true
WHERE "emailVerified" = false
  AND "emailVerificationToken" IS NULL;
