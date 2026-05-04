import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.tenant.findMany({include: {whatsappAccounts: true}})
  .then(t => console.log(JSON.stringify(t, null, 2)))
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
