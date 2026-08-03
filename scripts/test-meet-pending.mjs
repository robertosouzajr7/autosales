/**
 * Sala do Meet criada DEPOIS da resposta do insert.
 *
 *   DATABASE_URL=... node scripts/test-meet-pending.mjs
 *
 * O Google responde o insert com createRequest.status = "pending" e sem
 * hangoutLink; a sala fica pronta segundos depois. Quem lê só a resposta do
 * insert grava meetLink nulo numa reunião que TEM link — e o painel, o
 * lembrete e o agente passam a jurar que não existe link.
 *
 * Aqui a API do Google é dublada nesse comportamento exato.
 */
import prisma from "../src/api/config/prisma.js";
import { google } from "googleapis";
import CalendarService from "../calendar_service.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const LINK = "https://meet.google.com/xyz-1234-abc";

// Dublê do Google: o insert devolve "pending" e sem link; o get só passa a
// devolver o link a partir da 2ª leitura, imitando a espera real.
let leituras = 0;
let inserts = 0;
google.calendar = () => ({
  events: {
    insert: async () => {
      inserts++;
      return {
        data: {
          id: "evt-pendente",
          conferenceData: { createRequest: { status: { statusCode: "pending" } } },
        },
      };
    },
    get: async () => {
      leituras++;
      return leituras >= 2
        ? { data: { id: "evt-pendente", hangoutLink: LINK } }
        : { data: { id: "evt-pendente", conferenceData: { createRequest: { status: { statusCode: "pending" } } } } };
    },
    list: async () => ({ data: { items: [] } }),
  },
});

async function main() {
  const plan = await prisma.plan.create({
    data: { name: `Pend ${Date.now()}`, priceMonthly: 0, priceYearly: 0, enableCalendar: true },
  });
  const tenant = await prisma.tenant.create({
    data: {
      name: "Pendente", email: `pd${Date.now()}@teste.local`, planId: plan.id,
      googleRefreshToken: "refresh-de-teste",
    },
  });
  const lead = await prisma.lead.create({
    data: { tenantId: tenant.id, name: "Maria", phone: "5571999990000" },
  });

  // ── 1. Criação espera a sala ficar pronta ───────────────────
  console.log("\n1. Evento criado com a sala ainda pendente");
  const r = await CalendarService.criarEvento(tenant.id, {
    titulo: "Consulta", inicio: new Date(Date.now() + 3600e3), fim: new Date(Date.now() + 7200e3), lead,
  });
  ok(inserts === 1, "inseriu o evento");
  ok(r.googleEventId === "evt-pendente", "guardou o id do evento");
  ok(r.meetLink === LINK, `e voltou para buscar o link até achar (${r.meetLink})`);
  ok(leituras >= 2, `releu o evento enquanto estava pendente (${leituras} leitura(s))`);

  // ── 2. Conserto de quem já ficou sem link ───────────────────
  console.log("\n2. Agendamento antigo, com evento mas sem link");
  leituras = 5; // já resolvido no Google
  const orfao = await prisma.appointment.create({
    data: {
      tenantId: tenant.id, leadId: lead.id, title: "Antigo",
      date: new Date(Date.now() + 3 * 3600e3), status: "SCHEDULED",
      googleEventId: "evt-pendente", meetLink: null,
    },
  });
  const achado = await CalendarService.garantirLink(orfao);
  ok(achado === LINK, `acha o link no Google (${achado})`);
  const gravado = await prisma.appointment.findUnique({ where: { id: orfao.id } });
  ok(gravado.meetLink === LINK, "e grava no agendamento, para o painel mostrar");

  // ── 3. Sem evento no Google, não inventa nada ───────────────
  console.log("\n3. Compromisso sem evento no Google");
  const local = await prisma.appointment.create({
    data: {
      tenantId: tenant.id, leadId: lead.id, title: "Presencial",
      date: new Date(Date.now() + 4 * 3600e3), status: "SCHEDULED",
    },
  });
  ok((await CalendarService.garantirLink(local)) === null, "devolve nulo, sem chamar o Google");

  console.log(falhas === 0 ? "\n✅ Todos os cenários passaram." : `\n❌ ${falhas} falha(s).`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
