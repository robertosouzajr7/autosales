import { useMemo, useState } from "react";
import { Globe, Instagram, Loader2, Phone, Search } from "lucide-react";
import { Avatar } from "../componentes/Avatar";
import { Conversa } from "../dados";
import { haQuanto } from "../tempo";

/**
 * Caixa de entrada — quem espera vem primeiro.
 *
 * Essa é a escolha que decide a tela: em vez de uma lista única ordenada por
 * horário, quem pediu um humano fica destacado no topo, com o tempo de espera
 * e o botão de assumir ao alcance do polegar. O resto — o que a IA está
 * cuidando sozinha — vem embaixo, para acompanhar, não para agir.
 */

const CANAIS = [
  { chave: "", rotulo: "Todos", Icone: null as any, cor: "" },
  { chave: "WHATSAPP", rotulo: "WhatsApp", Icone: Phone, cor: "#22A06B" },
  { chave: "INSTAGRAM", rotulo: "Instagram", Icone: Instagram, cor: "#DB2777" },
  { chave: "SITE", rotulo: "Site", Icone: Globe, cor: "#2563EB" },
];

const ETIQUETAS: Record<string, { texto: string; fundo: string; cor: string }> = {
  BOT: { texto: "IA atendendo", fundo: "rgba(37,99,235,0.12)", cor: "#1D4ED8" },
  HUMAN: { texto: "Em atendimento", fundo: "rgba(34,160,107,0.12)", cor: "#15803D" },
  QUEUE: { texto: "Esperando", fundo: "rgba(245,158,11,0.14)", cor: "#B45309" },
  CLOSED: { texto: "Encerrada", fundo: "#F2F2F7", cor: "rgba(60,60,67,0.6)" },
};

