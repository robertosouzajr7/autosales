import prisma from "../config/prisma.js";
import AIProviderService from "./AIProviderService.js";
import { getFunctionPreset, SKILLS } from "./AgentFunctions.js";

/**
 * Montagem do prompt do agente a partir das respostas do dono.
 *
 * O problema: pedir a quem tem uma clínica que "escreva o prompt do agente"
 * é pedir uma habilidade que ele não tem motivo para ter. O resultado é
 * sempre uma linha ("seja simpático e agende") — e um agente que inventa
 * preço, promete prazo e discute com cliente irritado.
 *
 * A regra que governa o que entra aqui: **o prompt carrega conduta, não
 * dados**. Preço, horário, equipe, catálogo e FAQ já são injetados vivos a
 * cada conversa por `buildBusinessContext`. Congelar essas informações no
 * texto do prompt é como o agente começa a cotar o preço do mês passado.
 * Aqui vai o que não muda toda semana: quem ele é, o que é sucesso, como se
 * comporta em cada situação, o que nunca pode fazer e quando chamar gente.
 */

/** As seções, na ordem. É esta a espinha do prompt. */
export const SECOES = [
  { id: "identidade", titulo: "IDENTIDADE" },
  { id: "objetivo", titulo: "OBJETIVO" },
  { id: "tom", titulo: "COMO FALAR" },
  { id: "cenarios", titulo: "O QUE FAZER EM CADA SITUAÇÃO" },
  { id: "coleta", titulo: "O QUE VOCÊ PRECISA DESCOBRIR" },
  { id: "regras", titulo: "REGRAS INEGOCIÁVEIS" },
  { id: "proibicoes", titulo: "PROIBIÇÕES" },
  { id: "escalonamento", titulo: "QUANDO CHAMAR UM HUMANO" },
  { id: "ferramentas", titulo: "SUAS FERRAMENTAS" },
  { id: "limites", titulo: "LIMITES DO QUE VOCÊ SABE" },
];

/**
 * O questionário.
 *
 * Perguntas que o dono responde de cabeça, sobre o negócio dele — não sobre
 * IA. Nenhuma pergunta sobre preço ou horário: isso o sistema já tem.
 */
export const QUESTIONARIO = [
  {
    id: "nomeAgente",
    pergunta: "Como o agente deve se apresentar?",
    ajuda: "O nome que o cliente vê. Pode ser uma pessoa (\"Sou a Bia\") ou o próprio negócio.",
    tipo: "texto",
    exemplo: "Bia, da Clínica Vida Plena",
    obrigatoria: true,
  },
  {
    id: "publico",
    pergunta: "Quem é o cliente que escreve para vocês?",
    ajuda: "Em uma frase. Ajuda o agente a escolher as palavras.",
    tipo: "texto",
    exemplo: "Mulheres de 25 a 45 anos, buscando tratamento estético pela primeira vez",
    obrigatoria: true,
  },
  {
    id: "sucesso",
    pergunta: "Uma conversa deu certo quando…",
    ajuda: "Escolha UM desfecho. Agente com dois objetivos não persegue nenhum.",
    tipo: "escolha",
    opcoes: [
      { valor: "AGENDAR", rotulo: "o cliente saiu com horário marcado" },
      { valor: "VENDER", rotulo: "o cliente comprou ou pediu o link de pagamento" },
      { valor: "QUALIFICAR", rotulo: "descobri se vale a pena e passei para a equipe" },
      { valor: "RESOLVER", rotulo: "a dúvida do cliente foi resolvida" },
    ],
    obrigatoria: true,
  },
  {
    id: "tom",
    pergunta: "Como vocês falam com o cliente?",
    tipo: "escolha",
    opcoes: [
      { valor: "PROXIMO", rotulo: "Próximo e informal — \"oi\", \"tudo bem?\", emoji com moderação" },
      { valor: "PROFISSIONAL", rotulo: "Profissional e claro — cordial, sem intimidade" },
      { valor: "TECNICO", rotulo: "Técnico e preciso — vocabulário da área, sem rodeio" },
    ],
    obrigatoria: true,
  },
  {
    id: "diferencial",
    pergunta: "Por que alguém escolhe vocês e não o concorrente?",
    ajuda: "É o que o agente usa quando o cliente disser que está pesquisando.",
    tipo: "texto_longo",
    exemplo: "Somos os únicos da região com o aparelho X e damos retorno gratuito em 30 dias.",
  },
  {
    id: "objecoes",
    pergunta: "Quais são as três objeções que mais aparecem?",
    ajuda: "Uma por linha. O agente vai aprender a responder cada uma sem enrolar.",
    tipo: "texto_longo",
    exemplo: "Achei caro\nPreciso falar com meu marido\nVou pensar",
  },
  {
    id: "nuncaFazer",
    pergunta: "O que o agente NUNCA pode fazer ou dizer?",
    ajuda: "O mais importante do questionário. Seja literal.",
    tipo: "texto_longo",
    exemplo: "Nunca dar desconto\nNunca prometer resultado\nNunca opinar sobre tratamento de outra clínica",
  },
  {
    id: "chamarHumano",
    pergunta: "Em que situações o agente deve parar e chamar você ou a equipe?",
    tipo: "texto_longo",
    exemplo: "Cliente irritado ou reclamando\nPedido de reembolso\nAlguém perguntando sobre um problema depois do procedimento",
  },
  {
    id: "coletar",
    pergunta: "Que informações o agente precisa ter antes de fechar?",
    ajuda: "O e-mail já é sempre pedido antes de agendar — é por ele que vai o convite.",
    tipo: "texto_longo",
    exemplo: "Nome completo\nSe já foi cliente\nQual o incômodo principal",
  },
];

