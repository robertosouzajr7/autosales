import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, Target, Calendar, MessageSquare, TrendingUp, 
  ArrowUpRight, ArrowDownRight, Bot, Zap, Clock,
  MoreHorizontal, ChevronRight, BarChart3, PieChart as PieChartIcon,
  ShieldCheck, CheckCircle2, AlertCircle, Phone, Search, Mail
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';

interface DashboardStats {
  totalLeads: number;
  qualifiedLeads: number;
  appointments: number;
  completedAppointments: number;
  showRate: number;
  activeSdrs: number;
  conversionRate: number;
  emailsSent: number;
  whatsappFollowups: number;
  funnel: { label: string; value: number }[];
  usedTokens: number;
  maxTokens: number;
  maxSdrs: number;
  planName: string;
  qualifiedLeadsCount: number;
  trends: { leads: number; qualified: number; appointments: number; conversion: number };
  openOpportunities: number;
}

interface SimpleLead {
  id: string;
  name: string;
  status: string;
  source: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    qualifiedLeads: 0,
    appointments: 0,
    completedAppointments: 0,
    showRate: 0,
    activeSdrs: 0,
    conversionRate: 0,
    emailsSent: 0,
    whatsappFollowups: 0,
    funnel: [],
    usedTokens: 0,
    maxTokens: 0,
    maxSdrs: 0,
    planName: "...",
    qualifiedLeadsCount: 0,
    trends: { leads: 0, qualified: 0, appointments: 0, conversion: 0 },
    openOpportunities: 0
  });
  const [recentLeads, setRecentLeads] = useState<SimpleLead[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const statsRes = await fetch("/api/stats/dashboard", { headers });
      const statsData = await statsRes.json();
      
      const lRes = await fetch("/api/leads", { headers });
      const leadsArr = await lRes.json();
      
      const fData = (statsData.funnelData || []) as { name: string, value: number }[];
      
      setStats({
        totalLeads: statsData.stats.totalLeads || 0,
        qualifiedLeads: statsData.stats.qualifiedLeadsCount || 0,
        appointments: statsData.stats.appointments || 0,
        completedAppointments: statsData.stats.completedAppointments || 0,
        showRate: statsData.stats.showRate || 0,
        activeSdrs: statsData.stats.activeSdrs || 0,
        conversionRate: statsData.stats.conversionRate || 0,
        emailsSent: statsData.stats.emailsSent || 0,
        whatsappFollowups: statsData.stats.whatsappFollowups || 0,
        funnel: fData.map((f) => ({ label: f.name, value: f.value })),
        usedTokens: statsData.stats.usedTokens || 0,
        maxTokens: statsData.stats.maxTokens || 0,
        maxSdrs: statsData.stats.maxSdrs || 0,
        planName: statsData.stats.planName || "Básico",
        qualifiedLeadsCount: statsData.stats.qualifiedLeadsCount || 0,
        trends: statsData.stats.trends || { leads: 0, qualified: 0, appointments: 0, conversion: 0 },
        openOpportunities: fData.length > 1 ? fData.slice(1).reduce((acc: number, curr) => acc + curr.value, 0) : 0
      });
      setRecentLeads(Array.isArray(leadsArr) ? (leadsArr as SimpleLead[]).slice(0, 6) : []);

    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const funnelDisplayData = (stats.funnel || []).map((item, idx: number) => ({
    name: item.label,
    value: stats.totalLeads > 0 ? Math.round((item.value / stats.totalLeads) * 100) : 0,
    color: ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#0f172a'][idx] || '#cbd5e1'
  }));

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-[1600px] mx-auto animate-in fade-in duration-1000">
        
        {/* HEADER DASHBOARD */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                 Painel <span className="text-emerald-500 italic">Estratégico</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Real-time Performance Metrics & AI Insights</p>
           </div>
           <div className="flex gap-3">
              <Button onClick={fetchData} variant="outline" className="h-12 rounded-2xl border-2 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95">
                <Clock className="w-4 h-4 mr-2" /> {loading ? "Sincronizando..." : "Sincronizar Agora"}
              </Button>
              <Button 
                onClick={() => window.location.href = "/crm"}
                className="h-12 bg-slate-900 hover:bg-slate-800 rounded-2xl px-8 font-black text-xs uppercase tracking-widest text-white shadow-2xl"
              >
                 Ver Pipeline
              </Button>
           </div>
        </div>

        {/* TOP CARDS DINÂMICOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <KpiCard 
              label="Volume de Leads" 
              value={loading ? "..." : stats.totalLeads} 
              trend={`${stats.trends.leads >= 0 ? '+' : ''}${stats.trends.leads}%`} 
              up={stats.trends.leads >= 0}
              icon={<Users className="text-blue-500 w-6 h-6" />} 
           />
           <KpiCard 
              label="Leads Qualificados" 
              value={loading ? "..." : stats.qualifiedLeads} 
              trend={`${stats.trends.qualified >= 0 ? '+' : ''}${stats.trends.qualified}%`} 
              up={stats.trends.qualified >= 0}
              icon={<Bot className="text-emerald-500 w-6 h-6" />} 
           />
           <KpiCard 
              label="Agendamentos" 
              value={loading ? "..." : stats.appointments} 
              trend={`${stats.trends.appointments >= 0 ? '+' : ''}${stats.trends.appointments}%`} 
              up={stats.trends.appointments >= 0}
              icon={<Calendar className="text-purple-500 w-6 h-6" />} 
           />
           <KpiCard 
              label="Conversão Geral" 
              value={loading ? "..." : `${stats.conversionRate.toFixed(1)}%`} 
              trend={`${stats.trends.conversion >= 0 ? '+' : ''}${stats.trends.conversion}%`} 
              up={stats.trends.conversion >= 0}
              icon={<TrendingUp className="text-orange-500 w-6 h-6" />} 
           />
        </div>

        {/* RESOURCE USAGE / SUBSCRIPTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <Card className="lg:col-span-2 border-none shadow-3xl rounded-[45px] bg-white p-10 flex flex-col md:flex-row gap-10 items-center justify-between border-t-8 border-t-blue-500">
              <div className="w-full md:w-1/2 space-y-6">
                 <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
                       <Zap className="text-blue-500 w-6 h-6" /> Créditos de IA
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle de Tokens do Plano {stats.planName}</p>
                 </div>
                 
                 <div className="space-y-3">
                    <div className="flex justify-between items-end text-[11px] font-black uppercase tracking-wider">
                       <span className="text-slate-400">Consumo</span>
                       <span className="text-slate-900">{stats.usedTokens.toLocaleString()} / {stats.maxTokens.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-4 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5 shadow-inner">
                       <div 
                         className={`h-full rounded-full transition-all duration-1000 ${ (stats.usedTokens / (stats.maxTokens || 1)) > 0.8 ? 'bg-orange-500' : 'bg-blue-600' }`}
                         style={{ width: `${Math.min(100, (stats.usedTokens / (stats.maxTokens || 1)) * 100)}%` }}
                       />
                    </div>
                    <div className="flex justify-between items-center px-1">
                        <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[9px] px-3">{Math.round((stats.usedTokens / (stats.maxTokens || 1)) * 100)}% Utilizado</Badge>
                        <span className="text-[9px] font-bold text-slate-300 italic">Renova mensalmente</span>
                    </div>
                 </div>
              </div>

              <div className="hidden md:block w-px h-24 bg-slate-100" />

              <div className="w-full md:w-1/3 space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
                       <Bot className="w-6 h-6" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SDRs Ativos</p>
                       <p className="text-2xl font-black text-slate-900 italic tracking-tighter">{stats.activeSdrs} / {stats.maxSdrs}</p>
                    </div>
                 </div>
                 <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-900 rounded-full transition-all duration-1000" 
                      style={{ width: `${(stats.activeSdrs / (stats.maxSdrs || 1)) * 100}%` }}
                    />
                 </div>
                 <Button variant="outline" className="w-full h-10 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">
                    Upgrade de Plano
                 </Button>
              </div>
           </Card>

           <Card className="border-none shadow-3xl rounded-[45px] bg-slate-900 p-10 flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="space-y-6 relative z-10 w-full">
                 <div className="p-5 bg-white/5 rounded-[30px] border border-white/5 inline-flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Target className="w-10 h-10 text-emerald-500" />
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.3em]">Sucesso Comercial</p>
                    <h4 className="text-5xl font-black text-white italic tracking-tighter">{stats.qualifiedLeadsCount}</h4>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Leads Qualificados pela IA</p>
                 </div>
              </div>
           </Card>
        </div>

        {/* PROSPECTING STATS (FASE 1 & 2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <Card className="border-none shadow-3xl rounded-[45px] bg-slate-900 overflow-hidden group transition-all duration-500 hover:shadow-2xl relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <CardContent className="p-10 flex items-center justify-between relative z-10">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.25em] mb-2 flex items-center gap-2">
                       <Mail className="w-3 h-3 text-blue-400" /> Abordagem (Fase 1)
                    </p>
                    <div className="flex items-baseline gap-4">
                       <p className="text-6xl font-black text-white tracking-tighter italic">{stats.emailsSent}</p>
                       <span className="text-white/30 font-bold text-xs uppercase tracking-widest">E-mails Enviados</span>
                    </div>
                 </div>
                 <div className="h-24 w-1 bg-white/5 mx-6" />
                 <div className="p-8 bg-white/5 rounded-[35px] border border-white/5 group-hover:bg-blue-600 group-hover:border-blue-500 transition-all duration-500">
                    <Mail className="w-10 h-10 text-white" />
                 </div>
              </CardContent>
           </Card>

           <Card className="border-none shadow-3xl rounded-[45px] bg-slate-900 overflow-hidden group transition-all duration-500 hover:shadow-2xl relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <CardContent className="p-10 flex items-center justify-between relative z-10">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.25em] mb-2 flex items-center gap-2">
                       <Phone className="w-3 h-3 text-emerald-400" /> Reengajamento (Fase 2)
                    </p>
                    <div className="flex items-baseline gap-4">
                       <p className="text-6xl font-black text-white tracking-tighter italic">{stats.whatsappFollowups}</p>
                       <span className="text-white/30 font-bold text-xs uppercase tracking-widest">Wpp Follow-ups</span>
                    </div>
                 </div>
                 <div className="h-24 w-1 bg-white/5 mx-6" />
                 <div className="p-8 bg-white/5 rounded-[35px] border border-white/5 group-hover:bg-emerald-600 group-hover:border-emerald-500 transition-all duration-500">
                    <Phone className="w-10 h-10 text-white" />
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* ANALYTICS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <Card className="lg:col-span-2 border-none shadow-3xl rounded-[45px] bg-white overflow-hidden p-10 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-10">
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                       <BarChart3 className="w-6 h-6 text-emerald-500" /> Fluxo de Atividade
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distribuição por estágio do funil</p>
                 </div>
                 <Badge className="bg-emerald-50 text-emerald-600 border-none font-black px-4 py-1.5 rounded-xl text-[10px]">REAL-TIME</Badge>
              </div>
              
              <div className="h-[300px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.funnel.map((f: any) => ({ name: f.label, leads: f.value }))} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                       <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                             <stop offset="100%" stopColor="#34d399" stopOpacity={0.8}/>
                          </linearGradient>
                       </defs>
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#cbd5e1'}} dy={15} />
                       <Tooltip 
                          cursor={{fill: 'transparent'}}
                          contentStyle={{borderRadius: '25px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '20px'}}
                          itemStyle={{fontSize: '14px', fontWeight: '900', color: '#0f172a'}}
                       />
                       <Bar dataKey="leads" radius={[15, 15, 15, 15]} barSize={60}>
                          {(stats.funnel || []).map((entry: any, index: number) => (
                             <Cell key={`cell-${index}`} fill="url(#barGradient)" />
                          ))}
                       </Bar>
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </Card>

           <Card className="border-none shadow-3xl rounded-[45px] bg-slate-900 text-white p-10 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
              
              <div className="space-y-2 relative z-10">
                 <h3 className="text-xl font-black tracking-tight uppercase italic text-emerald-400">Conversão de Funil</h3>
                 <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-10">Efetividade da Qualificação IA</p>
              </div>

              <div className="space-y-8 relative z-10">
                 {funnelDisplayData.map((item) => (
                    <div key={item.name} className="space-y-3">
                       <div className="flex justify-between items-center text-[10px] font-black px-1 uppercase tracking-[0.1em]">
                          <span className="text-white/40">{item.name}</span>
                          <span className="text-white">{item.value}%</span>
                       </div>
                       <div className="w-full h-3.5 bg-white/5 rounded-full overflow-hidden p-1 border border-white/5 shadow-inner">
                          <div 
                             className="h-full rounded-full transition-all duration-[1.5s] ease-in-out shadow-lg" 
                             style={{width: `${item.value}%`, backgroundColor: item.color}} 
                          />
                       </div>
                    </div>
                 ))}
                 
                 <div className="mt-8 p-6 bg-white/5 rounded-3xl border border-white/5 text-center backdrop-blur-xl">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 leading-none">Oportunidades em Aberto</p>
                    <p className="text-3xl font-black text-white italic tracking-tighter">{stats.openOpportunities} Oportunidades</p>
                 </div>
              </div>
           </Card>
        </div>

        {/* BOTTOM SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <Card className="border-none shadow-3xl rounded-[45px] bg-white overflow-hidden p-2">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                 <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
                    <Clock className="w-5 h-5 text-emerald-500" /> Atividade Recente
                 </h3>
                 <Button variant="ghost" className="text-[10px] font-black text-slate-400 uppercase tracking-widest" onClick={() => window.location.href = "/crm"}>Ver CRM Completo</Button>
              </div>
              <div className="p-6 space-y-3">
                 {recentLeads.map((lead: { id: string, name: string, status: string, source: string }) => (
                    <div key={lead.id} className="flex items-center gap-4 p-5 hover:bg-slate-50 rounded-[30px] transition-all duration-300 group cursor-pointer border-l-4 border-l-transparent hover:border-l-emerald-500">
                       <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center font-black text-white group-hover:bg-emerald-500 shadow-xl transition-all hvr-pop">
                          {lead.name?.substring(0,2).toUpperCase() || "L"}
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{lead.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                             <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-400 border-slate-200 px-2 leading-none">{lead.status || "Novo"}</Badge>
                             <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest truncate">{lead.source || "Manual"}</span>
                          </div>
                       </div>
                       <div className="text-right flex flex-col items-end">
                          <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-600">
                             <MessageSquare className="w-4 h-4" />
                          </div>
                       </div>
                    </div>
                 ))}
                 {recentLeads.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                       <Search className="w-12 h-12 text-slate-200" />
                       <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Aguardando novos leads...</p>
                    </div>
                 )}
              </div>
           </Card>

           <Card className="border-none shadow-3xl rounded-[45px] bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-12 relative overflow-hidden group">
              <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/10 blur-[120px] rounded-full translate-x-1/2 translate-y-1/2" />
              <div className="relative z-10 h-full flex flex-col justify-between gap-12">
                 <div className="space-y-6">
                    <div className="w-20 h-20 bg-white/20 rounded-[35px] flex items-center justify-center shadow-2xl backdrop-blur-xl border border-white/20">
                       <Zap className="w-10 h-10 text-white animate-pulse" />
                    </div>
                    <div>
                       <h3 className="text-3xl font-black tracking-tighter uppercase italic leading-none">SDR Intelligence <br/>Monitoring</h3>
                       <p className="text-white/60 font-bold uppercase text-[10px] tracking-widest mt-3">Análise Preditiva de Conversão</p>
                    </div>
                 </div>
                 
                 <div className="space-y-5">
                      <InsightRow icon={<Bot className="w-4 h-4" />} text={stats.activeSdrs > 0 ? `${stats.activeSdrs} SDRs IAs estão prospectando agora.` : "Nenhum SDR ativo no momento."} />
                      <InsightRow icon={<Target className="w-4 h-4" />} text={stats.qualifiedLeadsCount > 0 ? `Taxa de qualificação atual em ${((stats.qualifiedLeadsCount / (stats.totalLeads || 1)) * 100).toFixed(1)}%.` : "Aguardando primeiras qualificações."} />
                      <InsightRow icon={<CheckCircle2 className="w-4 h-4" />} text={`Taxa de Show de reuniões em ${stats.showRate}%.`} />
                      <InsightRow icon={<Calendar className="w-4 h-4" />} text={stats.appointments > 0 ? `${stats.appointments} reuniões confirmadas na agenda.` : "Sem agendamentos pendentes."} />
                   </div>

                 <Button 
                   onClick={() => window.location.href = "/sdrs"}
                   className="w-full h-16 bg-white text-emerald-600 hover:bg-emerald-50 hover:scale-[1.02] font-black rounded-3xl uppercase tracking-widest text-sm transition-all shadow-3xl"
                 >
                    Acessar Central SDR
                 </Button>
              </div>
           </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function KpiCard({ label, value, trend, up, icon }: { label: string, value: string | number, trend: string, up: boolean, icon: React.ReactNode }) {
  return (
    <Card className="border-none shadow-xl rounded-[40px] bg-white p-10 hover:shadow-2xl hover:translate-y-[-8px] transition-all duration-500 group border-b-8 border-transparent hover:border-emerald-500">
       <div className="flex justify-between items-start mb-8">
          <div className="p-5 bg-slate-50 rounded-[25px] group-hover:bg-slate-900 group-hover:shadow-xl transition-all duration-500">{icon}</div>
          <div className={`flex items-center gap-1.5 text-[9px] font-black px-3 py-1.5 rounded-full ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'} shadow-sm`}>
             {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
             {trend}
          </div>
       </div>
       <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter italic">{value}</p>
       </div>
  </Card>
  );
}

function InsightRow({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-white/5 text-[13px] font-bold tracking-tight">
       <div className="p-2 bg-white/10 rounded-xl border border-white/5 backdrop-blur-md">{icon}</div>
       <span className="leading-tight">{text}</span>
    </div>
  );
}