export function Conversas({
  conversas,
  carregando,
  erro,
  assumindo,
  aoAbrir,
  aoAssumir,
  aoVerFila,
}: {
  conversas: Conversa[];
  carregando: boolean;
  erro: string | null;
  assumindo: string | null;
  aoAbrir: (c: Conversa) => void;
  aoAssumir: (c: Conversa) => void;
  aoVerFila: () => void;
}) {
  const [canal, setCanal] = useState("");
  const [busca, setBusca] = useState("");
  const negocio = localStorage.getItem("tenantName") || "";

  const { esperando, cuidando } = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const visiveis = conversas.filter((c) => {
      if (canal && String(c.channel).toUpperCase() !== canal) return false;
      if (!termo) return true;
      return (
        c.name.toLowerCase().includes(termo) ||
        (c.handle || "").toLowerCase().includes(termo) ||
        (c.lastMessagePreview || "").toLowerCase().includes(termo)
      );
    });
    return {
      // Quem espera há mais tempo primeiro — a mesma ordem da tela de Fila.
      // A lista geral vem ordenada por última mensagem, que aqui seria o
      // avesso: quem acabou de escrever apareceria na frente de quem espera
      // há meia hora.
      esperando: visiveis
        .filter((c) => c.phase === "QUEUE")
        .sort((a, b) => new Date(a.queuedAt || 0).getTime() - new Date(b.queuedAt || 0).getTime()),
      cuidando: visiveis.filter((c) => c.phase !== "QUEUE" && c.phase !== "CLOSED"),
    };
  }, [conversas, canal, busca]);

  const abertas = conversas.filter((c) => c.phase !== "CLOSED").length;

  return (
    <div className="flex h-full flex-col bg-[#F2F2F7]">
      <header
        className="shrink-0 border-b border-[rgba(60,60,67,0.12)] bg-white/[0.86] px-5 pb-3 backdrop-blur-xl"
        style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[28px] font-bold tracking-[-0.04em] text-[#0F172A]">Conversas</h2>
            <p className="mt-0.5 truncate text-[13px] text-[rgba(60,60,67,0.6)]">
              {negocio ? `${negocio} · ` : ""}
              {abertas} {abertas === 1 ? "aberta" : "abertas"}
            </p>
          </div>
          <span className="inline-flex h-8 shrink-0 items-center gap-[7px] rounded-full bg-[rgba(34,160,107,0.12)] px-3 text-[13px] font-semibold text-[#15803D]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#22A06B]" />
            Online
          </span>
        </div>

        <div className="mt-3.5 flex h-[38px] items-center gap-2.5 rounded-[11px] bg-[#EDEDF2] px-3">
          <Search className="h-[15px] w-[15px] shrink-0 text-[rgba(60,60,67,0.45)]" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente ou mensagem"
            className="w-full bg-transparent text-[15px] text-[#0F172A] outline-none placeholder:text-[rgba(60,60,67,0.45)]"
          />
        </div>

        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CANAIS.map(({ chave, rotulo, Icone, cor }) => {
            const on = canal === chave;
            return (
              <button
                key={rotulo}
                onClick={() => setCanal(chave)}
                className="inline-flex h-[34px] shrink-0 items-center gap-[7px] rounded-full border px-[13px] text-[13.5px] font-semibold"
                style={{
                  background: on ? "#2563EB" : "#fff",
                  color: on ? "#fff" : "#0F172A",
                  borderColor: on ? "#2563EB" : "rgba(60,60,67,0.12)",
                }}
              >
                {Icone && <Icone className="h-[13px] w-[13px]" style={{ color: on ? "#fff" : cor }} />}
                {rotulo}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-4">
        {erro && (
          <p className="mx-4 mt-4 rounded-xl bg-rose-50 px-4 py-3 text-[13.5px] leading-snug text-rose-700">{erro}</p>
        )}

        {carregando && !conversas.length && (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[rgba(60,60,67,0.35)]" />
          </div>
        )}

        {esperando.length > 0 && (
          <section className="mx-4 mt-3.5 overflow-hidden rounded-[18px] border border-[rgba(245,158,11,0.4)] bg-white shadow-[0_6px_18px_-12px_rgba(15,23,42,0.3)]">
            <div className="flex items-center gap-2.5 bg-[#FEF6E7] px-4 py-3.5">
              <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
              <span className="flex-1 text-[14px] font-bold text-[#B45309]">
                Esperando você · {esperando.length}
              </span>
              <button onClick={aoVerFila} className="text-[13px] font-semibold text-[#B45309]">
                Ver fila
              </button>
            </div>
            {esperando.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 border-t border-[rgba(60,60,67,0.1)] px-4 py-3.5"
              >
                <button onClick={() => aoAbrir(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <Avatar nome={c.name} canal={c.channel} tamanho={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] font-semibold text-[#0F172A]">{c.name}</p>
                    <p className="mt-0.5 truncate text-[13.5px] text-[rgba(60,60,67,0.6)]">
                      {c.handoffReason || c.lastMessagePreview || "Pediu para falar com uma pessoa"}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="whitespace-nowrap text-[12px] font-bold text-[#B45309]">
                    há {haQuanto(c.queuedAt)}
                  </span>
                  <button
                    onClick={() => aoAssumir(c)}
                    disabled={assumindo === c.id}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#2563EB] px-[13px] text-[13px] font-semibold text-white disabled:opacity-60"
                  >
                    {assumindo === c.id && <Loader2 className="h-3 w-3 animate-spin" />}
                    Assumir
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        <p className="mx-5 mb-2 mt-[22px] text-[12px] font-semibold uppercase tracking-[0.1em] text-[rgba(60,60,67,0.5)]">
          {esperando.length ? "A IA está cuidando" : "Conversas"}
        </p>

        {!carregando && !cuidando.length && (
          <p className="mx-5 text-[14px] leading-relaxed text-[rgba(60,60,67,0.5)]">
            {busca || canal
              ? "Nada aqui com esse filtro."
              : "Nenhuma conversa aberta agora. Quando alguém escrever, aparece aqui."}
          </p>
        )}

        <div className="mx-4 overflow-hidden rounded-[18px] bg-white">
          {cuidando.map((c, i) => {
            const etiqueta = ETIQUETAS[c.phase] || ETIQUETAS.BOT;
            const minha = c.phase === "HUMAN" && c.assignedTo?.id === localStorage.getItem("userId");
            return (
              <button
                key={c.id}
                onClick={() => aoAbrir(c)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                style={{ borderTop: i ? "0.5px solid rgba(60,60,67,0.1)" : undefined }}
              >
                <Avatar nome={c.name} canal={c.channel} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="min-w-0 flex-1 truncate text-[15.5px] font-semibold text-[#0F172A]">{c.name}</p>
                    <span className="whitespace-nowrap text-[12.5px] text-[rgba(60,60,67,0.45)]">
                      {haQuanto(c.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[13.5px] text-[rgba(60,60,67,0.6)]">
                    {c.lastMessagePreview || "Sem mensagens ainda"}
                  </p>
                  <div className="mt-[7px] flex items-center gap-[7px]">
                    <span
                      className="whitespace-nowrap rounded-md px-2 py-[3px] text-[11.5px] font-semibold"
                      style={{ background: etiqueta.fundo, color: etiqueta.cor }}
                    >
                      {minha ? "Você atendendo" : etiqueta.texto}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-[#2563EB] px-1.5 text-[11px] font-bold text-white">
                        {c.unreadCount > 99 ? "99+" : c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
