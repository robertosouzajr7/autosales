import prisma from "../config/prisma.js";

/**
 * Recomendação de plano a partir das respostas do questionário.
 *
 * A página de preços com cinco colunas obriga o visitante a virar analista
 * de si mesmo antes de comprar. Aqui ele responde cinco perguntas do
 * negócio dele e recebe DUAS opções: a melhor com API oficial e a melhor
 * por QR Code. Duas, e não uma, porque a escolha entre os canais é de
 * preferência (custo x oficialidade) e não dá para adivinhar por ele.
 */

/** As perguntas, na ordem em que a tela mostra. */
export const PERGUNTAS = [
  {
    id: "conversas",
    titulo: "Quantas conversas novas por mês?",
    ajuda: "Cada cliente que chama pela primeira vez no mês conta uma.",
    opcoes: [
      { valor: 100, rotulo: "Até 100", detalhe: "Começando agora" },
      { valor: 500, rotulo: "100 a 500", detalhe: "Movimento constante" },
      { valor: 2000, rotulo: "500 a 2.000", detalhe: "Operação cheia" },
      { valor: 8000, rotulo: "Mais de 2.000", detalhe: "Alto volume" },
    ],
  },
  {
    id: "colaboradores",
    titulo: "Quantas pessoas vão usar o sistema?",
    ajuda: "Quem atende, quem vende e quem acompanha os números.",
    opcoes: [
      { valor: 1, rotulo: "Só eu", detalhe: "Autônomo" },
      { valor: 3, rotulo: "2 a 3", detalhe: "Time pequeno" },
      { valor: 8, rotulo: "4 a 8", detalhe: "Equipe formada" },
      { valor: 20, rotulo: "Mais de 8", detalhe: "Vários setores" },
    ],
  },
  {
    id: "canais",
    titulo: "Por onde os clientes chegam?",
    ajuda: "Pode marcar mais de um.",
    multipla: true,
    opcoes: [
      { valor: "WHATSAPP", rotulo: "WhatsApp", detalhe: "O principal" },
      { valor: "INSTAGRAM", rotulo: "Instagram", detalhe: "Direct" },
      { valor: "SITE", rotulo: "Site", detalhe: "Chat na página" },
    ],
  },
  {
    id: "numeros",
    titulo: "Quantos números de WhatsApp?",
    ajuda: "Um por unidade, ou um por equipe.",
    opcoes: [
      { valor: 1, rotulo: "1 número", detalhe: "Um só canal" },
      { valor: 2, rotulo: "2 números", detalhe: "Vendas e suporte" },
      { valor: 5, rotulo: "3 a 5", detalhe: "Várias unidades" },
      { valor: 10, rotulo: "Mais de 5", detalhe: "Rede" },
    ],
  },
  {
    id: "disparos",
    titulo: "Vai enviar campanhas para a base?",
    ajuda: "Promoções, avisos, retorno de clientes antigos.",
    opcoes: [
      { valor: 0, rotulo: "Não, só atendimento", detalhe: "Recebe e responde" },
      { valor: 500, rotulo: "De vez em quando", detalhe: "Até 500/mês" },
      { valor: 2000, rotulo: "Toda semana", detalhe: "Até 2.000/mês" },
      { valor: 10000, rotulo: "É o meu motor", detalhe: "Volume alto" },
    ],
  },
];

/** Normaliza a resposta, aceitando o que a tela mandar. */
function num(v, padrao = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : padrao;
}

/**
 * Escolhe o melhor plano de uma lista para a necessidade informada.
 *
 * "Melhor" = o mais barato que atende tudo. Quando nenhum atende (o cliente
 * é maior que a maior linha), devolve o maior — é honesto dizer "este é o
 * nosso topo, fale com a gente" em vez de recomendar algo que vai estourar.
 */
function escolher(planos, precisa) {
  const atendem = planos.filter(
    (p) =>
      (p.maxConversations === 0 || p.maxConversations >= precisa.conversas) &&
      p.maxUsers >= precisa.colaboradores &&
      p.maxWhatsAppNumbers >= precisa.numeros &&
      (precisa.disparos === 0 || p.maxCampaignMessages >= precisa.disparos)
  );

  if (atendem.length) {
    const escolhido = [...atendem].sort((a, b) => a.priceMonthly - b.priceMonthly)[0];
    return { plano: escolhido, cobreTudo: true };
  }

  const maior = [...planos].sort((a, b) => b.priceMonthly - a.priceMonthly)[0];
  return { plano: maior || null, cobreTudo: false };
}