/** Vocabulário do desfecho, para o esqueleto sair direto ao ponto. */
const DESFECHO = {
  AGENDAR: {
    frase: "o cliente sair desta conversa com dia e hora marcados",
    passo: "Conduza para o agendamento assim que entender o que a pessoa precisa. Não espere ela pedir.",
  },
  VENDER: {
    frase: "o cliente comprar, ou receber o link de pagamento com a decisão tomada",
    passo: "Apresente a solução certa e feche. Não termine a conversa sem propor o próximo passo.",
  },
  QUALIFICAR: {
    frase: "você descobrir se vale a pena e entregar o caso para a equipe com o contexto pronto",
    passo: "Faça uma pergunta por vez. Escute mais do que fala.",
  },
  RESOLVER: {
    frase: "a dúvida do cliente ser resolvida sem ele precisar repetir a pergunta",
    passo: "Responda o que foi perguntado antes de oferecer qualquer outra coisa.",
  },
};

const TOM = {
  PROXIMO: "Fale como uma pessoa próxima: frases curtas, tratamento por \"você\", emoji só quando cabe. Nada de linguagem de folheto.",
  PROFISSIONAL: "Fale de forma cordial e direta, sem intimidade e sem emoji. Frases curtas, nada de jargão.",
  TECNICO: "Use o vocabulário técnico da área, com precisão e sem rodeios. Explique o termo só quando o cliente demonstrar não conhecê-lo.",
};

const linhas = (texto) =>
  String(texto || "").split(/\r?\n/).map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

const lista = (itens) => itens.map((i) => `- ${i}`).join("\n");

/**
 * O esqueleto determinístico.
 *
 * Existe para valer sozinho: sem chave de IA configurada, sem crédito, ou
 * com o provedor fora do ar, o dono recebe um prompt completo e utilizável
 * em vez de uma mensagem de erro. Quando a IA está disponível, é este texto
 * que ela recebe para desenvolver — não uma folha em branco.
 */
