import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, Target, Calendar, MessageSquare, TrendingUp, 
  ArrowUpRight, ArrowDownRight, Bot, Zap, Clock,
  MoreHorizontal, ChevronRight, BarChart3, PieChart as PieChartIcon,
  ShieldCheck, CheckCircle2, AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    qualifiedLeads: 0,
    appointments: 0,
    messagesSent: 0
  });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, aRes] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/appointments")
      ]);
      
      const leads = lRes.ok ? await lRes.json() : [];
      const appts = aRes.ok ? await aRes.json() : [];
      
      const leadsArr = Array.isArray(leads) ? leads : [];
      const apptsArr = Array.isArray(appts) ? appts : [];

      setStats({
        totalLeads: leadsArr.length,
        qualifiedLeads: leadsArr.filter((l: any) => l.status === 'QUALIFIED').length,
        appointments: apptsArr.length,
        messagesSent: leadsArr.length * 4.2 
      });
      setRecentLeads(leadsArr.slice(0, 5));
    } catch (e) {
      console.error("Dashboard fetch error:", e);
      toast({ title: "Erro ao atualizar Dashboard", description: "Verifique sua conexão com o servidor.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const chartData = [
    { name: 'Seg', leads: 12, res: 8 },
    { name: 'Ter', leads: 45, res: 32 },
    { name: 'Qua', leads: 38, res: 28 },
    { name: 'Qui', leads: 65, res: 48 },
    { name: 'Sex', leads: 48, res: 35 },
    { name: 'Sáb', leads: 15, res: 10 },
    { name: 'Dom', leads: 8, res: 5 },
  ];

  const funnelData = [
    { name: 'Captados', value: 100, color: '#10b981' },
    { name: 'Qualificados', value: 65, color: '#34d399' },
    { name: 'Agendados', value: 32, color: '#6ee7b7' },
    { name: 'Vendas', value: 12, color: '#059669' },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="space-y-1">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
                 Bem-vindo, <span className="text-emerald-500 italic">Master</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Visão Geral de performance Comercial IA</p>
           </div>
           <div className="flex gap-3">
              <Button onClick={fetchData} variant="outline" className="h-11 rounded-xl border-2 font-bold text-xs uppercase tracking-widest hover:bg-slate-50">
                <Clock className="w-4 h-4 mr-2" /> {loading ? "Carregando..." : "Atualizar"}
              </Button>
              <Button className="h-11 bg-slate-900 hover:bg-slate-800 rounded-xl px-6 font-black text-xs uppercase tracking-widest shadow-xl">
                 Exportar Relatório
              </Button>
           </div>
        </div>

        {/* TOP CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <KpiCard 
              label="Leads Totais" 
              value={loading ? "..." : stats.totalLeads} 
              trend="+12%" 
              up={true}
              icon={<Users className="text-blue-500" />} 
           />
           <KpiCard 
              label="Qualificados pela IA" 
              value={loading ? "..." : stats.qualifiedLeads} 
              trend="+8.4%" 
              up={true}
              icon={<Bot className="text-emerald-500" />} 
           />
           <KpiCard 
              label="Reuniões Marcadas" 
              value={loading ? "..." : stats.appointments} 
              trend="-2%" 
              up={false}
              icon={<Calendar className="text-purple-500" />} 
           />
           <KpiCard 
              label="Taxa de Conversão" 
              value={loading ? "..." : `${((stats.qualifiedLeads / (stats.totalLeads || 1)) * 100).toFixed(1)}%`} 
              trend="+5%" 
              up={true}
              icon={<TrendingUp className="text-orange-500" />} 
           />
        </div>

        {/* GRÁFICOS E FUNIL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <Card className="lg:col-span-2 border-none shadow-2xl rounded-[40px] bg-white overflow-hidden p-8">
              <div className="flex items-center justify-between mb-8">
                 <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Atividade Semanal</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prospectos contatados vs Respostas recebidas</p>
                 </div>
                 <div className="flex gap-2">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold text-slate-400 uppercase">Leads</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-100" /><span className="text-[10px] font-bold text-slate-400 uppercase">Respostas</span></div>
                 </div>
              </div>
              <div className="h-[350px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                       <defs>
                          <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                             <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                       <YAxis hide />
                       <Tooltip 
                          contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px'}}
                          itemStyle={{fontSize: '12px', fontWeight: 'bold'}}
                       />
                       <Area type="monotone" dataKey="leads" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorLeads)" />
                       <Area type="monotone" dataKey="res" stroke="#d1fae5" strokeWidth={4} fill="transparent" />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </Card>

           <Card className="border-none shadow-2xl rounded-[40px] bg-slate-900 text-white p-8">
              <CardHeader className="p-0 mb-10 space-y-2">
                 <h3 className="text-xl font-black tracking-tight flex items-center gap-3"><BarChart3 className="w-6 h-6 text-emerald-500" /> Funil de Conversão</h3>
                 <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Efetividade do Processo Comercial</p>
              </CardHeader>
              <div className="space-y-6">
                 {funnelData.map((item) => (
                    <div key={item.name} className="space-y-2">
                       <div className="flex justify-between items-center text-xs font-bold px-1">
                          <span className="text-white/40 uppercase tracking-widest">{item.name}</span>
                          <span className="font-black text-white">{item.value}%</span>
                       </div>
                       <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                          <div 
                             className="h-full rounded-full transition-all duration-1000 ease-out" 
                             style={{width: `${item.value}%`, backgroundColor: item.color}} 
                          />
                       </div>
                    </div>
                 ))}
                 <div className="mt-10 p-6 bg-white/5 rounded-3xl border border-white/5 text-center">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">ROI Mensal Estimado</p>
                    <p className="text-2xl font-black text-white italic tracking-tighter">R$ 45.280,00</p>
                 </div>
              </div>
           </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <Card className="border-none shadow-2xl rounded-[40px] bg-white overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                 <h3 className="text-xl font-black text-slate-800">Atividade dos SDRs</h3>
                 <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold uppercase text-[9px]">Ao Vivo</Badge>
              </div>
              <div className="p-4 space-y-2">
                 {recentLeads.map((lead: any) => (
                    <div key={lead.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-3xl transition-colors group">
                       <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                          {lead.name?.substring(0,2).toUpperCase() || "L"}
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-800 truncate">{lead.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Conversando via WhatsApp · {lead.source || "Direto"}</p>
                       </div>
                       <div className="text-right flex flex-col items-end gap-1">
                          <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-400 border-slate-200">{lead.status || "Novo"}</Badge>
                          <span className="text-[9px] font-bold text-slate-300">Há pouco</span>
                       </div>
                    </div>
                 ))}
                 {recentLeads.length === 0 && (
                   <div className="py-12 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">Sem Interações Recentes</div>
                 )}
              </div>
           </Card>

           <Card className="border-none shadow-2xl rounded-[40px] bg-emerald-500 text-white p-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="relative z-10 space-y-10">
                 <div className="space-y-4">
                    <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center">
                       <Zap className="w-8 h-8 text-white animate-pulse" />
                    </div>
                    <div className="space-y-1">
                       <h3 className="text-2xl font-black tracking-tighter uppercase italic">Insights de <br/>Performance IA</h3>
                    </div>
                 </div>
                 
                 <div className="space-y-4">
                    <InsightRow icon={<CheckCircle2 className="w-4 h-4" />} text="O SDR 'João IA' está com 85% de taxa de conversão." />
                    <InsightRow icon={<AlertCircle className="w-4 h-4 text-emerald-200" />} text="Aviso: O Nicho 'Imobiliárias' está respondendo melhor às 14h." />
                    <InsightRow icon={<TrendingUp className="w-4 h-4" />} text="Projeção: Você deve fechar 12 novos contratos este mês." />
                 </div>

                 <Button className="w-full h-14 bg-white text-emerald-600 hover:bg-emerald-50 font-black rounded-2xl uppercase tracking-widest transition-all">Ver Análise Completa</Button>
              </div>
           </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function KpiCard({ label, value, trend, up, icon }: { label: string, value: any, trend: string, up: boolean, icon: any }) {
  return (
    <Card className="border-none shadow-xl rounded-[35px] bg-white p-8 hover:translate-y-[-5px] transition-all duration-300">
       <div className="flex justify-between items-start mb-6">
          <div className="p-4 bg-slate-50 rounded-2xl">{icon}</div>
          <div className={`flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
             {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
             {trend}
          </div>
       </div>
       <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter italic">{value}</p>
       </div>
    </Card>
  );
}

function InsightRow({ icon, text }: { icon: any, text: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/10 text-xs font-bold tracking-tight">
       <div className="p-1 bg-white/10 rounded-lg">{icon}</div>
       <span>{text}</span>
    </div>
  );
}
