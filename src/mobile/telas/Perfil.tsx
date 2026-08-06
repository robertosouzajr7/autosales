import { ChevronRight, LogOut } from "lucide-react";
import { encerrarSessao } from "../sessao";

/**
 * Você — quem está atendendo e a saída da conta.
 *
 * O handoff mostra aqui também a disponibilidade (online / em pausa / fora do
 * turno) e as preferências de notificação. Nenhum dos dois existe no backend
 * ainda — não há campo de disponibilidade no `User` nem push configurado —
 * e desenhar interruptor que não liga em nada é pior do que não ter. Entram
 * quando o backend entrar.
 */

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

const PAPEIS: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  AGENT: "Atendente",
  USER: "Atendente",
};

export function Perfil({ aoSair }: { aoSair: () => void }) {
  const nome = localStorage.getItem("userName") || "Sua conta";
  const negocio = localStorage.getItem("tenantName") || "";
  const papel = PAPEIS[localStorage.getItem("userRole") || ""] || "Atendente";

  const sair = async () => {
    await encerrarSessao();
    aoSair();
  };

  return (
    <div className="flex h-full flex-col bg-[#F2F2F7]">
      <header className="shrink-0 border-b border-[rgba(60,60,67,0.12)] bg-white/[0.86] px-5 pb-3.5 backdrop-blur-xl" style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}>
        <h2 className="text-[28px] font-bold tracking-[-0.04em] text-[#0F172A]">Você</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-[18px]">
        <div className="flex items-center gap-3.5 rounded-[18px] bg-white p-[18px]">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#2563EB] text-[20px] font-bold text-white">
            {iniciais(nome)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-semibold text-[#0F172A]">{nome}</p>
            <p className="mt-1 truncate text-[13.5px] text-[rgba(60,60,67,0.6)]">
              {negocio ? `${papel} · ${negocio}` : papel}
            </p>
          </div>
        </div>

        <button
          onClick={sair}
          className="mt-4 flex min-h-[52px] w-full items-center gap-3.5 rounded-[18px] bg-white px-4 text-left"
        >
          <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-[rgba(120,120,128,0.16)] text-[#FF3B30]">
            <LogOut className="h-4 w-4" />
          </span>
          <span className="flex-1 text-[16px] text-[#FF3B30]">Sair da conta</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[rgba(60,60,67,0.3)]" />
        </button>
      </div>
    </div>
  );
}
