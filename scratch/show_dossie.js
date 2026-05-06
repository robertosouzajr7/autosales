import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Busca leads que foram enriquecidos (status ENRICHED ou que têm extractedData com decisionMaker)
  const enrichedLeads = await prisma.lead.findMany({
    where: {
      status: "ENRICHED",
    },
    take: 3
  });

  // Também busca qualquer lead com extractedData preenchido
  const withData = await prisma.lead.findMany({
    where: {
      extractedData: { not: null },
      isToEnrich: false
    },
    take: 3
  });

  console.log(`\n=== LEADS ENRIQUECIDOS (status=ENRICHED): ${enrichedLeads.length} ===`);
  enrichedLeads.forEach(lead => {
    console.log(`\n📋 Lead: ${lead.name}`);
    try {
      const data = JSON.parse(lead.extractedData || '{}');
      console.log(`  🎯 Decisor: ${data.decisionMaker?.name || 'N/A'} (${data.decisionMaker?.role || 'N/A'})`);
      console.log(`  🔗 LinkedIn: ${data.decisionMaker?.linkedIn || 'N/A'}`);
      console.log(`  🏢 Empresa: ${data.companyInfo?.name || 'N/A'}`);
      console.log(`  🌐 Site: ${data.companyInfo?.website || 'N/A'}`);
      console.log(`  📧 Emails: ${(data.contacts?.emails || []).join(', ') || 'N/A'}`);
      console.log(`  📱 Telefones extras: ${(data.contacts?.phones || []).join(', ') || 'N/A'}`);
      console.log(`  💡 Insight: ${(data.strategicInsights || 'N/A').substring(0, 100)}...`);
      console.log(`  💬 IceBreaker: ${(data.iceBreaker || 'N/A').substring(0, 150)}...`);
    } catch(e) { console.log('  [Erro ao parsear dados]'); }
  });

  console.log(`\n=== LEADS COM DADOS EXTRAÍDOS: ${withData.length} ===`);
  withData.forEach(lead => {
    if (!enrichedLeads.find(e => e.id === lead.id)) {
      console.log(`  - ${lead.name} (status: ${lead.status})`);
    }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
