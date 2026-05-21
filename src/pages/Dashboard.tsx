import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, Target, Calendar, MessageSquare, TrendingUp, 
  ArrowUpRight, ArrowDownRight, Bot, Zap, Clock,
  MoreHorizontal, ChevronRight, BarChart3, PieChart as PieChartIcon,
  ShieldCheck, CheckCircle2, AlertCircle, Phone, Search, Mail, Brain
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
  usedMessages: number;
  maxMessages: number;
  usedProspects: number;
  maxProspects: number;
  usedResearch: number;
  maxResearch: number;
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
    usedMessages: 0,
    maxMessages: 0,
    usedProspects: 0,
    maxProspects: 0,
    usedResearch: 0,
    maxResearch: 0,
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
        usedMessages: statsData.stats.usedMessages || 0,
        maxMessages: statsData.stats.maxMessages || 0,
        usedProspects: statsData.stats.usedProspects || 0,
        maxProspects: statsData.stats.maxProspects || 0,
        usedResearch: statsData.stats.usedResearch || 0,
        maxResearch: statsData.stats.maxResearch || 0,
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

  // Nubank Palette Conversion Colors
  const funnelDisplayData = (stats.funnel || []).map((item, idx: number) => ({
    name: item.label,
    value: stats.totalLeads > 0 ? Math.round((item.value / stats.totalLeads) * 100) : 0,
    // Nubank color progression from light purple to deep dark violet
    color: ['#A033FF', '#820AD1', '#5F00A3', '#4C0677', '#2D0052'][idx] || '#820AD1'
  }));

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-[1600px] mx-auto animate-in fade-in duration-1000">
        
        {/* HEADER DASHBOARD */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="space-y-1">
              <h1 className="text-4xl font-black text-[#2D0052] dark:text-white tracking-tighter uppercase flex items-center gap-3">
                 Painel <span className="text-[#820AD1] italic">Estratégico</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Real-time Performance Metrics & AI Insights</p>
           </div>
           <div className="flex gap-3">
              <Button onClick={fetchData} variant="outline" className="h-12 rounded-2xl border-2 border-purple-100 dark:border-purple-950 font-black text-xs uppercase tracking-widest hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all active:scale-95 text-[#2D0052] dark:text-purple-200">
                 <Clock className="w-4 h-4 mr-2" /> {loading ? "Sincronizando..." : "Sincronizar"}
              </Button>
              <Button 
                onClick={() => window.location.href = "/crm"}
                className="h-12 bg-[#820AD1] hover:bg-[#6c08b0] rounded-2xl px-8 font-black text-xs uppercase tracking-widest text-white shadow-2xl shadow-[#820AD1]/10 border-none"
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
              icon={<Users className="text-[#820AD1] w-6 h-6" />} 
           />
           <KpiCard 
              label="Leads Qualificados" 
              value={loading ? "..." : stats.qualifiedLeads} 
              trend={`${stats.trends.qualified >= 0 ? '+' : ''}${stats.trends.qualified}%`} 
              up={stats.trends.qualified >= 0}
              icon={<Bot className="text-[#820AD1] w-6 h-6" />} 
           />
           <KpiCard 
              label="Agendamentos" 
              value={loading ? "..." : stats.appointments} 
              trend={`${stats.trends.appointments >= 0 ? '+' : ''}${stats.trends.appointments}%`} 
              up={stats.trends.appointments >= 0}
              icon={<Calendar className="text-[#820AD1] w-6 h-6" />} 
           />
           <KpiCard 
              label="Conversão Geral" 
              value={loading ? "..." : `${stats.conversionRate.toFixed(1)}%`} 
              trend={`${stats.trends.conversion >= 0 ? '+' : ''}${stats.trends.conversion}%`} 
              up={stats.trends.conversion >= 0}
              icon={<TrendingUp className="text-[#820AD1] w-6 h-6" />} 
           />
        </div>

        {/* RESOURCE USAGE / SUBSCRIPTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <Card className="lg:col-span-2 border-none shadow-xl dark:shadow-none rounded-[45px] bg-white dark:bg-[#1c0133] p-10 flex flex-col gap-10 border-t-8 border-t-[#820AD1]">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black text-[#2D0052] dark:text-white tracking-tighter uppercase italic flex items-center gap-3">
                       <Zap className="text-[#820AD1] w-6 h-6" /> Créditos & Consumo
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acompanhe o uso dos recursos do seu plano {stats.planName}</p>
                 </div>
                 <Button variant="outline" className="h-10 rounded-xl border-2 border-purple-100 dark:border-purple-950 font-black text-[10px] uppercase tracking-widest hover:bg-[#820AD1] hover:text-white dark:text-purple-200 transition-all shadow-md">
                    Upgrade de Plano
                 </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                 {/* TOKENS IA */}
                 <UsageMetric 
                    label="Tokens de IA (Gemini)"
                    used={stats.usedTokens}
                    max={stats.maxTokens}
                    color="bg-[#820AD1]"
                    icon={<Brain className="w-4 h-4 text-[#820AD1]" />}
                 />
                 
                 {/* MENSAGENS */}
                 <UsageMetric 
                    label="Mensagens (WhatsApp)"
                    used={stats.usedMessages}
                    max={stats.maxMessages}
                    color="bg-[#820AD1]"
                    icon={<MessageSquare className="w-4 h-4 text-[#820AD1]" />}
                 />

                 {/* PROSPECTING */}
                 <UsageMetric 
                    label="Buscas BDR Agent"
                    used={stats.usedProspects}
                    max={stats.maxProspects}
                    color="bg-[#820AD1]"
                    icon={<Search className="w-4 h-4 text-[#820AD1]" />}
                 />

                 {/* DEEP RESEARCH */}
                 <UsageMetric 
                    label="Deep Research"
                    used={stats.usedResearch}
                    max={stats.maxResearch}
                    color="bg-[#820AD1]"
                    icon={<Zap className="w-4 h-4 text-[#820AD1]" />}
                 />
              </div>
           </Card>

           <Card className="border-none shadow-xl dark:shadow-none rounded-[45px] bg-[#230440]/90 p-10 flex flex-col justify-between items-center text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#820AD1]/15 blur-[50px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="space-y-6 relative z-10 w-full">
                 <div className="p-5 bg-white/5 rounded-[30px] border border-white/5 inline-flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Target className="w-10 h-10 text-[#820AD1]" />
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-purple-300 uppercase tracking-[0.3em]">SDR Agent</p>
                    <h4 className="text-5xl font-black text-white italic tracking-tighter">{stats.qualifiedLeadsCount}</h4>
                    <p className="text-purple-200/40 font-bold uppercase tracking-widest text-[10px]">Leads Qualificados</p>
                 </div>
              </div>

              <div className="w-full space-y-4 pt-10 border-t border-white/5">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase text-purple-300">
                    <span>Vagas SDR</span>
                    <span>{stats.activeSdrs} / {stats.maxSdrs}</span>
                 </div>
                 <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#820AD1] rounded-full transition-all duration-1000" 
                      style={{ width: `${(stats.activeSdrs / (stats.maxSdrs || 1)) * 100}%` }}
                    />
                 </div>
              </div>
           </Card>
        </div>

        {/* PROSPECTING STATS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <Card className="border-none shadow-xl dark:shadow-none rounded-[45px] bg-[#230440] overflow-hidden group transition-all duration-500 hover:shadow-2xl relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#820AD1]/10 blur-[60px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <CardContent className="p-10 flex items-center justify-between relative z-10">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-purple-200/40 uppercase tracking-[0.25em] mb-2 flex items-center gap-2">
                       <Mail className="w-3 h-3 text-purple-300" /> Abordagem (Fase 1)
                    </p>
                    <div className="flex items-baseline gap-4">
                       <p className="text-6xl font-black text-white tracking-tighter italic">{stats.emailsSent}</p>
                       <span className="text-purple-200/30 font-bold text-xs uppercase tracking-widest">E-mails Enviados</span>
                    </div>
                 </div>
                 <div className="h-24 w-1 bg-white/5 mx-6" />
                 <div className="p-8 bg-white/5 rounded-[35px] border border-white/5 group-hover:bg-[#820AD1] group-hover:border-[#820AD1] transition-all duration-500">
                    <Mail className="w-10 h-10 text-white" />
                 </div>
              </CardContent>
           </Card>

           <Card className="border-none shadow-xl dark:shadow-none rounded-[45px] bg-[#230440] overflow-hidden group transition-all duration-500 hover:shadow-2xl relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#820AD1]/10 blur-[60px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <CardContent className="p-10 flex items-center justify-between relative z-10">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-purple-200/40 uppercase tracking-[0.25em] mb-2 flex items-center gap-2">
                       <Phone className="w-3 h-3 text-purple-300" /> Reengajamento (Fase 2)
                    </p>
                    <div className="flex items-baseline gap-4">
                       <p className="text-6xl font-black text-white tracking-tighter italic">{stats.whatsappFollowups}</p>
                       <span className="text-purple-200/30 font-bold text-xs uppercase tracking-widest">Wpp Follow-ups</span>
                    </div>
                 </div>
                 <div className="h-24 w-1 bg-white/5 mx-6" />
                 <div className="p-8 bg-white/5 rounded-[35px] border border-white/5 group-hover:bg-[#820AD1] group-hover:border-[#820AD1] transition-all duration-500">
                    <Phone className="w-10 h-10 text-white" />
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* ANALYTICS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <Card className="lg:col-span-2 border-none shadow-xl dark:shadow-none rounded-[45px] bg-white dark:bg-[#1c0133] overflow-hidden p-10 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-10">
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black text-[#2D0052] dark:text-white tracking-tight flex items-center gap-3">
                       <BarChart3 className="w-6 h-6 text-[#820AD1]" /> Fluxo de Atividade
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distribuição por estágio do funil</p>
                 </div>
                 <Badge className="bg-purple-50 dark:bg-purple-950/45 text-[#820AD1] dark:text-purple-300 border-none font-black px-4 py-1.5 rounded-xl text-[10px]">REAL-TIME</Badge>
              </div>
              
              <div className="h-[300px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.funnel.map((f: any) => ({ name: f.label, leads: f.value }))} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                       <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="0%" stopColor="#820AD1" stopOpacity={1}/>
                             <stop offset="100%" stopColor="#A033FF" stopOpacity={0.8}/>
                          </linearGradient>
                       </defs>
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#8b5cf6'}} dy={15} />
                       <Tooltip 
                          cursor={{fill: 'transparent'}}
                          contentStyle={{borderRadius: '25px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '20px', backgroundColor: '#1c0133', color: '#fff'}}
                          itemStyle={{fontSize: '14px', fontWeight: '900', color: '#820AD1'}}
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

           <Card className="border-none shadow-xl dark:shadow-none rounded-[45px] bg-[#230440] text-white p-10 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#820AD1]/15 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
              
              <div className="space-y-2 relative z-10">
                 <h3 className="text-xl font-black tracking-tight uppercase italic text-purple-200">Conversão de Funil</h3>
                 <p className="text-purple-200/30 text-[10px] font-bold uppercase tracking-widest mb-10">Efetividade da Qualificação IA</p>
              </div>

              <div className="space-y-8 relative z-10">
                 {funnelDisplayData.map((item) => (
                    <div key={item.name} className="space-y-3">
                       <div className="flex justify-between items-center text-[10px] font-black px-1 uppercase tracking-[0.1em]">
                          <span className="text-purple-200/50">{item.name}</span>
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
                    <p className="text-[10px] font-black text-purple-300 uppercase tracking-widest mb-1 leading-none">Oportunidades em Aberto</p>
                    <p className="text-3xl font-black text-white italic tracking-tighter">{stats.openOpportunities} Oportunidades</p>
                 </div>
              </div>
           </Card>
        </div>

        {/* BOTTOM SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <Card className="border-none shadow-xl dark:shadow-none rounded-[45px] bg-white dark:bg-[#1c0133] overflow-hidden p-2">
              <div className="p-8 border-b border-purple-50 dark:border-purple-950/45 flex items-center justify-between">
                 <h3 className="text-xl font-black text-[#2D0052] dark:text-white tracking-tight uppercase flex items-center gap-3">
                    <Clock className="w-5 h-5 text-[#820AD1]" /> Atividade Recente
                 </h3>
                 <Button variant="ghost" className="text-[10px] font-black text-slate-400 hover:text-[#820AD1] uppercase tracking-widest" onClick={() => window.location.href = "/crm"}>Ver CRM Completo</Button>
              </div>
              <div className="p-6 space-y-3">
                 {recentLeads.map((lead: { id: string, name: string, status: string, source: string }) => (
                    <div key={lead.id} className="flex items-center gap-4 p-5 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 rounded-[30px] transition-all duration-300 group cursor-pointer border-l-4 border-l-transparent hover:border-l-[#820AD1]">
                       <div className="w-14 h-14 bg-[#2D0052] rounded-2xl flex items-center justify-center font-black text-white group-hover:bg-[#820AD1] shadow-xl transition-all">
                          {lead.name?.substring(0,2).toUpperCase() || "L"}
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-black text-[#2D0052] dark:text-white group-hover:text-[#820AD1] transition-colors">{lead.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                             <Badge variant="outline" className="text-[9px] font-black uppercase text-purple-400 border-purple-100 dark:border-purple-950 px-2 leading-none">{lead.status || "Novo"}</Badge>
                             <span className="text-[10px] font-bold text-slate-400 dark:text-purple-300/40 uppercase tracking-widest truncate">{lead.source || "Manual"}</span>
                          </div>
                       </div>
                       <div className="text-right flex flex-col items-end">
                          <div className="bg-purple-50 dark:bg-purple-950/40 p-2 rounded-xl text-[#820AD1]">
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

           <Card className="border-none shadow-xl dark:shadow-none rounded-[45px] bg-gradient-to-br from-[#820AD1] to-[#4C0677] text-white p-12 relative overflow-hidden group">
              <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/10 blur-[120px] rounded-full translate-x-1/2 translate-y-1/2" />
              <div className="relative z-10 h-full flex flex-col justify-between gap-12">
                 <div className="space-y-6">
                    <div className="w-20 h-20 bg-white/20 rounded-[35px] flex items-center justify-center shadow-2xl backdrop-blur-xl border border-white/20">
                       <Zap className="w-10 h-10 text-white animate-pulse" />
                    </div>
                    <div>
                       <h3 className="text-3xl font-black tracking-tighter uppercase italic leading-none">SDR Intelligence <br/>Monitoring</h3>
                       <p className="text-purple-200/60 font-bold uppercase text-[10px] tracking-widest mt-3">Análise Preditiva de Conversão</p>
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
                   className="w-full h-16 bg-white text-[#820AD1] hover:bg-purple-50 hover:scale-[1.02] font-black rounded-3xl uppercase tracking-widest text-sm transition-all shadow-3xl border-none"
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

function UsageMetric({ label, used = 0, max = 0, color, icon }: { label: string, used: number, max: number, color: string, icon: React.ReactNode }) {
  const percentage = Math.min(100, ((used || 0) / (max || 1)) * 100);
  const isHigh = percentage > 80;

  return (
    <div className="space-y-3">
       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
          <div className="flex items-center gap-2">
             <div className="p-1.5 bg-slate-50 dark:bg-purple-950/40 rounded-lg">{icon}</div>
             <span className="text-slate-400">{label}</span>
          </div>
          <span className={isHigh ? "text-orange-500" : "text-slate-900 dark:text-purple-200"}>{(used || 0).toLocaleString()} / {(max || 0).toLocaleString()}</span>
       </div>
       <div className="w-full h-3 bg-slate-50 dark:bg-purple-950/20 rounded-full overflow-hidden border border-slate-100 dark:border-purple-950 p-0.5">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${isHigh ? 'bg-orange-500' : color}`}
            style={{ width: `${percentage}%` }}
          />
       </div>
    </div>
  );
}

function KpiCard({ label, value, trend, up, icon }: { label: string, value: string | number, trend: string, up: boolean, icon: React.ReactNode }) {
  return (
    <Card className="border-none shadow-xl dark:shadow-none rounded-[40px] bg-white dark:bg-[#1c0133] p-10 hover:shadow-2xl dark:hover:bg-[#230440]/40 hover:translate-y-[-8px] transition-all duration-500 group border-b-8 border-transparent hover:border-[#820AD1]">
       <div className="flex justify-between items-start mb-8">
          <div className="p-5 bg-slate-50 dark:bg-[#230440] rounded-[25px] group-hover:bg-[#820AD1] group-hover:shadow-xl transition-all duration-500 group-hover:text-white">{icon}</div>
          <div className={`flex items-center gap-1.5 text-[9px] font-black px-3 py-1.5 rounded-full ${up ? 'bg-purple-50 dark:bg-purple-950/45 text-[#820AD1]' : 'bg-red-50 text-red-600'} shadow-sm`}>
             {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
             {trend}
          </div>
       </div>
       <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 dark:text-purple-300/40 uppercase tracking-widest pl-1">{label}</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic">{value}</p>
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
