/**
 * Catálogo de gatilhos dos fluxos.
 *
 * Fonte única: o builder monta a tela a partir daqui (via GET
 * /automations/triggers) e o motor decide se um evento casa com o fluxo
 * usando `matchesTrigger`. Antes a lista vivia hardcoded no frontend com
 * quatro opções, enquanto o motor conhecia outras — e nenhuma delas tinha
 * filtro configurável além de palavra-chave.
 *
 * Cada gatilho declara:
 *   id, label, hint  — o que aparece na tela
 *   categoria        — agrupamento (conversa, atendimento, agenda, funil…)
 *   campos           — configuração específica, renderizada dinamicamente
 */

/** Tipos de campo que a tela sabe renderizar. */
export const FIELD_TYPES = ["text", "textarea", "number", "select", "tags", "cron"];

const CANAL = {
  key: "channel",
  label: "Somente no canal",
  type: "select",
  opcional: true,
  hint: "Deixe em branco para valer em qualquer canal.",
  options: [
    { value: "", label: "Qualquer canal" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "SITE", label: "Site / webchat" },
  ],
};

/**
 * Convivência com o agente de IA enquanto o fluxo roda. O padrão é pausar: se
 * os dois falam ao mesmo tempo, o cliente recebe mensagens contraditórias.
 */
const IA_DURANTE = {
  key: "aiDuring",
  label: "Enquanto este fluxo roda",
  type: "select",
  padrao: "pause",
  options: [
    { value: "pause", label: "Pausar o agente de IA (recomendado)" },
    { value: "allow", label: "Deixar o agente responder junto" },
  ],
  hint: "Pausado, o agente só volta a responder quando o fluxo terminar.",
};

