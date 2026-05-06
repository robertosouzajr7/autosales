import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanup() {
  console.log("🚀 Iniciando limpeza de leads de grupos e canais...");

  try {
    // 1. Identificar leads que possuem JIDs de grupos ou canais no campo 'phone'
    const leadsToDelete = await prisma.lead.findMany({
      where: {
        OR: [
          { phone: { contains: "@g.us" } },
          { phone: { contains: "@newsletter" } },
          { phone: { contains: "@broadcast" } },
          { phone: { startsWith: "12036" } }, // Padrão de IDs de grupo mencionado pelo usuário
          { name: { contains: "@g.us" } }
        ]
      },
      select: { id: true, name: true, phone: true }
    });

    console.log(`[Limpeza] Encontrados ${leadsToDelete.length} leads inválidos.`);

    if (leadsToDelete.length === 0) {
      console.log("✅ Nenhum lead inválido encontrado.");
      return;
    }

    const ids = leadsToDelete.map(l => l.id);

    // 2. Deletar mensagens e conversas primeiro (devido às constraints do banco)
    const deletedMsgs = await prisma.message.deleteMany({
      where: { conversation: { leadId: { in: ids } } }
    });
    
    const deletedConvs = await prisma.conversation.deleteMany({
      where: { leadId: { in: ids } }
    });

    // 3. Deletar os leads
    const deletedLeads = await prisma.lead.deleteMany({
      where: { id: { in: ids } }
    });

    console.log(`✅ Limpeza concluída!`);
    console.log(`- Mensagens removidas: ${deletedMsgs.count}`);
    console.log(`- Conversas removidas: ${deletedConvs.count}`);
    console.log(`- Leads removidos: ${deletedLeads.count}`);

  } catch (error) {
    console.error("❌ Erro durante a limpeza:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
