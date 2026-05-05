import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTenantKeys() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, aiApiKey: true, openAiKey: true }
  });
  
  for (const t of tenants) {
    console.log(`Tenant: ${t.name} (${t.id})`);
    console.log(`  aiApiKey: ${t.aiApiKey ? t.aiApiKey.substring(0, 8) + '...' : 'NULL'}`);
    console.log(`  openAiKey: ${t.openAiKey ? t.openAiKey.substring(0, 8) + '...' : 'NULL'}`);
  }
}

checkTenantKeys()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