/** Explica em uma frase por que este plano, com os números do cliente. */
function justificar(plano, precisa, cobreTudo) {
  if (!plano) return null;
  if (!cobreTudo) {
    return "Seu volume passa do nosso maior plano — este é o mais completo, e a gente ajusta o que faltar com você.";
  }
  const partes = [];
  partes.push(
    plano.maxConversations === 0
      ? "conversas sem limite"
      : `${plano.maxConversations.toLocaleString("pt-BR")} conversas/mês`
  );
  partes.push(`${plano.maxUsers} pessoa(s)`);
  partes.push(`${plano.maxWhatsAppNumbers} número(s)`);
  if (precisa.disparos > 0 && plano.maxCampaignMessages > 0) {
    partes.push(`${plano.maxCampaignMessages.toLocaleString("pt-BR")} disparos/mês`);
  }
  return `Cobre ${partes.join(", ")} — com folga para o que você respondeu.`;
}

/** Como o plano aparece na tela: só o que ajuda a decidir. */
function apresentar(plano) {
  if (!plano) return null;
  return {
    id: plano.id,
    name: plano.name,
    priceMonthly: plano.priceMonthly,
    priceYearly: plano.priceYearly,
    whatsappMode: plano.whatsappMode,
    maxConversations: plano.maxConversations,
    maxUsers: plano.maxUsers,
    maxWhatsAppNumbers: plano.maxWhatsAppNumbers,
    maxCampaignMessages: plano.maxCampaignMessages,
    maxTokens: plano.maxTokens,
    enableCalendar: plano.enableCalendar,
    enableAutomations: plano.enableAutomations,
    enableVoice: plano.enableVoice,
    enableWebhooks: plano.enableWebhooks,
  };
}

/**
 * Recomenda um plano de cada canal.
 * @returns { precisa, oficial, qrcode }
 */
export async function recomendar(respostas = {}) {
  const precisa = {
    conversas: num(respostas.conversas, 100),
    colaboradores: num(respostas.colaboradores, 1),
    numeros: num(respostas.numeros, 1),
    disparos: num(respostas.disparos, 0),
    canais: Array.isArray(respostas.canais) ? respostas.canais : ["WHATSAPP"],
  };

  const planos = await prisma.plan.findMany({
    where: { active: true, priceMonthly: { gt: 0 } },
    orderBy: { priceMonthly: "asc" },
  });

  // BOTH serve aos dois lados: é plano que aceita o canal que o cliente quiser.
  const oficiais = planos.filter((p) => ["OFFICIAL", "BOTH"].includes(String(p.whatsappMode || "BOTH").toUpperCase()));
  const qrcodes = planos.filter((p) => ["BAILEYS", "BOTH"].includes(String(p.whatsappMode || "BOTH").toUpperCase()));

  const escolhaOficial = escolher(oficiais, precisa);
  const escolhaQr = escolher(qrcodes, precisa);

  return {
    precisa,
    oficial: escolhaOficial.plano
      ? {
          ...apresentar(escolhaOficial.plano),
          cobreTudo: escolhaOficial.cobreTudo,
          porque: justificar(escolhaOficial.plano, precisa, escolhaOficial.cobreTudo),
          canal: {
            titulo: "API oficial do WhatsApp",
            bom: [
              "Selo de conta verificada",
              "Número não corre risco de bloqueio",
              "Disparo em massa liberado pela Meta",
            ],
            considere: ["A Meta cobra por mensagem de campanha", "Aprovação de templates leva algumas horas"],
          },
        }
      : null,
    qrcode: escolhaQr.plano
      ? {
          ...apresentar(escolhaQr.plano),
          cobreTudo: escolhaQr.cobreTudo,
          porque: justificar(escolhaQr.plano, precisa, escolhaQr.cobreTudo),
          canal: {
            titulo: "WhatsApp por QR Code",
            bom: [
              "Conecta em 1 minuto, lendo o QR",
              "Sem cobrança por mensagem",
              "Usa o número que você já tem",
            ],
            considere: [
              "Canal não oficial: a Meta pode bloquear o número",
              "Sem selo de verificado",
            ],
          },
        }
      : null,
  };
}

export default { PERGUNTAS, recomendar };
