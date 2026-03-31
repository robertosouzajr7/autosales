import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar, Plus, ChevronLeft, ChevronRight, X, RefreshCw,
  Pencil, Trash2, Eye, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────

interface Lead { id: string; name: string; phone: string; }

interface Appointment {
  id: string;
  title: string;
  status: string;
  date: string; // ISO
  notes?: string;
  lead: Lead;
  leadId: string;
}

// ─── Constants ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string; icon: React.ElementType }> = {
  SCHEDULED: { label: "Agendado",   badge: "bg-blue-50 text-blue-700 border-blue-200",   dot: "bg-blue-400",   icon: Clock },
  COMPLETED: { label: "Concluído",  badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", icon: CheckCircle2 },
  CANCELED:  { label: "Cancelado",  badge: "bg-red-50 text-red-700 border-red-200",       dot: "bg-red-400",    icon: AlertCircle },
};

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8..18

function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

// ─── Appointment Form Dialog ──────────────────────────────────

function AppointmentDialog({
  open, onClose, initial, leads, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Appointment | null;
  leads: Lead[];
  onSaved: (a: Appointment) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const now = new Date(); now.setMinutes(0, 0, 0); now.setHours(now.getHours() + 1);
  const [form, setForm] = useState({
    title: "", leadId: "", clientName: "", clientPhone: "",
    date: formatDateLocal(now), status: "SCHEDULED", notes: "",
    newContact: false,
  });

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title || "", leadId: initial.leadId || "",
        clientName: "", clientPhone: "",
        date: formatDateLocal(new Date(initial.date)), status: initial.status || "SCHEDULED",
        notes: initial.notes || "", newContact: false,
      });
    } else {
      const n = new Date(); n.setMinutes(0, 0, 0); n.setHours(n.getHours() + 1);
      setForm({ title: "", leadId: "", clientName: "", clientPhone: "", date: formatDateLocal(n), status: "SCHEDULED", notes: "", newContact: false });
    }
  }, [initial, open]);

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.title || !form.date) return toast({ title: "Título e data são obrigatórios.", variant: "destructive" });
    if (!form.leadId && !form.newContact) return toast({ title: "Selecione um contato ou crie um novo.", variant: "destructive" });
    if (form.newContact && (!form.clientName || !form.clientPhone)) return toast({ title: "Nome e telefone do novo contato são obrigatórios.", variant: "destructive" });

    setSaving(true);
    try {
      const body: Record<string, string> = {
        title: form.title, date: new Date(form.date).toISOString(), status: form.status, notes: form.notes,
      };
      if (form.newContact) {
        body.clientName = form.clientName;
        body.clientPhone = form.clientPhone;
      } else {
        body.leadId = form.leadId;
      }

      const url = initial ? `/api/appointments/${initial.id}` : "/api/appointments";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Erro ao salvar");
      const saved = await res.json();
      onSaved(saved);
      toast({ title: initial ? "Agendamento atualizado!" : "Agendamento criado com sucesso!" });
      onClose();
    } catch (e) { toast({ title: "Erro ao salvar agendamento", variant: "destructive" }); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1">
            <Label>Título / Tipo de reunião *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Ex: Demonstração, Consulta, Reunião de Vendas..." />
          </div>

          <div className="space-y-1">
            <Label>Data e Hora *</Label>
            <Input type="datetime-local" value={form.date} onChange={e => set("date", e.target.value)} />
          </div>

          {!initial && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label>Contato existente</Label>
                <button
                  type="button"
                  onClick={() => set("newContact", !form.newContact)}
                  className="text-xs text-emerald-600 underline"
                >
                  {form.newContact ? "← Escolher existente" : "Criar novo contato"}
                </button>
              </div>
              {form.newContact ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input value={form.clientName} onChange={e => set("clientName", e.target.value)} placeholder="Nome do cliente" />
                  <Input value={form.clientPhone} onChange={e => set("clientPhone", e.target.value)} placeholder="Telefone WhatsApp" />
                </div>
              ) : (
                <Select value={form.leadId} onValueChange={v => set("leadId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar contato..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name} — {l.phone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Contexto desta reunião, pontos a discutir..."
              className="h-24 resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <RefreshCw className="h-4 w-4 animate-spin mr-1" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Appointment Detail Dialog ────────────────────────────────

function AppointmentDetail({
  appt, onClose, onEdit, onDelete,
}: {
  appt: Appointment | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!appt) return null;
  const cfg = STATUS_CONFIG[appt.status];
  const Icon = cfg?.icon ?? Clock;
  const dt = new Date(appt.date);

  return (
    <Dialog open={!!appt} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-slate-500" />
            {appt.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Status</span>
            <Badge className={`border text-xs ${cfg?.badge}`}>{cfg?.label}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Data / Hora</span>
            <span className="font-medium text-slate-800">
              {dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })} às {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Cliente</span>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px] bg-emerald-100 text-emerald-700">{appt.lead?.name?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <span className="font-medium text-slate-800">{appt.lead?.name}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Contato</span>
            <span className="text-slate-700">{appt.lead?.phone}</span>
          </div>
          {appt.notes && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 mt-2">
              {appt.notes}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onDelete} className="text-red-600 border-red-200 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5 mr-1" />Excluir
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          <Button size="sm" onClick={onEdit} className="bg-emerald-600 hover:bg-emerald-700">
            <Pencil className="h-3.5 w-3.5 mr-1" />Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Calendar Grid ────────────────────────────────────────────

function WeeklyCalendar({
  week, appointments, onSlotClick, onApptClick,
}: {
  week: Date[];
  appointments: Appointment[];
  onSlotClick: (date: Date, hour: number) => void;
  onApptClick: (a: Appointment) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] grid" style={{ gridTemplateColumns: `64px repeat(${week.length}, 1fr)` }}>
        {/* Header row */}
        <div className="h-12 border-b border-slate-200 bg-slate-50" />
        {week.map(day => (
          <div
            key={day.toISOString()}
            className={cn(
              "h-12 flex flex-col items-center justify-center border-b border-l border-slate-200 bg-slate-50",
              isToday(day) && "bg-emerald-50"
            )}
          >
            <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-wide">
              {format(day, "EEE", { locale: ptBR })}
            </p>
            <p className={cn("text-sm font-bold", isToday(day) ? "text-emerald-600" : "text-slate-700")}>
              {format(day, "d")}
            </p>
          </div>
        ))}

        {/* Hour rows */}
        {HOURS.map(hour => (
          <>
            <div key={`h-${hour}`} className="h-16 border-b border-slate-100 flex items-start justify-end pr-2 pt-1">
              <span className="text-[10px] text-slate-400">{hour}:00</span>
            </div>
            {week.map(day => {
              const dayStr = format(day, "yyyy-MM-dd");
              const slotAppts = appointments.filter(a => {
                const d = new Date(a.date);
                return format(d, "yyyy-MM-dd") === dayStr && d.getHours() === hour;
              });
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className={cn(
                    "h-16 border-b border-l border-slate-100 relative cursor-pointer group",
                    isToday(day) && "bg-emerald-50/30",
                    "hover:bg-slate-50"
                  )}
                  onClick={() => onSlotClick(day, hour)}
                >
                  {slotAppts.map(a => {
                    const cfg = STATUS_CONFIG[a.status];
                    return (
                      <div
                        key={a.id}
                        onClick={e => { e.stopPropagation(); onApptClick(a); }}
                        className={cn(
                          "absolute inset-x-1 top-1 rounded-md px-2 py-1 text-[10px] font-semibold truncate cursor-pointer z-10",
                          "border shadow-sm hover:shadow-md transition-shadow",
                          cfg?.badge
                        )}
                        title={`${a.title} — ${a.lead?.name}`}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg?.dot} mr-1`} />
                        {a.title} · {a.lead?.name}
                      </div>
                    );
                  })}
                  <div className="absolute inset-0 hidden group-hover:flex items-center justify-center">
                    <Plus className="h-4 w-4 text-slate-300" />
                  </div>
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function Appointments() {
  const { toast } = useToast();
  const [view, setView] = useState<"week" | "list">("week");
  const [weekRef, setWeekRef] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [prefillDate, setPrefillDate] = useState<Date | null>(null);

  const week = Array.from({ length: 5 }, (_, i) => addDays(startOfWeek(weekRef, { weekStartsOn: 1 }), i));

  const load = async () => {
    setLoading(true);
    try {
      const [apptRes, leadRes] = await Promise.all([
        fetch("/api/appointments"),
        fetch("/api/leads"),
      ]);
      const appts = await apptRes.json();
      const leds = await leadRes.json();
      if (Array.isArray(appts)) setAppointments(appts);
      if (Array.isArray(leds)) setLeads(leds);
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = (date?: Date, hour?: number) => {
    setEditAppt(null);
    if (date && hour !== undefined) {
      const d = new Date(date);
      d.setHours(hour, 0, 0, 0);
      setPrefillDate(d);
    } else { setPrefillDate(null); }
    setDialogOpen(true);
  };

  const openEdit = (a: Appointment) => {
    setEditAppt(a);
    setDetailAppt(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este agendamento?")) return;
    try {
      await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      setAppointments(p => p.filter(a => a.id !== id));
      setDetailAppt(null);
      toast({ title: "Agendamento excluído." });
    } catch { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const onSaved = (a: Appointment) => {
    setAppointments(p => {
      const idx = p.findIndex(x => x.id === a.id);
      if (idx >= 0) { const n = [...p]; n[idx] = a; return n; }
      return [...p, a];
    });
  };

  const counts = {
    total: appointments.length,
    scheduled: appointments.filter(a => a.status === "SCHEDULED").length,
    completed: appointments.filter(a => a.status === "COMPLETED").length,
    canceled: appointments.filter(a => a.status === "CANCELED").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-20">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Agendamentos</h1>
            <p className="text-sm text-slate-500 mt-0.5">Gerencie todos os encontros, reuniões e compromissos.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden">
              <button onClick={() => setView("week")} className={cn("px-3 py-1.5 text-xs font-medium", view === "week" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50")}>
                Semana
              </button>
              <button onClick={() => setView("list")} className={cn("px-3 py-1.5 text-xs font-medium", view === "list" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50")}>
                Lista
              </button>
            </div>
            <Button onClick={() => openNew()} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" size="sm">
              <Plus className="h-3.5 w-3.5" /> Novo Agendamento
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: counts.total, color: "text-slate-700 bg-slate-50 border-slate-200" },
            { label: "Agendados", value: counts.scheduled, color: "text-blue-700 bg-blue-50 border-blue-200" },
            { label: "Concluídos", value: counts.completed, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
            { label: "Cancelados", value: counts.canceled, color: "text-red-700 bg-red-50 border-red-200" },
          ].map(s => (
            <Card key={s.label} className={`border ${s.color}`}>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs font-medium mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {view === "week" ? (
          <Card className="border border-slate-200 shadow-sm overflow-hidden">
            {/* Week nav */}
            <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700">
                {format(week[0], "d MMM", { locale: ptBR })} – {format(week[4], "d MMM yyyy", { locale: ptBR })}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekRef(d => addDays(d, -7))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setWeekRef(new Date())}>Hoje</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekRef(d => addDays(d, 7))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-64 text-slate-400 text-sm animate-pulse">Carregando agendamentos...</div>
              ) : (
                <WeeklyCalendar
                  week={week}
                  appointments={appointments}
                  onSlotClick={(date, hour) => openNew(date, hour)}
                  onApptClick={a => setDetailAppt(a)}
                />
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-sm animate-pulse">Carregando...</div>
              ) : appointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <Calendar className="h-8 w-8" />
                  <p className="font-medium">Nenhum agendamento encontrado</p>
                  <Button size="sm" onClick={() => openNew()} className="mt-1 bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-3.5 w-3.5 mr-1" />Criar agendamento
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {[...appointments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(a => {
                    const cfg = STATUS_CONFIG[a.status];
                    const Icon = cfg?.icon ?? Clock;
                    const dt = new Date(a.date);
                    return (
                      <div key={a.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                        {/* Date block */}
                        <div className="flex w-14 flex-col items-center rounded-lg border border-slate-200 bg-white py-1 shrink-0 shadow-sm">
                          <span className="text-[10px] font-semibold uppercase text-slate-400">
                            {format(dt, "MMM", { locale: ptBR })}
                          </span>
                          <span className="text-lg font-bold text-slate-800 leading-tight">{format(dt, "d")}</span>
                          <span className="text-[10px] text-slate-400">{format(dt, "HH:mm")}</span>
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800 truncate">{a.title}</p>
                            <Badge className={`text-[10px] border shrink-0 ${cfg?.badge}`}>{cfg?.label}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px] bg-emerald-100 text-emerald-700">{a.lead?.name?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                            <p className="text-xs text-slate-500 truncate">{a.lead?.name} · {a.lead?.phone}</p>
                          </div>
                          {a.notes && <p className="text-xs text-slate-400 truncate mt-0.5 italic">{a.notes}</p>}
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => setDetailAppt(a)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-emerald-600" onClick={() => openEdit(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDelete(a.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AppointmentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editAppt}
        leads={leads}
        onSaved={onSaved}
      />
      <AppointmentDetail
        appt={detailAppt}
        onClose={() => setDetailAppt(null)}
        onEdit={() => openEdit(detailAppt!)}
        onDelete={() => handleDelete(detailAppt!.id)}
      />
    </DashboardLayout>
  );
}
