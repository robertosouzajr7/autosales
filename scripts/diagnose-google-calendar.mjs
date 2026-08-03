/**
 * Diagnóstico do Google Calendar, conta por conta.
 *
 *   DATABASE_URL=... node scripts/diagnose-google-calendar.mjs
 *   DATABASE_URL=... node scripts/diagnose-google-calendar.mjs <tenantId>
 *
 * Testa a corrente inteira e diz em qual elo ela quebra. O teste decisivo é
 * criar um evento descartável daqui a um ano, ver se o Google devolve sala do
 * Meet e apagá-lo em seguida — a única resposta que não depende de suposição
 * sobre tipo de conta, escopo ou configuração da agenda.
 *
 * Não mexe em nenhum agendamento existente.
 */
import prisma from "../src/api/config/prisma.js";
import CalendarService from "../calendar_service.js";

const alvo = process.argv[2];

const env = (nome) => (process.env[nome] ? "definido" : "AUSENTE");
console.log("Ambiente do servidor:");
for (const nome of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]) {
  console.log(`  ${nome}: ${env(nome)}`);
}
if (process.env.GOOGLE_REDIRECT_URI) {
  console.log(`  (o redirect precisa ser exatamente este no Google Cloud: ${process.env.GOOGLE_REDIRECT_URI})`);
}

const tenants = await prisma.tenant.findMany({
  where: alvo ? { id: alvo } : { googleRefreshToken: { not: null } },
  select: { id: true, name: true, googleRefreshToken: true },
});

if (!tenants.length) {
  console.log("\nNenhuma conta com Google conectado.");
  await prisma.$disconnect();
  process.exit(0);
}

const marca = (v) => (v ? "✓" : "✗");

for (const t of tenants) {
  console.log(`\n── ${t.name} (${t.id})`);
  const r = await CalendarService.diagnosticar(t.id);
  console.log(`  ${marca(r.configurado)} credenciais no servidor`);
  console.log(`  ${marca(r.tokenSalvo)} conta autorizada`);
  console.log(`  ${marca(r.tokenValido)} autorização ainda válida`);
  console.log(`  ${marca(r.escreveNaAgenda)} consegue gravar na agenda`);
  console.log(`  ${marca(r.geraMeet)} gera link do Meet`);
  if (r.erro) console.log(`\n  → ${r.erro}`);
  if (r.detalhe) console.log(`  (resposta do Google: ${r.detalhe})`);

  const semLink = await prisma.appointment.count({
    where: { tenantId: t.id, status: "SCHEDULED", date: { gte: new Date() }, meetLink: null },
  });
  const comLink = await prisma.appointment.count({
    where: { tenantId: t.id, status: "SCHEDULED", date: { gte: new Date() }, meetLink: { not: null } },
  });
  console.log(`\n  Agendamentos futuros: ${comLink} com link, ${semLink} sem.`);
  if (semLink && r.geraMeet) {
    console.log("  Rode: node scripts/backfill-meet-links.mjs");
  }
}

await prisma.$disconnect();
