import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const enrichCount = await prisma.lead.count({
    where: { isToEnrich: true }
  });
  
  const discoveredLeads = await prisma.lead.findMany({
    where: { status: "DISCOVERED" },
    take: 5
  });

  console.log(`Leads aguardando BDR (isToEnrich: true): ${enrichCount}`);
  console.log(`Leads na lista de espera (DISCOVERED): ${discoveredLeads.length}`);
  if (discoveredLeads.length > 0) {
    console.log("Exemplo de lead descoberto:", discoveredLeads[0].name);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
