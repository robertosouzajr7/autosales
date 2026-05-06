import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const latestLeads = await prisma.lead.findMany({
    where: { source: "AUTO-HUNTER" },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log("=== ÚLTIMOS LEADS REAIS ENCONTRADOS ===");
  latestLeads.forEach(lead => {
    console.log(`Nome: ${lead.name}`);
    console.log(`Telefone: ${lead.phone}`);
    console.log(`Notas: ${lead.notes.substring(0, 100)}...`);
    console.log("-----------------------------------");
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
