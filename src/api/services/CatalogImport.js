/**
 * Leitura de catálogo em massa (CSV ou TXT).
 *
 * Cadastrar item por item não escala: quem chega com uma tabela de cem
 * serviços desiste antes do vigésimo. Aqui o arquivo é lido, conferido e
 * mostrado ANTES de gravar — importação que grava direto e depois avisa que
 * 40 linhas falharam obriga a limpar a base na mão.
 *
 * Dois formatos, porque é o que as pessoas realmente têm:
 *  - tabela com cabeçalho, salva de Excel/Sheets (vírgula, ponto-e-vírgula
 *    ou tabulação — o separador é descoberto, não perguntado);
 *  - lista solta, uma linha por item, do tipo "Clareamento - R$ 1.400".
 */

const SEPARADORES = [";", "\t", ","];

/** Cabeçalho comparável: sem acento, sem caixa, sem pontuação. */
function chave(texto) {
  return String(texto || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const COLUNAS = {
  name: ["nome", "name", "item", "produto", "servico", "titulo", "descricao_curta"],
  type: ["tipo", "type"],
  category: ["categoria", "category", "grupo", "secao"],
  description: ["descricao", "description", "detalhes", "observacao", "obs"],
  price: ["preco", "price", "valor", "preco_venda", "valor_unitario"],
  size: ["tamanho", "size", "duracao", "sessoes"],
  buyUrl: ["link", "url", "buy_url", "link_de_compra", "link_compra"],
  imageUrl: ["imagem", "image", "image_url", "foto", "url_da_imagem"],
  isActive: ["ativo", "active", "status"],
};

/**
 * Preço como as pessoas escrevem.
 *
 * "R$ 1.400,00", "1.400,00", "1400.00" e "1400" são o mesmo número.
 *
 * Com os dois símbolos presentes é fácil: o último é o decimal — em
 * "1.400,00" a vírgula, em "1,400.00" o ponto.
 *
 * Com um só, "1.400" é armadilha. Tratar todo ponto como decimal transforma
 * mil e quatrocentos em um e quatro décimos, e é o erro que faz o catálogo
 * inteiro entrar com preço errado sem ninguém perceber. A regra que
 * desempata é quantos dígitos vêm depois: exatamente três é separador de
 * milhar ("1.400", "1,400"); um ou dois é decimal ("89,90", "250.00").
 *
 * O caso que essa regra erra é um preço de verdade como "0.500" — meio real
 * escrito com três casas. Em preço isso não existe na prática, e o
 * inverso ("1.400" virar 1,40) acontece o tempo todo.
 */
export function lerPreco(bruto) {
  if (bruto === null || bruto === undefined) return null;
  const texto = String(bruto).replace(/[^\d.,-]/g, "").trim();
  if (!texto) return null;

  const virgulas = (texto.match(/,/g) || []).length;
  const pontos = (texto.match(/\./g) || []).length;
  let normalizado = texto;

  if (virgulas && pontos) {
    // O último símbolo é o decimal; o outro é milhar.
    normalizado = texto.lastIndexOf(",") > texto.lastIndexOf(".")
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto.replace(/,/g, "");
  } else if (virgulas || pontos) {
    const simbolo = virgulas ? "," : ".";
    const quantos = virgulas || pontos;
    const depois = texto.length - texto.lastIndexOf(simbolo) - 1;
    if (quantos > 1 || depois === 3) {
      // Repetido, ou com três dígitos atrás: é separador de milhar.
      normalizado = texto.split(simbolo).join("");
    } else {
      normalizado = texto.replace(simbolo, ".");
    }
  }

  const n = Number(normalizado);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** "sim", "1", "ativo", "true" → true. Vazio vira ativo: é o esperado. */
function lerAtivo(bruto) {
  const v = chave(bruto);
  if (!v) return true;
  return !["nao", "n", "no", "0", "false", "inativo", "off", "desativado"].includes(v);
}

function lerTipo(bruto) {
  const v = chave(bruto);
  if (["servico", "service", "atendimento", "procedimento"].includes(v)) return "SERVICE";
  return "PRODUCT";
}

/** Divide respeitando campo entre aspas ("Silva, João";…). */
function dividir(linha, sep) {
  const out = [];
  let atual = "";
  let aspas = false;
  for (const ch of linha) {
    if (ch === '"') { aspas = !aspas; continue; }
    if (ch === sep && !aspas) { out.push(atual.trim()); atual = ""; continue; }
    atual += ch;
  }
  out.push(atual.trim());
  return out;
}

/** O separador que mais divide a primeira linha. Empate fica com o primeiro. */
function descobrirSeparador(primeiraLinha) {
  let melhor = null;
  let maior = 0;
  for (const sep of SEPARADORES) {
    const n = dividir(primeiraLinha, sep).length;
    if (n > maior) { maior = n; melhor = sep; }
  }
  return maior > 1 ? melhor : null;
}

function mapearColunas(cabecalho) {
  const mapa = {};
  cabecalho.forEach((h, i) => {
    for (const [campo, nomes] of Object.entries(COLUNAS)) {
      if (mapa[campo] === undefined && nomes.includes(h)) mapa[campo] = i;
    }
  });
  return mapa;
}

/**
 * Lista solta: "Clareamento a Laser - R$ 1.400" ou só "Clareamento a Laser".
 * O preço é o último número monetário da linha; o resto é o nome.
 */
function lerLinhaSolta(linha) {
  const texto = linha.trim();
  const m = texto.match(/(?:R\$\s*)?(\d[\d.,]*)\s*$/);
  if (!m) return { name: texto, price: null };
  const price = lerPreco(m[1]);
  if (price === null) return { name: texto, price: null };
  const nome = texto.slice(0, m.index).replace(/[\s\-–—:|]+$/, "").trim();
  // "1400" sozinho é um item chamado 1400, não um preço sem item.
  return nome ? { name: nome, price } : { name: texto, price: null };
}

/**
 * Lê o arquivo e devolve o que seria gravado, linha a linha, com os erros.
 * Não toca no banco: quem grava é o controller, depois de o dono conferir.
 */
export function analisar(texto) {
  const linhas = String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return { formato: null, colunas: [], itens: [], erro: "Arquivo vazio." };

  const sep = descobrirSeparador(linhas[0]);
  const cabecalho = sep ? dividir(linhas[0], sep).map(chave) : [];
  const mapa = sep ? mapearColunas(cabecalho) : {};

  // Sem coluna de nome reconhecível, o arquivo é tratado como lista solta —
  // inclusive a primeira linha, que aí não é cabeçalho e sim um item.
  const tabela = mapa.name !== undefined;
  const itens = [];
  const inicio = tabela ? 1 : 0;

  for (let i = inicio; i < linhas.length; i++) {
    const numero = i + 1;
    let dados;

    if (tabela) {
      const cols = dividir(linhas[i], sep);
      const pegar = (campo) => (mapa[campo] !== undefined ? (cols[mapa[campo]] || "") : "");
      dados = {
        name: pegar("name"),
        type: lerTipo(pegar("type")),
        category: pegar("category") || null,
        description: pegar("description") || null,
        price: lerPreco(pegar("price")),
        size: pegar("size") || null,
        buyUrl: pegar("buyUrl") || null,
        imageUrl: pegar("imageUrl") || null,
        isActive: mapa.isActive !== undefined ? lerAtivo(pegar("isActive")) : true,
      };
    } else {
      const solto = lerLinhaSolta(linhas[i]);
      dados = {
        name: solto.name, type: "PRODUCT", category: null, description: null,
        price: solto.price, size: null, buyUrl: null, imageUrl: null, isActive: true,
      };
    }

    const erros = [];
    if (!dados.name) erros.push("sem nome");
    else if (dados.name.length > 200) erros.push("nome com mais de 200 caracteres");
    if (tabela && mapa.price !== undefined) {
      const bruto = dividir(linhas[i], sep)[mapa.price] || "";
      if (bruto.trim() && dados.price === null) erros.push(`preço não reconhecido: "${bruto.trim()}"`);
    }
    if (dados.buyUrl && !/^https?:\/\//i.test(dados.buyUrl)) {
      // Link quebrado é pior que link ausente: o agente enviaria ao cliente.
      erros.push("link precisa começar com http:// ou https://");
      dados.buyUrl = null;
    }

    itens.push({ linha: numero, dados, erros });
  }

  return {
    formato: tabela ? "tabela" : "lista",
    separador: sep,
    colunas: tabela ? cabecalho : [],
    naoReconhecidas: tabela ? cabecalho.filter((h) => !Object.values(COLUNAS).flat().includes(h)) : [],
    itens,
  };
}

/** Modelo para o dono baixar, preencher e devolver. */
export const MODELO_CSV = [
  "nome;tipo;categoria;descricao;preco;tamanho;link;imagem;ativo",
  "Clareamento a Laser;servico;Estética;Três sessões de 40 minutos;1400,00;3 sessões;https://seusite.com.br/clareamento;https://seusite.com.br/fotos/clareamento.jpg;sim",
  "Limpeza de Pele;servico;Estética;Sessão única;180,00;50 min;;;sim",
  "Kit Pós-Procedimento;produto;Produtos;Creme + protetor solar;89,90;;;;sim",
].join("\r\n");

export default { analisar, lerPreco, MODELO_CSV };
