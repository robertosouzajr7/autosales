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
  if (ext === "pdf" || mimetype.includes("pdf")) {
    const mod = await import("pdf-parse");
    const pdfParse = mod.default || mod;
    const data = await pdfParse(buffer);
    return clean(data.text);
  }

  // DOCX
  if (ext === "docx" || mimetype.includes("wordprocessingml")) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer });
    return clean(value);
  }

  // Planilhas binárias (XLSX/XLS) → texto tabular legível
  if (["xlsx", "xls"].includes(ext) || mimetype.includes("spreadsheet") || mimetype.includes("excel")) {
    const XLSX = (await import("xlsx")).default || (await import("xlsx"));
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

  throw new Error("Formato não suportado. Envie PDF, DOCX, XLSX, CSV ou TXT.");
}

export default { extractText };
