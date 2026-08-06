import { Loader2 } from "lucide-react";
import { Avatar } from "../componentes/Avatar";
import { ItemDaFila } from "../dados";
import { espera } from "../tempo";

/**
 * Fila — ordenada por quem espera há mais tempo.
 *
 * A ordem vem do servidor (`queuedAt` crescente) e não é reordenável: fila
 * que se pode furar deixa de ser fila. Cada cartão traz o motivo pelo qual a
 * conversa saiu da IA, porque é isso que o atendente precisa saber antes de
 * assumir.
 */

export function Fila({
  itens,
  carregando,
  erro,
  assumindo,
  aoAbrir,
  aoAssumir,
}: {
  itens: ItemDaFila[];
  carregando: boolean;
  erro: string | null;
  assumindo: string | null;
  aoAbrir: (item: ItemDaFila) => void;
  aoAssumir: (item: ItemDaFila) => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#F2F2F7]">
      <header
        className="shrink-0 border-b border-[rgba(60,60,67,0.12)] bg-white/[0.86] px-5 pb-3.5 backdrop-blur-xl"
        style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}
      >
        <h2 className="text-[28px] font-bold tracking-[-0.04em] text-[#0F172A]">Fila</h2>
        <p className="mt-0.5 text-[13px] text-[rgba(60,60,67,0.6)]">
          {itens.length ? "Ordenada por quem espera há mais tempo" : "Ninguém esperando"}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {erro && (
          <p className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-[13.5px] leading-snug text-rose-700">{erro}</p>
        )}

        {carregando && !itens.length && (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[rgba(60,60,67,0.35)]" />
          </div>
        )}

        {!carregando && !itens.length && !erro && (
          <p className="px-1 pt-6 text-[15px] leading-relaxed text-[rgba(60,60,67,0.5)]">
            A IA está dando conta. Quando alguém pedir uma pessoa, aparece aqui.
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {itens.map((item) => {
            const urgente = item.esperaMinutos >= 5;
            return (
              <article
                key={item.conversationId}
                className="rounded-[18px] bg-white px-4 py-3.5"
                style={{ borderLeft: `4px solid ${urgente ? "rgba(245,158,11,0.75)" : "rgba(60,60,67,0.12)"}` }}
              >
                <button onClick={() => aoAbrir(item)} className="flex w-full items-center gap-3 text-left">
                  <Avatar nome={item.name} canal={item.channel} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold text-[#0F172A]">{item.name}</p>
                    <p
                      className="mt-1 whitespace-nowrap text-[12.5px] font-semibold"
                      style={{ color: urgente ? "#B45309" : "rgba(60,60,67,0.6)" }}
                    >
                      {espera(item.esperaMinutos)}
                    </p>
                  </div>
                  {item.queue && (
                    <span
                      className="shrink-0 whitespace-nowrap rounded-[7px] px-[9px] py-1 text-[11.5px] font-bold"
                      style={{
                        background: `${item.queue.color || "#2563EB"}1F`,
                        color: item.queue.color || "#1D4ED8",
                      }}
                    >
                      {item.queue.name}
                    </span>
                  )}
                </button>

                <p className="mt-3 text-[14.5px] leading-[1.5] text-[rgba(60,60,67,0.7)]">
                  {item.reason || item.lastMessagePreview || "Pediu para falar com uma pessoa."}
                </p>

                <button
                  onClick={() => aoAssumir(item)}
                  disabled={assumindo === item.conversationId}
                  className="mt-3.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] text-[15px] font-semibold text-white disabled:opacity-60"
                >
                  {assumindo === item.conversationId && <Loader2 className="h-4 w-4 animate-spin" />}
                  Assumir
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
