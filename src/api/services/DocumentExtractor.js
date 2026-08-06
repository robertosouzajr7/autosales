/**
 * Extração real de texto de documentos enviados pela clínica.
 * Suporta PDF, DOCX, XLSX/XLS, CSV e TXT. Retorna texto limpo pronto para
 * virar base de conhecimento do agente.
 */

const MAX_CHARS = 100_000; // trava de segurança para não estourar o prompt/DB

function clean(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CHARS);
}

export async function extractText(buffer, filename = "", mimetype = "") {
  const name = (filename || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";

  // PDF
  //
  // O pdf-parse 2.x deixou de exportar uma função: agora é a classe PDFParse,
  // e a chamada antiga (`pdfParse(buffer)`) estourava com "pdfParse is not a
  // function" em todo upload de PDF. O `destroy()` importa — sem ele o worker
  // do pdf.js fica de pé e o processo vaza memória a cada documento.
  if (ext === "pdf" || mimetype.includes("pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const leitor = new PDFParse({ data: buffer });
    try {
      const { text } = await leitor.getText();
      // O rodapé "-- N of M --" é separador de página da biblioteca, não
      // conteúdo do documento: iria para o prompt do agente como se fosse.
      return clean(String(text || "").replace(/^-{2}\s*\d+\s+of\s+\d+\s*-{2}$/gm, ""));
    } finally {
      await leitor.destroy().catch(() => {});
    }
  }

  // DOCX
  if (ext === "docx" || mimetype.includes("wordprocessingml")) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer });
    return clean(value);
  }

  // Planilhas binárias (XLSX/XLS) → texto tabular legível
  if (["xlsx", "xls"].includes(ext) || mimetype.includes("spreadsheet") || mimetype.includes("excel")) {
    const mod = await import("xlsx");
    const XLSX = mod.default || mod;
    const wb = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
    const parts = [];
    for (const sheetName of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { blankrows: false });
      if (csv.trim()) parts.push(`# ${sheetName}\n${csv}`);
    }
    return clean(parts.join("\n\n"));
  }

  // CSV / TXT / Markdown → texto puro (UTF-8; evita mojibake de acentos)
  if (["csv", "txt", "md", "text"].includes(ext) || mimetype.startsWith("text/") || mimetype.includes("csv")) {
    return clean(buffer.toString("utf8"));
  }

  // .doc (Word 97-2003) é um formato binário diferente do .docx e o mammoth
  // não lê — dizer só "formato não suportado" mandaria a pessoa tentar de novo.
  if (ext === "doc") {
    throw new Error("O formato .doc (Word antigo) não é lido. Salve como .docx ou PDF e envie de novo.");
  }

  throw new Error(`Não sei ler arquivos ${ext ? `.${ext}` : "deste tipo"}. Envie PDF, DOCX, XLSX, CSV ou TXT.`);
}

export default { extractText };
