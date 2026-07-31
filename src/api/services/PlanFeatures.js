/**
 * Traduz uma linha de Plan no que o comprador precisa ler.
 *
 * A vitrine não pode ter a sua própria lista de benefícios: quando alguém
 * desliga um módulo no painel do SaaS, a página tem que parar de prometê-lo
 * no mesmo instante. Por isso tudo aqui sai dos campos do plano — nenhum
 * texto é fixo por plano, só o rótulo de cada campo.
 *
 * Os rótulos são os mesmos do formulário do admin (PlansPanel), para quem
 * cadastra e quem compra estarem falando da mesma coisa.
 */

const milhar = (n) => Number(n || 0).toLocaleString("pt-BR");

const CATEGORIA_DISPARO = {
  MARKETING: "categoria marketing (promoções)",
  UTILITY: "categoria utilidade (lembretes e confirmações)",
  AUTHENTICATION: "categoria autenticação (códigos)",
};

/** Como o WhatsApp conecta — é o que separa os planos em dois mundos. */
export function descreverCanal(plan) {
  const modo = String(plan.whatsappMode || "BOTH").toUpperCase();
  if (modo === "OFFICIAL") {
    return {
      modo,
      titulo: "API oficial do WhatsApp",
      bom: ["Selo de conta verificada", "Número não corre risco de bloqueio", "Disparo em massa liberado pela Meta"],
      considere: ["A Meta cobra por mensagem de campanha", "Aprovação de templates leva algumas horas"],
    };
  }
  if (modo === "BAILEYS") {
    return {
      modo,
      titulo: "WhatsApp por QR Code",
      bom: ["Conecta em 1 minuto, lendo o QR", "Sem cobrança por mensagem", "Usa o número que você já tem"],
      considere: ["Canal não oficial: a Meta pode bloquear o número", "Sem selo de verificado"],
    };
  }
  return {
    modo,
    titulo: "QR Code ou API oficial",
    bom: ["Você escolhe como conectar", "Dá para começar no QR e migrar para o oficial"],
    considere: ["No canal oficial, a Meta cobra por mensagem de campanha"],
  };
}

/**
 * Limites numéricos do plano. Limite de módulo desligado não entra: dizer
 * "3 agentes de IA" num plano sem agente de IA é vender o que não existe.
 */
export function descreverLimites(plan) {
  const limites = [];
  const add = (rotulo, valor, detalhe) => limites.push({ rotulo, valor, detalhe: detalhe || null });

  add(
    "Conversas por mês",
    plan.maxConversations ? milhar(plan.maxConversations) : "Sem limite",
    "Janelas de atendimento de 24h abertas por clientes"
  );
  add("Pessoas na equipe", milhar(plan.maxUsers));
  add("Números conectados", milhar(plan.maxWhatsAppNumbers));
  add("Contatos na base", plan.maxLeads ? milhar(plan.maxLeads) : "Sem limite");

  if (plan.enableSdr) add("Agentes de IA", milhar(plan.maxSdrs));
  if (plan.enableTokens) {
    add("Créditos de IA por mês", `${milhar(plan.maxTokens)} tokens`, "Renovam todo mês");
  }
  if (plan.maxKnowledgeBaseChars) {
    add("Treino do agente", `${milhar(Math.round(plan.maxKnowledgeBaseChars / 1000))} mil caracteres`);
  }
  if (plan.maxCampaignMessages > 0) {
    add(
      "Disparos em massa por mês",
      milhar(plan.maxCampaignMessages),
      CATEGORIA_DISPARO[String(plan.campaignCategory || "MARKETING").toUpperCase()] || null
    );
  }
  return limites;
}

/**
 * Módulos do plano, ligados e desligados. O que está fora aparece também:
 * comparar dois planos exige saber o que falta em cada um, e um recurso
 * omitido vira surpresa depois da compra.
 */
export function descreverRecursos(plan) {
  const recursos = [
    { chave: "enableSdr", rotulo: "Agente de IA que atende sozinho", ativo: !!plan.enableSdr },
    { chave: "enableCalendar", rotulo: "Agenda no Google Calendar", ativo: !!plan.enableCalendar },
    { chave: "enableAutomations", rotulo: "Lembretes e confirmação automáticos", ativo: !!plan.enableAutomations },
    { chave: "campanhas", rotulo: "Disparo em massa por template", ativo: plan.maxCampaignMessages > 0 },
    { chave: "enableVoice", rotulo: "Agente ouve e responde em áudio", ativo: !!plan.enableVoice },
    // Voz premium sem voz é toggle órfão: não muda nada para quem compra.
    { chave: "enablePremiumVoice", rotulo: "Vozes premium", ativo: !!(plan.enableVoice && plan.enablePremiumVoice) },
    { chave: "enableWebhooks", rotulo: "API pública e webhooks (CRM)", ativo: !!plan.enableWebhooks },
    { chave: "enableTokens", rotulo: "Créditos de IA inclusos", ativo: !!plan.enableTokens },
  ];
  return recursos;
}

/** Tudo junto, do jeito que a página consome. */
export function descreverPlano(plan) {
  return {
    canal: descreverCanal(plan),
    limites: descreverLimites(plan),
    recursos: descreverRecursos(plan),
  };
}

/**
 * O plano como ele pode aparecer para quem não tem conta. Os custos
 * unitários (sdrUnitCost, tokenUnitCost, messageUnitCost) são a margem da
 * operação e não saem em rota pública; o stripePriceId também não interessa
 * a ninguém de fora.
 */
export function publicar(plan) {
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    whatsappMode: plan.whatsappMode,
    descricao: descreverPlano(plan),
  };
}

export default { descreverPlano, descreverLimites, descreverRecursos, descreverCanal, publicar };
