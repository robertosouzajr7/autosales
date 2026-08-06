import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, UserPlus, Bot, CalendarCheck, Clock, Instagram,
  Smartphone, Globe, TrendingUp, TrendingDown, Inbox,
} from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Relatórios: o que aconteceu no atendimento no período.
 *
 * A tela anterior tinha quatro cartões e dois retângulos "Em Breve", e os
 * números vinham de um endpoint que os estimava — "Visitantes" era o total de
 * contatos vezes três, "Qualificados" era 40% do total, o ROI era a string
 * "150%". Número inventado em relatório é pior que relatório vazio: leva a
 * decidir errado com confiança. Aqui tudo é contado no banco, e o que não dá
 * para responder aparece como "—".
 */

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
];

const CANAIS: Record<string, { rotulo: string; cor: string; icone: any }> = {
  WHATSAPP: { rotulo: "WhatsApp", cor: "#22A06B", icone: Smartphone },
  INSTAGRAM: { rotulo: "Instagram", cor: "#C13584", icone: Instagram },
  SITE: { rotulo: "Site", cor: "#2563EB", icone: Globe },
};

const duracao = (s: number | null) => {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} h`;
};

export default function Analytics() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stats/report?days=${dias}`, { headers: auth() })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Não foi possível carregar os relatórios.");
        setDados(d);
        setErro(null);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, [dias]);

  const v = dados?.volume;
  const a = dados?.atendimento;
  const ag = dados?.agenda;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1240px] px-4 pb-10 pt-5 sm:px-6">

        <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Relatórios</h1>
            <p className="mt-0.5 max-w-lg text-[13.5px] text-muted-foreground">
              O que aconteceu no atendimento, comparado com o período anterior de mesmo tamanho.
            </p>
          </div>
          <div className="flex rounded-xl border border-border bg-card p-1 shadow-card">
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                onClick={() => setDias(p.dias)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  dias === p.dias ? "bg-[#2563EB] text-white" : "text-muted-foreground hover:bg-surface-2"
                }`}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
        </header>

        {erro ? (
          <div className="rounded-[14px] border border-border bg-card px-6 py-16 text-center shadow-card">
            <p className="text-[13.5px] text-muted-foreground">{erro}</p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px] rounded-[14px]" />)}
            </div>
            <Skeleton className="h-[260px] rounded-[14px]" />
          </div>
        ) : (
          <div className="space-y-3">

            {/* ── NÚMEROS DO PERÍODO ────────────────────────── */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                icone={MessageSquare} rotulo="Conversas"
                valor={v.conversas} delta={v.conversasDelta}
                nota={`${v.recebidas} recebidas · ${v.enviadas} enviadas`}
              />
              <Kpi
                icone={UserPlus} rotulo="Contatos novos"
                valor={v.contatosNovos} delta={v.contatosNovosDelta}
                nota="primeira conversa no período"
              />
              <Kpi
                icone={Bot} rotulo="Resolvido pela IA"
                valor={a.percentualIa === null ? "—" : `${a.percentualIa}%`}
                nota={`${a.ia} sem passar por gente · ${a.equipe} com a equipe`}
              />
              <Kpi
                icone={Clock} rotulo="Primeira resposta"
                valor={duracao(a.respostaSegundos)}
                nota="mediana, ignorando esperas acima de 6h"
              />
            </div>

            {/* ── VOLUME AO LONGO DO PERÍODO ────────────────── */}
            <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-foreground">Movimento por dia</h2>
                  <p className="text-[12.5px] text-muted-foreground">
                    Conversas com pelo menos uma mensagem no dia.
                  </p>
                </div>
                <p className="text-[12px] text-faint">
                  {v.encerradas} conversa{v.encerradas === 1 ? "" : "s"} encerrada{v.encerradas === 1 ? "" : "s"} no período
                </p>
              </div>
              <GraficoDeBarras serie={v.serie} />
            </section>

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">

              {/* ── CANAIS ──────────────────────────────────── */}
              <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                <h2 className="text-[15px] font-semibold text-foreground">Por onde entra</h2>
                <p className="mb-4 text-[12.5px] text-muted-foreground">Canal de origem de cada conversa.</p>
                {dados.canais.length === 0 ? (
                  <Vazio texto="Nenhuma conversa no período." />
                ) : (
                  <div className="space-y-3">
                    {dados.canais.map((c: any) => {
                      const meta = CANAIS[c.canal] || { rotulo: c.canal, cor: "#64748B", icone: MessageSquare };
                      const Icone = meta.icone;
                      const pct = v.conversas ? Math.round((c.total / v.conversas) * 100) : 0;
                      return (
                        <div key={c.canal}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                              <Icone className="h-3.5 w-3.5" style={{ color: meta.cor }} /> {meta.rotulo}
                            </span>
                            <span className="text-[12.5px] tabular-nums text-muted-foreground">
                              {c.total} <span className="text-faint">· {pct}%</span>
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: meta.cor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ── AGENDA ──────────────────────────────────── */}
              <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-semibold text-foreground">Agenda</h2>
                    <p className="text-[12.5px] text-muted-foreground">
                      Comparecimento conta só compromisso que já venceu.
                    </p>
                  </div>
                  <CalendarCheck className="h-4 w-4 shrink-0 text-faint" />
                </div>

                <div className="mt-4 flex items-end gap-4">
                  <div>
                    <p className="text-[30px] font-bold leading-none tabular-nums text-foreground">
                      {ag.comparecimento === null ? "—" : `${ag.comparecimento}%`}
                    </p>
                    <p className="mt-1 text-[11.5px] uppercase tracking-wide text-faint">comparecimento</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
                      {ag.concluidos > 0 && (
                        <div className="h-full bg-[#22A06B]" style={{ flexGrow: ag.concluidos }} />
                      )}
                      {ag.faltas > 0 && <div className="h-full bg-[#E11D48]" style={{ flexGrow: ag.faltas }} />}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border-soft pt-3 sm:grid-cols-4">
                  <Miudo rotulo="Marcados" valor={ag.agendados} delta={ag.agendadosDelta} />
                  <Miudo rotulo="Compareceram" valor={ag.concluidos} />
                  <Miudo rotulo="Faltaram" valor={ag.faltas} alerta={ag.faltas > 0} />
                  <Miudo rotulo="Cancelados" valor={ag.cancelados} />
                </div>
              </section>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">

              {/* ── EQUIPE ──────────────────────────────────── */}
              <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                <h2 className="text-[15px] font-semibold text-foreground">Quem atendeu</h2>
                <p className="mb-4 text-[12.5px] text-muted-foreground">
                  Conversas sob responsabilidade de cada pessoa hoje.
                </p>
                {dados.equipe.length === 0 ? (
                  <Vazio texto="Nenhuma conversa assumida por pessoa no período — a IA deu conta." />
                ) : (
                  <div className="space-y-1">
                    {dados.equipe.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-bold text-accent-text">
                          {(p.nome || "?").substring(0, 2).toUpperCase()}
                        </span>
                        <span className="linha-unica-elipse flex-1 text-[13px] font-medium text-foreground">{p.nome}</span>
                        <span className="text-[12.5px] tabular-nums text-muted-foreground">
                          {p.atendidas} <span className="text-faint">atendidas</span>
                        </span>
                        <span className="w-[86px] text-right text-[12.5px] tabular-nums text-muted-foreground">
                          {p.encerradas} <span className="text-faint">encerradas</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── FILAS ───────────────────────────────────── */}
              <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                <h2 className="text-[15px] font-semibold text-foreground">Filas</h2>
                <p className="mb-4 text-[12.5px] text-muted-foreground">
                  Quanto passou por cada fila e quanto ainda espera.
                </p>
                {dados.filas.length === 0 ? (
                  <Vazio
                    texto="Nenhuma fila cadastrada — tudo que sai da IA cai num balaio só."
                    acao={<Link to="/filas" className="font-medium text-accent-text hover:underline">Criar filas</Link>}
                  />
                ) : (
                  <div className="space-y-1">
                    {dados.filas.map((f: any) => (
                      <div key={f.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                        <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: f.cor || "#2563EB" }} />
                        <span className="linha-unica-elipse flex-1 text-[13px] font-medium text-foreground">{f.nome}</span>
                        <span className="text-[12.5px] tabular-nums text-muted-foreground">
                          {f.total} <span className="text-faint">no período</span>
                        </span>
                        <span className={`w-[92px] text-right text-[12.5px] font-medium tabular-nums ${
                          f.esperando > 0 ? "text-amber-600" : "text-faint"
                        }`}>
                          {f.esperando} esperando
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Kpi({
  icone: Icone, rotulo, valor, delta, nota,
}: { icone: any; rotulo: string; valor: any; delta?: number | null; nota?: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-faint">
          <Icone className="h-3.5 w-3.5" /> {rotulo}
        </span>
        <Delta valor={delta} />
      </div>
      <p className="mt-1.5 text-[26px] font-bold leading-none tabular-nums text-foreground">{valor}</p>
      {nota && <p className="mt-1.5 linha-unica-elipse text-[11.5px] text-muted-foreground">{nota}</p>}
    </div>
  );
}

/**
 * Variação contra o período anterior. `null` some da tela: sem base de
 * comparação, mostrar "0%" afirmaria uma estabilidade que ninguém mediu.
 */
function Delta({ valor }: { valor?: number | null }) {
  if (valor === null || valor === undefined) return null;
  const subiu = valor >= 0;
  const Icone = subiu ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-0.5 text-[11.5px] font-semibold tabular-nums ${
      subiu ? "text-emerald-600" : "text-rose-600"
    }`}>
      <Icone className="h-3 w-3" /> {subiu ? "+" : ""}{valor}%
    </span>
  );
}

