import multer from "multer";

/**
 * Recebimento de arquivo, com limite e recusa explicada.
 *
 * O multer estava configurado sem limite nenhum: um arquivo de 500 MB era
 * lido inteiro para a memória do processo antes de qualquer verificação. E
 * quando ele reclamava de alguma coisa, o erro subia como exceção e virava
 * um "Erro interno." genérico — a tela dizia que falhou, sem dizer por quê.
 *
 * Aqui o limite é explícito por tipo de upload e a recusa vira uma frase que
 * diz o que aconteceu e o que fazer.
 */

const MB = 1024 * 1024;

/** Tetos por finalidade. Os de mídia seguem o que o WhatsApp aceita. */
export const LIMITES = {
  // Documento de treino do agente: PDF/DOCX/XLSX/CSV/TXT.
  documento: 20 * MB,
  // Mídia enviada na conversa e no catálogo.
  midia: 25 * MB,
  // Planilha de contatos.
  planilha: 10 * MB,
};

/** Extensões aceitas por finalidade, para recusar antes de ler o arquivo. */
export const FORMATOS = {
  documento: ["pdf", "docx", "xlsx", "xls", "csv", "txt", "md"],
  midia: [
    "jpg", "jpeg", "png", "webp", "gif",
    "mp4", "3gp", "mov",
    "mp3", "ogg", "opus", "wav", "m4a", "webm", "aac", "amr",
    "pdf", "docx", "xlsx", "doc", "xls", "ppt", "pptx", "txt", "csv",
  ],
  planilha: ["csv", "txt", "xlsx", "xls"],
};

const extensaoDe = (nome) => {
  const limpo = String(nome || "").toLowerCase();
  return limpo.includes(".") ? limpo.split(".").pop() : "";
};

/**
 * Middleware de upload de um arquivo.
 *
 * @param {string} campo      nome do campo no formulário
 * @param {string} finalidade documento | midia | planilha
 */
export function receberArquivo(campo, finalidade = "midia") {
  const limite = LIMITES[finalidade] || LIMITES.midia;
  const aceitos = FORMATOS[finalidade] || FORMATOS.midia;

  const middleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: limite, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ext = extensaoDe(file.originalname);
      if (!ext || aceitos.includes(ext)) return cb(null, true);
      const erro = new Error(
        `Arquivos .${ext} não são aceitos aqui. Formatos válidos: ${aceitos.slice(0, 8).join(", ")}.`
      );
      erro.code = "FORMATO_RECUSADO";
      cb(erro);
    },
  }).single(campo);

  return (req, res, next) => {
    middleware(req, res, (erro) => {
      if (!erro) return next();

      const emMb = Math.round(limite / MB);
      if (erro.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: `Arquivo grande demais. O limite aqui é ${emMb} MB.`,
          limiteMb: emMb,
        });
      }
      if (erro.code === "FORMATO_RECUSADO") {
        return res.status(415).json({ error: erro.message });
      }
      if (erro.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({ error: `Envie o arquivo no campo "${campo}".` });
      }
      return res.status(400).json({ error: erro.message || "Não foi possível receber o arquivo." });
    });
  };
}

/**
 * De que tipo é o arquivo: imagem, vídeo, áudio ou documento.
 *
 * Classificar só pelo mimetype recusava arquivo bom: o navegador manda
 * `application/octet-stream` sempre que o sistema não reconhece a extensão —
 * acontece direto com .ogg, .opus, .webp e .amr, e com qualquer arquivo
 * vindo de um pendrive ou de um download. A extensão é o desempate.
 */
const POR_EXTENSAO = {
  image: ["jpg", "jpeg", "png", "webp", "gif"],
  video: ["mp4", "3gp", "mov", "webm"],
  audio: ["mp3", "ogg", "opus", "wav", "m4a", "aac", "amr"],
  document: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md"],
};

export function tipoDoArquivo(nome, mimetype = "") {
  const mime = String(mimetype || "").toLowerCase();
  // O mimetype é a fonte melhor quando diz alguma coisa.
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";

  const ext = extensaoDe(nome);
  for (const [tipo, extensoes] of Object.entries(POR_EXTENSAO)) {
    if (extensoes.includes(ext)) return tipo;
  }

  // Texto e PDF só chegam aqui quando a extensão também não ajudou.
  if (mime.startsWith("text/") || mime.includes("pdf") || mime.includes("officedocument") || mime.includes("msword")) {
    return "document";
  }
  return null;
}

export default { receberArquivo, tipoDoArquivo, LIMITES, FORMATOS };
