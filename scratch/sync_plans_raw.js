import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const plans = [
    { 
      id: "basic-plan",
      name: "BASIC", 
      priceMonthly: 197, 
      priceYearly: 0, 
      maxLeads: 300, 
      maxSdrs: 1, 
      maxTokens: 50000, 
      maxProspects: 100, 
      maxResearch: 10, 
      maxMessages: 1000,
      active: 1,
      features: JSON.stringify({ aiEnabled: true, support: "Email" })
    },
    { 
      id: "pro-plan",
      name: "PRO", 
      priceMonthly: 797, 
      priceYearly: 0, 
      maxLeads: 10000, 
      maxSdrs: 5, 
      maxTokens: 500000, 
      maxProspects: 1000, 
      maxResearch: 100, 
      maxMessages: 10000,
      active: 1,
      features: JSON.stringify({ aiEnabled: true, support: "WhatsApp", bulkMessaging: true, calendar: true })
    },
    { 
      id: "enterprise-plan",
      name: "ENTERPRISE", 
      priceMonthly: 997, 
      priceYearly: 0, 
      maxLeads: 999999, 
      maxSdrs: 20, 
      maxTokens: 2000000, 
      maxProspects: 10000, 
      maxResearch: 500, 
      maxMessages: 50000,
      active: 1,
      features: JSON.stringify({ aiEnabled: true, support: "Gerente Dedicado", bulkMessaging: true, calendar: true, webhooks: true })
    },
    { 
      id: "vitalicio-plan",
      name: "VITALICIO", 
      priceMonthly: 0, 
      priceYearly: 0, 
      maxLeads: 9999999, 
      maxSdrs: 999, 
      maxTokens: 999999999, 
      maxProspects: 9999999, 
      maxResearch: 9999999, 
      maxMessages: 9999999, 
      active: 1,
      features: JSON.stringify({ aiEnabled: true, webhookEnabled: true, bulkMessaging: true, calendar: true, crmIntegration: true })
    }
  ];

  for (const p of plans) {
    console.log(`Upserting ${p.name}...`);
    // Check if exists
    const exists = await prisma.$queryRaw`SELECT id FROM Plan WHERE id = ${p.id}`;
    if (Array.isArray(exists) && exists.length > 0) {
      await prisma.$executeRaw`
        UPDATE Plan SET 
          name = ${p.name}, 
          priceMonthly = ${p.priceMonthly}, 
          priceYearly = ${p.priceYearly}, 
          maxLeads = ${p.maxLeads}, 
          maxSdrs = ${p.maxSdrs}, 
          maxTokens = ${p.maxTokens}, 
          maxProspects = ${p.maxProspects}, 
          maxResearch = ${p.maxResearch}, 
          maxMessages = ${p.maxMessages}, 
          active = ${p.active}, 
          features = ${p.features},
          updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${p.id}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO Plan (id, name, priceMonthly, priceYearly, maxLeads, maxSdrs, maxTokens, maxProspects, maxResearch, maxMessages, active, features, createdAt, updatedAt)
        VALUES (${p.id}, ${p.name}, ${p.priceMonthly}, ${p.priceYearly}, ${p.maxLeads}, ${p.maxSdrs}, ${p.maxTokens}, ${p.maxProspects}, ${p.maxResearch}, ${p.maxMessages}, ${p.active}, ${p.features}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    }
  }

  // Deactivate others
  const ids = plans.map(p => p.id).join("','");
  await prisma.$executeRawUnsafe(`UPDATE Plan SET active = 0 WHERE id NOT IN ('${ids}')`);

  console.log("✅ Planos atualizados via Raw SQL.");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
