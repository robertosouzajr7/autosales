/**
 * Limpa a base que já existe: normaliza telefones, funde contatos repetidos
 * e preenche a tabela de identidades do CDP.
 *
 *   DATABASE_URL=... node scripts/dedupe-contacts.mjs            (simulação)
 *   DATABASE_URL=... node scripts/dedupe-contacts.mjs --aplicar  (grava)
 *   ... --tenant <id>   restringe a uma conta
 *
 * Roda quantas vezes for preciso: é idempotente.
 */
import prisma from "../src/api/config/prisma.js";
import {
  buildIdentifiers, mergeLeads, normalizePhone, normalizeEmail,
} from "../src/api/services/ContactIdentity.js";

const aplicar = process.argv.includes("--aplicar");
const tenantArg = process.argv.indexOf("--tenant");
const tenantFiltro = tenantArg > -1 ? process.argv[tenantArg + 1] : null;

const log = (...a) => console.log(...a);

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: tenantFiltro ? { id: tenantFiltro } : {},
    select: { id: true, name: true },
  });

  let totalFundidos = 0;
  let totalNormalizados = 0;
  let totalIdentidades = 0;

  for (const tenant of tenants) {
    const leads = await prisma.lead.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" },
    });
    if (!leads.length) continue;

    // 1. Agrupa por chave de identidade. O primeiro a reivindicar uma chave
    // vira dono; quem chegar depois com a mesma chave é duplicata dele.
    const donoDaChave = new Map();
    const fusoes = new Map(); // canônicoId -> Set(perdedores)

    for (const lead of leads) {
      const chaves = buildIdentifiers({
        phone: lead.phone,
        email: lead.email,
        channel: lead.channel,
        externalId: lead.externalId,
        igUsername: lead.igUsername,
        extraPhones: lead.extraPhones,
        extraEmails: lead.extraEmails,
      });
      if (!chaves.length) continue;

      // Se qualquer chave já tem dono, este lead pertence àquele contato.
      let canonico = null;
      for (const c of chaves) {
        const dono = donoDaChave.get(`${c.type}|${c.value}`);
        if (dono && dono !== lead.id) { canonico = raiz(fusoes, dono); break; }
      }

      if (canonico) {
        if (!fusoes.has(canonico)) fusoes.set(canonico, new Set());
        fusoes.get(canonico).add(lead.id);
        for (const c of chaves) donoDaChave.set(`${c.type}|${c.value}`, canonico);
      } else {
        for (const c of chaves) if (!donoDaChave.has(`${c.type}|${c.value}`)) donoDaChave.set(`${c.type}|${c.value}`, lead.id);
      }
    }

    const duplicatas = [...fusoes.values()].reduce((n, s) => n + s.size, 0);
    if (duplicatas) {
      log(`\n${tenant.name}: ${duplicatas} contato(s) duplicado(s) em ${fusoes.size} pessoa(s).`);
      for (const [canonico, perdedores] of fusoes) {
        const dono = leads.find((l) => l.id === canonico);
        for (const perdedorId of perdedores) {
          const p = leads.find((l) => l.id === perdedorId);
          log(`  ${dono?.name || canonico} (${dono?.phone || dono?.email || "—"})  ←  ${p?.name} (${p?.phone || p?.email || "—"})`);
          if (aplicar) {
            await mergeLeads(canonico, perdedorId).catch((e) => log(`  ! falhou: ${e.message}`));
          }
        }
      }
      totalFundidos += duplicatas;
    }

    // 2. Telefone/e-mail em formato antigo passam para o formato canônico.
    const vivos = aplicar
      ? await prisma.lead.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "asc" } })
      : leads;

    for (const lead of vivos) {
      const patch = {};
      const tel = normalizePhone(lead.phone);
      const mail = normalizeEmail(lead.email);
      if (tel && tel !== lead.phone) patch.phone = tel;
      if (mail && mail !== lead.email) patch.email = mail;
      // Telefone que na verdade era IGSID/lixo sai do campo.
      if (lead.phone && !tel) patch.phone = null;

      if (Object.keys(patch).length) {
        totalNormalizados++;
        if (aplicar) {
          const conflito = patch.phone
            ? await prisma.lead.findFirst({
                where: { tenantId: tenant.id, phone: patch.phone, id: { not: lead.id } },
                select: { id: true },
              })
            : null;
          if (conflito) {
            await mergeLeads(conflito.id, lead.id).catch(() => {});
            continue;
          }
          await prisma.lead.update({ where: { id: lead.id }, data: patch }).catch(() => {});
        }
      }

      // 3. Backfill das identidades.
      const chaves = buildIdentifiers({
        phone: patch.phone ?? lead.phone,
        email: patch.email ?? lead.email,
        channel: lead.channel,
        externalId: lead.externalId,
        igUsername: lead.igUsername,
        extraPhones: lead.extraPhones,
        extraEmails: lead.extraEmails,
      });
      totalIdentidades += chaves.length;
      if (aplicar) {
        for (const c of chaves) {
          await prisma.contactIdentity
            .upsert({
              where: { tenantId_type_value: { tenantId: tenant.id, type: c.type, value: c.value } },
              update: {},
              create: { tenantId: tenant.id, leadId: lead.id, type: c.type, value: c.value, rawValue: c.rawValue, source: "BACKFILL" },
            })
            .catch(() => {});
        }
      }
    }
  }

  log(`\n${aplicar ? "Aplicado" : "Simulação"}:`);
  log(`  contatos duplicados fundidos ....... ${totalFundidos}`);
  log(`  telefones/e-mails normalizados ..... ${totalNormalizados}`);
  log(`  chaves de identidade registradas ... ${totalIdentidades}`);
  if (!aplicar) log(`\nNada foi gravado. Rode com --aplicar para valer.`);

  await prisma.$disconnect();
}

/** Segue a cadeia de fusões até o contato que sobrou de verdade. */
function raiz(fusoes, id) {
  for (const [canonico, perdedores] of fusoes) {
    if (perdedores.has(id)) return canonico;
  }
  return id;
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
