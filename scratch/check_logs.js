import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.prospectionLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { icp: true }
  });
  console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
