import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App as AppNativo } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { assinarEventos } from "@/lib/eventosDoPainel";
import { ehNativo } from "./plataforma";
import { restaurarSessao } from "./sessao";
import { Aba, BarraDeAbas } from "./componentes/BarraDeAbas";
import {
  assumir,
  devolverAIa,
  enviarMensagem,
  listarConversas,
  listarFila,
  listarMensagens,
  marcarLida,
  Conversa,
  ItemDaFila,
  Mensagem,
} from "./dados";
import { Entrar } from "./telas/Entrar";
import { Conversas } from "./telas/Conversas";
import { Fila } from "./telas/Fila";
import { Chat } from "./telas/Chat";
import { Buscar } from "./telas/Buscar";
import { Perfil } from "./telas/Perfil";

/**
 * O shell do app.
 *
 * Tudo do app começa aqui, e nada daqui alcança a web: quem renderiza este
 * componente é o `App.tsx`, atrás de um único `ehApp()`. No navegador o
 * roteador de sempre segue intacto, rota por rota.
 *
 * A navegação é por estado, não por URL. Dentro do aparelho não existe barra
 * de endereço, e o histórico do navegador só atrapalharia: o botão físico do
 * Android é tratado aqui embaixo, explicitamente.
 *
 * Os dados também moram aqui, não em cada tela. A lista de conversas alimenta
 * a caixa de entrada, o número da fila na barra de abas e o cabeçalho do chat
 * ao mesmo tempo; carregar três vezes a mesma coisa daria três respostas
 * ligeiramente diferentes na mesma tela.
 */

