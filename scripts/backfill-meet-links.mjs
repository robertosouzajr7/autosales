/**
 * Busca no Google o link do Meet dos agendamentos que ficaram sem ele.
 *
 *   DATABASE_URL=... node scripts/backfill-meet-links.mjs [--todos]
 *
 * Alcança os compromissos que têm evento no Google mas meetLink vazio — os que
 * nasceram enquanto a sala ainda estava sendo criada. Por padrão mexe só nos
 * futuros e ainda agendados, que são os que alguém vai abrir; --todos varre o
 * histórico também.
 *
 * Só lê e grava o link: não cria, não move e não apaga evento nenhum.
 */
import prisma from "../src/api/config/prisma.js";
import CalendarService from "../calendar_service.js";

const todos = process.argv.includes("--todos");

const alvos = await prisma.appointment.findMany({
  where: {
    googleEventId: { not: null },
    meetLink: null,
    ...(todos ? {} : { status: "SCHEDULED", date: { gte: new Date() } }),
  },
  orderBy: { date: "asc" },
});

console.log(`${alvos.length} agendamento(s) com evento no Google e sem link.`);

let achados = 0;
for (const appt of alvos) {
  const link = await CalendarService.garantirLink(appt);
  const quando = appt.date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (link) {
    achados++;
    console.log(`  ✓ ${quando} — ${appt.title}: ${link}`);
  } else {
    console.log(`  – ${quando} — ${appt.title}: o evento não tem Meet`);
  }
}

console.log(`\n${achados} link(s) gravado(s).`);
await prisma.$disconnect();
