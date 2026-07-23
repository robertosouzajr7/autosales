import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Grade de planos v2 — entrada acessível para pequenos negócios.
 * Degraus de ~2x (97 → 197 → 497 → 997) + Enterprise sob consulta (inativo
 * na vitrine; vendido pelo comercial). Ver docs/precificacao-v2-acessivel.md.
 *
 * Custos unitários informativos (cálculo de margem no admin) calibrados para
 * Gemini 2.5 Flash: ~R$ 3,50 por 1M tokens ⇒ R$ 0,0035/1k. Mensagens via
 * Baileys não têm custo por envio.
 */
async function main() {
  console.log('🌱 Semeando grade de planos v2 (acessível)…');

  const plans = [
    {
      id: 'essencial-plan',
      name: 'Essencial',
      priceMonthly: 97.0,
      priceYearly: 970.0,

      // Hard limits — plano de entrada: negócio com 1–3 contatos novos/dia
      maxLeads: 300,
      maxSdrs: 1,
      maxUsers: 1,
      maxWhatsAppNumbers: 1,
      maxKnowledgeBaseChars: 20_000,

      // Créditos mensais
      maxTokens: 50_000,              // ~25-30 conversas AI completas
      maxMessages: 1_000,

      // Toggles de módulo — agenda/automações desde o 1º plano (valor imediato)
      enableSdr: true,
      enableTokens: true,
      enableMessages: true,
      enableCalendar: true,
      enableAutomations: true,
      enableWebhooks: false,

      sdrUnitCost: 1.0,
      tokenUnitCost: 0.0035,
      messageUnitCost: 0.0,

      features: JSON.stringify({
        support: 'Email',
        rag: false,
        priority: false,
      }),
      active: true,
    },
    {
      id: 'starter-plan',
      name: 'Starter',
      priceMonthly: 197.0,
      priceYearly: 1970.0,

      maxLeads: 1_000,
      maxSdrs: 1,
      maxUsers: 2,
      maxWhatsAppNumbers: 1,
      maxKnowledgeBaseChars: 50_000,

      maxTokens: 150_000,             // ~75-90 conversas AI
      maxMessages: 3_000,

      enableSdr: true,
      enableTokens: true,
      enableMessages: true,
      enableCalendar: true,
      enableAutomations: true,
      enableWebhooks: false,

      sdrUnitCost: 1.0,
      tokenUnitCost: 0.0035,
      messageUnitCost: 0.0,

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
      priceMonthly: 497.0,
      priceYearly: 4970.0,

      maxLeads: 3_000,
      maxSdrs: 3,
      maxUsers: 5,
      maxWhatsAppNumbers: 2,
      maxKnowledgeBaseChars: 150_000,

      maxTokens: 600_000,
      maxMessages: 10_000,

      enableSdr: true,
      enableTokens: true,
      enableMessages: true,
      enableCalendar: true,
      enableAutomations: true,
      enableWebhooks: true,

      sdrUnitCost: 1.0,
      tokenUnitCost: 0.0035,
      messageUnitCost: 0.0,

      features: JSON.stringify({
        support: 'Prioritário',
        rag: false,
        priority: true,
      }),
      active: true,
    },
    {
      id: 'escala-plan',
      name: 'Escala',
      priceMonthly: 997.0,
      priceYearly: 9970.0,

      maxLeads: 10_000,
      maxSdrs: 10,
      maxUsers: 15,
      maxWhatsAppNumbers: 5,
      maxKnowledgeBaseChars: 500_000,

      maxTokens: 2_000_000,
      maxMessages: 30_000,

      enableSdr: true,
      enableTokens: true,
      enableMessages: true,
      enableCalendar: true,
      enableAutomations: true,
      enableWebhooks: true,

      sdrUnitCost: 1.0,
      tokenUnitCost: 0.0035,
      messageUnitCost: 0.0,

      features: JSON.stringify({
        support: 'Implantação assistida',
        rag: true,
        priority: true,
      }),
      active: true,
    },
    {
      // Fora da vitrine: vendido sob consulta pelo comercial (redes/franquias).
      // Fica inativo para não aparecer na landing/checkout self-service.
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

      sdrUnitCost: 1.0,
      tokenUnitCost: 0.0035,
      messageUnitCost: 0.0,

      features: JSON.stringify({
        support: 'Gerente dedicado',
        rag: true,
        priority: true,
        sla: '4h',
      }),
      active: false,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }

  console.log('✅ Planos configurados: Essencial, Starter, Pro, Escala (+ Enterprise sob consulta)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