export const TRIGGERS = [
  // ── Contato e conversa ─────────────────────────────────────────
  {
    id: "NEW_LEAD",
    label: "Novo contato",
    hint: "Quando um contato entra na base (formulário, importação, primeira mensagem).",
    categoria: "contato",
    campos: [CANAL, IA_DURANTE],
  },
  {
    id: "FIRST_MESSAGE",
    label: "Primeira mensagem do contato",
    hint: "Só na primeira vez que a pessoa escreve. Ideal para boas-vindas.",
    categoria: "contato",
    campos: [CANAL, IA_DURANTE],
  },
  {
    id: "INCOMING_MESSAGE",
    label: "Qualquer mensagem recebida",
    hint: "Toda vez que o contato manda algo. Use com cuidado: dispara muito.",
    categoria: "contato",
    campos: [CANAL, IA_DURANTE],
  },
  {
    id: "KEYWORD",
    label: "Palavra ou frase na mensagem",
    hint: "Dispara quando a mensagem contém o que você listar.",
    categoria: "contato",
    campos: [
      { key: "keywords", label: "Palavras / frases", type: "tags", hint: "Ex.: preço, orçamento, quero comprar." },
      {
        key: "match",
        label: "Como comparar",
        type: "select",
        padrao: "word",
        options: [
          { value: "word", label: "Palavra inteira (recomendado)" },
          { value: "contains", label: "Em qualquer parte do texto" },
          { value: "exact", label: "Mensagem exatamente igual" },
        ],
      },
      CANAL,
      IA_DURANTE,
    ],
  },
  {
    id: "BUTTON_CLICK",
    label: "Clique em botão ou menu",
    hint: "Quando o contato escolhe uma opção enviada por botões ou lista.",
    categoria: "contato",
    campos: [
      {
        key: "buttonIds",
        label: "Ids ou títulos das opções",
        type: "tags",
        opcional: true,
        hint: "Deixe vazio para qualquer opção. Ex.: opt_1, Confirmar.",
      },
      CANAL,
      IA_DURANTE,
    ],
  },
  {
    id: "MEDIA_RECEIVED",
    label: "Recebeu mídia",
    hint: "Áudio, imagem, vídeo ou documento enviado pelo contato.",
    categoria: "contato",
    campos: [
      {
        key: "mediaType",
        label: "Tipo de mídia",
        type: "select",
        opcional: true,
        options: [
          { value: "", label: "Qualquer mídia" },
          { value: "AUDIO", label: "Áudio" },
          { value: "IMAGE", label: "Imagem" },
          { value: "VIDEO", label: "Vídeo" },
          { value: "DOCUMENT", label: "Documento" },
        ],
      },
      CANAL,
      IA_DURANTE,
    ],
  },
  {
    id: "INACTIVITY",
    label: "Sem resposta há um tempo",
    hint: "O contato parou de responder e o tempo limite passou.",
    categoria: "contato",
    campos: [
      { key: "inactivityMinutes", label: "Tempo sem resposta", type: "number", unidade: "minutos", padrao: 1440 },
      IA_DURANTE,
    ],
  },
  {
    id: "OPT_OUT",
    label: "Pediu para não receber mais",
    hint: "O contato mandou uma palavra de descadastro (SAIR, PARAR).",
    categoria: "contato",
    campos: [IA_DURANTE],
  },

  // ── Atendimento humano ─────────────────────────────────────────
  {
    id: "HANDOFF_QUEUED",
    label: "Entrou na fila de atendimento",
    hint: "A IA (ou um operador) transferiu a conversa para a fila humana.",
    categoria: "atendimento",
    campos: [{ key: "queueName", label: "Somente na fila", type: "text", opcional: true }, IA_DURANTE],
  },
  {
    id: "ATTENDANCE_ASSIGNED",
    label: "Atendente assumiu a conversa",
    hint: "Alguém da equipe pegou o atendimento.",
    categoria: "atendimento",
    campos: [IA_DURANTE],
  },
  {
    id: "ATTENDANCE_CLOSED",
    label: "Atendimento encerrado",
    hint: "A conversa foi encerrada pelo painel. Bom para pesquisa de satisfação.",
    categoria: "atendimento",
    campos: [IA_DURANTE],
  },

  // ── Agenda ─────────────────────────────────────────────────────
  {
    id: "APPOINTMENT_CREATED",
    label: "Novo agendamento",
    hint: "O contato marcou um horário (pelo agente, pelo link ou pelo painel).",
    categoria: "agenda",
    campos: [IA_DURANTE],
  },
  {
    id: "APPOINTMENT_CONFIRMED",
    label: "Presença confirmada",
    hint: "O contato clicou em confirmar no lembrete.",
    categoria: "agenda",
    campos: [IA_DURANTE],
  },
  {
    id: "APPOINTMENT_CANCELLED",
    label: "Agendamento cancelado",
    hint: "Cancelado pelo contato ou pelo painel.",
    categoria: "agenda",
    campos: [IA_DURANTE],
  },
  {
    id: "APPOINTMENT_NOSHOW",
    label: "Faltou (no-show)",
    hint: "Passou a tolerância e o contato não apareceu.",
    categoria: "agenda",
    campos: [IA_DURANTE],
  },
  {
    id: "APPOINTMENT_COMPLETED",
    label: "Atendimento concluído",
    hint: "O agendamento foi marcado como concluído.",
    categoria: "agenda",
    campos: [IA_DURANTE],
  },

  // ── Funil ──────────────────────────────────────────────────────
  {
    id: "PIPELINE_MOVE",
    label: "Mudou de etapa no funil",
    hint: "O contato entrou numa etapa — manualmente ou por automação.",
    categoria: "funil",
    campos: [
      { key: "stageName", label: "Somente ao entrar na etapa", type: "text", opcional: true, hint: "Deixe vazio para qualquer etapa." },
      IA_DURANTE,
    ],
  },
  {
    id: "TAG_ADDED",
    label: "Recebeu uma tag",
    hint: "Uma tag foi adicionada ao contato.",
    categoria: "funil",
    campos: [{ key: "tagName", label: "Somente a tag", type: "text", opcional: true }, IA_DURANTE],
  },

  // ── Campanha ───────────────────────────────────────────────────
  {
    id: "CAMPAIGN_REPLY",
    label: "Respondeu a um disparo",
    hint: "O contato respondeu depois de receber uma campanha.",
    categoria: "campanha",
    campos: [
      { key: "withinHours", label: "Janela após o disparo", type: "number", unidade: "horas", padrao: 72 },
      IA_DURANTE,
    ],
  },

  // ── Tempo e integrações ────────────────────────────────────────
  {
    id: "SCHEDULE",
    label: "Horário recorrente (cron)",
    hint: "Roda no horário marcado, sem depender do contato.",
    categoria: "tempo",
    campos: [
      { key: "schedule", label: "Expressão cron", type: "cron", padrao: "0 9 * * *", hint: "Ex.: 0 9 * * 1-5 (dias úteis às 9h)." },
      IA_DURANTE,
    ],
  },
  {
    id: "WEBHOOK",
    label: "Chamada externa (webhook)",
    hint: "Um sistema de fora chama a URL do fluxo e ele começa.",
    categoria: "tempo",
    campos: [
      { key: "secret", label: "Chave de segurança", type: "text", hint: "Enviada no cabeçalho X-Flow-Secret. Gere uma sequência aleatória." },
      IA_DURANTE,
    ],
  },
];

