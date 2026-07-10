import dotenv from "dotenv";

// Este módulo é avaliado durante a resolução de imports, antes do corpo do
// app.js rodar — carrega o .env aqui para o fail-fast enxergar a variável.
dotenv.config();

// Segredo do JWT vem exclusivamente do ambiente. Sem fallback:
// um segredo previsível permitiria forjar tokens (inclusive SUPERADMIN).
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    "[FATAL] JWT_SECRET ausente ou muito curto (mínimo 32 caracteres). " +
    "Defina a variável de ambiente JWT_SECRET antes de iniciar o servidor."
  );
  process.exit(1);
}

export default JWT_SECRET;
