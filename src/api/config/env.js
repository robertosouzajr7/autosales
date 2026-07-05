import dotenv from "dotenv";
dotenv.config();

// SEGURANÇA: o JWT_SECRET é obrigatório e não tem fallback. Um segredo padrão
// conhecido permitiria forjar tokens de qualquer tenant (inclusive SUPERADMIN).
// O processo falha no boot se o segredo estiver ausente ou for o valor vazado.
const JWT_SECRET = process.env.JWT_SECRET;

const LEAKED_DEFAULT = "vendai-secret-key-2026";

if (!JWT_SECRET) {
  console.error(
    "[CONFIG] JWT_SECRET não definido. Defina-o no ambiente antes de iniciar.\n" +
    '  Gere um: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
  );
  process.exit(1);
}

if (JWT_SECRET === LEAKED_DEFAULT) {
  console.error(
    "[CONFIG] JWT_SECRET está usando o valor padrão que vazou no repositório. " +
    "Gere um novo segredo e rotacione (ver SECRETS_ROTATION.md)."
  );
  process.exit(1);
}

if (JWT_SECRET.length < 32) {
  console.warn("[CONFIG] JWT_SECRET tem menos de 32 caracteres; use um segredo mais forte.");
}

export { JWT_SECRET };
