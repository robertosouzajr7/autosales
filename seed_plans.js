import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Grade de planos v2 — entrada acessível para pequenos negócios.
 * Degraus de ~2x (97 → 197 → 497 → 997) + Enterprise sob consulta (inativo
 * na vitrine; vendido pelo comercial). Ver docs/precificacao-v2-acessivel.md.
 *
 * Franquias de tokens dimensionadas para uso REAL: cada conversa completa do
 * agente consome ~40k tokens (o contexto do negócio + base de conhecimento é
 * reenviado a cada turno). Ver docs/precificacao-v2-acessivel.md.
 *
 * Custo calibrado para Gemini 2.5 Flash (~R$ 3,50/1M ⇒ R$ 0,0035/1k). Não há
 * custo por agente nem por mensagem (WhatsApp via Baileys é gratuito), então
 * sdrUnitCost e messageUnitCost são 0 — o único custo variável é o token.
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
      maxTokens: 10_000_000,          // ~250 conversas completas (~8/dia)
      maxMessages: 3_000,

      // Toggles de módulo — agenda/automações desde o 1º plano (valor imediato)
      enableSdr: true,
      enableTokens: true,
      enableMessages: true,
      enableCalendar: true,
      enableAutomations: true,
      enableWebhooks: false,

      sdrUnitCost: 0.0,
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

      maxTokens: 25_000_000,          // ~625 conversas completas (~20/dia)
      maxMessages: 8_000,

      enableSdr: true,
      enableTokens: true,
      enableMessages: true,
      enableCalendar: true,
      enableAutomations: true,
      enableWebhooks: false,

      sdrUnitCost: 0.0,
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

      maxTokens: 60_000_000,          // ~1.500 conversas completas (~50/dia)
      maxMessages: 20_000,

      enableSdr: true,
      enableTokens: true,
      enableMessages: true,
      enableCalendar: true,
      enableAutomations: true,
      enableWebhooks: true,

      sdrUnitCost: 0.0,
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

      maxTokens: 150_000_000,         // ~3.750 conversas completas (~125/dia)
      maxMessages: 50_000,

      enableSdr: true,
      enableTokens: true,
      enableMessages: true,
      enableCalendar: true,
      enableAutomations: true,
      enableWebhooks: true,

      sdrUnitCost: 0.0,
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

      maxTokens: 300_000_000,         // sob consulta
      maxMessages: 100_000,

      enableSdr: true,
      enableTokens: true,
      enableMessages: true,
      enableCalendar: true,
      enableAutomations: true,
      enableWebhooks: true,

      sdrUnitCost: 0.0,
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
