import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create a Master Tenant
  const masterTenant = await prisma.tenant.upsert({
    where: { email: 'contato@autosales.com' },
    update: {},
    create: {
      id: 'master-tenant',
      name: 'AutoSales Master',
      email: 'contato@autosales.com',
      subscriptionStatus: 'ACTIVE',
      systemPrompt: 'Você é um SDR altamente capacitado da AutoSales. Seu objetivo é qualificar leads e agendar reuniões.',
    },
  });
  console.log(`✅ Master Tenant created: ${masterTenant.name}`);

  // 2. Create some sample leads
  const leads = [
    { name: 'Ana Oliveira', phone: '5511999991111', email: 'ana@gmail.com', status: 'NEW', source: 'Google Maps' },
    { name: 'Bruno Santos', phone: '5511999992222', email: 'bruno@outbox.com', status: 'QUALIFYING', source: 'Instagram' },
    { name: 'Carla Dias', phone: '5511999993333', email: 'carla@empresa.com', status: 'APPOINTMENT', source: 'Indicação' },
    { name: 'Daniel Silva', phone: '5511999994444', email: 'daniel@tech.io', status: 'CONVERTED', source: 'WhatsApp' },
  ];

  for (const lead of leads) {
    await prisma.lead.upsert({
      where: { id: `sample-${lead.name.toLowerCase().replace(' ', '-')}` }, // Artificial ID for upsert
      update: {},
      create: {
        ...lead,
        tenantId: masterTenant.id,
      },
    });
  }
  console.log(`✅ Sample leads seeded.`);

  // 3. Create a default SDR Bot
  await prisma.sdrBot.upsert({
    where: { id: 'default-sdr-bot' },
    update: {},
    create: {
      id: 'default-sdr-bot',
      name: 'Agente Principal',
      role: 'OUTBOUND',
      prompt: 'Você é um SDR focado em qualificar novos leads frios vindos do Google Maps.',
      tenantId: masterTenant.id,
      active: true,
    }
  });
  console.log(`✅ Default SDR Bot created.`);

  console.log('🚀 Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
