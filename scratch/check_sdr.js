import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkSdrStatus() {
  const tenants = await prisma.tenant.findMany();
  console.log(`--- Tenants (${tenants.length}) ---`);
  
  for (const t of tenants) {
    const sdrCount = await prisma.sdrBot.count({ where: { tenantId: t.id } });
    const activeSdrCount = await prisma.sdrBot.count({ where: { tenantId: t.id, active: true } });
    console.log(`Tenant: ${t.name} (${t.id})`);
    console.log(`  SDRs: ${sdrCount} (${activeSdrCount} ativos)`);
    
    if (sdrCount > 0) {
      const sdrs = await prisma.sdrBot.findMany({ where: { tenantId: t.id } });
      sdrs.forEach(s => console.log(`    - [${s.active ? 'Ativo' : 'Inativo'}] ${s.name} (${s.role})`));
    }
  }
}

checkSdrStatus()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
