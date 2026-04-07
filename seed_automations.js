import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  
  for (const tenant of tenants) {
    const existing = await prisma.automation.findFirst({
      where: { tenantId: tenant.id, trigger: 'NEW_LEAD', name: 'Prospecção Automática (Fase 1)' }
    });

    if (!existing) {
      console.log(`[Seed] Criando regra de prospecção para ${tenant.name}...`);
      
      const nodes = [
        { id: 'trigger-1', type: 'TRIGGER', data: { label: 'Novo Lead', trigger: 'NEW_LEAD' }, position: { x: 0, y: 0 } },
        { id: 'action-1', type: 'ACTION', data: { label: 'Prospecção IA', type: 'PROSPECT_LEAD', config: {} }, position: { x: 0, y: 150 } }
      ];
      const edges = [{ id: 'e1-2', source: 'trigger-1', target: 'action-1' }];

      await prisma.automation.create({
        data: {
          name: 'Prospecção Automática (Fase 1)',
          description: 'Envia e-mail de abordagem IA assim que o lead é importado.',
          trigger: 'NEW_LEAD',
          active: true,
          tenantId: tenant.id,
          nodes: JSON.stringify(nodes),
          edges: JSON.stringify(edges)
        }
      });
    }

    const followUpExisting = await prisma.automation.findFirst({
      where: { tenantId: tenant.id, trigger: 'INACTIVITY', name: 'Follow-up 24h (WhatsApp)' }
    });

    if (!followUpExisting) {
      console.log(`[Seed] Criando regra de follow-up para ${tenant.name}...`);
      
      const nodes = [
        { 
          id: 'trigger-2', 
          type: 'TRIGGER', 
          data: { label: 'Inatividade 24h', trigger: 'INACTIVITY' }, 
          position: { x: 0, y: 0 } 
        },
        { 
          id: 'action-2', 
          type: 'ACTION', 
          data: { label: 'Cobrança WhatsApp IA', type: 'PROSPECT_LEAD', config: {} }, 
          position: { x: 0, y: 150 } 
        }
      ];
      const edges = [{ id: 'e2-2', source: 'trigger-2', target: 'action-2' }];

      await prisma.automation.create({
        data: {
          name: 'Follow-up 24h (WhatsApp)',
          description: 'Chama o lead no WhatsApp se ele não responder ao e-mail em 24h.',
          trigger: 'INACTIVITY',
          triggerConfig: JSON.stringify({ inactivityMinutes: 1440 }),
          active: true,
          tenantId: tenant.id,
          nodes: JSON.stringify(nodes),
          edges: JSON.stringify(edges)
        }
      });
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
