/**
 * Normaliza o status das conexões que não são via QR.
 *
 * Números migrados para a API oficial costumam deixar a pasta auth_info para
 * trás. Até esta correção, o Baileys tentava restaurá-los no boot, falhava e
 * gravava DISCONNECTED por cima de uma conexão oficial que estava funcionando.
 * Este script acerta as linhas que ficaram com o valor errado.
 *
 *   node scripts/fix-connection-status.js
 */
import prisma from "../src/api/config/prisma.js";

async function main() {
  const accounts = await prisma.whatsAppAccount.findMany({
    select: { id: true, name: true, status: true, phoneId: true, accessToken: true, channel: true },
  });

  const managedElsewhere = accounts.filter(
    (a) => a.channel === "INSTAGRAM" || (a.phoneId && a.accessToken)
  );
  const wrong = managedElsewhere.filter((a) => a.status !== "CONNECTED");

  console.log(`Conexões no total: ${accounts.length}`);
  console.log(`Oficiais/Instagram: ${managedElsewhere.length}`);
  console.log(`Com status incorreto: ${wrong.length}`);

  for (const a of wrong) {
    await prisma.whatsAppAccount.update({
      where: { id: a.id },
      data: { status: "CONNECTED" },
    });
    const tipo = a.channel === "INSTAGRAM" ? "Instagram" : "Cloud API";
    console.log(`  ✓ ${a.name} (${tipo}): ${a.status} → CONNECTED`);
  }

  console.log(wrong.length ? "\nPronto." : "\nNada a corrigir.");
}

main()
  .catch((e) => {
    console.error("Falhou:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
