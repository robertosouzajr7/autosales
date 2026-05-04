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
      active: true,
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
      active: true,
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
      active: true,
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
      active: true,
      features: JSON.stringify({ aiEnabled: true, webhookEnabled: true, bulkMessaging: true, calendar: true, crmIntegration: true })
    }
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan
    });
  }

  // Deactivate old plans that are not in the new list
  const newPlanIds = plans.map(p => p.id);
  await prisma.plan.updateMany({
    where: { id: { notIn: newPlanIds } },
    data: { active: false }
  });

  console.log("✅ Planos atualizados com sucesso.");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
