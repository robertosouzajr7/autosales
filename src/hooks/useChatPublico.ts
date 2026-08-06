import { useCallback, useEffect, useRef, useState } from "react";
import type { Visitante } from "@/components/public/IdentificacaoVisitante";

export type MensagemPublica = {
  id?: string;
  role: string;
  content: string;
  createdAt?: string;
  enviando?: boolean;
};

/**
 * A conversa do site, dos dois lados.
 *
 * Antes o chat público era uma via de mão única: o visitante mandava, a IA
 * respondia na mesma requisição, e o histórico ficava no sessionStorage do
 * navegador. Quando o atendente respondia pelo painel, a mensagem era gravada
 * e morria ali — não havia por onde ela chegar ao visitante.
 *
 * Agora a conversa mora no servidor. Este hook cuida das três coisas que isso
 * exige e que as duas telas de chat (landing e widget) precisavam igual:
 * lembrar quem é o visitante, carregar o histórico de verdade, e ficar
 * escutando o que chega enquanto a aba está aberta.
 *
 * `chave` separa as sessões: a landing e o webchat de um cliente podem estar
 * abertos no mesmo navegador sem misturar conversa.
 */
export function useChatPublico({ chave, corpoBase }: { chave: string; corpoBase: () => Record<string, any> }) {
  const [visitante, setVisitante] = useState<Visitante | null>(() => {
    const salvo = sessionStorage.getItem(`${chave}_visitante`);
    return salvo ? JSON.parse(salvo) : null;
  });
  const [leadId, setLeadId] = useState<string | null>(() => sessionStorage.getItem(`${chave}_lead`) || null);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(`${chave}_token`) || null);
  const [mensagens, setMensagens] = useState<MensagemPublica[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const corpoRef = useRef(corpoBase);
  corpoRef.current = corpoBase;

  const identificar = useCallback((v: Visitante) => {
    setVisitante(v);
    sessionStorage.setItem(`${chave}_visitante`, JSON.stringify(v));
  }, [chave]);

  // Histórico do servidor. Repõe o que chegou com a aba fechada — inclusive a
  // resposta do atendente humano, que é justamente o que se perdia.
  useEffect(() => {
    if (!token) return;
    let cancelado = false;
    fetch(`/api/public/chat/history?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("sessão expirada"))))
      .then((d) => {
        if (!cancelado && Array.isArray(d.messages)) setMensagens(d.messages);
      })
      .catch(() => {
        // Token vencido: a próxima mensagem começa uma sessão nova.
        if (!cancelado) {
          sessionStorage.removeItem(`${chave}_token`);
          setToken(null);
        }
      });
    return () => { cancelado = true; };
  }, [token, chave]);

  // Respostas chegando enquanto a aba está aberta.
  useEffect(() => {
    if (!token) return;
    const fonte = new EventSource(`/api/public/chat/stream?token=${encodeURIComponent(token)}`);
    fonte.onmessage = (evento) => {
      try {
        const m = JSON.parse(evento.data);
        setMensagens((prev) => (prev.some((x) => x.id && x.id === m.id) ? prev : [...prev, m]));
      } catch { /* linha de keep-alive */ }
    };
    return () => fonte.close();
  }, [token]);

  const enviar = useCallback(async (texto: string) => {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;

    // Eco imediato: quem está conversando não deve esperar o servidor para
    // ver o que acabou de escrever.
    const provisorio: MensagemPublica = {
      id: `local-${Date.now()}`,
      role: "USER",
      content: conteudo,
      createdAt: new Date().toISOString(),
      enviando: true,
    };
    setMensagens((prev) => [...prev, provisorio]);
    setEnviando(true);
    setErro(null);

    try {
      const res = await fetch("/api/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...corpoRef.current(),
          message: conteudo,
          leadId,
          name: visitante?.name,
          email: visitante?.email,
          phone: visitante?.phone,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível enviar agora.");

      if (d.leadId && d.leadId !== leadId) {
        setLeadId(d.leadId);
        sessionStorage.setItem(`${chave}_lead`, d.leadId);
      }
      if (d.chatToken && d.chatToken !== token) {
        setToken(d.chatToken);
        sessionStorage.setItem(`${chave}_token`, d.chatToken);
      }

      setMensagens((prev) => {
        const semProvisorio = prev.filter((m) => m.id !== provisorio.id);
        const confirmada = d.message || { ...provisorio, enviando: false };
        // A resposta da IA vem na mesma requisição; a do humano vem pelo SSE.
        const resposta = d.response
          ? [{ id: `ia-${Date.now()}`, role: "ASSISTANT", content: d.response, createdAt: new Date().toISOString() }]
          : [];
        return [...semProvisorio, confirmada, ...resposta];
      });
    } catch (e: any) {
      setMensagens((prev) => prev.filter((m) => m.id !== provisorio.id));
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }, [chave, enviando, leadId, token, visitante]);

  return { visitante, identificar, mensagens, enviar, enviando, erro };
}
