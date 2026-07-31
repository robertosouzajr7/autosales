import prisma from "./prisma.js";

/**
 * Confere, no boot, se o banco está na mesma versão do código.
 *
 * Subir código novo sem rodar as migrations deixava o servidor de pé e
 * quebrando só na hora do uso, com uma mensagem crua do Prisma
 * ("The column `Lead.mergedCount` does not exist") escondida no log — do
 * lado de quem usa parecia que "o front quebrou", porque as telas abriam
 * e as listas vinham vazias.
 *
 * Aqui a falha aparece no primeiro segundo, dizendo exatamente o que fazer.
 */

/**
 * Colunas e tabelas que cada migration recente trouxe. Não precisa listar
 * tudo — basta uma amostra por migration, que é o que denuncia a falta.
 */
const EXIGIDOS = [
  { migration: "20260801010000_appointment_routines", tabela: "AppointmentReminder" },
  { migration: "20260802010000_attendance_queues", tabela: "ServiceQueue" },
  { migration: "20260803010000_collaborator_access", tabela: "User", coluna: "permissions" },
  { migration: "20260804010000_contact_cdp", tabela: "ContactIdentity" },
  { migration: "20260804010000_contact_cdp", tabela: "Lead", coluna: "mergedCount" },
];

async function existe({ tabela, coluna }) {
  if (coluna) {
    const r = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
      tabela,
      coluna
    );
    return r.length > 0;
  }
  const r = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1`,
    tabela
  );
  return r.length > 0;
}

/**
 * @returns lista de migrations que faltam. Vazia = banco em dia.
 */
export async function checarSchema() {
  const faltando = new Set();
  for (const alvo of EXIGIDOS) {
    try {
      if (!(await existe(alvo))) faltando.add(alvo.migration);
    } catch {
      // Sem acesso ao information_schema não dá para concluir nada; melhor
      // seguir calado do que travar o boot por causa da checagem.
      return [];
    }
  }
  return [...faltando];
}

/** Roda a checagem e grita alto se o banco estiver atrasado. */
export async function avisarSeSchemaAtrasado() {
  const faltando = await checarSchema();
  if (!faltando.length) return true;

  const linha = "─".repeat(64);
  console.error(`\n${linha}`);
  console.error("❌ BANCO DESATUALIZADO — o servidor vai responder com erro nas telas.");
  console.error(`\nMigrations que faltam aplicar:`);
  faltando.forEach((m) => console.error(`   • ${m}`));
  console.error(`\nRode isto no servidor, com a DATABASE_URL de produção:\n`);
  console.error(`   npm run migrate:deploy\n`);
  console.error("Depois reinicie a API. Enquanto isso, listas de contatos e");
  console.error("outras telas continuam vazias ou com erro.");
  console.error(`${linha}\n`);
  return false;
}

export default { checarSchema, avisarSeSchemaAtrasado };
