/**
 * As notificações do sino.
 *
 * A versão anterior só guardava o que chegasse pelo fluxo de eventos enquanto
 * a aba estivesse aberta: recarregar a página zerava tudo, e quem abrisse o
 * painel de manhã via "nenhuma notificação" mesmo com conversas esperando
 * desde a noite. Marcar como lida também não funcionava — o objeto era
 * mutado no lugar, sem avisar ninguém, então o contador não mexia; e "limpar
 * tudo" só limpava a cópia da tela, e a lista voltava na mensagem seguinte.
 *
 * Agora a lista é semeada do servidor ao abrir, e o que foi lido fica no
 * navegador: ninguém quer ver de novo, a cada recarga, o aviso que já leu.
 */

export type Notificacao = {
  id: string;
  leadId?: string | null;
  nome?: string;
  content: string;
  time: string;
  read: boolean;
  messageType?: string;
  criadoEm: number;
};

const CHAVE_LIDAS = "notificacoes_lidas";
const LIMITE = 50;

function lidasSalvas(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_LIDAS) || "[]"));
  } catch {
    return new Set();
  }
}

function salvarLidas(ids: Set<string>) {
  // Só as mais recentes: a lista de lidas não pode crescer para sempre.
  try {
    localStorage.setItem(CHAVE_LIDAS, JSON.stringify([...ids].slice(-300)));
  } catch { /* modo privado, cota cheia: seguir sem persistir */ }
}

export const notificationStore = {
  listeners: [] as ((n: Notificacao[]) => void)[],
  notifications: [] as Notificacao[],

  _avisar() {
    for (const l of this.listeners) l(this.notifications);
  },

  _ordenar() {
    this.notifications.sort((a, b) => b.criadoEm - a.criadoEm);
    this.notifications = this.notifications.slice(0, LIMITE);
  },

  add(n: Partial<Notificacao> & { content: string }) {
    const id = String(n.id || `local-${Date.now()}-${Math.random()}`);
    if (this.notifications.some((x) => x.id === id)) return;
    const lidas = lidasSalvas();
    this.notifications = [
      {
        id,
        leadId: n.leadId ?? null,
        nome: n.nome,
        content: n.content,
        time: n.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        read: lidas.has(id),
        messageType: n.messageType,
        criadoEm: n.criadoEm || Date.now(),
      },
      ...this.notifications,
    ];
    this._ordenar();
    this._avisar();
  },

  /** Estado inicial vindo do servidor, ao abrir o painel. */
  semear(itens: (Partial<Notificacao> & { content: string })[]) {
    const lidas = lidasSalvas();
    const existentes = new Set(this.notifications.map((n) => n.id));
    for (const item of itens) {
      const id = String(item.id || `${item.leadId}-${item.criadoEm}`);
      if (existentes.has(id)) continue;
      this.notifications.push({
        id,
        leadId: item.leadId ?? null,
        nome: item.nome,
        content: item.content,
        time: item.time || "",
        read: lidas.has(id),
        messageType: item.messageType,
        criadoEm: item.criadoEm || Date.now(),
      });
    }
    this._ordenar();
    this._avisar();
  },

  marcarLida(id: string) {
    const lidas = lidasSalvas();
    lidas.add(id);
    salvarLidas(lidas);
    this.notifications = this.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    this._avisar();
  },

  marcarTodasLidas() {
    const lidas = lidasSalvas();
    for (const n of this.notifications) lidas.add(n.id);
    salvarLidas(lidas);
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    this._avisar();
  },

  /** Limpa a lista de verdade — e lembra que foram lidas, para não voltarem. */
  limpar() {
    const lidas = lidasSalvas();
    for (const n of this.notifications) lidas.add(n.id);
    salvarLidas(lidas);
    this.notifications = [];
    this._avisar();
  },

  /** Troca de conta na mesma aba: o que estava na tela era de outro negócio. */
  esquecerTudo() {
    this.notifications = [];
    try { localStorage.removeItem(CHAVE_LIDAS); } catch { /* ignora */ }
    this._avisar();
  },

  subscribe(l: (n: Notificacao[]) => void) {
    this.listeners.push(l);
    l(this.notifications);
    return () => { this.listeners = this.listeners.filter((x) => x !== l); };
  },
};
