import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, Users, Zap, Search, Globe, Clock, CheckCircle2, AlertCircle, 
  RefreshCw, Filter, ArrowUpRight, TrendingUp, Brain, Database, MousePointer2, Target
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ProspectionAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [isHunting, setIsHunting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/prospect/stats", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const json = await res.json();
      setData(json);
    } catch (e) {
      toast({ title: "Erro ao carregar analytics", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerHunt = async () => {
    setIsHunting(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/prospect/trigger-hunt", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const json = await res.json();
      toast({ title: "🚀 Busca Iniciada", description: json.message });
      
      // Refresh after a delay to show logs
      setTimeout(fetchData, 5000);
    } catch (e) {
      toast({ title: "Erro ao iniciar busca", variant: "destructive" });
    } finally {
      setIsHunting(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading && !data) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[80vh] gap-4 opacity-30">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consolidando Inteligência B2B...</p>
        </div>
      </DashboardLayout>
    );
  }

  const stats = data?.stats || { totalLeadsFound: 0, totalContacted: 0, enrichmentRate: 0, contactRate: 0 };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-screen-2xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-12 rounded-[50px] shadow-3xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 blur-[130px] rounded-full translate-x-1/2 -translate-y-1/2" />
           <div className="space-y-3 relative z-10">
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase flex items-center gap-4">
                 Performance <span className="text-emerald-500 italic">Hunter</span>
              </h1>
              <p className="text-white/30 font-bold uppercase tracking-widest text-[9px] pl-[56px] leading-relaxed max-w-md">Visibilidade total sobre o pipeline de descoberta e prospecção automática.</p>
           </div>
           
           <div className="flex gap-3 relative z-10">
              <Button 
                onClick={handleTriggerHunt} 
                disabled={isHunting}
                className="h-14 px-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest shadow-2xl transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
              >
                 {isHunting ? (
                   <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                 ) : (
                   <Search className="w-4 h-4 mr-2" />
                 )}
                 {isHunting ? "Caçando..." : "Buscar Agora"}
              </Button>

              <Button onClick={fetchData} variant="outline" className="h-14 px-8 rounded-2xl border-white/10 bg-white/5 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/10">
                 <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Sincronizar
              </Button>
           </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <Card className="p-8 border-none shadow-xl rounded-[35px] bg-white group hover:scale-[1.02] transition-all">
              <div className="flex justify-between items-start mb-6">
                 <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                    <Search className="w-6 h-6" />
                 </div>
                 <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[9px]">+12%</Badge>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Leads Identificados</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.totalLeadsFound}</h3>
           </Card>

           <Card className="p-8 border-none shadow-xl rounded-[35px] bg-white group hover:scale-[1.02] transition-all">
              <div className="flex justify-between items-start mb-6">
                 <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm">
                    <Brain className="w-6 h-6" />
                 </div>
                 <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[9px]">{Math.round((stats.enrichmentRate / stats.totalLeadsFound) * 100 || 0)}%</Badge>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Enriquecidos (Deep)</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.enrichmentRate}</h3>
           </Card>

           <Card className="p-8 border-none shadow-xl rounded-[35px] bg-white group hover:scale-[1.02] transition-all">
              <div className="flex justify-between items-start mb-6">
                 <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors shadow-sm">
                    <Zap className="w-6 h-6" />
                 </div>
                 <Badge className="bg-amber-50 text-amber-600 border-none font-black text-[9px]">{Math.round(stats.contactRate)}%</Badge>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Taxa de Abordagem</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.totalContacted}</h3>
           </Card>

           <Card className="p-8 border-none shadow-xl rounded-[35px] bg-white group hover:scale-[1.02] transition-all">
              <div className="flex justify-between items-start mb-6">
                 <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white transition-colors shadow-sm">
                    <ArrowUpRight className="w-6 h-6" />
                 </div>
                 <Badge className="bg-slate-100 text-slate-600 border-none font-black text-[9px]">Pipeline</Badge>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Potencial de Vendas</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">R$ {stats.totalLeadsFound * 500}</h3>
           </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* FEED DE LEADS RECENTES */}
           <Card className="lg:col-span-2 border-none shadow-2xl rounded-[45px] bg-white overflow-hidden">
              <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                       <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Últimos Alvos Identificados</h3>
                 </div>
                 <Badge className="bg-blue-600 text-white border-none font-black text-[8px] uppercase tracking-widest px-3">Tempo Real</Badge>
              </div>
              <div className="p-2">
                 <ScrollArea className="h-[500px] p-6">
                    <div className="space-y-4">
                       {data?.latestLeads?.map((lead: any) => (
                          <div key={lead.id} className="p-6 bg-slate-50 rounded-[30px] flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-slate-100">
                             <div className="flex items-center gap-6">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-blue-600 shadow-sm uppercase group-hover:bg-blue-600 group-hover:text-white transition-all">
                                   {lead.name.charAt(0)}
                                </div>
                                <div>
                                   <h4 className="text-sm font-black text-slate-900 uppercase mb-1">{lead.name}</h4>
                                   <div className="flex items-center gap-3">
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{lead.phone || 'Sem Telefone'}</p>
                                      <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                      <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Origem: {lead.source}</p>
                                   </div>
                                </div>
                             </div>
                             <div className="flex items-center gap-4">
                                {lead.extractedData && (
                                   <div className="flex gap-1">
                                      <Badge className="bg-emerald-100 text-emerald-600 text-[8px] font-black uppercase tracking-tighter px-2 border-none">DADOS IA</Badge>
                                      <Badge className="bg-blue-100 text-blue-600 text-[8px] font-black uppercase tracking-tighter px-2 border-none">MAPS</Badge>
                                   </div>
                                )}
                                <Badge className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-lg border-none ${
                                   lead.status === 'NEW' ? 'bg-slate-200 text-slate-500' : 
                                   lead.status === 'PROSPECTING' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                }`}>
                                   {lead.status}
                                </Badge>
                             </div>
                          </div>
                       ))}
                       {(!data?.latestLeads || data?.latestLeads.length === 0) && (
                          <div className="py-20 text-center opacity-20">
                             <Search className="w-12 h-12 mx-auto mb-4" />
                             <p className="text-xs font-black uppercase tracking-widest">Nenhum lead encontrado ainda.</p>
                          </div>
                       )}
                    </div>
                 </ScrollArea>
              </div>
           </Card>

           {/* LOGS DE BUSCA (AUTO-HUNTER) */}
           <Card className="border-none shadow-2xl rounded-[45px] bg-slate-900 overflow-hidden">
              <div className="p-10 border-b border-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                       <Database className="w-5 h-5 text-emerald-500" />
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Engine Logs</h3>
                 </div>
              </div>
              <ScrollArea className="h-[550px] p-8">
                 <div className="space-y-6">
                    {data?.logs?.map((log: any) => (
                       <div key={log.id} className="relative pl-8 border-l border-white/10 pb-2">
                          <div className={`absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                          <div className="space-y-2">
                             <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                                   {format(new Date(log.createdAt), "HH:mm '•' dd MMM", { locale: ptBR })}
                                </p>
                                <Badge className={`text-[7px] font-black uppercase border-none ${log.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                   {log.status}
                                </Badge>
                             </div>
                             <p className="text-[11px] font-bold text-white leading-relaxed">
                                {log.status === 'SUCCESS' 
                                   ? `Busca concluída: ${log.leadsFound} leads importados.` 
                                   : `Falha na busca: ${log.error || 'Erro desconhecido'}`}
                             </p>
                             <div className="flex items-center gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
                                <Search className="w-3 h-3 text-emerald-500" />
                                <p className="text-[10px] font-black text-emerald-500/80 uppercase truncate">"{log.query}"</p>
                             </div>
                             {log.icp && (
                                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest flex items-center gap-2">
                                   <Target className="w-3 h-3" /> Jornada: {log.icp.name}
                                </p>
                             )}
                          </div>
                       </div>
                    ))}
                    {(!data?.logs || data?.logs.length === 0) && (
                       <div className="py-20 text-center opacity-20">
                          <Clock className="w-12 h-12 mx-auto mb-4 text-white" />
                          <p className="text-xs font-black uppercase tracking-widest text-white">Nenhum log de busca registrado.</p>
                       </div>
                    )}
                 </div>
              </ScrollArea>
           </Card>
        </div>

        {/* ESTATÍSTICAS POR ICP */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {data?.leadsByIcp?.map((icp: any) => (
              <Card key={icp.id} className="p-8 border-none shadow-xl rounded-[35px] bg-white">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                       <Target className="w-5 h-5" />
                    </div>
                    <div>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jornada</h4>
                       <p className="text-sm font-black text-slate-900 uppercase">{icp.name}</p>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <div className="flex justify-between items-end">
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ciclos de Busca</p>
                       <p className="text-lg font-black text-slate-900">{icp._count.prospectionLogs}</p>
                    </div>
                    <Progress value={Math.min(100, (icp._count.prospectionLogs / 50) * 100)} className="h-1.5 bg-slate-100" />
                 </div>
              </Card>
           ))}
        </div>

      </div>
    </DashboardLayout>
  );
}