export default function MobileShell() {
  const [carregando, setCarregando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);
  const [aba, setAba] = useState<Aba>("conversas");

  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [fila, setFila] = useState<ItemDaFila[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [ultimaAberta, setUltimaAberta] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregandoChat, setCarregandoChat] = useState(false);
  const [erroChat, setErroChat] = useState<string | null>(null);
  const [assumindo, setAssumindo] = useState<string | null>(null);

  const aberta = useMemo(
    () => conversas.find((c) => c.id === abertaId) || (abertaId ? ultimaAberta : null),
    [conversas, abertaId, ultimaAberta]
  );

  // ── Sessão ────────────────────────────────────────────────────

  useEffect(() => {
    let vivo = true;
    (async () => {
      // No aparelho o token pode estar só no armazenamento do sistema — o
      // WebView é limpo com mais frequência do que se imagina.
      await restaurarSessao();
      if (!vivo) return;
      setAutenticado(Boolean(localStorage.getItem("token")));
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  // A área segura só é liberada dentro do app. Mexer no `viewport` do
  // index.html mudaria também o site aberto no celular, e ele não deve mudar.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const antes = meta?.getAttribute("content") || "";
    meta?.setAttribute("content", "width=device-width, initial-scale=1.0, viewport-fit=cover");
    return () => { if (meta && antes) meta.setAttribute("content", antes); };
  }, []);

  useEffect(() => {
    if (!ehNativo()) return;
    // As telas são claras; sem isto o texto da barra sai branco no branco.
    StatusBar.setStyle({ style: Style.Light }).catch(() => { /* Android antigo */ });
  }, []);

  // ── Dados ─────────────────────────────────────────────────────

  const recarregar = useCallback(async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const [lista, f] = await Promise.all([listarConversas(), listarFila()]);
      setConversas(lista);
      setFila(f.itens);
      setErroLista(null);
    } catch (e: any) {
      setErroLista(e.message);
    } finally {
      setCarregandoLista(false);
    }
  }, []);

  useEffect(() => {
    if (!autenticado) return;
    setCarregandoLista(true);
    recarregar();
  }, [autenticado, recarregar]);

  // Tempo real. Mensagem nova em conversa aberta entra na hora; a lista é
  // recarregada em lote, porque uma rajada de mensagens não pode virar uma
  // rajada de consultas.
  // O ouvinte de eventos é registrado uma vez; sem esta referência ele
  // enxergaria para sempre a conversa que estava aberta na inscrição.
  const abertaIdRef = useRef<string | null>(null);
  useEffect(() => { abertaIdRef.current = abertaId; }, [abertaId]);

  const agendada = useRef<any>(null);
  useEffect(() => {
    if (!autenticado) return;
    const cancelar = assinarEventos((msg: any) => {
      if (msg?.id && msg?.conversationId === abertaIdRef.current) {
        setMensagens((atuais) => (atuais.some((m) => m.id === msg.id) ? atuais : [...atuais, msg as Mensagem]));
      }
      clearTimeout(agendada.current);
      agendada.current = setTimeout(recarregar, 600);
    });
    return () => { clearTimeout(agendada.current); cancelar(); };
  }, [autenticado, recarregar]);

  // Volta do segundo plano: o que aconteceu enquanto o app estava fechado
  // não chegou por SSE, porque a conexão cai junto.
  useEffect(() => {
    if (!ehNativo() || !autenticado) return;
    const p = AppNativo.addListener("appStateChange", ({ isActive }) => {
      if (isActive) recarregar();
    });
    return () => { p.then((h) => h.remove()).catch(() => { /* já removido */ }); };
  }, [autenticado, recarregar]);

  // ── Ações ─────────────────────────────────────────────────────

  /** Relê as mensagens da conversa aberta, sem mexer no resto da tela. */
  const recarregarMensagens = useCallback(async (leadId: string) => {
    try {
      setMensagens(await listarMensagens(leadId));
    } catch { /* o fluxo de eventos traz a próxima de qualquer jeito */ }
  }, []);

  const abrirConversa = useCallback(async (c: Conversa) => {
    setAbertaId(c.id);
    setUltimaAberta(c);
    setMensagens([]);
    setErroChat(null);
    setCarregandoChat(true);
    try {
      setMensagens(await listarMensagens(c.leadId));
      if (c.unreadCount > 0) {
        setConversas((atuais) => atuais.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)));
        marcarLida(c.leadId).catch(() => { /* o contador se acerta na próxima carga */ });
      }
    } catch (e: any) {
      setErroChat(e.message);
    } finally {
      setCarregandoChat(false);
    }
  }, []);

  const abrirDaFila = useCallback(
    (item: ItemDaFila) => {
      const c = conversas.find((x) => x.id === item.conversationId);
      if (c) abrirConversa(c);
    },
    [conversas, abrirConversa]
  );

  const assumirConversa = useCallback(
    async (conversationId: string) => {
      setAssumindo(conversationId);
      setErroChat(null);
      setErroLista(null);
      try {
        await assumir(conversationId);
        await recarregar();
      } catch (e: any) {
        if (abertaIdRef.current === conversationId) setErroChat(e.message);
        else setErroLista(e.message);
      } finally {
        setAssumindo(null);
      }
    },
    [recarregar]
  );

  const devolver = useCallback(async () => {
    if (!abertaId) return;
    setAssumindo(abertaId);
    try {
      await devolverAIa(abertaId);
      await recarregar();
    } catch (e: any) {
      setErroChat(e.message);
    } finally {
      setAssumindo(null);
    }
  }, [abertaId, recarregar]);

  const enviar = useCallback(async (texto: string): Promise<boolean> => {
    if (!abertaId) return false;
    const alvo = conversas.find((c) => c.id === abertaId) || ultimaAberta;
    if (!alvo) return false;
    setErroChat(null);
    try {
      const nova = await enviarMensagem(alvo.leadId, texto);
      // O SSE também traz esta mensagem; o `id` evita que apareça duas vezes.
      setMensagens((atuais) => (atuais.some((m) => m.id === nova.id) ? atuais : [...atuais, nova]));
      recarregar();
      return true;
    } catch (e: any) {
      // Falha de canal (fora da janela de 24h, conexão caída) é recado para o
      // atendente, não erro de programa: aparece no rodapé do chat.
      setErroChat(e.message);
      return false;
    }
  }, [abertaId, conversas, ultimaAberta, recarregar]);

  const fecharChat = useCallback(() => {
    setAbertaId(null);
    setUltimaAberta(null);
    setMensagens([]);
    setErroChat(null);
  }, []);

  // Botão físico do Android: fecha a conversa, volta à caixa de entrada, sai.
  useEffect(() => {
    if (!ehNativo()) return;
    const p = AppNativo.addListener("backButton", () => {
      if (abertaIdRef.current) return fecharChat();
      setAba((atual) => {
        if (atual !== "conversas") return "conversas";
        AppNativo.exitApp();
        return atual;
      });
    });
    return () => { p.then((h) => h.remove()).catch(() => { /* já removido */ }); };
  }, [fecharChat]);

  // ── Telas ─────────────────────────────────────────────────────

  if (carregando) {
    return (
      <div className="grid h-[100dvh] place-items-center bg-white">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E5E7EB] border-t-[#2563EB]" />
      </div>
    );
  }

  if (!autenticado) {
    return (
      <div className="h-[100dvh] overflow-y-auto bg-white">
        <Entrar aoEntrar={() => setAutenticado(true)} />
      </div>
    );
  }

  if (aberta) {
    return (
      <div className="h-[100dvh] overflow-hidden">
        <Chat
          conversa={aberta}
          mensagens={mensagens}
          carregando={carregandoChat}
          erro={erroChat}
          ocupado={assumindo === aberta.id}
          aoVoltar={fecharChat}
          aoEnviar={enviar}
          aoAssumir={() => assumirConversa(aberta.id)}
          aoDevolver={devolver}
          aoRecarregar={() => { recarregar(); if (aberta) recarregarMensagens(aberta.leadId); }}
        />
      </div>
    );
  }

  const naoLidas = conversas.reduce((soma, c) => soma + (c.phase === "QUEUE" ? 0 : c.unreadCount > 0 ? 1 : 0), 0);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#F2F2F7]">
      <div className="min-h-0 flex-1">
        {aba === "conversas" && (
          <Conversas
            conversas={conversas}
            carregando={carregandoLista}
            erro={erroLista}
            assumindo={assumindo}
            aoAbrir={abrirConversa}
            aoAssumir={(c) => assumirConversa(c.id)}
            aoVerFila={() => setAba("fila")}
          />
        )}
        {aba === "fila" && (
          <Fila
            itens={fila}
            carregando={carregandoLista}
            erro={erroLista}
            assumindo={assumindo}
            aoAbrir={abrirDaFila}
            aoAssumir={(item) => assumirConversa(item.conversationId)}
          />
        )}
        {aba === "buscar" && <Buscar aoAbrir={abrirConversa} />}
        {aba === "perfil" && <Perfil aoSair={() => { setAba("conversas"); setAutenticado(false); }} />}
      </div>
      <BarraDeAbas ativa={aba} aoTrocar={setAba} aguardando={fila.length} naoLidas={naoLidas} />
    </div>
  );
}
