import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import {
  CalendarDays, MessageSquare, CheckCircle2, Clock, Timer,
  ArrowRight, Smartphone, Bot, Send, ChevronRight, CircleDot
} from "lucide-react";

interface Results {
  appointmentsScheduled: number;
  appointmentsCompleted: number;
  conversationsHandled: number;
  avgResponseSeconds: number | null;
}
interface Appt { id: string; title: string; date: string; status: string; lead?: { name?: string } }
interface Lead { id: string; name: string; phone?: string; conversations?: { botActive: boolean; messages?: any[] }[] }

function firstName(v?: string) {
  return (v || "").trim().split(" ")[0] || "";
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtResponse(sec: number | null) {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  return `${Math.round(sec / 60)}min`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Results | null>(null);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [setup, setSetup] = useState({ whatsapp: false, agent: false });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [rRes, aRes, lRes, sRes] = await Promise.all([
        fetch("/api/stats/results?days=30", { headers }),
        fetch("/api/appointments", { headers }),
        fetch("/api/leads", { headers }),
        fetch("/api/settings", { headers }),
      ]);
      const [r, a, l, s] = await Promise.all([rRes.json(), aRes.json(), lRes.json(), sRes.json()]);

      setResults(r && !r.error ? r : null);
      setAppts(Array.isArray(a) ? a : []);
      setLeads(Array.isArray(l) ? l : []);
      setSetup({ whatsapp: !!s.hasWhatsAppConnection, agent: !!s.hasSdr });
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isToday = (iso: string) => {
    const d = new Date(iso); const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  };
  const todayAppts = appts
    .filter(a => isToday(a.date) && a.status !== "CANCELLED")
    .sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime());

  const waiting = leads.filter(l =>
    (l.conversations || []).some(c => c.botActive === false && (c.messages?.length || 0) > 0)
  );

  const setupDone = setup.whatsapp && setup.agent;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <PageHeader
          title={`${greeting}${firstName(localStorage.getItem("companyName") || "") ? ", " + (localStorage.getItem("companyName") || "") : ""}`}
          subtitle="Veja o que está acontecendo na sua clínica hoje."
          actions={
            <Button onClick={() => navigate("/appointments")}>
              <CalendarDays className="w-4 h-4 mr-2" /> Agenda de hoje
            </Button>
          }
        />

        {/* Checklist de setup — some quando concluído */}
        {!loading && !setupDone && (
          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Termine de configurar sua clínica</h3>
                <p className="text-sm text-muted-foreground">Faltam alguns passos para o seu assistente começar a atender.</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <SetupItem done={setup.whatsapp} icon={<Smartphone className="w-4 h-4" />} label="Conectar o WhatsApp" onClick={() => navigate("/connections")} />
              <SetupItem done={setup.agent} icon={<Bot className="w-4 h-4" />} label="Criar seu assistente de IA" onClick={() => navigate("/sdrs")} />
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)
          ) : (
            <>
              <StatCard label="Consultas (30 dias)" value={results?.appointmentsScheduled ?? 0} icon={<CalendarDays className="w-5 h-5" />} hint="agendadas no período" />
              <StatCard label="Conversas atendidas" value={results?.conversationsHandled ?? 0} icon={<MessageSquare className="w-5 h-5" />} hint="últimos 30 dias" />
              <StatCard label="Comparecimento" value={results?.appointmentsCompleted ?? 0} icon={<CheckCircle2 className="w-5 h-5" />} hint="consultas concluídas" />
              <StatCard label="Resposta média" value={fmtResponse(results?.avgResponseSeconds ?? null)} icon={<Timer className="w-5 h-5" />} hint="1ª resposta ao paciente" />
            </>
          )}
        </div>

        {/* Duas colunas: Hoje + Aguardando */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Consultas de hoje */}
          <section className="rounded-2xl border border-border bg-card">
            <header className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" /> Consultas de hoje
              </h2>
              <button onClick={() => navigate("/appointments")} className="text-sm text-primary hover:underline flex items-center gap-1">
                Ver agenda <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </header>
            <div className="p-2">
              {loading ? (
                <div className="p-3 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
              ) : todayAppts.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma consulta marcada para hoje.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {todayAppts.slice(0, 6).map(a => (
                    <li key={a.id} className="flex items-center gap-3 px-3 py-3">
                      <div className="flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="text-sm font-semibold tabular-nums">{fmtTime(a.date)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{a.lead?.name || a.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.title}</p>
                      </div>
                      <StatusPill status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Aguardando você */}
          <section className="rounded-2xl border border-border bg-card">
            <header className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-500" /> Aguardando atendimento
                {waiting.length > 0 && (
                  <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700">{waiting.length}</span>
                )}
              </h2>
              <button onClick={() => navigate("/conversations")} className="text-sm text-primary hover:underline flex items-center gap-1">
                Abrir conversas <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </header>
            <div className="p-2">
              {loading ? (
                <div className="p-3 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
              ) : waiting.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="w-6 h-6 text-primary/60 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Tudo em dia. O assistente está cuidando das conversas.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {waiting.slice(0, 6).map(l => (
                    <li key={l.id} className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50 rounded-lg" onClick={() => navigate("/conversations")}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
                        {(l.name?.charAt(0) || "?").toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{l.name || l.phone}</p>
                        <p className="text-xs text-amber-600 flex items-center gap-1"><CircleDot className="w-3 h-3" /> Aguardando você</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

function SetupItem({ done, icon, label, onClick }: { done: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
    >
      <span className={done ? "text-primary" : "text-muted-foreground"}>
        {done ? <CheckCircle2 className="w-5 h-5" /> : icon}
      </span>
      <span className={`flex-1 text-sm font-medium ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>{label}</span>
      {!done && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SCHEDULED: { label: "Agendada", cls: "bg-primary/10 text-primary" },
    PENDING: { label: "Pendente", cls: "bg-amber-100 text-amber-700" },
    COMPLETED: { label: "Concluída", cls: "bg-emerald-100 text-emerald-700" },
    CANCELLED: { label: "Cancelada", cls: "bg-rose-100 text-rose-700" },
  };
  const s = map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
