/**
 * Funções (papéis) do agente de IA e catálogo de skills.
 *
 * Cada função é um preset: persona-base + skills ligadas por padrão.
 * O dono do negócio escolhe a função ao criar o agente e pode ajustar
 * as skills individualmente depois.
 *
 * "Skill" = uma capacidade que o engine traduz em ferramentas (tools)
 * expostas ao modelo. Ver automation_engine.js → skillsToToolNames().
 */

// Catálogo de skills disponíveis (o que aparece pra ligar/desligar na UI).
export const SKILLS = [
  { id: "schedule",       label: "Agendar horários",        desc: "Consulta a agenda e marca compromissos." },
  { id: "qualify",        label: "Qualificar (SPIN)",       desc: "Descobre necessidade, dor e urgência antes de ofertar." },
  { id: "send_catalog",   label: "Enviar catálogo/mídia",   desc: "Apresenta produtos e envia foto/áudio/vídeo do item." },
  { id: "move_pipeline",  label: "Mover no funil",          desc: "Avança o lead de etapa no CRM automaticamente." },
  { id: "tag_lead",       label: "Marcar com tags",         desc: "Etiqueta o lead conforme a conversa (ex.: 'quente')." },
  { id: "escalate_human", label: "Escalar para humano",     desc: "Passa a conversa para a equipe quando necessário." },
];

export const SKILL_IDS = SKILLS.map((s) => s.id);

// Presets de função.
export const AGENT_FUNCTIONS = {
  SDR: {
    id: "SDR",
    label: "SDR (pré-vendas)",
    hint: "Qualifica e agenda reuniões com o time comercial",
    persona:
      "Você é um SDR profissional de pré-vendas. Seu objetivo é qualificar o lead " +
      "usando SPIN Selling (Situação, Problema, Implicação, Necessidade) e agendar " +
      "uma reunião. Seja consultivo, faça uma pergunta por vez e escute mais do que fala.",
    skills: ["qualify", "schedule", "move_pipeline", "tag_lead", "escalate_human"],
  },
  SELLER: {
    id: "SELLER",
    label: "Vendedor",
    hint: "Apresenta produtos, tira dúvidas e conduz ao fechamento",
    persona:
      "Você é um vendedor experiente e simpático. Descobre a necessidade do cliente, " +
      "apresenta os produtos/serviços do catálogo (enviando fotos quando ajudar), trata " +
      "objeções com o método LAER e conduz ao fechamento. Nunca invente preço — use o catálogo.",
    skills: ["qualify", "send_catalog", "move_pipeline", "tag_lead", "escalate_human", "schedule"],
  },
  SUPPORT: {
    id: "SUPPORT",
    label: "Atendimento / Suporte",
    hint: "Responde dúvidas e resolve problemas dos clientes",
    persona:
      "Você é um atendente de suporte cordial e eficiente. Responde dúvidas com base na " +
      "base de conhecimento, resolve problemas comuns e, quando o assunto exige um humano " +
      "(reclamação, caso complexo), escala para a equipe com todo o contexto.",
    skills: ["escalate_human", "tag_lead", "send_catalog"],
  },
  SCHEDULER: {
    id: "SCHEDULER",
    label: "Agendador / Recepcionista",
    hint: "Foco em marcar horários na agenda",
    persona:
      "Você é uma recepcionista virtual. Seu foco é acolher, entender o que o cliente " +
      "precisa e marcar o horário na agenda. Confirme sempre profissional, serviço, data " +
      "e hora antes de fechar. Nunca dê diagnóstico nem orientação técnica.",
    skills: ["schedule", "escalate_human", "tag_lead"],
  },
  CONSULTANT: {
    id: "CONSULTANT",
    label: "Consultor",
    hint: "Abordagem consultiva com diagnóstico e recomendação",
    persona:
      "Você é um consultor especialista. Faz um diagnóstico da situação do cliente com " +
      "perguntas abertas, recomenda a melhor solução do catálogo com justificativa e, " +
      "quando faz sentido, agenda uma conversa aprofundada. Nunca empurre — recomende.",
    skills: ["qualify", "send_catalog", "schedule", "tag_lead", "escalate_human"],
  },
};

export function getFunctionPreset(id) {
  return AGENT_FUNCTIONS[id] || AGENT_FUNCTIONS.SCHEDULER;
}

export function listFunctions() {
  return Object.values(AGENT_FUNCTIONS).map((f) => ({
    id: f.id,
    label: f.label,
    hint: f.hint,
    skills: f.skills,
  }));
}

// Parse seguro das skills salvas no SdrBot; se vazio, usa o default da função.
export function resolveSkills(sdr) {
  let skills = null;
  try {
    if (sdr?.skills) skills = JSON.parse(sdr.skills);
  } catch {
    skills = null;
  }
  if (!Array.isArray(skills) || skills.length === 0) {
    skills = getFunctionPreset(sdr?.agentFunction).skills;
  }
  return skills.filter((s) => SKILL_IDS.includes(s));
}