export function montarEsqueleto(respostas = {}, contexto = {}) {
  const r = respostas;
  const preset = getFunctionPreset(contexto.agentFunction);
  const desfecho = DESFECHO[r.sucesso] || DESFECHO.AGENDAR;
  const skills = new Set(contexto.skills?.length ? contexto.skills : preset.skills);

  const objecoes = linhas(r.objecoes);
  const proibicoes = linhas(r.nuncaFazer);
  const escalonar = linhas(r.chamarHumano);
  const coletar = linhas(r.coletar);

  const partes = [];

  // "Bia, da Clínica Vida Plena, atendendo pelo canal oficial de Clínica Vida
  // Plena" é o tipo de frase que faz o dono desconfiar do resto do texto.
  const nome = r.nomeAgente || "o atendente virtual";
  const jaCitaONegocio =
    contexto.negocio && nome.toLowerCase().includes(String(contexto.negocio).toLowerCase());
  const ondeTrabalha = contexto.negocio && !jaCitaONegocio ? `, atendendo pelo canal oficial de ${contexto.negocio}` : "";

  partes.push(`# IDENTIDADE
Você é ${nome}${ondeTrabalha}.
Você fala com ${r.publico || "os clientes do negócio"}.
Você não é um robô genérico: você trabalha aqui e responde como quem conhece a casa.`);

  partes.push(`# OBJETIVO
Esta conversa deu certo quando ${desfecho.frase}.
${desfecho.passo}
Se não der para chegar lá agora, deixe o próximo passo combinado — nunca encerre no vazio.`);

  partes.push(`# COMO FALAR
${TOM[r.tom] || TOM.PROFISSIONAL}
- Uma ideia por mensagem. Mensagem longa em aplicativo de conversa não é lida.
- Uma pergunta por vez. Duas perguntas juntas recebem meia resposta.
- Nunca repita o que o cliente acabou de dizer para "confirmar entendimento".
- Não use "Como posso ajudar?" depois que a conversa já começou.`);

  const cenarios = [
    `**O cliente chega e só diz "oi"**: cumprimente pelo nome se souber, diga quem você é em meia linha e pergunte o que ele procura. Não despeje o catálogo.`,
    `**O cliente pergunta preço logo de cara**: responda o preço que está no contexto, sem rodeio e sem pedir dados antes. Depois pergunte o que ele quer resolver.`,
    `**O cliente some no meio da conversa**: retome de onde parou, sem cobrar. Uma única vez.`,
    `**O cliente já é cliente**: não trate como se fosse a primeira vez. Use o histórico que está no contexto.`,
    `**O cliente pergunta algo que você não sabe**: diga que vai confirmar e ${skills.has("escalate_human") ? "chame a equipe" : "peça um instante"}. Nunca invente.`,
  ];
  if (r.diferencial) {
    cenarios.push(`**O cliente diz que está pesquisando ou comparando**: ${r.diferencial.trim()}`);
  }
  for (const o of objecoes) {
    cenarios.push(`**O cliente diz "${o}"**: acolha sem discutir, responda o que está por trás da frase e proponha o próximo passo.`);
  }
  partes.push(`# O QUE FAZER EM CADA SITUAÇÃO\n${cenarios.join("\n")}`);

  const aColetar = [...coletar];
  if (skills.has("schedule")) {
    aColetar.push("E-mail do cliente — obrigatório antes de agendar; é por ele que vai o convite do compromisso.");
  }
  if (aColetar.length) {
    partes.push(`# O QUE VOCÊ PRECISA DESCOBRIR
Ao longo da conversa, sem interrogatório — uma pergunta de cada vez, encaixada no assunto:
${lista(aColetar)}`);
  }

  partes.push(`# REGRAS INEGOCIÁVEIS
- Preço, horário disponível, equipe e serviços: use SOMENTE o que está no contexto desta conversa. Se não está lá, você não sabe.
- Confirme os detalhes antes de fechar qualquer compromisso: o quê, com quem, quando.
- Se o cliente pedir para falar com uma pessoa, passe na hora. Não tente resolver antes.
- Se o cliente pedir para não receber mais mensagens, pare imediatamente e registre.
- Escreva em português do Brasil.`);

  const proibidoBase = [
    "Inventar preço, prazo, horário disponível ou nome de profissional.",
    "Prometer resultado, cura, aprovação ou qualquer coisa que dependa de terceiros.",
    "Dar orientação técnica, clínica, jurídica ou financeira que exija um profissional habilitado.",
    "Discutir com o cliente, ironizar ou responder com aspereza — mesmo se ele estiver errado.",
    "Falar mal de concorrente.",
    "Pedir dado sensível (senha, cartão, documento) pela conversa.",
    "Dizer que é uma inteligência artificial a não ser que o cliente pergunte diretamente. Se perguntar, confirme com naturalidade.",
  ];
  partes.push(`# PROIBIÇÕES
Nunca, em nenhuma hipótese:
${lista([...proibicoes, ...proibidoBase])}`);

  const gatilhos = [
    ...escalonar,
    "O cliente pede explicitamente para falar com uma pessoa.",
    "O cliente está irritado, reclamando ou ameaçando.",
    "O assunto envolve dinheiro de volta, cancelamento com multa ou problema depois do serviço.",
    "Você já tentou responder duas vezes e o cliente continua sem entender.",
  ];
  partes.push(`# QUANDO CHAMAR UM HUMANO
${lista(gatilhos)}
Ao passar, diga ao cliente que alguém vai continuar dali — não deixe no vácuo.`);

  const disponiveis = SKILLS.filter((s) => skills.has(s.id));
  if (disponiveis.length) {
    partes.push(`# SUAS FERRAMENTAS
Use quando a situação pedir, sem anunciar que está usando:
${lista(disponiveis.map((s) => `${s.label} — ${s.desc}`))}`);
  }

  partes.push(`# LIMITES DO QUE VOCÊ SABE
Tudo o que você sabe sobre o negócio está no contexto desta conversa: serviços, preços, horários, equipe e perguntas frequentes.
Fora disso, você não sabe — e dizer "vou confirmar isso para você" é sempre melhor do que arriscar.
Nunca contradiga o contexto com o que você acha que sabe do mundo.`);

  return partes.join("\n\n");
}

