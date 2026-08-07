import QRCode from "qrcode";

/**
 * Pix: a chave do negócio em três formatos.
 *
 * O cliente pede de jeitos diferentes — uns querem apontar a câmera (QR
 * Code), outros querem colar no app do banco (copia e cola) e outros querem
 * abrir um link. Os três saem do mesmo lugar: o BR Code, que é o payload EMV
 * padronizado pelo Banco Central.
 *
 * O BR Code é montado aqui em vez de vir de um PSP porque a chave estática do
 * negócio não precisa de intermediário: quem recebe é a conta do dono, e a
 * plataforma não toca no dinheiro.
 */

export const TIPOS_DE_CHAVE = ["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"];

const soDigitos = (v) => String(v || "").replace(/\D/g, "");

/**
 * Limpa a chave conforme o tipo. O banco recusa a chave com máscara: CPF vai
 * como 11 dígitos, telefone vai em E.164 (+55...).
 *
 * @returns {{ ok: boolean, chave?: string, erro?: string }}
 */
export function normalizarChave(tipo, chave) {
  const bruto = String(chave || "").trim();
  if (!bruto) return { ok: false, erro: "Informe a chave Pix." };
  const t = String(tipo || "").toUpperCase();

  switch (t) {
    case "CPF": {
      const d = soDigitos(bruto);
      if (d.length !== 11) return { ok: false, erro: "CPF precisa ter 11 dígitos." };
      return { ok: true, chave: d };
    }
    case "CNPJ": {
      const d = soDigitos(bruto);
      if (d.length !== 14) return { ok: false, erro: "CNPJ precisa ter 14 dígitos." };
      return { ok: true, chave: d };
    }
    case "EMAIL": {
      const e = bruto.toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, erro: "E-mail inválido." };
      return { ok: true, chave: e };
    }
    case "PHONE": {
      const d = soDigitos(bruto);
      // 10 ou 11 dígitos = número nacional; 12 ou 13 = já veio com o 55.
      if (d.length === 10 || d.length === 11) return { ok: true, chave: `+55${d}` };
      if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return { ok: true, chave: `+${d}` };
      return { ok: false, erro: "Telefone inválido. Use DDD + número." };
    }
    case "RANDOM": {
      const r = bruto.toLowerCase();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r)) {
        return { ok: false, erro: "Chave aleatória inválida — são 32 caracteres no formato UUID." };
      }
      return { ok: true, chave: r };
    }
    default:
      return { ok: false, erro: `Tipo de chave desconhecido: "${tipo}".` };
  }
}

/**
 * Duas chaves são a mesma coisa? Compara ignorando máscara e caixa.
 * É o que permite conferir a chave do comprovante contra a do negócio sem
 * exigir que o banco tenha formatado igual.
 */
export function mesmaChave(a, b) {
  const limpa = (v) => {
    const s = String(v || "").trim().toLowerCase();
    // Só descarta a pontuação quando o que sobra é número: e-mail e chave
    // aleatória perdem o sentido sem os caracteres.
    const d = s.replace(/\D/g, "");
    return d.length >= 10 && !/[a-z]/.test(s) ? d.replace(/^55(?=\d{10,11}$)/, "") : s;
  };
  const x = limpa(a);
  const y = limpa(b);
  return !!x && x === y;
}

/** Campo no formato EMV: id + tamanho em 2 dígitos + valor. */
function campo(id, valor) {
  const v = String(valor);
  return `${id}${String(v.length).padStart(2, "0")}${v}`;
}

/**
 * CRC16/CCITT-FALSE — o dígito verificador exigido no fim do BR Code.
 * Sem ele o app do banco recusa o código com "QR Code inválido".
 */
export function crc16(texto) {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Tira acento e caracteres que o padrão não aceita, e corta no limite.
 * Nome e cidade viajam em ASCII maiúsculo no BR Code.
 */
function texto(valor, limite) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, limite);
}

/**
 * O identificador da transação. Só letras e números, até 25 caracteres.
 * "***" é o que o padrão manda usar quando não há identificador.
 */
export function normalizarTxid(txid) {
  const limpo = String(txid || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25);
  return limpo || "***";
}

/**
 * Monta o BR Code (copia e cola) de uma cobrança estática.
 *
 * @param {object} p
 * @param {string} p.chave    chave Pix já normalizada
 * @param {string} p.nome     nome do recebedor
 * @param {string} p.cidade   cidade do recebedor
 * @param {number} [p.valor]  em reais; omitido, o cliente digita no app
 * @param {string} [p.txid]
 * @param {string} [p.descricao]
 * @returns {{ ok: boolean, payload?: string, erro?: string }}
 */
export function montarBrCode({ chave, nome, cidade, valor = null, txid = null, descricao = null }) {
  if (!chave) return { ok: false, erro: "Sem chave Pix não dá para gerar o código." };

  const nomeLimpo = texto(nome, 25) || "RECEBEDOR";
  const cidadeLimpa = texto(cidade, 15) || "SAO PAULO";

  // 26 = merchant account information do Pix.
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", chave)
    + (descricao ? campo("02", texto(descricao, 72)) : "");

  let payload =
    campo("00", "01") +            // payload format indicator
    campo("26", conta) +
    campo("52", "0000") +          // merchant category code
    campo("53", "986") +           // moeda: BRL
    (valor != null && Number(valor) > 0 ? campo("54", Number(valor).toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", nomeLimpo) +
    campo("60", cidadeLimpa) +
    campo("62", campo("05", normalizarTxid(txid)));

  // O CRC é calculado sobre o payload já com "6304" no fim.
  payload += "6304";
  return { ok: true, payload: payload + crc16(payload) };
}

/** O BR Code como PNG em data URL, pronto para virar imagem na conversa. */
export async function qrCodeDataUrl(payload) {
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 512 });
}

/** Código curto do link público. Sem caracteres ambíguos (0/O, 1/l). */
export function gerarCodigo(tamanho = 10) {
  const alfabeto = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < tamanho; i++) s += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return s;
}

/** O link público da cobrança. */
export function linkDaCobranca(code, base = process.env.PUBLIC_URL || "") {
  const raiz = String(base || "").replace(/\/+$/, "");
  return `${raiz}/pix/${code}`;
}

/**
 * Os dados de Pix do negócio estão completos?
 * @returns {{ ok: boolean, erro?: string }}
 */
export function conferirCadastro(tenant) {
  if (!tenant?.pixKey) {
    return { ok: false, erro: "O negócio ainda não cadastrou a chave Pix em Meu Negócio." };
  }
  const n = normalizarChave(tenant.pixKeyType, tenant.pixKey);
  if (!n.ok) return { ok: false, erro: n.erro };
  return { ok: true };
}

export default {
  TIPOS_DE_CHAVE,
  normalizarChave,
  mesmaChave,
  crc16,
  normalizarTxid,
  montarBrCode,
  qrCodeDataUrl,
  gerarCodigo,
  linkDaCobranca,
  conferirCadastro,
};
