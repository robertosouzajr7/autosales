import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const tenants = await prisma.tenant.findMany({ include: { plan: true } });
    const plans = await prisma.plan.findMany();
    const sdrs = await prisma.sdrBot.findMany();
    const automations = await prisma.automation.count();
    const settings = await prisma.landingPageSettings.findMany();

    console.log("--- RESULTS ---");
    console.log("Tenants:", tenants.length);
    tenants.forEach(t => console.log(` - ${t.name} (${t.email}), Plan: ${t.plan?.name || "None"}`));
    
    console.log("Plans:", plans.length);
    plans.forEach(p => console.log(` - ${p.name} (R$ ${p.priceMonthly})`));
    
    console.log("SDRs:", sdrs.length);
    sdrs.forEach(s => console.log(` - ${s.name} (Tenant: ${s.tenantId})`));

    console.log("Automations Count:", automations);
    
    console.log("Landing Settings:", settings.length);
    settings.forEach(s => console.log(` - Selected SDR: ${s.selectedSdrId}`));
  } catch (e) {
    console.error("DB Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
