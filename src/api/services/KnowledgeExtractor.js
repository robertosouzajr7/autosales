import prisma from "../config/prisma.js";
import AIProviderService from "./AIProviderService.js";
import { extractText } from "./DocumentExtractor.js";
import VoiceService from "./VoiceService.js";

/**
 * Do material bruto ao conhecimento que o agente usa — com o dono no meio.
 *
 * Antes, treinar era colar texto num campo. Um PDF inteiro entrava cru na
 * base, e o agente passava a responder com o que estava no rodapé do
 * documento, no cabeçalho da planilha ou no "bom dia, pessoal" da gravação.
 *
 * Aqui o material vira itens discretos — uma pergunta e uma resposta —, cada
 * um com o trecho de onde saiu. Nada entra na base do agente sem o dono ler:
 * ele é quem sabe se o que a máquina entendeu é o que o negócio realmente
 * faz. Extração automática que se auto-aprova é como um preço errado vira
 * política da casa.
 */

const MAX_CARACTERES = 60000;
const MAX_ITENS = 40;

export const ORIGENS = {
  DOCUMENTO: "DOCUMENTO",
  PLANILHA: "PLANILHA",
  AUDIO: "AUDIO",
  TEXTO: "TEXTO",
};

const AUDIO = ["mp3", "ogg", "opus", "wav", "m4a", "webm", "aac", "amr"];
const PLANILHA = ["xlsx", "xls", "csv"];

function extensao(nome) {
  const limpo = String(nome || "").toLowerCase();
  return limpo.includes(".") ? limpo.split(".").pop() : "";
}

export function origemDoArquivo(nome, mimetype = "") {
  const ext = extensao(nome);
  if (AUDIO.includes(ext) || String(mimetype).startsWith("audio/")) return ORIGENS.AUDIO;
  if (PLANILHA.includes(ext) || String(mimetype).includes("spreadsheet")) return ORIGENS.PLANILHA;
  return ORIGENS.DOCUMENTO;
}

/** Texto do material, seja ele documento, planilha ou fala. */
export async function lerMaterial(buffer, nome, mimetype) {
  const origem = origemDoArquivo(nome, mimetype);
  if (origem === ORIGENS.AUDIO) {
    const fala = await VoiceService.transcribeAudio(buffer, mimetype || "audio/ogg");
    if (!fala) {
      throw new Error(
        "Não consegui transcrever o áudio. Verifique se a chave de IA está configurada e se o áudio tem voz audível."
      );
    }
    return { texto: fala, origem };
  }
  return { texto: await extractText(buffer, nome, mimetype), origem };
}

const INSTRUCAO = `Você recebe um material de treinamento de um negócio e precisa transformá-lo em itens de conhecimento para um agente de atendimento.

Cada item é UMA pergunta que um cliente faria e a resposta correspondente, extraída do material.

Regras:
- Extraia SOMENTE o que está no material. Não complete com o que você sabe do mundo.
- A pergunta tem de ser como um cliente falaria, não como um índice ("Quanto tempo dura a sessão?", não "Duração").
- A resposta tem de ser completa sozinha: quem ler o item sem o material precisa entender.
- Ignore cabeçalho, rodapé, numeração de página, sumário, saudação e despedida.
- Se o material tiver preço ou horário, extraia — mas só se estiver escrito lá.
- Um assunto por item. Não junte dois temas na mesma resposta.
- No máximo {MAX} itens, priorizando o que um cliente perguntaria de verdade.
- Se o material não tiver nada aproveitável, devolva uma lista vazia.

Responda APENAS com um JSON válido neste formato, sem cerca de código e sem comentário:
{"itens":[{"pergunta":"...","resposta":"...","trecho":"até 120 caracteres do material de onde isso saiu"}]}`;

