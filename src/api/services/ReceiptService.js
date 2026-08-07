import prisma from "../config/prisma.js";
import { mesmaChave } from "./PixService.js";

/**
 * Conferência de comprovante de pagamento.
 *
 * O comprovante chega como foto ou PDF, e o que está escrito nele é o que
 * decide se a venda foi paga. Ler "com os olhos do agente" e acreditar não
 * serve: o caso que mais passa no balcão é o Pix AGENDADO — o print diz
 * "Pix agendado para 10/03", parece um comprovante, e o dinheiro não saiu.
 *
 * Por isso a decisão é uma função pura, separada da leitura: dá para testar
 * cada regra sem depender de modelo nenhum, e o motivo de cada recusa fica
 * escrito para o dono conferir na mão quando discordar.
 */

export const VEREDITO = { APROVADO: "APPROVED", RECUSADO: "REJECTED", REVISAR: "REVIEW" };

/** Diferença de centavos que ainda conta como o mesmo valor. */
const TOLERANCIA = 0.01;

/** Quantos dias para trás um comprovante ainda é considerado desta compra. */
const DIAS_ACEITAVEIS = 7;

/** Quanto o relógio do comprovante pode adiantar sem virar suspeita. */
const MINUTOS_DE_FOLGA = 10;

const digitos = (v) => String(v || "").replace(/\D/g, "");

/**
 * O texto do comprovante indica agendamento em vez de pagamento efetuado?
 * Serve como rede: mesmo que o campo estruturado venha errado, a frase
 * "agendado" no corpo do comprovante já é motivo de revisão.
 */
