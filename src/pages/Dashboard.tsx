import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays, MessageSquare, CheckCircle2, Timer, ArrowRight,
  Smartphone, Bot, ChevronRight, Building2, Target,
} from "lucide-react";

/**
 * Home do painel.
 *
 * A ordem de leitura é deliberada e vem do handoff: saudação → o que falta
 * configurar → números → o que exige ação → agenda → funil. Quem abre o
 * painel não vem saber quantas conversas teve; vem saber o que fazer agora.
 * Por isso a fila de espera aparece antes da agenda, e ambas antes do funil.
 */

interface Results {
  appointmentsScheduled: number;
  appointmentsCompleted: number;
  conversationsHandled: number;
  avgResponseSeconds: number | null;
}
interface Appt { id: string; title: string; date: string; status: string; lead?: { name?: string } }
interface Conversa { botActive: boolean; messages?: any[] }
interface Lead { id: string; name: string; phone?: string; stageId?: string | null; conversations?: Conversa[] }
interface Etapa { id: string; name: string; order: number }

function primeiroNome(v?: string) {
  return (v || "").trim().split(" ")[0] || "";
}
function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function tempoResposta(sec: number | null) {
  if (sec == null) return "—";
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h}h ${resto}min` : `${h}h`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Results | null>(null);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [setup, setSetup] = useState({ whatsapp: false, agent: false, business: false });

  const buscar = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [rRes, aRes, lRes, sRes, bRes, eRes] = await Promise.all([
        fetch("/api/stats/results?days=30", { headers }),
        fetch("/api/appointments", { headers }),
        fetch("/api/leads", { headers }),
        fetch("/api/settings", { headers }),
        fetch("/api/business", { headers }),
        fetch("/api/pipeline-stages", { headers }),
      ]);
      const [r, a, l, s, b, e] = await Promise.all([
        rRes.json(), aRes.json(), lRes.json(), sRes.json(), bRes.json(), eRes.json(),
      ]);

      setResults(r && !r.error ? r : null);
      setAppts(Array.isArray(a) ? a : []);
      setLeads(Array.isArray(l) ? l : []);
      setEtapas(Array.isArray(e) ? e : []);

      // Sem tipo de negócio o painel não tem o que mostrar: vai para o wizard.
      const businessType = b?.profile?.businessType;
      if (!businessType) return navigate("/onboarding");

      setSetup({
        whatsapp: !!s.hasWhatsAppConnection,
        agent: !!s.hasSdr,
        business: !!businessType,
      });
    } catch (e) {
      console.error("Erro ao carregar o painel:", e);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { buscar(); }, [buscar]);

  const ehHoje = (iso: string) => {
    const d = new Date(iso), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  };
  const agendaHoje = appts
    .filter((a) => ehHoje(a.date) && a.status !== "CANCELLED")
    .sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime());

  // Conversa com o agente desligado = alguém assumiu e ela espera resposta.
  const esperando = leads.filter((l) =>
    (l.conversations || []).some((c) => c.botActive === false && (c.messages?.length || 0) > 0)
  );

  const passos = [
    { feito: setup.business, rotulo: "Configurar seu negócio", icone: Building2, destino: "/negocio" },
    { feito: setup.whatsapp, rotulo: "Conectar o WhatsApp", icone: Smartphone, destino: "/connections" },
    { feito: setup.agent, rotulo: "Criar seu agente de IA", icone: Bot, destino: "/sdrs" },
  ];
  const feitos = passos.filter((p) => p.feito).length;
  const proximo = passos.find((p) => !p.feito);
  const setupCompleto = feitos === passos.length;

  const h = new Date().getHours();
  const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const nome = primeiroNome(localStorage.getItem("userName") || "");
  const dataHoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  // A linha de atenção só afirma o que existe. Sem nada pendente, ela diz isso
  // em vez de inventar uma pendência para preencher espaço.
  const partes = [
    esperando.length ? `${esperando.length} ${esperando.length === 1 ? "conversa espera" : "conversas esperam"} por você` : null,
    agendaHoje.length ? `${agendaHoje.length} ${agendaHoje.length === 1 ? "agendamento acontece" : "agendamentos acontecem"} hoje` : null,
  ].filter(Boolean);
  const linhaAtencao = partes.length ? `${partes.join(" e ")}.` : "Nada pendente no momento.";

  // Funil por etapa. Contagem e conversão são reais; valor em R$ não existe —
  // o modelo Lead não tem campo de valor, então o painel não inventa um.
  const funil = etapas
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((et) => ({ nome: et.name, total: leads.filter((l) => l.stageId === et.id).length }));
  const topoFunil = funil[0]?.total ?? 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1380px] px-4 pb-10 pt-5 sm:px-6">

        {/* 1. Saudação */}
        <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="linha-unica text-[12px] font-semibold uppercase tracking-[0.12em] text-faint">{dataHoje}</p>
            <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-foreground">
              {saudacao}{nome ? `, ${nome}` : ""}
            </h1>
            <p className="mt-0.5 text-[13.5px] text-muted-foreground">{linhaAtencao}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => navigate("/appointments")} className="linha-unica gap-2">
              <CalendarDays className="h-4 w-4" /> Agenda de hoje
            </Button>
            <Button onClick={() => navigate("/conversations")} className="linha-unica gap-2">
              <MessageSquare className="h-4 w-4" /> Abrir conversas
            </Button>
          </div>
        </header>

        {/* 2. Checklist de setup — some quando concluído */}
        {!loading && !setupCompleto && (
          <section className="mb-4 rounded-[14px] border border-primary/30 bg-accent-soft p-5">
            <div className="flex flex-wrap items-center gap-5">
              <AnelProgresso feitos={feitos} total={passos.length} />
              <div className="min-w-[200px] flex-1">
                <h2 className="text-[15px] font-semibold text-foreground">
                  {passos.length - feitos === 1
                    ? "Falta um passo para o agente atender sozinho"
                    : `Faltam ${passos.length - feitos} passos para o agente atender sozinho`}
                </h2>
                {/* O rótulo vai como está: passar por toLowerCase transformava
                    "Conectar o WhatsApp" em "conectar o whatsapp". */}
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {proximo ? `Próximo: ${proximo.rotulo}.` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {passos.filter((p) => p.feito).map((p) => (
                  <span key={p.rotulo} className="linha-unica flex items-center gap-1.5 text-[12.5px] text-muted-foreground line-through">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 no-underline" />
                    {p.rotulo}
                  </span>
                ))}
                {proximo && (
                  <Button onClick={() => navigate(proximo.destino)} className="linha-unica gap-2">
                    <proximo.icone className="h-4 w-4" /> {proximo.rotulo}
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 3. KPIs — o principal ocupa mais espaço porque é o que se olha antes */}
        <section className="mb-4 grid gap-4 lg:grid-cols-[1.55fr_1fr_1fr_1fr]">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-[14px]" />)
          ) : (
            <>
              <article className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-foreground">Conversas atendidas</h3>
                  <span className="linha-unica rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">30 dias</span>
                </div>
                <p className="num mt-2 text-[46px] font-bold leading-none tracking-[-0.045em] text-foreground">
                  {(results?.conversationsHandled ?? 0).toLocaleString("pt-BR")}
                </p>
                <p className="mt-3 text-[12.5px] text-muted-foreground">
                  {esperando.length > 0
                    ? `${esperando.length} ${esperando.length === 1 ? "está" : "estão"} com a equipe agora.`
                    : "Nenhuma com a equipe agora — o agente está dando conta."}
                </p>
              </article>

              <Kpi
                rotulo="Agendamentos"
                valor={(results?.appointmentsScheduled ?? 0).toLocaleString("pt-BR")}
                contexto="marcados em 30 dias"
                icone={<CalendarDays className="h-4 w-4" />}
              />
              <Kpi
                rotulo="Comparecimento"
                valor={(results?.appointmentsCompleted ?? 0).toLocaleString("pt-BR")}
                contexto="agendamentos concluídos"
                icone={<CheckCircle2 className="h-4 w-4" />}
              />
              <Kpi
                rotulo="1ª resposta"
                valor={tempoResposta(results?.avgResponseSeconds ?? null)}
                contexto="mediana no período"
                icone={<Timer className="h-4 w-4" />}
              />
            </>
          )}
        </section>

        {/* 4 e 5. O que exige ação vem antes da agenda */}
        <div className="mb-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <Painel
            titulo="Precisa de você"
            icone={<MessageSquare className="h-4 w-4 text-amber-500" />}
            contador={esperando.length}
            acao={{ rotulo: "Abrir conversas", destino: "/conversations" }}
            navigate={navigate}
            pulsar
          >
            {loading ? (
              <Carregando />
            ) : esperando.length === 0 ? (
              <Vazio icone={<CheckCircle2 className="h-6 w-6 text-emerald-600" />} texto="Tudo em dia. O agente está cuidando das conversas." />
            ) : (
              <ul>
                {esperando.slice(0, 5).map((l) => (
                  <li
                    key={l.id}
                    onClick={() => navigate("/conversations")}
                    className="flex cursor-pointer items-center gap-3 border-b border-border-soft px-4 py-3 last:border-0 hover:bg-surface-2"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-[13px] font-semibold text-amber-700 dark:text-amber-500">
                      {(l.name?.charAt(0) || "?").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="linha-unica-elipse text-[13.5px] font-medium text-foreground">{l.name || l.phone}</p>
                      <p className="linha-unica text-[11.5px] text-amber-600 dark:text-amber-500">Aguardando resposta da equipe</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-faint" />
                  </li>
                ))}
              </ul>
            )}
          </Painel>

          <Painel
            titulo="Agenda de hoje"
            icone={<CalendarDays className="h-4 w-4 text-primary" />}
            contador={agendaHoje.length}
            acao={{ rotulo: "Ver agenda", destino: "/appointments" }}
            navigate={navigate}
          >
            {loading ? (
              <Carregando />
            ) : agendaHoje.length === 0 ? (
              <Vazio icone={<CalendarDays className="h-6 w-6 text-faint" />} texto="Nenhum agendamento marcado para hoje." />
            ) : (
              <ul>
                {agendaHoje.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-0 hover:bg-surface-2">
                    <span className="num shrink-0 text-[13px] font-semibold text-foreground">{hora(a.date)}</span>
                    <span className={`h-8 w-[3px] shrink-0 rounded-full ${corDoEstado(a.status)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="linha-unica-elipse text-[13.5px] font-medium text-foreground">{a.lead?.name || a.title}</p>
                      <p className="linha-unica-elipse text-[11.5px] text-muted-foreground">{a.title}</p>
                    </div>
                    <PilulaEstado status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </div>

        {/* 6. Funil */}
        {!loading && funil.length > 0 && (
          <section className="rounded-[14px] border border-border bg-card shadow-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="linha-unica flex items-center gap-2 text-[14px] font-semibold text-foreground">
                <Target className="h-4 w-4 text-primary" /> Funil de clientes
              </h2>
              <button onClick={() => navigate("/crm")} className="linha-unica flex items-center gap-1 text-[13px] text-accent-text hover:underline">
                Abrir funil <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </header>
            <div className="space-y-2.5 p-5">
              {funil.map((et, i) => {
                const largura = topoFunil > 0 ? Math.max(6, Math.round((et.total / topoFunil) * 100)) : 6;
                // Conversão sempre contra a etapa anterior: contra o topo, toda
                // etapa parece ruim e a comparação perde utilidade.
                const anterior = i > 0 ? funil[i - 1].total : null;
                const taxa = anterior && anterior > 0 ? Math.round((et.total / anterior) * 100) : null;
                return (
                  <div key={et.nome} className="flex items-center gap-3">
                    <span className="linha-unica-elipse w-[124px] shrink-0 text-[12.5px] text-muted-foreground">{et.nome}</span>
                    <div className="h-7 flex-1 overflow-hidden rounded-lg bg-surface-2">
                      <div
                        className="flex h-full items-center rounded-lg bg-primary px-2.5 transition-[width] duration-500"
                        style={{ width: `${largura}%` }}
                      >
                        <span className="num text-[12px] font-bold text-primary-foreground">{et.total}</span>
                      </div>
                    </div>
                    <span className="num w-[52px] shrink-0 text-right text-[12px] text-faint">
                      {taxa !== null ? `${taxa}%` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

/** Anel de progresso do checklist. */
function AnelProgresso({ feitos, total }: { feitos: number; total: number }) {
  const r = 19;
  const circunferencia = 2 * Math.PI * r; // ≈ 119,4
  const restante = circunferencia * (1 - feitos / total);
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-primary/20" />
        <circle
          cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-700"
          strokeDasharray={circunferencia}
          strokeDashoffset={restante}
        />
      </svg>
      <span className="num absolute inset-0 grid place-items-center text-[12px] font-bold text-foreground">
        {feitos}/{total}
      </span>
    </div>
  );
}

function Kpi({ rotulo, valor, contexto, icone }: { rotulo: string; valor: string; contexto: string; icone: React.ReactNode }) {
  return (
    <article className="rounded-[14px] border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="linha-unica-elipse text-[13px] font-medium text-muted-foreground">{rotulo}</h3>
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-text">{icone}</span>
      </div>
      <p className="num mt-2 text-[32px] font-bold leading-none tracking-[-0.04em] text-foreground">{valor}</p>
      <p className="mt-2 text-[12px] text-faint">{contexto}</p>
    </article>
  );
}

function Painel({
  titulo, icone, contador, acao, navigate, pulsar, children,
}: {
  titulo: string; icone: React.ReactNode; contador: number;
  acao: { rotulo: string; destino: string }; navigate: any; pulsar?: boolean; children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="linha-unica flex items-center gap-2 text-[14px] font-semibold text-foreground">
          {pulsar && contador > 0 && <span className="h-1.5 w-1.5 shrink-0 animate-pulseDot rounded-full bg-amber-500" />}
          {icone}
          {titulo}
          {contador > 0 && (
            <span className="num grid h-[18px] min-w-[18px] place-items-center rounded-full bg-surface-2 px-1 text-[11px] font-bold text-muted-foreground">
              {contador}
            </span>
          )}
        </h2>
        <button onClick={() => navigate(acao.destino)} className="linha-unica flex items-center gap-1 text-[13px] text-accent-text hover:underline">
          {acao.rotulo} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </header>
      {children}
    </section>
  );
}

function Carregando() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-[11px]" />)}
    </div>
  );
}

function Vazio({ icone, texto }: { icone: React.ReactNode; texto: string }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-12 text-center">
      {icone}
      <p className="text-[13px] text-muted-foreground">{texto}</p>
    </div>
  );
}

function corDoEstado(status: string) {
  return {
    COMPLETED: "bg-emerald-500",
    CANCELLED: "bg-rose-500",
    NOSHOW: "bg-amber-500",
  }[status] || "bg-primary";
}

function PilulaEstado({ status }: { status: string }) {
  const mapa: Record<string, { rotulo: string; cls: string }> = {
    SCHEDULED: { rotulo: "Agendada", cls: "bg-surface-2 text-muted-foreground" },
    PENDING: { rotulo: "Pendente", cls: "bg-amber-500/12 text-amber-700 dark:text-amber-500" },
    COMPLETED: { rotulo: "Concluída", cls: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" },
    NOSHOW: { rotulo: "Faltou", cls: "bg-amber-500/12 text-amber-700 dark:text-amber-500" },
  };
  const e = mapa[status] || { rotulo: status, cls: "bg-surface-2 text-muted-foreground" };
  return <span className={`linha-unica shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${e.cls}`}>{e.rotulo}</span>;
}
