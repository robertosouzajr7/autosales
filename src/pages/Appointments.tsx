import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type AppointmentType = "Reunião" | "Demonstração" | "Consulta" | "Follow-up";
type AppointmentStatus = "Confirmado" | "Pendente" | "Cancelado";

interface Appointment {
  id: string;
  client: string;
  type: AppointmentType;
  status: AppointmentStatus;
  date: string; // YYYY-MM-DD
  startHour: number; // 8–17
  startMinute: number; // 0 or 30
  durationSlots: number; // number of 30-min slots
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<
  AppointmentType,
  { bg: string; text: string; border: string; badge: string }
> = {
  Reunião: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  Demonstração: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  Consulta: {
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-300",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
  },
  "Follow-up": {
    bg: "bg-orange-100",
    text: "text-orange-800",
    border: "border-orange-300",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
  },
};

const STATUS_STYLES: Record<
  AppointmentStatus,
  { dot: string; text: string; badge: string }
> = {
  Confirmado: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  Pendente: {
    dot: "bg-yellow-400",
    text: "text-yellow-700",
    badge: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  Cancelado: {
    dot: "bg-red-400",
    text: "text-red-700",
    badge: "bg-red-50 text-red-700 border-red-200",
  },
};

const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 8..17
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex"];

const DAYS_OF_WEEK = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

// ─── Mock Data ────────────────────────────────────────────────────────────────

function getWeekDates(referenceDate: Date) {
  const monday = startOfWeek(referenceDate, { weekStartsOn: 1 });
  return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
}

const TODAY = new Date();
const UPCOMING_APPOINTMENTS = [
  {
    id: "u1",
    client: "Ana Lima",
    initials: "AL",
    time: "10:00",
    date: "Hoje, 31/03",
    type: "Demonstração" as AppointmentType,
    status: "Confirmado" as AppointmentStatus,
  },
  {
    id: "u2",
    client: "Roberto Mendes",
    initials: "RM",
    time: "14:00",
    date: "Hoje, 31/03",
    type: "Consulta" as AppointmentType,
    status: "Pendente" as AppointmentStatus,
  },
  {
    id: "u3",
    client: "Fernanda Costa",
    initials: "FC",
    time: "11:30",
    date: "Amanhã, 01/04",
    type: "Follow-up" as AppointmentType,
    status: "Confirmado" as AppointmentStatus,
  },
  {
    id: "u4",
    client: "Marcelo Santos",
    initials: "MS",
    time: "15:00",
    date: "Amanhã, 01/04",
    type: "Reunião" as AppointmentType,
    status: "Pendente" as AppointmentStatus,
  },
  {
    id: "u5",
    client: "Juliana Ferreira",
    initials: "JF",
    time: "09:30",
    date: "Qui, 02/04",
    type: "Demonstração" as AppointmentType,
    status: "Confirmado" as AppointmentStatus,
  },
  {
    id: "u6",
    client: "Paulo Ribeiro",
    initials: "PR",
    time: "13:00",
    date: "Qui, 02/04",
    type: "Consulta" as AppointmentType,
    status: "Cancelado" as AppointmentStatus,
  },
  {
    id: "u7",
    client: "Camila Nunes",
    initials: "CN",
    time: "10:00",
    date: "Sex, 03/04",
    type: "Follow-up" as AppointmentType,
    status: "Confirmado" as AppointmentStatus,
  },
  {
    id: "u8",
    client: "Diego Alves",
    initials: "DA",
    time: "16:00",
    date: "Sex, 03/04",
    type: "Reunião" as AppointmentType,
    status: "Pendente" as AppointmentStatus,
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <span className={cn("text-2xl font-bold", accent ?? "text-slate-800")}>
        {value}
      </span>
      <span className="mt-0.5 text-xs text-slate-500">{label}</span>
    </div>
  );
}

interface CalendarGridProps {
  weekDates: Date[];
  appointments: Appointment[];
}

function CalendarGrid({ weekDates, appointments }: CalendarGridProps) {
  // Build a lookup: date string -> list of appointments
  const byDate: Record<string, Appointment[]> = {};
  for (const appt of appointments) {
    if (!byDate[appt.date]) byDate[appt.date] = [];
    byDate[appt.date].push(appt);
  }

  // Each hour has 2 sub-rows (30-min slots). Grid rows: header(1) + 10h*2=20 data rows
  // Grid cols: time(1) + 5 days = 6

  const totalSlots = HOURS.length * 2; // 20 half-hour slots (8:00–18:00)

  function slotIndex(hour: number, minute: number) {
    return (hour - 8) * 2 + (minute === 30 ? 1 : 0);
  }

  return (
    <div className="relative overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Fixed header row */}
      <div
        className="sticky top-0 z-20 grid border-b border-slate-200 bg-white"
        style={{ gridTemplateColumns: "56px repeat(5, 1fr)" }}
      >
        <div className="border-r border-slate-100 py-3" />
        {weekDates.map((date, di) => {
          const today = isToday(date);
          return (
            <div
              key={di}
              className={cn(
                "flex flex-col items-center py-3 text-center",
                di < 4 && "border-r border-slate-100"
              )}
            >
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  today ? "text-emerald-600" : "text-slate-400"
                )}
              >
                {WEEKDAYS[di]}
              </span>
              <span
                className={cn(
                  "mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
                  today
                    ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                    : "text-slate-700"
                )}
              >
                {format(date, "d")}
              </span>
            </div>
          );
        })}
      </div>

      {/* Body: time labels + day columns */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "56px repeat(5, 1fr)",
          gridTemplateRows: `repeat(${totalSlots}, 28px)`,
        }}
      >
        {/* Time labels – one per hour, spanning 2 rows */}
        {HOURS.map((hour, hi) => (
          <div
            key={hour}
            className="border-r border-slate-100 pr-2 text-right"
            style={{
              gridColumn: 1,
              gridRow: `${hi * 2 + 1} / span 2`,
            }}
          >
            <span className="relative -top-2 text-[11px] text-slate-400">
              {hour}:00
            </span>
          </div>
        ))}