export function pareceAgendamento(texto) {
  const t = String(texto || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return /\bagendad[oa]\b|\bagendamento\b|\bprogramad[oa]\b|sera debitado|pagamento futuro/.test(t);
}

/**
 * Decide sobre um comprovante já lido.
 *
 * @param {object} lido      o que foi extraído: amount, paidAt, pixKey,
 *                           receiverName, receiverDoc, endToEndId, scheduled,
 *                           rawText
 * @param {object} esperado  amount (da venda), pixKey, holderName, holderDoc
 *                           do negócio, agora (Date), jaUsado (boolean)
 * @returns {{ status: string, motivos: Array<{codigo: string, texto: string}> }}
 */
export function conferir(lido = {}, esperado = {}) {
  const motivos = [];
  const agora = esperado.agora instanceof Date ? esperado.agora : new Date();
  let recusar = false;
  let revisar = false;

  const recusa = (codigo, texto) => { motivos.push({ codigo, texto }); recusar = true; };
  const revisa = (codigo, texto) => { motivos.push({ codigo, texto }); revisar = true; };

  // 1. Agendamento. É a primeira regra porque é a que engana mais gente: o
  // print é idêntico ao de um Pix pago, só muda uma palavra.
  if (lido.scheduled === true || pareceAgendamento(lido.rawText)) {
    recusa("AGENDADO", "O comprovante é de um Pix agendado, não de um pagamento já efetuado.");
  }

  // 2. Comprovante repetido: o mesmo end-to-end não paga duas compras.
  if (esperado.jaUsado) {
    recusa("REPETIDO", "Este comprovante já foi usado em outro pagamento.");
  }

  // 3. Valor.
  const valorLido = Number(lido.amount);
  const valorEsperado = Number(esperado.amount);
  if (!Number.isFinite(valorLido) || valorLido <= 0) {
    revisa("SEM_VALOR", "Não consegui ler o valor no comprovante.");
  } else if (Number.isFinite(valorEsperado) && valorEsperado > 0) {
    const diferenca = valorLido - valorEsperado;
    if (diferenca < -TOLERANCIA) {
      recusa(
        "VALOR_MENOR",
        `O comprovante é de R$ ${valorLido.toFixed(2)}, abaixo dos R$ ${valorEsperado.toFixed(2)} combinados.`
      );
    } else if (diferenca > TOLERANCIA) {
      // Pagar a mais não é golpe — é troco a devolver. Quem decide é o dono.
      revisa(
        "VALOR_MAIOR",
        `O comprovante é de R$ ${valorLido.toFixed(2)}, acima dos R$ ${valorEsperado.toFixed(2)} combinados.`
      );
    }
  }

  // 4. Para quem foi. Chave, documento ou nada: sem nenhum dos dois não dá
  // para afirmar que o dinheiro caiu nesta conta.
  const chaveConfere = esperado.pixKey && lido.pixKey ? mesmaChave(lido.pixKey, esperado.pixKey) : null;
  const docConfere =
    esperado.holderDoc && lido.receiverDoc
      // O comprovante costuma mascarar o CPF do recebedor (•••.456.789-••).
      // Comparar pelo que aparece é o que dá para fazer: os dígitos visíveis
      // do comprovante têm de estar no documento cadastrado.
      ? digitos(esperado.holderDoc).includes(digitos(lido.receiverDoc)) && digitos(lido.receiverDoc).length >= 3
      : null;

  if (chaveConfere === false) {
    recusa("CHAVE_DIFERENTE", `A chave do comprovante (${lido.pixKey}) não é a chave do negócio.`);
  }
  if (docConfere === false) {
    recusa("RECEBEDOR_DIFERENTE", "O CPF/CNPJ que recebeu não é o do negócio.");
  }
  if (chaveConfere === null && docConfere === null) {
    revisa("SEM_RECEBEDOR", "O comprovante não mostra para quem o pagamento foi feito.");
  }

  // 5. Data e hora.
  const pago = lido.paidAt instanceof Date ? lido.paidAt : lido.paidAt ? new Date(lido.paidAt) : null;
  if (!pago || Number.isNaN(pago.getTime())) {
    revisa("SEM_DATA", "Não consegui ler a data do pagamento.");
  } else {
    const minutosNoFuturo = (pago.getTime() - agora.getTime()) / 60000;
    if (minutosNoFuturo > MINUTOS_DE_FOLGA) {
      // Data no futuro é agendamento com outro nome, ou comprovante montado.
      recusa("DATA_FUTURA", "A data do comprovante está no futuro — o pagamento ainda não aconteceu.");
    } else {
      const dias = (agora.getTime() - pago.getTime()) / 86400000;
      if (dias > (esperado.diasAceitaveis ?? DIAS_ACEITAVEIS)) {
        revisa("COMPROVANTE_ANTIGO", `O comprovante é de ${Math.floor(dias)} dias atrás.`);
      }
    }
  }

  if (recusar) return { status: VEREDITO.RECUSADO, motivos };
  if (revisar) return { status: VEREDITO.REVISAR, motivos };
  return {
    status: VEREDITO.APROVADO,
    motivos: [{ codigo: "OK", texto: "Valor, recebedor e data conferem." }],
  };
}

/** A instrução de leitura. Fora da função para poder ser conferida no teste. */
export const INSTRUCAO_DE_LEITURA = `Você está lendo um comprovante de pagamento brasileiro (Pix, TED, boleto ou cartão).
Responda APENAS com um objeto JSON, sem texto antes ou depois, com estas chaves:
{
  "amount": número em reais (ponto decimal) ou null,
  "paidAt": data e hora no formato "AAAA-MM-DDTHH:MM:SS" ou null,
  "pixKey": a chave Pix que RECEBEU o dinheiro, como está escrita, ou null,
  "payerName": nome de quem pagou ou null,
  "receiverName": nome de quem recebeu ou null,
  "receiverDoc": CPF/CNPJ de quem recebeu, como está escrito (pode estar mascarado), ou null,
  "endToEndId": identificador da transação (E2E, id, autenticação) ou null,
  "scheduled": true se o comprovante for de um pagamento AGENDADO/PROGRAMADO que ainda não foi debitado, false se já foi efetuado,
  "rawText": todo o texto que você conseguir transcrever do comprovante
}
Não invente valores: o que não estiver legível vai como null. Preste atenção especial na diferença entre "Pix realizado/efetuado" e "Pix agendado/programado".`;

/**
 * Extrai os campos de um comprovante.
 *
 * @returns {{ ok: boolean, dados?: object, erro?: string }}
 */
export async function ler(buffer, mimetype) {
  try {
    const { default: VoiceService } = await import("./VoiceService.js");
    const texto = await VoiceService.describeMedia(buffer, mimetype, INSTRUCAO_DE_LEITURA);
    if (!texto) return { ok: false, erro: "Não consegui ler o comprovante." };
    return interpretar(texto);
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

/**
 * Converte a resposta do modelo nos campos que a conferência usa.
 *
 * O modelo às vezes embrulha o JSON em ```json, às vezes escreve uma frase
 * antes. Recortar do primeiro `{` ao último `}` é o que faz a leitura
 * sobreviver a isso sem virar um erro para o dono.
 */
export function interpretar(texto) {
  const bruto = String(texto || "");
  const inicio = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) {
    return { ok: false, erro: "A leitura do comprovante não voltou em JSON." };
  }
  let json;
  try {
    json = JSON.parse(bruto.slice(inicio, fim + 1));
  } catch (e) {
    return { ok: false, erro: "Não consegui interpretar a leitura do comprovante." };
  }

  const numero = (v) => {
    if (v == null || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    // "R$ 1.234,56" → 1234.56
    const limpo = String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    const n = Number(limpo);
    return Number.isFinite(n) ? n : null;
  };

  const data = json.paidAt ? new Date(json.paidAt) : null;

  return {
    ok: true,
    dados: {
      amount: numero(json.amount),
      paidAt: data && !Number.isNaN(data.getTime()) ? data : null,
      pixKey: json.pixKey || null,
      payerName: json.payerName || null,
      receiverName: json.receiverName || null,
      receiverDoc: json.receiverDoc || null,
      endToEndId: json.endToEndId || null,
      scheduled: json.scheduled === true,
      rawText: json.rawText || bruto.slice(0, 4000),
    },
  };
}

/**
 * Traz os bytes do arquivo, esteja ele no disco ou atrás de uma URL.
 *
 * @returns {{ ok: boolean, buffer?: Buffer, mimetype?: string, erro?: string }}
 */
export async function baixar(fileUrl) {
  if (!fileUrl) return { ok: false, erro: "Comprovante sem arquivo." };
  const ext = String(fileUrl).split("?")[0].split(".").pop()?.toLowerCase();
  const mimetype =
    ext === "pdf" ? "application/pdf"
      : ext === "png" ? "image/png"
        : ext === "webp" ? "image/webp"
          : "image/jpeg";
  try {
    const { localPathFor } = await import("./StorageService.js");
    const fs = await import("fs");
    const caminho = localPathFor(fileUrl);
    if (caminho && fs.existsSync(caminho)) {
      return { ok: true, buffer: fs.readFileSync(caminho), mimetype };
    }
    if (/^https?:\/\//i.test(fileUrl)) {
      const { default: axios } = await import("axios");
      const { data, headers } = await axios.get(fileUrl, { responseType: "arraybuffer", timeout: 30000 });
      return { ok: true, buffer: Buffer.from(data), mimetype: headers["content-type"] || mimetype };
    }
    return { ok: false, erro: "Não encontrei o arquivo do comprovante." };
  } catch (e) {
    return { ok: false, erro: `Não consegui abrir o comprovante: ${e.message}` };
  }
}

/**
 * Confere um comprovante e grava o resultado.
 *
 * Aprovar fecha a venda: é o único caminho em que a venda vira PAID sozinha.
 * Recusa e revisão deixam a venda como está — o dono decide.
 *
 * @returns {{ ok: boolean, comprovante?: object, erro?: string }}
 */
export async function conferirEGravar({ tenantId, leadId = null, saleId = null, fileUrl, fileKind = "image", buffer, mimetype }) {
  // Pelo objeto do serviço, e não pela função solta: é o mesmo formato dos
  // outros serviços daqui (MessagingService, PipelineAutomation), e mantém a
  // leitura substituível — sem isso, conferir a decisão exigiria gastar uma
  // chamada de modelo a cada verificação.
  const leitura = await servico.ler(buffer, mimetype);
  if (!leitura.ok) return { ok: false, erro: leitura.erro };
  const lido = leitura.dados;

  const [tenant, venda] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { pixKey: true, pixHolderName: true, pixHolderDoc: true },
    }),
    saleId ? prisma.sale.findFirst({ where: { id: saleId, tenantId } }) : null,
  ]);

  // O mesmo end-to-end aprovado antes não paga de novo.
  const jaUsado = lido.endToEndId
    ? !!(await prisma.paymentReceipt.findFirst({
        where: { tenantId, endToEndId: lido.endToEndId, status: VEREDITO.APROVADO },
      }))
    : false;

  const veredito = conferir(lido, {
    amount: venda?.amount ?? null,
    pixKey: tenant?.pixKey || null,
    holderName: tenant?.pixHolderName || null,
    holderDoc: tenant?.pixHolderDoc || null,
    jaUsado,
  });

  const comprovante = await prisma.paymentReceipt.create({
    data: {
      tenantId,
      leadId,
      saleId,
      fileUrl,
      fileKind,
      status: veredito.status,
      reasons: JSON.stringify(veredito.motivos),
      amount: lido.amount,
      paidAt: lido.paidAt,
      pixKey: lido.pixKey,
      payerName: lido.payerName,
      receiverName: lido.receiverName,
      receiverDoc: lido.receiverDoc,
      endToEndId: lido.endToEndId,
      scheduled: lido.scheduled,
      rawText: lido.rawText ? String(lido.rawText).slice(0, 8000) : null,
    },
  });

  if (veredito.status === VEREDITO.APROVADO && venda && venda.status !== "PAID") {
    await servico.marcarPaga(venda, lido.paidAt || new Date());
  }

  return { ok: true, comprovante, veredito, lido };
}

/**
 * Baixa a venda e empurra o lead para "ganho" no funil.
 *
 * A venda é um evento do atendimento como o agendamento: se o quadro não
 * mexe quando o dinheiro entra, o funil mente.
 */
export async function marcarPaga(venda, quando = new Date()) {
  await prisma.sale.update({
    where: { id: venda.id },
    data: { status: "PAID", paidAt: quando },
  });
  if (venda.leadId) {
    try {
      const { default: PipelineAutomation } = await import("./PipelineAutomation.js");
      await PipelineAutomation.onEvent(venda.tenantId, venda.leadId, "SALE_PAID");
    } catch (e) {
      console.error("[Comprovante] Falha ao mover o lead no funil:", e.message);
    }
  }
}

/** Os motivos gravados, de volta em lista. */
export function lerMotivos(reasons) {
  try {
    const lista = JSON.parse(reasons || "[]");
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

const servico = {
  VEREDITO,
  baixar,
  conferir,
  pareceAgendamento,
  interpretar,
  ler,
  conferirEGravar,
  marcarPaga,
  lerMotivos,
  INSTRUCAO_DE_LEITURA,
};

export default servico;
