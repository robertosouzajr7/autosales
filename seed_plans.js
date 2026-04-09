import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Semeando planos com features granulares...');

  const plans = [
    {
      id: "starter-plan",
      name: 'Starter',
      priceMonthly: 297.0,
      priceYearly: 2970.0,
      maxLeads: 100,
      maxSdrs: 1,
      maxTokens: 50000,
      features: JSON.stringify({
        whatsapp: true,
        email: true,
        calendar: false,
        webhooks: false,
        bulkMessaging: false,
        crmIntegration: false,
        aiAgents: 1,
        support: "Email"
      }),
    },
    {
      id: "pro-plan",
      name: 'Pro',
      priceMonthly: 797.0,
      priceYearly: 7970.0,
      maxLeads: 1000,
      maxSdrs: 5,
      maxTokens: 250000,
      features: JSON.stringify({
        whatsapp: true,
        email: true,
        calendar: true,
        webhooks: true,
        bulkMessaging: true,
        crmIntegration: false,
        aiAgents: 5,
        support: "Prioritário"
      }),
    },
    {
      id: "enterprise-plan",
      name: 'Enterprise',
      priceMonthly: 1997.0, // Base inicial para enterprise
      priceYearly: 19970.0,
      maxLeads: 999999,
      maxSdrs: 99,
      maxTokens: 10000000,
      features: JSON.stringify({
        whatsapp: true,
        email: true,
        calendar: true,
        webhooks: true,
        bulkMessaging: true,
        crmIntegration: true,
        aiAgents: 99,
        support: "Gerente de Conta Dedicado"
      }),
    }
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }

  console.log('✅ Planos configurados com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