        {/* Hour dividers across all day columns */}
        {HOURS.map((_, hi) => (
          <div
            key={`div-${hi}`}
            className="pointer-events-none col-start-2 col-end-[-1] border-t border-slate-100"
            style={{ gridRow: hi * 2 + 1 }}
          />
        ))}

        {/* Half-hour dividers */}
        {HOURS.map((_, hi) => (
          <div
            key={`hdiv-${hi}`}
            className="pointer-events-none col-start-2 col-end-[-1] border-t border-dashed border-slate-100"
            style={{ gridRow: hi * 2 + 2 }}
          />
        ))}

        {/* Today column highlight */}
        {weekDates.map((date, di) => {
          if (!isToday(date)) return null;
          return (
            <div
              key={`today-${di}`}
              className="pointer-events-none bg-emerald-50/60"
              style={{
                gridColumn: di + 2,
                gridRow: `1 / span ${totalSlots}`,
              }}
            />
          );
        })}

        {/* Day column right borders */}
        {weekDates.map((_, di) => (
          <div
            key={`col-border-${di}`}
            className={cn(
              "pointer-events-none",
              di < 4 && "border-r border-slate-100"
            )}
            style={{
              gridColumn: di + 2,
              gridRow: `1 / span ${totalSlots}`,
            }}
          />
        ))}

