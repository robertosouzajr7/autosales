import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  MessageSquare,
  Calendar,
  TrendingUp,
  Plus,
  CalendarPlus,
  UserPlus,
  Clock,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// --- Mock data ---

const leadsPerDay = [
  { dia: "Seg", leads: 28 },
  { dia: "Ter", leads: 42 },
  { dia: "Qua", leads: 35 },
  { dia: "Qui", leads: 58 },
  { dia: "Sex", leads: 47 },
  { dia: "Sáb", leads: 21 },
  { dia: "Dom", leads: 14 },
];

const conversionsByChannel = [
  { canal: "WhatsApp", conversoes: 87 },
  { canal: "Instagram", conversoes: 43 },
  { canal: "Facebook", conversoes: 31 },
  { canal: "Site", conversoes: 56 },
  { canal: "Indicação", conversoes: 22 },
];

// --- Helpers ---

const statusConfig: Record<string, string> = {
  Ativo: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Aguardando: "bg-amber-100 text-amber-700 border-amber-200",
  Convertido: "bg-blue-100 text-blue-700 border-blue-200",
};

const appointmentTypeConfig: Record<string, string> = {
  Demo: "bg-purple-100 text-purple-700 border-purple-200",
  Reunião: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Consulta: "bg-sky-100 text-sky-700 border-sky-200",
};

function formatTodayDate(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Capitalise the first letter (toLocaleDateString returns lowercase weekday in pt-BR)
function capitalise(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// --- Stat card ---

interface StatCardProps {
  title: string;
  value: string;
  delta: string;
  deltaPositive?: boolean;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

function StatCard({
  title,
  value,
  delta,
  deltaPositive = true,
  icon: Icon,
  iconColor,
  iconBg,
}: StatCardProps) {
  return (
    <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
            <p
              className={`mt-1 text-xs font-medium ${
                deltaPositive ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {delta}
            </p>
          </div>
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Page ---

interface RecentConversation {
  id: number | string;
  name: string;
  initials: string;
  lastMessage: string;
  time: string;
  status: string;
}

interface CalendarEvent {
  id: string;
  date: string;
  startHour: number;
  startMinute: number;
  client: string;
  type: string;
}

export default function Dashboard() {
  const todayLabel = capitalise(formatTodayDate());
  const [data, setData] = useState({
    stats: { totalLeads: 0, activeBots: 0, agendamentosHoje: 0, taxa: 0, convertidos: 0 },
    recentConversations: [] as RecentConversation[]
  });
  const [appointments, setAppointments] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    fetch("/api/dashboard").then(r => r.json()).then(res => {
        if (res.stats) setData(res);
    });
    fetch("/api/calendar/events").then(r => r.json()).then(res => {
        if (Array.isArray(res)) setAppointments(res);
    });
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Welcome header */}
        <div className="flex flex-col gap-0.5">
          <h2 className="text-2xl font-bold text-slate-900">Bem-vindo de volta!</h2>
          <p className="text-sm text-slate-500">{todayLabel}</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total de Leads"
            value={data.stats.totalLeads.toString()}
            delta="+ Dinâmico"
            deltaPositive
            icon={Users}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />
          <StatCard
            title="SDR IA Operando"
            value={data.stats.activeBots.toString()}
            delta="Bots Automáticos"
            deltaPositive
            icon={MessageSquare}
            iconBg="bg-sky-50"
            iconColor="text-sky-600"
          />
          <StatCard
            title="Agendamentos Recentes"
            value={data.stats.agendamentosHoje.toString()}
            delta="Atualizado via Funil"
            deltaPositive
            icon={Calendar}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
          />
          <StatCard
            title="Taxa de Conversão Real"
            value={`${data.stats.taxa}%`}
            delta={`${data.stats.convertidos} convertidos`}
            deltaPositive
            icon={TrendingUp}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Line chart */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800">
                Leads por Dia
              </CardTitle>
              <p className="text-xs text-slate-500">Últimos 7 dias</p>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={leadsPerDay} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#475569", fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="leads"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#10b981" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bar chart */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800">
                Conversões por Canal
              </CardTitle>
              <p className="text-xs text-slate-500">Acumulado do mês</p>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={conversionsByChannel} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="canal"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#475569", fontWeight: 600 }}
                    cursor={{ fill: "#f1f5f9" }}
                  />
                  <Bar
                    dataKey="conversoes"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Bottom row: conversations + appointments + quick actions */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Recent conversations */}
          <Card className="border border-slate-200 shadow-sm lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-800">
                  Conversas Recentes
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {data.recentConversations.length} novas
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {data.recentConversations.length > 0 ? data.recentConversations.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50 cursor-pointer"
                  onClick={() => window.location.href='/conversations'}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      {conv.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {conv.name}
                      </p>
                      <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {conv.time}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {conv.lastMessage}
                    </p>
                    <Badge
                      className={`mt-1.5 border text-[10px] px-1.5 py-0 leading-4 ${statusConfig[conv.status] || ''}`}
                    >
                      {conv.status}
                    </Badge>
                  </div>
                </div>
              )) : (
                 <p className="text-xs text-slate-400 py-4 text-center">Nenhuma conversa recente registrada.</p>
              )}
            </CardContent>
          </Card>

          {/* Upcoming appointments */}
          <Card className="border border-slate-200 shadow-sm lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-800">
                  Agendamentos no Calendar
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {appointments.length} eventos (30d)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 h-64 overflow-y-auto">
              {appointments.length > 0 ? appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100 cursor-pointer"
                >
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-white border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-700 leading-tight">
                      {appt.date.split("-")[2]}/{appt.date.split("-")[1]}
                    </span>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      {appt.startHour}:{appt.startMinute === 0 ? "00" : appt.startMinute}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate" title={appt.client}>
                      {appt.client}
                    </p>
                    <Badge
                      className={`mt-0.5 border text-[10px] px-1.5 py-0 leading-4 bg-emerald-100 text-emerald-700`}
                    >
                      Reunião Google
                    </Badge>
                  </div>
                </div>
              )) : (
                 <div className="flex flex-col items-center justify-center py-6">
                    <p className="text-xs text-slate-400 py-4 text-center">Não há eventos futuros<br/>ou Google Calendar desconectado.</p>
                    <Button onClick={() => window.location.href='/settings'} variant="outline" size="sm" className="mt-2 text-xs">Conectar Agenda</Button>
                 </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card className="border border-slate-200 shadow-sm lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-800">
                Ações Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <Button onClick={() => window.location.href='/crm'} className="w-full justify-start gap-3 bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-200">
                <Plus className="h-4 w-4 shrink-0" />
                Acessar Novo Lead (Kanban)
              </Button>
              <Button onClick={() => window.location.href='/appointments'}
                variant="outline"
                className="w-full justify-start gap-3 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              >
                <CalendarPlus className="h-4 w-4 shrink-0 text-violet-600" />
                Abrir Full Calendar
              </Button>
              <Button onClick={() => window.location.href='/conversations'}
                variant="outline"
                className="w-full justify-start gap-3 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-sky-600" />
                Assumir Conversa do Bot
              </Button>

              {/* Summary mini-stats */}
              <div className="mt-4 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                  Resumo Diário Real
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-2xl font-bold">{data.stats.totalLeads}</p>
                    <p className="text-xs opacity-80">Leads mapeados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data.stats.convertidos}</p>
                    <p className="text-xs opacity-80">Finalizados</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </DashboardLayout>
  );
}
