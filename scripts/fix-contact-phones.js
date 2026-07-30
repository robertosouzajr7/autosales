/**
 * Limpa o campo `phone` dos contatos.
 *
 * Até a correção da identidade por canal, `phone` era usado como chave de todos
 * os canais e acabava recebendo IGSID do Instagram, id de visitante do site e
 * LID do WhatsApp. Este script move o identificador para `externalId` e deixa
 * em `phone` só o que é telefone de verdade.
 *
 *   node scripts/fix-contact-phones.js           # mostra o que faria
 *   node scripts/fix-contact-phones.js --aplicar # grava as mudanças
 *
 * A migration 20260730010000 já faz essa limpeza em SQL; este script serve
 * para inspecionar o resultado e tratar o que sobrou.
 */
import prisma from "../src/api/config/prisma.js";
import { normalizePhone } from "../src/api/services/ContactIdentity.js";

const APLICAR = process.argv.includes("--aplicar");

async function main() {
  const leads = await prisma.lead.findMany({
    select: { id: true, name: true, phone: true, email: true, channel: true, externalId: true, igUsername: true },
  });

  const ajustes = [];
  for (const l of leads) {
    const limpo = normalizePhone(l.phone);
    const patch = {};

    // Preserva o identificador antes de limpar o telefone.
    if (!l.externalId && l.phone) patch.externalId = l.phone;
    if (l.phone !== limpo) patch.phone = limpo;
    // Nome que ficou igual ao identificador não ajuda a identificar ninguém.
    if (l.name && /^\d+$/.test(String(l.name).trim())) {
      patch.name =
        l.channel === "INSTAGRAM" ? "Contato do Instagram"
        : l.channel === "SITE" ? "Visitante do site"
        : "Contato do WhatsApp";
    }

    if (Object.keys(patch).length) ajustes.push({ lead: l, patch });
  }

  console.log(`Contatos analisados: ${leads.length}`);
  console.log(`Precisam de ajuste:  ${ajustes.length}\n`);

  const porMotivo = { telefoneInvalido: 0, nomeNumerico: 0, soExternalId: 0 };
  for (const { patch } of ajustes) {
    if (patch.phone === null) porMotivo.telefoneInvalido++;
    else if (patch.name) porMotivo.nomeNumerico++;
    else porMotivo.soExternalId++;
  }
  console.log(`  telefone não era telefone (será esvaziado): ${porMotivo.telefoneInvalido}`);
  console.log(`  nome era só números (vira rótulo do canal):  ${porMotivo.nomeNumerico}`);
  console.log(`  apenas preencher externalId:                 ${porMotivo.soExternalId}\n`);

  for (const { lead, patch } of ajustes.slice(0, 20)) {
    const de = `${lead.channel} · nome="${lead.name}" · phone="${lead.phone ?? ""}"`;
    const para = Object.entries(patch).map(([k, v]) => `${k}="${v ?? ""}"`).join(" ");
    console.log(`  ${de}\n    → ${para}`);
  }
  if (ajustes.length > 20) console.log(`  … e outros ${ajustes.length - 20}.`);

  if (!APLICAR) {
    console.log("\nNada foi alterado. Rode com --aplicar para gravar.");
    return;
  }

  let feitos = 0;
  for (const { lead, patch } of ajustes) {
    try {
      await prisma.lead.update({ where: { id: lead.id }, data: patch });
      feitos++;
    } catch (e) {
      // Colisão no índice único (phone, tenantId) pode acontecer se dois
      // contatos tiverem o mesmo telefone; nesse caso só esvaziamos o duplicado.
      console.warn(`  ! ${lead.id}: ${e.message.split("\n").pop()}`);
    }
  }
  console.log(`\n${feitos} de ${ajustes.length} contatos atualizados.`);
}

main()
  .catch((e) => { console.error("Falhou:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
