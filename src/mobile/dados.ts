/**
 * As chamadas que o app faz.
 *
 * São as mesmas rotas do painel — nenhuma foi criada para o celular. O que
 * muda é a forma de pedir: a lista já vem separada entre quem espera um
 * humano e o que a IA está cuidando, porque é assim que a tela mostra.
 *
 * O token entra pelo interceptador do `main.tsx`, como em todo o resto.
 */

export type Conversa = {
  id: string;
  leadId: string;
  name: string;
  handle: string;
  channel: string;
  phase: "BOT" | "QUEUE" | "HUMAN" | "CLOSED" | string;
  botActive: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  queue: { id: string; name: string; color?: string } | null;
  queuedAt: string | null;
  queuePosition: number | null;
  handoffReason: string | null;
  assignedTo: { id: string; name: string } | null;
  windowOpen: boolean;
};

export type ItemDaFila = {
  conversationId: string;
  leadId: string;
  position: number;
  name: string;
  channel: string;
  queue: { id: string; name: string; color?: string } | null;
  reason: string | null;
  esperaMinutos: number;
  lastMessagePreview: string;
};

export type Mensagem = {
  id: string;
  conversationId: string;
  content: string;
  role: string;
  messageType: string;
  mediaUrl: string | null;
  createdAt: string;
};

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${caminho}`, init);
  // O corpo vem como texto primeiro: quando o proxy devolve uma página de
  // erro, `res.json()` estoura com "Unexpected token '<'" e o atendente vê
  // uma mensagem que não explica nada.
  const texto = await res.text();
  let dados: any = null;
  if (texto) {
    try { dados = JSON.parse(texto); } catch { dados = null; }
  }
  if (!res.ok) throw new Error(dados?.error || `Não foi possível concluir (${res.status}).`);
  if (dados === null && texto) throw new Error("O servidor respondeu em um formato inesperado.");
  return dados as T;
}

const comJson = (corpo: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corpo ?? {}),
});

export const listarConversas = (busca?: string) =>
  pedir<Conversa[]>(`/conversations${busca ? `?q=${encodeURIComponent(busca)}` : ""}`);

export const listarFila = () =>
  pedir<{ aguardando: number; emAtendimento: number; esperaMaisAntiga: number; itens: ItemDaFila[] }>(
    "/attendance/queue"
  );

export const listarMensagens = (leadId: string) => pedir<Mensagem[]>(`/messages/${leadId}`);

export const enviarMensagem = (leadId: string, content: string) =>
  pedir<Mensagem>("/messages", comJson({ leadId, content }));

export const marcarLida = (leadId: string) =>
  pedir<{ success: boolean }>(`/conversations/${leadId}/read`, { method: "PUT" });

export const assumir = (conversationId: string) =>
  pedir<{ success: boolean; assignedTo?: { id: string; name: string } }>(
    `/conversations/${conversationId}/assign`,
    comJson({})
  );

export const devolverAIa = (conversationId: string) =>
  pedir<{ success: boolean }>(`/conversations/${conversationId}/return-bot`, comJson({}));

export type RespostaRapida = {
  id: string;
  titulo: string;
  texto: string;
  atalho: string | null;
  categoria: string | null;
  usos: number;
};

export type Disponibilidade = {
  id: string;
  name: string;
  estado: "ONLINE" | "PAUSA" | "FORA";
  estadoGuardado: string;
  disponivelAte: string | null;
  recado: string | null;
  disponivel: boolean;
};

/** As respostas cadastradas, já ordenadas pelas mais usadas. */
export const listarRespostas = () =>
  pedir<{ total: number; itens: RespostaRapida[] }>("/quick-replies");

/** Contagem de uso: é o que faz a lista se ordenar pela utilidade real. */
export const marcarUsoDaResposta = (id: string) =>
  pedir<{ success: boolean }>(`/quick-replies/${id}/used`, { method: "POST" });

/**
 * A resposta que a IA sugere. Nada é enviado — o que volta é texto para o
 * atendente ler e editar. Sem sugestão não é erro: `ok:false` vem com o
 * motivo, para a tela explicar em vez de piscar um alerta.
 */
export const pedirSugestao = (leadId: string) =>
  pedir<{ ok: boolean; sugestao?: string; motivo?: string }>(
    `/conversations/${leadId}/suggest`,
    comJson({})
  );

export const minhaDisponibilidade = () => pedir<Disponibilidade>("/attendance/me");

export const definirDisponibilidade = (estado: string, minutos?: number, recado?: string) =>
  pedir<Disponibilidade>("/attendance/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado, minutos: minutos ?? null, recado: recado ?? null }),
  });