        {/* Appointments */}
        {weekDates.map((date, di) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const dayAppts = byDate[dateStr] ?? [];
          return dayAppts.map((appt) => {
            const startSlot = slotIndex(appt.startHour, appt.startMinute);
            const styles = TYPE_STYLES[appt.type];
            const timeLabel = `${appt.startHour}:${appt.startMinute === 30 ? "30" : "00"}`;
            return (
              <div
                key={appt.id}
                className={cn(
                  "relative z-10 mx-0.5 cursor-pointer overflow-hidden rounded-md border px-1.5 py-1 transition-opacity hover:opacity-90",
                  styles.bg,
                  styles.border,
                  appt.status === "Cancelado" && "opacity-50"
                )}
                style={{
                  gridColumn: di + 2,
                  gridRow: `${startSlot + 1} / span ${appt.durationSlots}`,
                }}
              >
                <p className={cn("text-[10px] font-semibold leading-tight", styles.text)}>
                  {timeLabel}
                </p>
                <p className={cn("truncate text-[11px] font-medium leading-tight", styles.text)}>
                  {appt.client}
                </p>
                {appt.durationSlots >= 3 && (
                  <p className={cn("truncate text-[10px] leading-tight opacity-70", styles.text)}>
                    {appt.type}
                  </p>
                )}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}

function UpcomingList() {
  const [statuses, setStatuses] = useState<Record<string, AppointmentStatus>>(
    Object.fromEntries(UPCOMING_APPOINTMENTS.map((a) => [a.id, a.status]))
  );

  function confirm(id: string) {
    setStatuses((prev) => ({ ...prev, [id]: "Confirmado" }));
  }
  function cancel(id: string) {
    setStatuses((prev) => ({ ...prev, [id]: "Cancelado" }));
  }

  return (
    <div className="flex flex-col gap-2">
      {UPCOMING_APPOINTMENTS.map((appt) => {
        const status = statuses[appt.id];
        const typeStyles = TYPE_STYLES[appt.type];
        const statusStyles = STATUS_STYLES[status];
        return (
          <div
            key={appt.id}
            className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 transition-colors hover:bg-slate-100/60"
          >
            {/* Avatar */}
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-slate-200 text-xs font-semibold text-slate-600">
                {appt.initials}
              </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-800">
                  {appt.client}
                </span>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 text-[10px]", typeStyles.badge)}
                >
                  {appt.type}
                </Badge>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                <span>{appt.time}</span>
                <span className="text-slate-300">·</span>
                <span>{appt.date}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    statusStyles.badge
                  )}
                >
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", statusStyles.dot)}
                  />
                  {status}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => confirm(appt.id)}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-emerald-100 hover:text-emerald-600"
                title="Confirmar"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-blue-100 hover:text-blue-600"
                title="Reagendar"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => cancel(appt.id)}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600"
                title="Cancelar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AvailabilitySettings() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<Record<string, boolean>>({
    seg: true,
    ter: true,
    qua: true,
    qui: true,
    sex: true,
    sab: false,
    dom: false,
  });
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");

  function toggleDay(key: string) {
    setDays((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <button
        className="flex w-full items-center justify-between px-6 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">
            Configurações de Disponibilidade
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {open && (
        <CardContent className="grid gap-6 border-t border-slate-100 pt-5 pb-6 md:grid-cols-2">
          {/* Days of week */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Dias da Semana
            </p>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleDay(key)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    days[key]
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Working hours */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Horário de Trabalho
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="mb-1 block text-xs text-slate-500">Início</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["07:00", "08:00", "09:00", "10:00"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="mt-5 text-slate-400">–</span>
              <div className="flex-1">
                <Label className="mb-1 block text-xs text-slate-500">Fim</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["17:00", "18:00", "19:00", "20:00"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Break time */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Horário de Intervalo
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="mb-1 block text-xs text-slate-500">Início</Label>
                <Select defaultValue="12:00">
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["11:30", "12:00", "12:30", "13:00"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="mt-5 text-slate-400">–</span>
              <div className="flex-1">
                <Label className="mb-1 block text-xs text-slate-500">Fim</Label>
                <Select defaultValue="13:00">
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["12:30", "13:00", "13:30", "14:00"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Buffer between appointments */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Buffer entre Agendamentos
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <Label className="text-sm text-slate-700">
                  Ativar buffer automático
                </Label>
                <Switch defaultChecked />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-slate-500">
                  Duração do buffer
                </Label>
                <Select defaultValue="15">
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 minutos</SelectItem>
                    <SelectItem value="10">10 minutos</SelectItem>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="md:col-span-2">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Appointments() {
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(TODAY, { weekStartsOn: 1 })
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    fetch("/api/calendar/events").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setAppointments(data);
    });
  }, []);

  const weekDates = Array.from({ length: 5 }, (_, i) =>
    addDays(currentWeekStart, i)
  );

  function prevWeek() {
    setCurrentWeekStart((d) => addDays(d, -7));
  }
  function nextWeek() {
    setCurrentWeekStart((d) => addDays(d, 7));
  }
  function goToday() {
    setCurrentWeekStart(startOfWeek(TODAY, { weekStartsOn: 1 }));
  }

  const weekLabel = `${format(weekDates[0], "d MMM", { locale: ptBR })} – ${format(
    weekDates[4],
    "d MMM yyyy",
    { locale: ptBR }
  )}`;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Agendamentos
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Gerencie seus compromissos e disponibilidade
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Stats */}
            <StatCard label="Hoje" value="12" accent="text-slate-800" />
            <StatCard label="Esta Semana" value="38" accent="text-slate-800" />
            <StatCard label="Confirmados" value="5" accent="text-emerald-600" />
            <StatCard label="Pendentes" value="3" accent="text-yellow-500" />

            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Agendamento
            </Button>
          </div>
        </div>

        {/* ── Main layout: Calendar + Side panel ── */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          {/* Calendar area */}
          <div className="min-w-0 flex-1 space-y-3">
            {/* Week navigation */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevWeek}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={nextWeek}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="ml-1 text-sm font-semibold capitalize text-slate-800">
                  {weekLabel}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goToday}
                className="h-7 text-xs"
              >
                Hoje
              </Button>
            </div>

            {/* Calendar grid */}
            <CalendarGrid weekDates={weekDates} appointments={appointments} />
          </div>

          {/* Side panel */}
          <div className="w-full xl:w-80 xl:shrink-0">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  Próximos Agendamentos
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-4">
                <UpcomingList />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Availability settings ── */}
        <AvailabilitySettings />
      </div>
    </DashboardLayout>
  );
}
