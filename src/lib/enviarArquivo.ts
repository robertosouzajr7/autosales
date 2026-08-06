/**
 * Envio de arquivo para a API, com a resposta lida de forma segura.
 *
 * Todo ponto de upload fazia `await res.json()` direto. Quando a resposta não
 * era JSON — a página de erro do Express, o 413 em HTML do nginx, um proxy
 * que devolveu o index.html — o erro que aparecia na tela era
 * `Unexpected token "<"`, que não diz nada a quem está tentando enviar um PDF.
 *
 * Aqui a resposta é lida como texto e só então interpretada, e cada caso
 * ganha uma frase que diz o que aconteceu.
 */

// Um objeto só, e não uma união discriminada: com `strict: false` o
// TypeScript não estreita união por booleano, e `envio.erro` dentro de um
// `if (!envio.ok)` viraria erro de compilação.
export type RespostaUpload<T = any> = { ok: boolean; dados?: T; erro?: string };

export async function enviarArquivo<T = any>(
  url: string,
  arquivo: File,
  extras: Record<string, string> = {},
  campo = "file"
): Promise<RespostaUpload<T>> {
  const fd = new FormData();
  fd.append(campo, arquivo);
  for (const [chave, valor] of Object.entries(extras)) fd.append(chave, valor);

  let res: Response;
  try {
    // Sem Content-Type de propósito: quem monta o boundary do multipart é o
    // navegador, e defini-lo à mão quebra a leitura no servidor.
    res = await fetch(url, { method: "POST", body: fd });
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Verifique a internet e tente de novo." };
  }

  const bruto = await res.text().catch(() => "");
  let corpo: any = null;
  try {
    corpo = bruto ? JSON.parse(bruto) : null;
  } catch {
    // Não é JSON: quase sempre uma página de erro de proxy no caminho.
    if (res.status === 413) {
      return { ok: false, erro: "O arquivo passou do tamanho aceito pelo servidor." };
    }
    return {
      ok: false,
      erro: res.ok
        ? "O servidor respondeu num formato inesperado."
        : `O servidor respondeu ${res.status} sem detalhar o motivo. Se o arquivo for grande, pode ser limite de tamanho no servidor.`,
    };
  }

  if (!res.ok) {
    return { ok: false, erro: corpo?.error || `Falha no envio (${res.status}).` };
  }
  return { ok: true, dados: corpo as T };
}
