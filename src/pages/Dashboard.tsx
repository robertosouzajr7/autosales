import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays, MessageSquare, CheckCircle2, Timer, ArrowRight, ArrowUpRight, ArrowDownRight,
  Smartphone, Bot, ChevronRight, Building2, Target, Instagram, Globe, Plug, AlertTriangle,
} from "lucide-react";

/**
 * Home do painel.
 *
 * A ordem de leitura é deliberada e vem do handoff: saudação → o que falta
 * configurar → números → o que exige ação → agenda → funil e conexões. Quem
 * abre o painel não vem saber quantas conversas teve; vem saber o que fazer
 * agora. Por isso a fila de espera aparece antes da agenda, e ambas antes do
 * funil.
 */

interface Serie { dia: string; total: number }
interface Home {
  periodDays: number;
  conversas: { total: number; delta: number | null; ia: number; equipe: number; serie: Serie[] };
  agendamentos: { total: number; delta: number | null };
  comparecimento: { taxa: number | null; delta: number | null; concluidos: number; faltas: number };
  resposta: { segundos: number | null; delta: number | null };
  funil: {
    etapas: { id: string; nome: string; cor?: string | null; total: number; valor: number }[];
    emNegociacao: number; fechado: number; ticketMedio: number;
  };
}
interface Lembrete { kind: string; status: string }
interface Appt {
  id: string; title: string; date: string; status: string;
  confirmedAt?: string | null; lead?: { name?: string }; reminders?: Lembrete[];
}
interface Conversa {
  id: string; leadId: string; name: string; channel?: string; phase?: string;
  lastMessagePreview?: string; lastMessageAt?: string; queuedAt?: string | null;
  handoffReason?: string | null; unreadCount?: number;
}
interface Conexao { id: string; name?: string; phone?: string; channel?: string; status?: string }

