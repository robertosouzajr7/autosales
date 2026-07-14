import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Planos alinhados ao produto real: IA de agendamento no WhatsApp.
 * Quotas calibradas pelo custo operacional (tokens Gemini, mensagens Meta).
 * Custos unitários informativos (usados no cálculo de margem no admin).
 */
async function main() {
  console.log('🌱 Semeando planos alinhados ao produto atual…');

  const plans = [
    {
      id: 'starter-plan',
      name: 'Starter',
      priceMonthly: 297.0,
      priceYearly: 2970.0,

      // Hard limits
      maxLeads: 500,
      maxSdrs: 1,
      maxUsers: 2,
      maxWhatsAppNumbers: 1,
      maxKnowledgeBaseChars: 50_000, // ~35 páginas de texto

      // Créditos mensais
      maxTokens: 100_000,             // ~50 conversas AI médias
      maxMessages: 2_000,             // envios WhatsApp / mês

      // Toggles de módulo
      enableSdr: true,
      enableTokens: true,
      enableMessages: true,
      enableCalendar: true,          // Google Calendar já no Starter
      enableAutomations: true,       // lembretes básicos
      enableWebhooks: false,         // API pública só a partir do Pro

      // Custos operacionais (para admin ver margem)
      sdrUnitCost: 15.0,
      tokenUnitCost: 0.08,
      messageUnitCost: 0.05,

      features: JSON.stringify({
        support: 'Email',
        rag: false,
        priority: false,
      }),
      active: true,
    },
    {
      id: 'pro-plan',
      name: 'Pro',
      priceMonthly: 797.0,
      priceYearly: 7970.0,

      maxLeads: 3_000,
      maxSdrs: 3,
      maxUsers: 5,
      maxWhatsAppNumbers: 2,
      maxKnowledgeBaseChars: 150_000,

      maxTokens: 500_000,
      maxMessages: 10_000,

      enableSdr: true,
      enableTokens: true,
      enableMessages: true,
      enableCalendar: true,
      enableAutomations: true,
      enableWebhooks: true,

      sdrUnitCost: 15.0,
      tokenUnitCost: 0.08,
      messageUnitCost: 0.05,

      features: JSON.stringify({
        support: 'Prioritário',
        rag: false,
        priority: true,
      }),
      active: true,
    },
    {
      id: 'enterprise-plan',
      name: 'Enterprise',
      priceMonthly: 1997.0,
      priceYearly: 19970.0,

      maxLeads: 20_000,
      maxSdrs: 10,
      maxUsers: 20,
      maxWhatsAppNumbers: 10,
      maxKnowledgeBaseChars: 500_000,

      maxTokens: 2_500_000,
      maxMessages: 50_000,

      enableSdr: true,
      enableTokens: true,
      enableMessages: true,
      enableCalendar: true,
      enableAutomations: true,
      enableWebhooks: true,

      sdrUnitCost: 15.0,
      tokenUnitCost: 0.08,
      messageUnitCost: 0.05,

      features: JSON.stringify({
        support: 'Gerente dedicado',
        rag: true,
        priority: true,
        sla: '4h',
      }),
      active: true,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }

  console.log('✅ Planos configurados: Starter, Pro, Enterprise');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
