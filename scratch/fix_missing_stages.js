import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixMissingStages() {
  console.log('🔍 Buscando leads sem stageId...');
  const leadsWithoutStage = await prisma.lead.findMany({
    where: { stageId: null }
  });

  if (leadsWithoutStage.length === 0) {
    console.log('✅ Todos os leads já possuem stageId.');
    return;
  }

  console.log(`🛠️ Corrigindo ${leadsWithoutStage.length} leads...`);

  // Agrupar leads por tenantId para buscar a primeira etapa de cada um
  const tenants = [...new Set(leadsWithoutStage.map(l => l.tenantId))];
  
  for (const tenantId of tenants) {
    const firstStage = await prisma.pipelineStage.findFirst({
      where: { tenantId },
      orderBy: { order: 'asc' }
    });

    if (firstStage) {
      await prisma.lead.updateMany({
        where: { tenantId, stageId: null },
        data: { stageId: firstStage.id }
      });
      console.log(`✅ Tenant ${tenantId}: leads movidos para "${firstStage.name}"`);
    } else {
      console.log(`⚠️ Tenant ${tenantId}: não possui etapas de pipeline cadastradas.`);
    }
  }

  console.log('🏁 Processo finalizado.');
}

fixMissingStages()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
