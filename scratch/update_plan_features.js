import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const plans = [
    { 
      id: "basic-plan",
      name: "BASIC", 
      priceMonthly: 197, 
      maxLeads: 300, 
      maxSdrs: 1, 
      maxTokens: 50000, 
      maxProspects: 100, 
      maxResearch: 10, 
      maxMessages: 1000,
      active: 1,
      features: JSON.stringify({ 
        crm: true, 
        scheduler: true, 
        chat: true, 
        prospector: true, 
        automations: "Básicas", 
        channels: "1 Canal",
        massMessaging: false,
        deepResearch: false
      })
    },
    { 
      id: "pro-plan",
      name: "PRO", 
      priceMonthly: 797, 
      maxLeads: 10000, 
      maxSdrs: 5, 
      maxTokens: 500000, 
      maxProspects: 1000, 
      maxResearch: 100, 
      maxMessages: 10000,
      active: 1,
      features: JSON.stringify({ 
        crm: true, 
        scheduler: true, 
        chat: true, 
        prospector: true, 
        automations: "Avançadas", 
        channels: "Ilimitados",
        massMessaging: true,
        deepResearch: true
      })
    },
    { 
      id: "enterprise-plan",
      name: "ENTERPRISE", 
      priceMonthly: 997, 
      maxLeads: 999999, 
      maxSdrs: 20, 
      maxTokens: 2000000, 
      maxProspects: 10000, 
      maxResearch: 500, 
      maxMessages: 50000,
      active: 1,
      features: JSON.stringify({ 
        crm: true, 
        scheduler: true, 
        chat: true, 
        prospector: true, 
        automations: "Customizadas", 
        channels: "Ilimitados",
        massMessaging: true,
        deepResearch: true,
        webhooks: true,
        prioritySupport: true
      })
    }
  ];

  for (const p of plans) {
    await prisma.$executeRaw`
      UPDATE Plan SET 
        features = ${p.features}
      WHERE id = ${p.id}
    `;
  }

  console.log("✅ Features dos planos atualizadas.");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
