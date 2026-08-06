import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Avatar } from "../componentes/Avatar";
import { Conversa, listarConversas } from "../dados";
import { haQuanto } from "../tempo";

/**
 * Buscar — por nome, telefone, @usuario.
 *
 * A consulta vai ao servidor (é lá que estão as 200 conversas, não só as que
 * couberam na tela), com uma pausa de 350 ms para não disparar uma chamada
 * por tecla digitada.
 */

export function Buscar({ aoAbrir }: { aoAbrir: (c: Conversa) => void }) {
  const [termo, setTermo] = useState("");
  const [itens, setItens] = useState<Conversa[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pedido = useRef(0);

  useEffect(() => {
    const consulta = termo.trim();
    if (consulta.length < 2) {
      setItens([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const id = ++pedido.current;
    const t = setTimeout(async () => {
      try {
        const r = await listarConversas(consulta);
        // Resposta atrasada de uma busca antiga não pode sobrescrever a atual.
        if (pedido.current !== id) return;
        setItens(r);
        setErro(null);
      } catch (e: any) {
        if (pedido.current === id) setErro(e.message);
      } finally {
        if (pedido.current === id) setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [termo]);

  return (
    <div className="flex h-full flex-col bg-[#F2F2F7]">
      <header
        className="shrink-0 border-b border-[rgba(60,60,67,0.12)] bg-white/[0.86] px-5 pb-3.5 backdrop-blur-xl"
        style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}
      >
        <h2 className="text-[28px] font-bold tracking-[-0.04em] text-[#0F172A]">Buscar</h2>
        <div className="mt-3 flex h-[38px] items-center gap-2.5 rounded-[11px] bg-[#EDEDF2] px-3">
          <Search className="h-[15px] w-[15px] shrink-0 text-[rgba(60,60,67,0.45)]" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="Nome, telefone ou @usuario"
            className="w-full bg-transparent text-[15px] text-[#0F172A] outline-none placeholder:text-[rgba(60,60,67,0.45)]"
          />
          {buscando && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[rgba(60,60,67,0.35)]" />}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {erro && (
          <p className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-[13.5px] leading-snug text-rose-700">{erro}</p>
        )}
        {termo.trim().length < 2 && (
          <p className="px-1 pt-4 text-[15px] leading-relaxed text-[rgba(60,60,67,0.5)]">
            Digite pelo menos duas letras.
          </p>
        )}
        {termo.trim().length >= 2 && !buscando && !itens.length && !erro && (
          <p className="px-1 pt-4 text-[15px] leading-relaxed text-[rgba(60,60,67,0.5)]">
            Nenhum contato encontrado.
          </p>
        )}

        <div className="overflow-hidden rounded-[18px] bg-white">
          {itens.map((c, i) => (
            <button
              key={c.id}
              onClick={() => aoAbrir(c)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              style={{ borderTop: i ? "0.5px solid rgba(60,60,67,0.1)" : undefined }}
            >
              <Avatar nome={c.name} canal={c.channel} tamanho={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="min-w-0 flex-1 truncate text-[15.5px] font-semibold text-[#0F172A]">{c.name}</p>
                  <span className="whitespace-nowrap text-[12.5px] text-[rgba(60,60,67,0.45)]">
                    {haQuanto(c.lastMessageAt)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[13.5px] text-[rgba(60,60,67,0.6)]">
                  {c.handle || c.lastMessagePreview}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