export const TRIGGER_IDS = TRIGGERS.map((t) => t.id);

export const CATEGORIAS = [
  { id: "contato", label: "Contato e conversa" },
  { id: "atendimento", label: "Atendimento humano" },
  { id: "agenda", label: "Agenda" },
  { id: "funil", label: "Funil" },
  { id: "campanha", label: "Campanha" },
  { id: "tempo", label: "Tempo e integrações" },
];

// Nomes antigos que ainda podem estar gravados em fluxos existentes.
const ALIASES = { NEW_MSG: "INCOMING_MESSAGE" };

/** Normaliza o gatilho gravado no banco. */
export function normalizeTrigger(trigger) {
  return ALIASES[trigger] || trigger;
}

function semAcento(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Casa palavra inteira, ignorando acento e caixa. */
function palavraInteira(texto, termo) {
  const t = semAcento(texto);
  const k = semAcento(termo).trim();
  if (!k) return false;
  const escapado = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escapado}([^a-z0-9]|$)`).test(t);
}

function parseConfig(automation) {
  try {
    return JSON.parse(automation.triggerConfig || "{}") || {};
  } catch {
    return {};
  }
}

/**
 * O evento casa com este fluxo?
 *
 * Centralizar aqui evita o que acontecia antes: o filtro de palavra-chave
 * morava dentro do dispatcher e os outros gatilhos não tinham filtro nenhum,
 * então "mudou de etapa" disparava em QUALQUER etapa.
 */
export function matchesTrigger(automation, evento = {}) {
  const config = parseConfig(automation);
  const tipo = normalizeTrigger(automation.trigger);

  // Filtro de canal vale para todos os gatilhos que nascem de uma conversa.
  if (config.channel && evento.channel && config.channel !== evento.channel) {
    return { ok: false, motivo: `canal ${evento.channel} ≠ ${config.channel}` };
  }

  switch (tipo) {
    case "KEYWORD": {
      const termos = (config.keywords || []).filter(Boolean);
      if (!termos.length) return { ok: false, motivo: "nenhuma palavra configurada" };
      const texto = evento.message || "";
      const modo = config.match || "word";
      const casou = termos.some((k) =>
        modo === "exact"
          ? semAcento(texto).trim() === semAcento(k).trim()
          : modo === "contains"
          ? semAcento(texto).includes(semAcento(k))
          : palavraInteira(texto, k)
      );
      return { ok: casou, motivo: casou ? null : "nenhuma palavra bateu" };
    }

    case "BUTTON_CLICK": {
      const alvos = (config.buttonIds || []).filter(Boolean);
      if (!alvos.length) return { ok: true };
      const casou = alvos.some(
        (a) => semAcento(a) === semAcento(evento.replyId) || semAcento(a) === semAcento(evento.replyTitle)
      );
      return { ok: casou, motivo: casou ? null : `opção "${evento.replyTitle || evento.replyId}" fora da lista` };
    }

    case "MEDIA_RECEIVED": {
      if (!config.mediaType) return { ok: true };
      const casou = String(config.mediaType).toUpperCase() === String(evento.mediaType || "").toUpperCase();
      return { ok: casou, motivo: casou ? null : `mídia ${evento.mediaType} ≠ ${config.mediaType}` };
    }

    case "PIPELINE_MOVE": {
      if (!config.stageName) return { ok: true };
      const casou = semAcento(evento.stageName).includes(semAcento(config.stageName));
      return { ok: casou, motivo: casou ? null : `etapa "${evento.stageName}" ≠ "${config.stageName}"` };
    }

    case "TAG_ADDED": {
      if (!config.tagName) return { ok: true };
      const casou = semAcento(evento.tagName) === semAcento(config.tagName);
      return { ok: casou, motivo: casou ? null : `tag "${evento.tagName}" ≠ "${config.tagName}"` };
    }

    case "HANDOFF_QUEUED": {
      if (!config.queueName) return { ok: true };
      const casou = semAcento(evento.queueName).includes(semAcento(config.queueName));
      return { ok: casou, motivo: casou ? null : `fila "${evento.queueName}" ≠ "${config.queueName}"` };
    }

    default:
      return { ok: true };
  }
}

export default { TRIGGERS, TRIGGER_IDS, CATEGORIAS, matchesTrigger, normalizeTrigger };
