import { Clock, MessageSquare, Search, User } from "lucide-react";

/**
 * A barra de abas do app.
 *
 * Quatro destinos, como no handoff: Conversas, Fila, Buscar e Você. O número
 * em vermelho na Fila é quem está esperando um humano — é o motivo de o app
 * existir, então aparece mesmo com a aba fechada.
 *
 * O padding de baixo soma a área segura do aparelho: no iPhone o traço do
 * gesto ocupa ~34px, e sem isso o dedo cai em cima do último ícone.
 */

export type Aba = "conversas" | "fila" | "buscar" | "perfil";

const ABAS: { chave: Aba; rotulo: string; Icone: typeof Clock }[] = [
  { chave: "conversas", rotulo: "Conversas", Icone: MessageSquare },
  { chave: "fila", rotulo: "Fila", Icone: Clock },
  { chave: "buscar", rotulo: "Buscar", Icone: Search },
  { chave: "perfil", rotulo: "Você", Icone: User },
];

export function BarraDeAbas({
  ativa,
  aoTrocar,
  aguardando = 0,
  naoLidas = 0,
}: {
  ativa: Aba;
  aoTrocar: (a: Aba) => void;
  aguardando?: number;
  naoLidas?: number;
}) {
  return (
    <nav
      className="flex shrink-0 border-t border-[rgba(60,60,67,0.12)] bg-white/90 px-3 pt-2.5 backdrop-blur-xl"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
    >
      {ABAS.map(({ chave, rotulo, Icone }) => {
        const on = chave === ativa;
        const n = chave === "fila" ? aguardando : chave === "conversas" ? naoLidas : 0;
        return (
          <button
            key={chave}
            onClick={() => aoTrocar(chave)}
            aria-current={on ? "page" : undefined}
            className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1"
            style={{ color: on ? "#2563EB" : "rgba(60,60,67,0.5)" }}
          >
            <span className="relative grid place-items-center">
              <Icone className="h-6 w-6" strokeWidth={on ? 2.3 : 1.9} />
              {n > 0 && (
                <span
                  className="absolute -right-[7px] -top-[3px] grid h-[17px] min-w-[17px] place-items-center rounded-full px-[5px] text-[10.5px] font-bold text-white"
                  style={{ background: chave === "fila" ? "#EF4444" : "#F59E0B" }}
                >
                  {n > 99 ? "99+" : n}
                </span>
              )}
            </span>
            <span className="whitespace-nowrap text-[11px] font-semibold">{rotulo}</span>
          </button>
        );
      })}
    </nav>
  );
}
