import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarCheck, Target, Bot } from "lucide-react";

export default function Analytics() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    scheduled: 0,
    converted: 0,
    activeBots: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then(r => r.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Performance do SDR</h1>
          <p className="text-slate-500">Métricas em tempo real da sua operação e conversão da Inteligência Artificial.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-xl"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total de Leads Tratados</CardTitle>
                <Users className="w-5 h-5 text-blue-500 opacity-80" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-800">{stats.totalLeads}</div>
                <p className="text-xs text-slate-500 mt-1">Acumulado histórico</p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-indigo-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Atendimentos Autônomos (IA)</CardTitle>
                <Bot className="w-5 h-5 text-indigo-500 opacity-80" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-800">{stats.activeBots}</div>
                <p className="text-xs text-slate-500 mt-1">Bots pilotando sem humanos</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Reuniões Agendadas pela IA</CardTitle>
                <CalendarCheck className="w-5 h-5 text-amber-500 opacity-80" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-800">{stats.scheduled}</div>
                <p className="text-xs text-slate-500 mt-1">Conduzidos status APPOINTMENT</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Vendas Fechadas (Conversão)</CardTitle>
                <Target className="w-5 h-5 text-green-500 opacity-80" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-800">{stats.converted}</div>
                <p className="text-xs text-slate-500 mt-1">Taxa de sucesso final</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
           <Card className="h-80 flex items-center justify-center border-dashed">
              <p className="text-sm text-slate-400 font-medium">Gráfico de Retenção e Engajamento (Em Breve)</p>
           </Card>
           <Card className="h-80 flex items-center justify-center border-dashed">
              <p className="text-sm text-slate-400 font-medium">Ranking de Objeções da IA (Em Breve)</p>
           </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