/** Extrai o JSON mesmo quando o modelo embrulha em texto ou cerca de código. */
function lerJson(bruto) {
  let t = String(bruto || "").trim();
  t = t.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  const inicio = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return null;
  try {
    return JSON.parse(t.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}

/**
 * Divide o material em itens quando a IA não está disponível.
 *
 * Não é tão bom quanto a extração por IA, e não finge ser: quebra por
 * parágrafo e usa a primeira linha como pergunta. Serve para o dono não
 * ficar travado sem chave configurada — e ele revisa item a item de qualquer
 * jeito, que é onde a qualidade é garantida.
 */
export function dividirSemIA(texto) {
  const blocos = String(texto || "")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 40);

  return blocos.slice(0, MAX_ITENS).map((bloco) => {
    const linhas = bloco.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const primeira = linhas[0];
    const temTitulo = linhas.length > 1 && primeira.length < 120;
    return {
      pergunta: temTitulo ? primeira.replace(/[:.]$/, "") : primeira.slice(0, 100),
      resposta: temTitulo ? linhas.slice(1).join("\n") : bloco,
      trecho: bloco.slice(0, 120),
    };
  });
}

function valido(item) {
  const p = String(item?.pergunta || "").trim();
  const r = String(item?.resposta || "").trim();
  return p.length >= 5 && r.length >= 5 && p.length <= 300;
}

class KnowledgeExtractor {
  /**
   * Lê o material, extrai os itens e grava como PENDENTE.
   *
   * Devolve o lote para a tela abrir a revisão. Nada toca a base do agente
   * aqui — isso é o `consolidar`, e só depois de o dono decidir.
   */
  async extrair(tenantId, sdrId, { buffer, nome, mimetype, texto: textoDireto }) {
    const { texto, origem } = textoDireto
      ? { texto: textoDireto, origem: ORIGENS.TEXTO }
      : await lerMaterial(buffer, nome, mimetype);

    const conteudo = String(texto || "").trim();
    if (conteudo.length < 30) {
      throw new Error("O material não tem texto suficiente para extrair conhecimento.");
    }

    // Material gigante: corta antes de mandar para a IA. Um manual de 300
    // páginas não cabe no pedido, e mandar assim mesmo é receber um erro
    // caro em vez de um resultado.
    const recorte = conteudo.slice(0, MAX_CARACTERES);
    const truncado = conteudo.length > MAX_CARACTERES;

    let itens = [];
    let porIA = false;
    let motivo = null;

    let config = null;
    try {
      config = await AIProviderService.resolveAIConfig(tenantId);
    } catch { /* segue sem IA */ }

    if (config?.apiKey) {
      try {
        const resposta = await AIProviderService.generateText({
          provider: config.provider,
          model: config.model,
          apiKey: config.apiKey,
          system: "Você extrai conhecimento de materiais de treinamento. Responde apenas com JSON válido.",
          prompt: `${INSTRUCAO.replace("{MAX}", String(MAX_ITENS))}\n\n--- MATERIAL ---\n${recorte}`,
        });
        const dados = lerJson(resposta);
        if (Array.isArray(dados?.itens)) {
          itens = dados.itens.filter(valido).slice(0, MAX_ITENS);
          porIA = true;
        } else {
          motivo = "A IA não devolveu itens no formato esperado.";
        }
      } catch (e) {
        motivo = `Falha ao chamar a IA: ${e.message}`;
      }
    } else {
      motivo = "Nenhum provedor de IA configurado.";
    }

    if (!itens.length && !porIA) itens = dividirSemIA(recorte).filter(valido);
    if (!itens.length) {
      throw new Error("Não encontrei nada aproveitável neste material.");
    }

    const lote = `lote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await prisma.knowledgeDraft.createMany({
      data: itens.map((i) => ({
        tenantId,
        sdrId,
        lote,
        origem,
        arquivo: nome || null,
        pergunta: String(i.pergunta).trim(),
        resposta: String(i.resposta).trim(),
        trecho: i.trecho ? String(i.trecho).slice(0, 300) : null,
      })),
    });

    return {
      lote,
      origem,
      total: itens.length,
      extraidoPorIA: porIA,
      motivo,
      truncado,
      caracteresLidos: recorte.length,
    };
  }

  /**
   * Consolida os itens aprovados na base do agente.
   *
   * Recebe os itens como o dono deixou — editados, se ele editou. Só o que
   * ele marcou para manter entra; o resto fica registrado como RECUSADO, para
   * a mesma coisa não ser proposta de novo na próxima extração.
   */
  async consolidar(tenantId, sdrId, decisoes = []) {
    const ids = decisoes.map((d) => d.id).filter(Boolean);
    const rascunhos = await prisma.knowledgeDraft.findMany({
      where: { id: { in: ids }, tenantId, sdrId },
    });
    const porId = new Map(rascunhos.map((r) => [r.id, r]));

    const aprovados = [];
    const recusados = [];
    for (const d of decisoes) {
      const original = porId.get(d.id);
      if (!original) continue;
      if (d.manter === false) {
        recusados.push(original.id);
        continue;
      }
      aprovados.push({
        id: original.id,
        pergunta: String(d.pergunta ?? original.pergunta).trim(),
        resposta: String(d.resposta ?? original.resposta).trim(),
      });
    }

    const agora = new Date();
    if (recusados.length) {
      await prisma.knowledgeDraft.updateMany({
        where: { id: { in: recusados } },
        data: { status: "RECUSADO", decidedAt: agora },
      });
    }

    if (!aprovados.length) {
      return { aprovados: 0, recusados: recusados.length, adicionado: 0 };
    }

    const bloco = aprovados.map((a) => `## ${a.pergunta}\n${a.resposta}`).join("\n\n");

    const sdr = await prisma.sdrBot.findFirst({ where: { id: sdrId, tenantId } });
    if (!sdr) throw new Error("Agente não encontrado.");

    const atual = sdr.knowledgeBase || "";
    const separador = atual.trim() ? "\n\n" : "";

    // O limite do plano vale aqui, não na extração: revisar o material é de
    // graça, o que ocupa espaço é o que entra na base.
    const { knowledgeBaseHeadroom } = await import("../middlewares/planLimits.js");
    const espaco = await knowledgeBaseHeadroom(tenantId, bloco.length + separador.length);
    if (!espaco.ok) {
      const erro = new Error(
        `Limite de treino do seu plano atingido: ${espaco.max.toLocaleString("pt-BR")} caracteres, ` +
        `${espaco.used.toLocaleString("pt-BR")} já em uso. Estes itens somam ` +
        `${(bloco.length + separador.length).toLocaleString("pt-BR")}. Recuse alguns, remova treino antigo ou mude de plano.`
      );
      erro.codigo = "LIMITE_DE_PLANO";
      throw erro;
    }

    await prisma.sdrBot.update({
      where: { id: sdr.id },
      data: { knowledgeBase: atual + separador + bloco },
    });

    for (const a of aprovados) {
      await prisma.knowledgeDraft.update({
        where: { id: a.id },
        data: { pergunta: a.pergunta, resposta: a.resposta, status: "APROVADO", decidedAt: agora },
      });
    }

    return {
      aprovados: aprovados.length,
      recusados: recusados.length,
      adicionado: bloco.length + separador.length,
    };
  }
}

export default new KnowledgeExtractor();