/** O que a IA recebe para desenvolver o esqueleto. */
function instrucaoDeEscrita(esqueleto, respostas, contexto) {
  return `Você é um especialista em escrever prompts de sistema para agentes de atendimento no WhatsApp.

Abaixo está o ESQUELETO de um prompt, montado a partir das respostas do dono de um negócio ${contexto.tipo ? `do tipo ${contexto.tipo}` : ""}. Sua tarefa é devolvê-lo desenvolvido e pronto para uso.

O que fazer:
- Mantenha EXATAMENTE as mesmas seções, na mesma ordem, com os mesmos títulos em "# MAIÚSCULAS".
- Desenvolva os cenários: transforme cada situação em conduta concreta, com o que dizer e o que não dizer. Acrescente até três cenários típicos deste tipo de negócio que faltaram.
- Escreva as respostas às objeções de verdade — a frase que o agente usaria, não a descrição do que ele deveria fazer.
- Deixe as proibições literais e curtas. Uma por linha.

O que NÃO fazer:
- NÃO inclua preço, horário de funcionamento, nome de profissional, endereço ou qualquer dado do negócio. Esses dados são injetados vivos a cada conversa; congelá-los aqui faria o agente cotar preço vencido.
- NÃO invente serviços, promoções ou políticas que não estejam no esqueleto.
- NÃO escreva introdução, comentário ou explicação. Devolva SÓ o prompt.
- NÃO use markdown além dos títulos "#" e das listas com "-".

Escreva em português do Brasil, na segunda pessoa ("Você é…", "Você faz…").

--- ESQUELETO ---
${esqueleto}
--- FIM DO ESQUELETO ---

Respostas cruas do dono, para você não perder nenhuma intenção:
${JSON.stringify(respostas, null, 2)}`;
}

class PromptBuilder {
  /**
   * Gera o prompt do agente.
   *
   * Devolve sempre algo utilizável: se a IA não estiver configurada ou
   * falhar, o esqueleto vai como resultado, com `geradoPorIA: false`. O dono
   * fica sabendo — mas não fica sem prompt.
   */
  async gerar(tenantId, respostas = {}, { agentFunction = null, skills = [] } = {}) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, businessType: true },
    });
    const contexto = {
      negocio: tenant?.name || null,
      tipo: tenant?.businessType || null,
      agentFunction,
      skills,
    };

    const esqueleto = montarEsqueleto(respostas, contexto);

    let config = null;
    try {
      config = await AIProviderService.resolveAIConfig(tenantId);
    } catch { /* sem IA: o esqueleto já resolve */ }
    if (!config?.apiKey) {
      return { prompt: esqueleto, geradoPorIA: false, motivo: "Nenhum provedor de IA configurado." };
    }

    try {
      const texto = await AIProviderService.generateText({
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        system: "Você escreve prompts de sistema. Responde apenas com o prompt final, sem comentários.",
        prompt: instrucaoDeEscrita(esqueleto, respostas, contexto),
      });

      const limpo = limpar(texto);
      // Resposta curta demais é sinal de que o modelo respondeu outra coisa —
      // entregar isso seria trocar um prompt bom por um ruim.
      if (!limpo || limpo.length < esqueleto.length * 0.5) {
        return { prompt: esqueleto, geradoPorIA: false, motivo: "A IA devolveu um texto incompleto." };
      }
      return { prompt: limpo, geradoPorIA: true, esqueleto };
    } catch (e) {
      return { prompt: esqueleto, geradoPorIA: false, motivo: `Falha ao chamar a IA: ${e.message}` };
    }
  }
}

/** Tira cerca de código e frase de abertura que alguns modelos insistem em pôr. */
function limpar(texto) {
  let t = String(texto || "").trim();
  t = t.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
  t = t.replace(/^(aqui está|segue|claro)[^\n]*\n+/i, "");
  return t.trim();
}

export default new PromptBuilder();
