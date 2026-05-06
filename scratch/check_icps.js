import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const icps = await prisma.icpProfile.findMany({});
  console.log(JSON.stringify(icps, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
