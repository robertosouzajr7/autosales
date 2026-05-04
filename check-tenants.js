import prisma from './src/api/config/prisma.js';

async function main() {
  const tenants = await prisma.tenant.findMany({
    include: {
      whatsappAccounts: true,
      sdrs: true
    }
  });
  console.log(JSON.stringify(tenants, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
