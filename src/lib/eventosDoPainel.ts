/**
 * Uma conexão de eventos por aba, não uma por tela.
 *
 * A sidebar e a tela de conversas abriam cada uma o seu `/api/events`, então
 * quem estava no inbox mantinha duas conexões idênticas ao mesmo endpoint —
 * e duas reconexões toda vez que a rede oscilava. Aqui a conexão é uma só e
 * as telas se inscrevem nela; quando a última sai, ela fecha.
 */

type Ouvinte = (mensagem: any) => void;

let fonte: EventSource | null = null;
let tokenAtual: string | null = null;
const ouvintes = new Set<Ouvinte>();

function abrir(token: string) {
  fonte = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
  tokenAtual = token;
  fonte.onmessage = (evento) => {
    let dados: any;
    try {
      dados = JSON.parse(evento.data);
    } catch {
      return; // linha de keep-alive
    }
    // Cada ouvinte cuida do próprio erro: um que quebre não pode calar o resto.
    for (const ouvinte of ouvintes) {
      try { ouvinte(dados); } catch { /* problema da tela, não do fluxo */ }
    }
  };
}

/** Inscreve uma tela nos eventos. Devolve a função que cancela a inscrição. */
export function assinarEventos(ouvinte: Ouvinte): () => void {
  const token = localStorage.getItem("token");
  if (!token) return () => {};

  // Trocou de conta na mesma aba: a conexão antiga fala pelo tenant errado.
  if (fonte && tokenAtual !== token) {
    fonte.close();
    fonte = null;
  }
  if (!fonte) abrir(token);

  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
    if (ouvintes.size === 0 && fonte) {
      fonte.close();
      fonte = null;
      tokenAtual = null;
    }
  };
}
