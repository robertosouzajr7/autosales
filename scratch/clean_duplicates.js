import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanDuplicates() {
  console.log('🔍 Buscando leads duplicados...');
  const allLeads = await prisma.lead.findMany({
    select: { id: true, phone: true, tenantId: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });

  const seen = new Set();
  const toDelete = [];

  for (const lead of allLeads) {
    if (!lead.phone) continue;
    const key = `${lead.phone}-${lead.tenantId}`;
    if (seen.has(key)) {
      toDelete.push(lead.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    console.log(`🗑️ Removendo ${toDelete.length} leads duplicados...`);
    await prisma.lead.deleteMany({
      where: { id: { in: toDelete } }
    });
    console.log('✅ Duplicados removidos.');
  } else {
    console.log('✅ Nenhum duplicado encontrado.');
  }
}

cleanDuplicates()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
