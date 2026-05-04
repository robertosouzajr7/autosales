import prisma from './src/api/config/prisma.js';

async function main() {
  const accounts = await prisma.whatsAppAccount.findMany();
  console.log(JSON.stringify(accounts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
