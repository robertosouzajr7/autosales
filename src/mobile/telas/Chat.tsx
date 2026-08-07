import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, Send } from "lucide-react";
import { Avatar } from "../componentes/Avatar";
import { Conversa, Mensagem, RESPOSTAS_RAPIDAS } from "../dados";
import { hora } from "../tempo";
import { baseDaApi } from "../plataforma";

/**
 * A conversa.
 *
 * O cabeçalho diz em uma linha de quem é a conversa agora — a IA, você, ou
 * ninguém ainda — porque é o que determina se o que você escrever vai por
 * cima do trabalho do robô. Enquanto a IA atende, o campo de mensagem
 * continua disponível, mas o botão em destaque é "Assumir": responder por
 * cima sem assumir é como as duas vozes se atropelam.
 */

function Bolha({ m }: { m: Mensagem }) {
  if (m.role === "SYSTEM") {
    return (
      <div className="max-w-[80%] self-center rounded-2xl bg-[rgba(37,99,235,0.1)] px-3.5 py-1.5 text-center text-[11.5px] font-semibold leading-[1.5] text-[#1D4ED8]">
        {m.content}
      </div>
    );
  }
  const saiu = m.role === "ASSISTANT" || m.role === "SDR";
  return (
    <div className={`flex max-w-[76%] flex-col gap-1 ${saiu ? "self-end items-end" : "self-start items-start"}`}>
      <div
        className="px-3.5 py-[11px] text-[15px] leading-[1.45] shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
        style={{
          background: saiu ? "#2563EB" : "#fff",
          color: saiu ? "#fff" : "#0F172A",
          borderRadius: saiu ? "18px 18px 5px 18px" : "18px 18px 18px 5px",
        }}
      >
        {m.mediaUrl && (
          <img
            src={m.mediaUrl.startsWith("/") ? baseDaApi() + m.mediaUrl : m.mediaUrl}
            alt=""
            className="mb-2 max-h-52 w-full rounded-xl object-cover"
          />
        )}
        {m.content}
      </div>
      <span className="whitespace-nowrap text-[11px] text-[rgba(60,60,67,0.45)]">{hora(m.createdAt)}</span>
    </div>
  );
}

export function Chat({
  conversa,
  mensagens,
  carregando,
  erro,
  ocupado,
  aoVoltar,
  aoEnviar,
  aoAssumir,
  aoDevolver,
}: {
  conversa: Conversa;
  mensagens: Mensagem[];
  carregando: boolean;
  erro: string | null;
  ocupado: boolean;
  aoVoltar: () => void;
  aoEnviar: (texto: string) => Promise<boolean>;
  aoAssumir: () => void;
  aoDevolver: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  const minha = conversa.phase === "HUMAN" && conversa.assignedTo?.id === localStorage.getItem("userId");

  // Ao abrir e a cada mensagem nova, o fim da conversa. Sem animação na
  // primeira vez: a conversa já deve estar no fim quando a tela aparece.
  const primeira = useRef(true);
  useLayoutEffect(() => {
    fim.current?.scrollIntoView({ behavior: primeira.current ? "auto" : "smooth" });
    primeira.current = false;
  }, [mensagens.length]);

  useEffect(() => { primeira.current = true; }, [conversa.id]);

  const enviar = async () => {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    setEnviando(true);
    try {
      // O texto só sai do campo se a mensagem saiu de verdade: quando o canal
      // recusa, quem escreveu não deve ter que digitar tudo de novo.
      if (await aoEnviar(conteudo)) setTexto("");
    } finally {
      setEnviando(false);
    }
  };

  const estado = minha
    ? "Você está atendendo"
    : conversa.phase === "HUMAN"
      ? `Com ${conversa.assignedTo?.name || "outro atendente"}`
      : conversa.phase === "QUEUE"
        ? "Esperando um atendente"
        : conversa.phase === "CLOSED"
          ? "Atendimento encerrado"
          : "A IA está atendendo";

  return (
    <div className="flex h-full flex-col bg-[#F2F2F7]">
      <header
        className="flex shrink-0 items-center gap-2.5 border-b border-[rgba(60,60,67,0.12)] bg-white/[0.88] px-3.5 pb-[11px] backdrop-blur-xl"
        style={{ paddingTop: "max(18px, env(safe-area-inset-top))" }}
      >
        <button onClick={aoVoltar} aria-label="Voltar" className="grid h-11 w-11 shrink-0 place-items-center text-[#2563EB]">
          <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <Avatar nome={conversa.name} canal={conversa.channel} tamanho={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold text-[#0F172A]">{conversa.name}</p>
          <p
            className="mt-0.5 truncate text-[12px] font-semibold"
            style={{ color: minha ? "#2563EB" : "rgba(60,60,67,0.6)" }}
          >
            {estado}
          </p>
        </div>
        {conversa.phase !== "CLOSED" && (
          <button
            onClick={minha ? aoDevolver : aoAssumir}
            disabled={ocupado}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-semibold disabled:opacity-60"
            style={
              minha
                ? { background: "#F2F2F7", color: "#0F172A" }
                : { background: "#2563EB", color: "#fff" }
            }
          >
            {ocupado && <Loader2 className="h-3 w-3 animate-spin" />}
            {minha ? "Devolver à IA" : "Assumir"}
          </button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 pb-1.5 pt-3.5">
        {carregando && !mensagens.length && (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-[rgba(60,60,67,0.35)]" />
          </div>
        )}
        {!carregando && !mensagens.length && (
          <p className="mt-8 text-center text-[14px] text-[rgba(60,60,67,0.5)]">Nenhuma mensagem ainda.</p>
        )}
        {mensagens.map((m) => <Bolha key={m.id} m={m} />)}
        <div ref={fim} />
      </div>

      {erro && (
        <p className="mx-3.5 mb-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] leading-snug text-rose-700">{erro}</p>
      )}

      {minha && (
        <div className="flex shrink-0 gap-2 overflow-x-auto px-3.5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {RESPOSTAS_RAPIDAS.map((r) => (
            <button
              key={r.rotulo}
              onClick={() => setTexto(r.texto)}
              className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-[rgba(60,60,67,0.12)] bg-white px-[13px] text-[13.5px] font-semibold text-[#0F172A]"
            >
              {r.rotulo}
            </button>
          ))}
        </div>
      )}

      <div
        className="flex shrink-0 items-end gap-2.5 border-t border-[rgba(60,60,67,0.12)] bg-white/90 px-3.5 pt-2.5 backdrop-blur-xl"
        style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
          }}
          rows={1}
          placeholder={minha ? "Mensagem" : "Responder por cima da IA"}
          className="max-h-28 min-h-[44px] flex-1 resize-none rounded-[22px] border border-[rgba(60,60,67,0.15)] bg-white px-4 py-[11px] text-[15px] leading-[1.35] text-[#0F172A] outline-none placeholder:text-[rgba(60,60,67,0.45)]"
        />
        <button
          onClick={enviar}
          disabled={!texto.trim() || enviando}
          aria-label="Enviar"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2563EB] text-white disabled:bg-[#F2F2F7] disabled:text-[rgba(60,60,67,0.3)]"
        >
          {enviando ? <Loader2 className="h-[19px] w-[19px] animate-spin" /> : <Send className="h-[19px] w-[19px]" />}
        </button>
      </div>
    </div>
  );
}
