import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2, Trash2, Plus, MoreVertical, UserX, Bell,
  ChevronLeft, ChevronRight,
  Calendar as LucideCalendar, Video, Copy, Check, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { format, isSameDay, isToday, isTomorrow, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";

/** Duração padrão de um compromisso no produto (AppointmentController). */
const DURACAO_MIN = 60;

/**
 * Estado do compromisso na lista.
 *
 * "Risco de falta" não é status do banco: é compromisso ainda agendado, não
 * confirmado pelo cliente, cujo lembrete de confirmação já saiu. Ou seja, foi
 * perguntado e ninguém respondeu — que é quando vale a pena alguém ligar.
 */
function estadoDoCompromisso(a: Appointment) {
  const inicio = new Date(a.date).getTime();
  const agora = Date.now();

  if (a.status === "COMPLETED") {
    return { id: "OK", rotulo: "Concluída", barra: "bg-emerald-500", pilula: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" };
  }
  if (a.status === "NOSHOW") {
    return { id: "FALTOU", rotulo: "Faltou", barra: "bg-rose-500", pilula: "bg-rose-500/12 text-rose-700 dark:text-rose-400" };
  }
  if (inicio <= agora && agora < inicio + DURACAO_MIN * 60000) {
    return { id: "AGORA", rotulo: "Agora", barra: "bg-primary", pilula: "bg-primary/12 text-accent-text" };
  }
  const confirmacaoEnviada = (a.reminders || []).some((r) => r.kind === "CONFIRM" && r.status === "SENT");
  if (!a.confirmedAt && confirmacaoEnviada && inicio > agora) {
    return { id: "RISCO", rotulo: "Risco de falta", barra: "bg-amber-500", pilula: "bg-amber-500/12 text-amber-700 dark:text-amber-500" };
  }
  if (a.confirmedAt) {
    return { id: "CONFIRMADA", rotulo: "Confirmada", barra: "bg-emerald-500", pilula: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" };
  }
  return { id: "AGENDADA", rotulo: "Agendada", barra: "bg-primary", pilula: "bg-surface-2 text-muted-foreground" };
}

interface Appointment {
  id: string;
  title: string;
  date: string;
  notes?: string;
  status: string;
  leadId: string;
  meetLink?: string | null;
  confirmedAt?: string | null;
  reminders?: { kind: string; status: string }[];
  lead?: {
    id: string;
    name: string;
    phone: string;
  };
}

/**
 * Link da reunião com copiar num clique.
 *
 * A URL do Meet é longa e ninguém decora: quem precisa mandar por outro canal
 * (e-mail, outro grupo) tem que conseguir levar o link inteiro sem selecionar
 * texto de um card. O "Entrar" abre; o botão ao lado copia.
 */
function MeetLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard exige contexto seguro (https); no HTTP a cópia manual salva.
      const campo = document.createElement("textarea");
      campo.value = url;
      document.body.appendChild(campo);
      campo.select();
      document.execCommand("copy");
      campo.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-1.5 rounded-lg border border-accent-text/30 bg-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-accent-text transition-colors hover:bg-accent-soft/70"
        title={url}
      >
        <Video className="h-3 w-3 shrink-0" />
        Entrar na reunião
        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
      </a>
      <button
        type="button"
        onClick={copiar}
        className="flex items-center gap-1.5 rounded-lg border border-border-soft px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        title="Copiar o link da reunião"
      >
        {copiado ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
        {copiado ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}

export default function Appointments() {
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAppt, setNewAppt] = useState({ title: "", date: "", leadId: "", notes: "" });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  // Config dos lembretes: o painel lateral liga e desliga os três da régua.
  const [config, setConfig] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const [aRes, lRes, cRes] = await Promise.all([
        fetch("/api/appointments", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/leads", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/automations/config", { headers: { "Authorization": `Bearer ${token}` } }),
      ]);
      const aData = await aRes.json();
      const lData = await lRes.json();
      setAppts(Array.isArray(aData) ? aData : []);
      setLeads(Array.isArray(lData) ? lData : []);
      setConfig(cRes.ok ? await cRes.json().catch(() => null) : null);
    } catch (e) {
      toast({ title: "Erro na agenda", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateAppt = async () => {
    if (!newAppt.title || !newAppt.date || !newAppt.leadId) {
      return toast({ title: "Dados incompletos", variant: "destructive" });
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(newAppt)
      });
      if (res.ok) {
        toast({ title: "Compromisso Agendado!" });
        setIsAddModalOpen(false);
        setNewAppt({ title: "", date: "", leadId: "", notes: "" });
        fetchData();
      }
    } catch (e) { toast({ title: "Falha ao agendar", variant: "destructive" }); }
  };

  const deleteAppt = async (id: string) => {
    if (!confirm("Remover este compromisso?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/appointments/${id}`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        toast({ title: "Agendamento removido" });
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const ROTULO_STATUS: Record<string, string> = {
    COMPLETED: "Marcado como concluído",
    NOSHOW: "Falta registrada",
    SCHEDULED: "Voltou para agendado",
  };

  const mudarStatus = async (appt: Appointment, status: string) => {
    try {
      const res = await fetch(`/api/appointments/${appt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast({ title: ROTULO_STATUS[status] || "Status atualizado" });
      fetchData();
    } catch (e) { toast({ title: "Erro ao atualizar", variant: "destructive" }); }
  };

  /** Liga/desliga um lembrete da régua sem sair da agenda. */
  const alternarLembrete = async (campo: string, valor: boolean) => {
    const anterior = config;
    setConfig((c: any) => ({ ...c, [campo]: valor }));
    try {
      const res = await fetch("/api/automations/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor }),
      });
      if (!res.ok) throw new Error();
    } catch (e) {
      setConfig(anterior);
      toast({ title: "Não foi possível mudar o lembrete", variant: "destructive" });
    }
  };

  // ── Números do topo ─────────────────────────────────────────
  const inicioDoDia = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const ativos = appts.filter((a) => a.status !== "CANCELLED");

  const deHoje = ativos.filter((a) => isSameDay(new Date(a.date), new Date()));
  const daSemana = ativos.filter((a) =>
    isWithinInterval(new Date(a.date), {
      start: startOfWeek(new Date(), { weekStartsOn: 0 }),
      end: endOfWeek(new Date(), { weekStartsOn: 0 }),
    })
  );
  const semanaPassada = ativos.filter((a) =>
    isWithinInterval(new Date(a.date), {
      start: startOfWeek(new Date(Date.now() - 7 * 864e5), { weekStartsOn: 0 }),
      end: endOfWeek(new Date(Date.now() - 7 * 864e5), { weekStartsOn: 0 }),
    })
  );
  // Comparecimento olha só o que já venceu: compromisso futuro não faltou.
  const vencidos = ativos.filter((a) => new Date(a.date) < new Date());
  const compareceram = vencidos.filter((a) => a.status === "COMPLETED").length;
  const faltaram = vencidos.filter((a) => a.status === "NOSHOW").length;
  const taxaComparecimento = compareceram + faltaram > 0
    ? Math.round((compareceram / (compareceram + faltaram)) * 100)
    : null;

  const emRisco = ativos.filter((a) => estadoDoCompromisso(a).id === "RISCO");

  // ── Lista do dia / semana / mês ─────────────────────────────
  const noPeriodo = ativos
    .filter((a) => {
      const d = new Date(a.date);
      if (!selectedDate) return true;
      if (viewMode === "day") return isSameDay(d, selectedDate);
      if (viewMode === "week") {
        return isWithinInterval(d, {
          start: startOfWeek(selectedDate, { weekStartsOn: 0 }),
          end: endOfWeek(selectedDate, { weekStartsOn: 0 }),
        });
      }
      return isWithinInterval(d, { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const agrupados = noPeriodo.reduce((acc: Record<string, Appointment[]>, a) => {
    const chave = format(new Date(a.date), "yyyy-MM-dd");
    (acc[chave] = acc[chave] || []).push(a);
    return acc;
  }, {});

  const rotuloDoDia = (chave: string) => {
    const d = new Date(`${chave}T12:00:00`);
    if (isToday(d)) return "Hoje";
    if (isTomorrow(d)) return "Amanhã";
    return format(d, "eeee, d 'de' MMMM", { locale: ptBR });
  };

  const andarDia = (passos: number) => {
    const base = selectedDate || new Date();
    const d = new Date(base);
    if (viewMode === "day") d.setDate(d.getDate() + passos);
    else if (viewMode === "week") d.setDate(d.getDate() + passos * 7);
    else d.setMonth(d.getMonth() + passos);
    setSelectedDate(d);
  };

  // Dias do mês que têm compromisso, para os pontos do calendário.
  const diasComEvento = new Set(ativos.map((a) => format(new Date(a.date), "yyyy-MM-dd")));

  const LEMBRETES = [
    { campo: "confirmEnabled", rotulo: "Confirmação 24h antes", detalhe: "Pergunta se o cliente confirma." },
    { campo: "meetLinkEnabled", rotulo: "Link da reunião", detalhe: "Envia o link do Meet antes da hora." },
    { campo: "finalEnabled", rotulo: "Lembrete final", detalhe: "Avisa minutos antes de começar." },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1500px] px-4 pb-10 pt-5 sm:px-6">

        {/* Cabeçalho */}
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Agendamentos</h1>
            <p className="mt-0.5 max-w-md text-[13.5px] text-muted-foreground">
              Tudo o que o agente marcou, com confirmação e lembrete automáticos.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex rounded-lg border border-border-soft bg-card p-1">
              {(["day", "week", "month"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`h-8 rounded-md px-4 text-[12.5px] font-semibold transition-colors ${
                    viewMode === v ? "bg-accent-soft text-accent-text" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
            <Button onClick={() => setIsAddModalOpen(true)} className="h-10 gap-2">
              <Plus className="h-4 w-4" /> Novo agendamento
            </Button>
          </div>
        </header>

        {/* KPIs */}
        <section className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiAgenda
            rotulo="Hoje"
            valor={String(deHoje.length)}
            detalhe={`${deHoje.filter((a) => a.status === "COMPLETED").length} já concluídos`}
          />
          <KpiAgenda
            rotulo="Esta semana"
            valor={String(daSemana.length)}
            detalhe={
              semanaPassada.length === 0
                ? "sem semana anterior para comparar"
                : `${daSemana.length - semanaPassada.length >= 0 ? "+" : ""}${daSemana.length - semanaPassada.length} vs. semana passada`
            }
          />
          <KpiAgenda
            rotulo="Comparecimento"
            valor={taxaComparecimento === null ? "—" : `${taxaComparecimento}%`}
            detalhe={
              taxaComparecimento === null
                ? "nenhum compromisso vencido ainda"
                : `${compareceram} de ${compareceram + faltaram} compareceram`
            }
            verde
          />
          <KpiAgenda
            rotulo="Risco de falta"
            valor={String(emRisco.length)}
            detalhe="sem confirmação do cliente"
            laranja={emRisco.length > 0}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          {/* Lista do período */}
          <section className="rounded-[14px] border border-border bg-card shadow-card">
            <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
              <h2 className="linha-unica-elipse text-[14px] font-semibold capitalize text-foreground">
                {viewMode === "day"
                  ? format(selectedDate || new Date(), "eeee, d 'de' MMMM", { locale: ptBR })
                  : viewMode === "week"
                  ? `Semana de ${format(startOfWeek(selectedDate || new Date(), { weekStartsOn: 0 }), "d 'de' MMMM", { locale: ptBR })}`
                  : format(selectedDate || new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
              </h2>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => andarDia(-1)} className="grid h-8 w-8 place-items-center rounded-lg border border-border-soft text-faint hover:text-foreground" aria-label="Anterior">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setSelectedDate(new Date())} className="h-8 rounded-lg border border-border-soft px-3 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
                  Hoje
                </button>
                <button onClick={() => andarDia(1)} className="grid h-8 w-8 place-items-center rounded-lg border border-border-soft text-faint hover:text-foreground" aria-label="Próximo">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </header>

            {loading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : noPeriodo.length === 0 ? (
              <div className="grid place-items-center gap-2 px-6 py-16 text-center">
                <LucideCalendar className="h-8 w-8 text-border-soft" />
                <p className="text-[13px] text-muted-foreground">Nenhum agendamento neste período.</p>
                <Button variant="outline" onClick={() => setIsAddModalOpen(true)} className="mt-2 gap-2">
                  <Plus className="h-4 w-4" /> Novo agendamento
                </Button>
              </div>
            ) : (
              <div>
                {Object.keys(agrupados).map((chave) => (
                  <div key={chave}>
                    {viewMode !== "day" && (
                      <p className="linha-unica border-b border-border-soft bg-surface-2 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                        {rotuloDoDia(chave)}
                      </p>
                    )}
                    {agrupados[chave].map((a) => {
                      const e = estadoDoCompromisso(a);
                      return (
                        <article key={a.id} className="flex items-center gap-3 border-b border-border-soft px-5 py-3 last:border-0 hover:bg-surface-2">
                          <div className="w-[52px] shrink-0">
                            <p className="num text-[14px] font-bold tabular-nums text-accent-text">{format(new Date(a.date), "HH:mm")}</p>
                            <p className="num text-[11px] text-faint">{DURACAO_MIN} min</p>
                          </div>
                          <span className={`h-10 w-[3px] shrink-0 rounded-full ${e.barra}`} />
                          <div className="min-w-0 flex-1">
                            <p className="linha-unica-elipse text-[13.5px] font-semibold text-foreground">{a.lead?.name || "Contato"}</p>
                            <p className="linha-unica-elipse text-[12px] text-muted-foreground">{a.title}</p>
                            {a.meetLink && <div className="mt-1.5"><MeetLink url={a.meetLink} /></div>}
                          </div>
                          <span className={`linha-unica shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${e.pilula}`}>
                            {e.rotulo}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint hover:bg-card hover:text-foreground">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
                              <DropdownMenuItem className="cursor-pointer rounded-lg text-[12px] font-medium" onClick={() => mudarStatus(a, "COMPLETED")}>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> Marcar como concluído
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer rounded-lg text-[12px] font-medium" onClick={() => mudarStatus(a, "NOSHOW")}>
                                <UserX className="mr-2 h-4 w-4 text-amber-600" /> Registrar falta
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer rounded-lg text-[12px] font-medium" onClick={() => mudarStatus(a, "SCHEDULED")}>
                                <LucideCalendar className="mr-2 h-4 w-4 text-accent-text" /> Voltar para agendado
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer rounded-lg text-[12px] font-medium text-red-600 focus:text-red-600"
                                onClick={() => deleteAppt(a.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Calendário + lembretes */}
          <div className="space-y-4">
            <section className="rounded-[14px] border border-border bg-card p-3 shadow-card">
              <div className="flex items-baseline justify-between px-2 pb-1">
                <h2 className="text-[14px] font-semibold capitalize text-foreground">
                  {format(selectedDate || new Date(), "MMMM yyyy", { locale: ptBR })}
                </h2>
                <span className="num text-[11.5px] text-faint">
                  {ativos.filter((a) => isWithinInterval(new Date(a.date), {
                    start: startOfMonth(selectedDate || new Date()),
                    end: endOfMonth(selectedDate || new Date()),
                  })).length} agendamentos
                </span>
              </div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { setSelectedDate(d); if (d) setViewMode("day"); }}
                month={selectedDate}
                onMonthChange={setSelectedDate}
                locale={ptBR}
                className="rounded-lg"
                // O mês já está escrito no cabeçalho da seção; repetir dentro
                // do calendário só duplicaria a mesma palavra. As setas ficam.
                classNames={{ caption_label: "hidden" }}
                // Ponto azul embaixo do dia que tem compromisso: é o que
                // permite achar o próximo sem clicar dia a dia.
                modifiers={{ temEvento: (d: Date) => diasComEvento.has(format(d, "yyyy-MM-dd")) }}
                modifiersClassNames={{
                  temEvento:
                    "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-[#2563EB]",
                }}
              />
            </section>

            <section className="rounded-[14px] border border-border bg-card shadow-card">
              <header className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="linha-unica flex items-center gap-2 text-[14px] font-semibold text-foreground">
                  <Bell className="h-4 w-4 text-primary" /> Lembretes automáticos
                </h2>
                <button onClick={() => navigate("/automations")} className="linha-unica text-[12.5px] text-accent-text hover:underline">
                  Ajustar
                </button>
              </header>
              <ul>
                {LEMBRETES.map((l) => (
                  <li key={l.campo} className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="linha-unica-elipse text-[13px] font-medium text-foreground">{l.rotulo}</p>
                      <p className="linha-unica-elipse text-[11.5px] text-faint">{l.detalhe}</p>
                    </div>
                    <Switch
                      checked={config?.[l.campo] !== false && config?.remindersEnabled !== false}
                      disabled={!config || config.remindersEnabled === false}
                      onCheckedChange={(v) => alternarLembrete(l.campo, v)}
                      aria-label={l.rotulo}
                    />
                  </li>
                ))}
              </ul>
              {config && config.remindersEnabled === false && (
                <p className="border-t border-border-soft px-4 py-2.5 text-[11.5px] text-amber-700">
                  Os lembretes estão desligados por completo em Lembretes — os interruptores acima não valem enquanto isso.
                </p>
              )}
            </section>
          </div>
        </div>
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold">
              <LucideCalendar className="h-4 w-4 text-primary" /> Novo agendamento
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              O convite no Google e os lembretes saem sozinhos depois de salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">O que é</Label>
              <Input
                value={newAppt.title}
                onChange={(e) => setNewAppt({ ...newAppt, title: e.target.value })}
                className="h-10"
                placeholder="Ex: Avaliação inicial"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-muted-foreground">Data e hora</Label>
                <Input
                  type="datetime-local"
                  value={newAppt.date}
                  onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-muted-foreground">Cliente</Label>
                <Select value={newAppt.leadId} onValueChange={(v) => setNewAppt({ ...newAppt, leadId: v })}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">Observações</Label>
              <Input
                value={newAppt.notes}
                onChange={(e) => setNewAppt({ ...newAppt, notes: e.target.value })}
                className="h-10"
                placeholder="O que precisa ser lembrado na hora"
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleCreateAppt} className="w-full">Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function KpiAgenda({
  rotulo, valor, detalhe, verde, laranja,
}: { rotulo: string; valor: string; detalhe: string; verde?: boolean; laranja?: boolean }) {
  return (
    <article className="rounded-[14px] border border-border bg-card p-4 shadow-card">
      <p className="linha-unica-elipse text-[12px] text-muted-foreground">{rotulo}</p>
      <p
        className={`num mt-1 text-[30px] font-bold leading-none tracking-[-0.04em] ${
          laranja
            ? "text-amber-600 dark:text-amber-500"
            : verde
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-foreground"
        }`}
      >
        {valor}
      </p>
      <p className="mt-2 text-[11.5px] text-faint">{detalhe}</p>
    </article>
  );
}
