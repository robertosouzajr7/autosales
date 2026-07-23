import { PrismaClient } from "@prisma/client";

/**
 * Ferramenta de TESTE: ajusta o estado de assinatura de um tenant para
 * simular cenários (trial expirado, trial ativo, pagamento pendente, etc.).
 *
 * Uso:
 *   node scripts/set-trial.js <email> [dias]
 *
 *   <email>  e-mail do usuário (OWNER) ou do tenant.
 *   [dias]   dias a partir de hoje para o fim do trial. Default: -1
 *            (ontem → trial EXPIRADO / acesso bloqueado).
 *            Ex.: 7 = trial ativo por mais 7 dias.
 *
 *   Flags especiais no lugar de [dias]:
 *     past_due  → marca a assinatura como pagamento pendente
 *     canceled  → marca como cancelada
 *     active    → marca como ativa (30 dias de próxima cobrança)
 */
const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  const arg = (process.argv[3] || "-1").trim();
  if (!email) {
    console.error("Uso: node scripts/set-trial.js <email> [dias|past_due|canceled|active]");
    process.exit(1);
  }

  let tenant = await prisma.tenant.findFirst({ where: { email } });
  if (!tenant) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
  }
  if (!tenant) {
    console.error(`❌ Nenhum tenant/usuário encontrado para "${email}".`);
    process.exit(1);
  }

  let data;
  if (arg === "past_due") {
    data = { subscriptionStatus: "PAST_DUE" };
  } else if (arg === "canceled") {
    data = { subscriptionStatus: "CANCELED" };
  } else if (arg === "active") {
    data = { subscriptionStatus: "ACTIVE", nextBillingDate: new Date(Date.now() + 30 * 86400000) };
  } else {
    const days = parseInt(arg, 10);
    if (Number.isNaN(days)) {
      console.error(`❌ Valor inválido: "${arg}". Use um número de dias ou past_due/canceled/active.`);
      process.exit(1);
    }
    const trialEnd = new Date(Date.now() + days * 86400000);
    data = { subscriptionStatus: "TRIAL", trialEnd, nextBillingDate: trialEnd, stripeSubscriptionId: null };
  }

  const updated = await prisma.tenant.update({ where: { id: tenant.id }, data });
  console.log(`✅ ${updated.name} (${updated.email})`);
  console.log(`   status: ${updated.subscriptionStatus}`);
  console.log(`   trialEnd: ${updated.trialEnd ? updated.trialEnd.toISOString() : "—"}`);
  const blocked =
    updated.subscriptionStatus === "PAST_DUE" ||
    updated.subscriptionStatus === "CANCELED" ||
    (updated.subscriptionStatus === "TRIAL" && updated.trialEnd && updated.trialEnd < new Date());
  console.log(`   acesso: ${blocked ? "🔒 BLOQUEADO" : "🟢 liberado"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