const CANAL: Record<string, { label: string; selo: string; Icon: any }> = {
  WHATSAPP: { label: "WhatsApp", selo: "bg-[#22A06B]", Icon: MessageSquare },
  INSTAGRAM: { label: "Instagram", selo: "bg-[#DB2777]", Icon: Instagram },
  SITE: { label: "Site", selo: "bg-[#2563EB]", Icon: Globe },
};
const canal = (c?: string) => CANAL[(c || "WHATSAPP").toUpperCase()] || CANAL.WHATSAPP;

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
/** "há 12 min" — quanto tempo a conversa está parada esperando. */
function esperaDesde(iso?: string | null) {
  if (!iso) return "";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
const reais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [home, setHome] = useState<Home | null>(null);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [google, setGoogle] = useState<any>(null);
  const [setup, setSetup] = useState({ whatsapp: false, agent: false, business: false });

  const buscar = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const respostas = await Promise.all([
        fetch("/api/stats/home?days=30", { headers }),
        fetch("/api/appointments", { headers }),
        fetch("/api/conversations", { headers }),
        fetch("/api/settings", { headers }),
        fetch("/api/business", { headers }),
        fetch("/api/whatsapp/accounts", { headers }),
        fetch("/api/google/status", { headers }),
      ]);
      // Rota sem permissão devolve 403; virar lista vazia é o certo aqui —
      // um colaborador sem acesso a conexões vê a home sem essa seção, não
      // uma home quebrada.
      const [h, a, c, s, b, w, g] = await Promise.all(
        respostas.map((r) => (r.ok ? r.json().catch(() => null) : null))
      );

      setHome(h && !h.error ? h : null);
      setAppts(Array.isArray(a) ? a : []);
      setConversas(Array.isArray(c) ? c : []);
      setConexoes(Array.isArray(w) ? w : []);
      setGoogle(g || null);

      // Sem tipo de negócio o painel não tem o que mostrar: vai para o wizard.
      const businessType = b?.profile?.businessType;
      if (!businessType) return navigate("/onboarding");

      setSetup({
        whatsapp: !!s?.hasWhatsAppConnection,
        agent: !!s?.hasSdr,
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

  // Espera humana é a fila de atendimento, não "bot desligado": desligar o
  // agente numa conversa já resolvida não põe ninguém esperando.
  const esperando = conversas
    .filter((c) => c.phase === "QUEUE")
    .sort((x, y) => new Date(x.queuedAt || 0).getTime() - new Date(y.queuedAt || 0).getTime());

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

  const funil = home?.funil?.etapas || [];
  const topoFunil = funil[0]?.total ?? 0;
  const temValor = (home?.funil?.emNegociacao || 0) + (home?.funil?.fechado || 0) > 0;

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
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[196px] rounded-[14px]" />)
          ) : (
            <>
              <article className="flex flex-col rounded-[14px] border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-foreground">Conversas atendidas</h3>
                  <span className="linha-unica rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {home?.periodDays ?? 30} dias
                  </span>
                </div>
                <div className="mt-2 flex items-end gap-3">
                  <p className="num text-[46px] font-bold leading-none tracking-[-0.045em] text-foreground">
                    {(home?.conversas.total ?? 0).toLocaleString("pt-BR")}
                  </p>
                  <Delta valor={home?.conversas.delta ?? null} />
                </div>
                <Sparkline serie={home?.conversas.serie || []} />
                <p className="mt-3 text-[12.5px] text-muted-foreground">
                  {home && home.conversas.total > 0 ? (
                    <>
                      <strong className="font-semibold text-foreground">{home.conversas.ia.toLocaleString("pt-BR")}</strong>{" "}
                      resolvidas pela IA ·{" "}
                      <strong className="font-semibold text-foreground">{home.conversas.equipe.toLocaleString("pt-BR")}</strong>{" "}
                      {home.conversas.equipe === 1 ? "passou" : "passaram"} para a equipe
                    </>
                  ) : (
                    "Nenhuma conversa no período."
                  )}
                </p>
              </article>

              <Kpi
                rotulo="Agendamentos"
                valor={(home?.agendamentos.total ?? 0).toLocaleString("pt-BR")}
                delta={home?.agendamentos.delta ?? null}
                contexto="marcados no período"
                icone={<CalendarDays className="h-4 w-4" />}
              />
              <Kpi
                rotulo="Comparecimento"
                valor={home?.comparecimento.taxa !== null && home?.comparecimento.taxa !== undefined ? `${home.comparecimento.taxa}%` : "—"}
                delta={home?.comparecimento.delta ?? null}
                unidadeDelta="p.p."
                contexto={
                  home?.comparecimento.taxa === null || home?.comparecimento.taxa === undefined
                    ? "sem compromissos vencidos ainda"
                    : `${home.comparecimento.concluidos} de ${home.comparecimento.concluidos + home.comparecimento.faltas} compareceram`
                }
                icone={<CheckCircle2 className="h-4 w-4" />}
              />
              <Kpi
                rotulo="1ª resposta"
                valor={tempoResposta(home?.resposta.segundos ?? null)}
                delta={home?.resposta.delta ?? null}
                // Aqui menos é melhor: cair 20% é uma boa notícia, e pintar
                // isso de vermelho diria o contrário.
                menorEhMelhor
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
                {esperando.slice(0, 5).map((c) => {
                  const m = canal(c.channel);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-0 hover:bg-surface-2"
                    >
                      <span className="relative shrink-0">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-500/15 text-[13px] font-semibold text-amber-700 dark:text-amber-500">
                          {(c.name?.charAt(0) || "?").toUpperCase()}
                        </span>
                        <span className={`absolute -bottom-0.5 -right-0.5 grid h-[15px] w-[15px] place-items-center rounded-full ring-2 ring-card ${m.selo}`}>
                          <m.Icon className="h-2 w-2 text-white" />
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="linha-unica-elipse text-[13.5px] font-medium text-foreground">{c.name}</p>
                          <span className="num shrink-0 text-[11px] text-faint">{esperaDesde(c.queuedAt)}</span>
                        </div>
                        <p className="linha-unica-elipse text-[11.5px] text-muted-foreground">
                          {c.lastMessagePreview || c.handoffReason || "Aguardando atendimento"}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate("/conversations")}
                        className="linha-unica h-8 shrink-0 rounded-lg border border-accent-text/30 bg-accent-soft px-3 text-[12px] font-semibold text-accent-text hover:bg-accent-soft/70"
                      >
                        Responder
                      </button>
                    </li>
                  );
                })}
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
                {agendaHoje.slice(0, 5).map((a) => {
                  const estado = estadoDoCompromisso(a);
                  return (
                    <li key={a.id} className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-0 hover:bg-surface-2">
                      <span className="num shrink-0 text-[13px] font-semibold tabular-nums text-foreground">{hora(a.date)}</span>
                      <span className={`h-8 w-[3px] shrink-0 rounded-full ${estado.barra}`} />
                      <div className="min-w-0 flex-1">
                        <p className="linha-unica-elipse text-[13.5px] font-medium text-foreground">{a.lead?.name || a.title}</p>
                        <p className="linha-unica-elipse text-[11.5px] text-muted-foreground">{a.title}</p>
                      </div>
                      <span className={`linha-unica shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${estado.pilula}`}>
                        {estado.rotulo}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Painel>
        </div>

        {/* 6 e 7. Funil e conexões */}
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-[14px] border border-border bg-card shadow-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="linha-unica flex items-center gap-2 text-[14px] font-semibold text-foreground">
                <Target className="h-4 w-4 text-primary" /> Funil de clientes
              </h2>
              <button onClick={() => navigate("/crm")} className="linha-unica flex items-center gap-1 text-[13px] text-accent-text hover:underline">
                Abrir funil <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </header>

            {loading ? (
              <Carregando />
            ) : funil.length === 0 ? (
              <Vazio icone={<Target className="h-6 w-6 text-faint" />} texto="Nenhuma etapa criada no funil ainda." />
            ) : (
              <>
                <div className="space-y-2.5 p-5">
                  {funil.map((et, i) => {
                    const largura = topoFunil > 0 ? Math.max(6, Math.round((et.total / topoFunil) * 100)) : 6;
                    // Conversão sempre contra a etapa anterior: contra o topo,
                    // toda etapa parece ruim e a comparação perde utilidade.
                    const anterior = i > 0 ? funil[i - 1].total : null;
                    const taxa = anterior && anterior > 0 ? Math.round((et.total / anterior) * 100) : null;
                    return (
                      <div key={et.id} className="flex items-center gap-3">
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

                {/* O rodapé de valores só aparece quando há valor preenchido:
                    exibir "R$ 0" para quem nunca usou o campo passaria a
                    impressão de que o funil está zerado, e não vazio. */}
                {temValor ? (
                  <footer className="grid grid-cols-3 divide-x divide-border border-t border-border">
                    <ValorFunil rotulo="Em negociação" valor={reais(home!.funil.emNegociacao)} />
                    <ValorFunil rotulo="Fechado" valor={reais(home!.funil.fechado)} destaque />
                    <ValorFunil rotulo="Ticket médio" valor={reais(home!.funil.ticketMedio)} />
                  </footer>
                ) : (
                  <footer className="border-t border-border px-5 py-3">
                    <p className="text-[12px] text-faint">
                      Preencha o valor dos contatos no funil para ver aqui quanto está em negociação e o ticket médio.
                    </p>
                  </footer>
                )}
              </>
            )}
          </section>

          {/* Canais e conexões */}
          <section className="rounded-[14px] border border-border bg-card shadow-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="linha-unica flex items-center gap-2 text-[14px] font-semibold text-foreground">
                <Plug className="h-4 w-4 text-primary" /> Canais e conexões
              </h2>
              <button onClick={() => navigate("/connections")} className="linha-unica flex items-center gap-1 text-[13px] text-accent-text hover:underline">
                Gerenciar <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </header>
            {loading ? (
              <Carregando />
            ) : (
              <ul>
                {conexoes.slice(0, 4).map((c) => {
                  const m = canal(c.channel);
                  const ligado = c.status === "CONNECTED";
                  return (
                    <li key={c.id} className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-0">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${m.selo}`}>
                        <m.Icon className="h-4 w-4 text-white" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="linha-unica-elipse text-[13px] font-medium text-foreground">{c.name || m.label}</p>
                        <p className="linha-unica-elipse text-[11.5px] text-faint">{c.phone || m.label}</p>
                      </div>
                      <Pilula ok={ligado} rotulo={ligado ? "Conectado" : "Desconectado"} />
                    </li>
                  );
                })}

                {/* Google: "conectado" aqui não é ter token salvo, é não haver
                    erro registrado — token revogado continua salvo. */}
                <li className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-0">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#4285F4]">
                    <CalendarDays className="h-4 w-4 text-white" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="linha-unica-elipse text-[13px] font-medium text-foreground">Google Agenda</p>
                    <p className="linha-unica-elipse text-[11.5px] text-faint">
                      {google?.lastError ? google.lastError : google?.connected ? "Agenda sincronizada" : "Não conectada"}
                    </p>
                  </div>
                  {google?.connected && google?.lastError ? (
                    <Pilula alerta rotulo="Renovar" />
                  ) : (
                    <Pilula ok={!!google?.connected} rotulo={google?.connected ? "Conectado" : "Conectar"} />
                  )}
                </li>

                {conexoes.length === 0 && !google?.connected && (
                  <li className="px-4 py-6 text-center">
                    <p className="text-[12.5px] text-muted-foreground">Nenhum canal conectado ainda.</p>
                  </li>
                )}
              </ul>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

/**
 * Estado do compromisso na agenda de hoje.
 *
 * "Risco de falta" não é um status do banco: é o cruzamento de compromisso
 * ainda agendado, não confirmado pelo cliente, com o lembrete de confirmação
 * já enviado. Ou seja, foi perguntado e ninguém respondeu — que é exatamente
 * quando vale a pena alguém ligar.
 */
function estadoDoCompromisso(a: Appt) {
  const inicio = new Date(a.date).getTime();
  const agora = Date.now();

  if (a.status === "COMPLETED") {
    return { rotulo: "Concluída", barra: "bg-emerald-500", pilula: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" };
  }
  if (a.status === "NOSHOW") {
    return { rotulo: "Faltou", barra: "bg-rose-500", pilula: "bg-rose-500/12 text-rose-700 dark:text-rose-400" };
  }
  // Uma hora de janela: é a duração padrão de um compromisso no produto.
  if (inicio <= agora && agora < inicio + 60 * 60000) {
    return { rotulo: "Agora", barra: "bg-primary", pilula: "bg-primary/12 text-accent-text" };
  }
  const confirmacaoEnviada = (a.reminders || []).some((r) => r.kind === "CONFIRM" && r.status === "SENT");
  if (!a.confirmedAt && confirmacaoEnviada && inicio > agora) {
    return { rotulo: "Risco de falta", barra: "bg-amber-500", pilula: "bg-amber-500/12 text-amber-700 dark:text-amber-500" };
  }
  if (a.confirmedAt) {
    return { rotulo: "Confirmada", barra: "bg-emerald-500", pilula: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" };
  }
  return { rotulo: "Agendada", barra: "bg-primary", pilula: "bg-surface-2 text-muted-foreground" };
}

/** Variação contra o período anterior. Nula quando não havia com o que comparar. */
function Delta({ valor, unidade = "%", menorEhMelhor }: { valor: number | null; unidade?: string; menorEhMelhor?: boolean }) {
  if (valor === null || valor === undefined) {
    // Um traço em vez da frase inteira: sem período anterior não há o que
    // dizer, e escrever isso por extenso ao lado do número roubava a atenção
    // dele. O motivo fica no title, para quem quiser saber.
    return (
      <span className="linha-unica pb-1.5 text-[12.5px] text-faint" title="Sem período anterior para comparar">—</span>
    );
  }
  const subiu = valor > 0;
  const bom = menorEhMelhor ? !subiu : subiu;
  const neutro = valor === 0;
  const Icone = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`linha-unica flex items-center gap-0.5 pb-1.5 text-[12.5px] font-semibold ${
        neutro ? "text-faint" : bom ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {!neutro && <Icone className="h-3.5 w-3.5" />}
      {valor > 0 ? "+" : ""}{valor.toLocaleString("pt-BR")}{unidade}
    </span>
  );
}

/**
 * Gráfico da série diária de conversas.
 *
 * SVG a mão, sem biblioteca de gráfico: é uma linha e um preenchimento, e
 * puxar uma dependência de charts para isso custaria mais no bundle do que a
 * página inteira.
 */
function Sparkline({ serie }: { serie: Serie[] }) {
  const L = 300, A = 64;
  if (serie.length < 2) return <div className="mt-4 h-16" />;

  const maximo = Math.max(...serie.map((p) => p.total), 1);
  const pontos = serie.map((p, i) => {
    const x = (i / (serie.length - 1)) * L;
    // 4px de folga em cima e embaixo para a linha não encostar na borda.
    const y = A - 4 - (p.total / maximo) * (A - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linha = `M ${pontos.join(" L ")}`;
  const area = `${linha} L ${L},${A} L 0,${A} Z`;
  const id = "grad-conversas";

  return (
    <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" className="mt-4 h-16 w-full" role="img" aria-label="Conversas por dia no período">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={linha} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
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

function Kpi({
  rotulo, valor, contexto, icone, delta, unidadeDelta, menorEhMelhor,
}: {
  rotulo: string; valor: string; contexto: string; icone: React.ReactNode;
  delta: number | null; unidadeDelta?: string; menorEhMelhor?: boolean;
}) {
  return (
    <article className="flex flex-col rounded-[14px] border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="linha-unica-elipse text-[13px] font-medium text-muted-foreground">{rotulo}</h3>
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-text">{icone}</span>
      </div>
      <p className="num mt-2 text-[32px] font-bold leading-none tracking-[-0.04em] text-foreground">{valor}</p>
      <div className="mt-2">
        <Delta valor={delta} unidade={unidadeDelta ?? "%"} menorEhMelhor={menorEhMelhor} />
      </div>
      <p className="mt-auto pt-2 text-[12px] text-faint">{contexto}</p>
    </article>
  );
}

function ValorFunil({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="px-5 py-3.5">
      <p className="text-[11.5px] text-faint">{rotulo}</p>
      <p className={`num mt-0.5 text-[15px] font-bold tracking-[-0.02em] ${destaque ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
        {valor}
      </p>
    </div>
  );
}

function Pilula({ ok, alerta, rotulo }: { ok?: boolean; alerta?: boolean; rotulo: string }) {
  const cls = alerta
    ? "bg-amber-500/12 text-amber-700 dark:text-amber-500"
    : ok
    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
    : "bg-surface-2 text-muted-foreground";
  return (
    <span className={`linha-unica flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${cls}`}>
      {alerta && <AlertTriangle className="h-3 w-3" />}
      {rotulo}
    </span>
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
