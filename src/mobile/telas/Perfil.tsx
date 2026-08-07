import { useEffect, useState } from "react";
import { Check, ChevronRight, Loader2, LogOut } from "lucide-react";
import { encerrarSessao } from "../sessao";
import { Disponibilidade, definirDisponibilidade, minhaDisponibilidade } from "../dados";

/**
 * Você — quem está atendendo, se está disponível, e a saída da conta.
 *
 * A disponibilidade é o que decide para quem a fila transfere. Em pausa a
 * pessoa continua vendo tudo e continua respondendo o que já é dela: a pausa
 * vale para o que CHEGA, não para o que está na mão. Tirar conversa de alguém
 * no meio do atendimento deixaria cliente falando sozinho.
 *
 * As preferências de push continuam fora: não existe push ainda, e
 * interruptor que não liga em nada é pior do que não ter.
 */

const ESTADOS = [
  { id: "ONLINE", titulo: "Online", detalhe: "Recebe transferências da IA e da equipe", cor: "#22A06B" },
  { id: "PAUSA", titulo: "Em pausa", detalhe: "Volto em 15 minutos", cor: "#F59E0B", minutos: 15 },
  { id: "FORA", titulo: "Fora do turno", detalhe: "Não recebe nada até você voltar", cor: "#8A8A8E" },
];

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

  const [estado, setEstado] = useState<Disponibilidade | null>(null);
  const [mudando, setMudando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    minhaDisponibilidade().then(setEstado).catch((e) => setErro(e.message));
  }, []);

  const mudar = async (id: string, minutos?: number) => {
    setMudando(id);
    setErro(null);
    try {
      const modelo = ESTADOS.find((e) => e.id === id);
      setEstado(await definirDisponibilidade(id, minutos, id === "ONLINE" ? undefined : modelo?.detalhe));
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setMudando(null);
    }
  };

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

        <section className="mt-5">
          <p className="mb-2 ml-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-[rgba(60,60,67,0.5)]">
            Disponibilidade
          </p>
          <div className="overflow-hidden rounded-[18px] bg-white">
            {ESTADOS.map((e, i) => {
              const ativo = estado?.estado === e.id;
              return (
                <button
                  key={e.id}
                  onClick={() => mudar(e.id, e.minutos)}
                  disabled={!!mudando}
                  className="flex min-h-[56px] w-full items-center gap-3.5 px-4 text-left disabled:opacity-70"
                  style={{
                    borderTop: i ? "0.5px solid rgba(60,60,67,0.1)" : undefined,
                    background: ativo ? "rgba(37,99,235,0.06)" : undefined,
                  }}
                >
                  <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: e.cor }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold text-[#0F172A]">{e.titulo}</p>
                    <p className="mt-0.5 text-[13px] text-[rgba(60,60,67,0.6)]">
                      {ativo && estado?.recado ? estado.recado : e.detalhe}
                    </p>
                  </div>
                  {mudando === e.id
                    ? <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-[rgba(60,60,67,0.4)]" />
                    : ativo && <Check className="h-[18px] w-[18px] shrink-0 text-[#2563EB]" strokeWidth={2.6} />}
                </button>
              );
            })}
          </div>
          <p className="mx-1 mt-2 text-[12.5px] leading-[1.5] text-[rgba(60,60,67,0.5)]">
            Em pausa você continua vendo as conversas e respondendo as que já são suas — as novas
            transferências é que vão para outro colega.
          </p>
          {erro && <p className="mx-1 mt-2 text-[12.5px] text-rose-600">{erro}</p>}
        </section>

        <button
          onClick={sair}
          className="mt-5 flex min-h-[52px] w-full items-center gap-3.5 rounded-[18px] bg-white px-4 text-left"
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