function Miudo({ rotulo, valor, delta, alerta }: { rotulo: string; valor: number; delta?: number | null; alerta?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-faint">{rotulo}</p>
      <p className={`flex items-center gap-1.5 text-[16px] font-semibold tabular-nums ${
        alerta ? "text-rose-600" : "text-foreground"
      }`}>
        {valor}
        <Delta valor={delta} />
      </p>
    </div>
  );
}

function Vazio({ texto, acao }: { texto: string; acao?: any }) {
  return (
    <div className="grid place-items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-10 text-center">
      <Inbox className="h-5 w-5 text-border-soft" />
      <p className="max-w-xs text-[12.5px] text-muted-foreground">{texto}</p>
      {acao}
    </div>
  );
}

/**
 * Barras por dia. Desenhadas à mão em SVG porque a única outra coisa a
 * plotar no painel é a sparkline do Dashboard — uma biblioteca de gráficos
 * pesaria mais que os dois desenhos somados.
 */
function GraficoDeBarras({ serie }: { serie: { dia: string; conversas: number }[] }) {
  const maximo = Math.max(...serie.map((d) => d.conversas), 1);
  const L = 900;
  const A = 180;
  const largura = L / serie.length;

  // Rótulos só de tantos em tantos dias: 90 datas encavaladas não se leem.
  const passo = Math.ceil(serie.length / 8);
  const dataCurta = (d: string) => {
    const [, m, dd] = d.split("-");
    return `${dd}/${m}`;
  };

  if (!serie.some((d) => d.conversas > 0)) {
    return <Vazio texto="Nenhuma conversa no período." />;
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${L} ${A + 22}`} className="h-[210px] w-full min-w-[520px]" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={L} y1={A - A * f} y2={A - A * f} stroke="#E9EEF5" strokeWidth={1} />
        ))}
        {serie.map((d, i) => {
          const h = (d.conversas / maximo) * (A - 6);
          return (
            <rect
              key={d.dia}
              x={i * largura + largura * 0.18}
              y={A - h}
              width={largura * 0.64}
              height={h}
              rx={Math.min(3, largura * 0.3)}
              fill="#2563EB"
              opacity={0.85}
            >
              <title>{`${dataCurta(d.dia)}: ${d.conversas} conversa(s)`}</title>
            </rect>
          );
        })}
        {serie.map((d, i) =>
          i % passo === 0 ? (
            <text
              key={`r-${d.dia}`}
              x={i * largura + largura / 2}
              y={A + 16}
              textAnchor="middle"
              fontSize={11}
              fill="#94A3B8"
            >
              {dataCurta(d.dia)}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}
