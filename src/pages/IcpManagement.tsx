import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Target, Plus, Trash2, Brain, Zap, Save, RefreshCw, Sliders, Search, Globe, Layout, ShieldCheck, TrendingUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

export default function IcpManagement() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);

  const [form, setForm] = useState({
    name: "",
    niche: "",
    role: "",
    location: "Brasil",
    relevantInfo: "",
    searchKeywords: "",
    dailyResearchLimit: 10,
    dailyLimit: 200,
    isAutoHunterEnabled: true,
    isProspectingActive: true,
    isActive: true
  });

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/icp-profiles", { 
        headers: { "Authorization": `Bearer ${token}` } 
      });
      const data = await res.json();
      setProfiles(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenModal = (profile: any = null) => {
    if (profile) {
      setEditingProfile(profile);
      setForm({
        name: profile.name || "",
        niche: profile.niche || "",
        role: profile.role || "",
        location: profile.location || "Brasil",
        relevantInfo: profile.relevantInfo || "",
        searchKeywords: profile.searchKeywords || "",
        dailyResearchLimit: profile.dailyResearchLimit || 10,
        dailyLimit: profile.dailyLimit || 200,
        isAutoHunterEnabled: profile.isAutoHunterEnabled ?? true,
        isProspectingActive: profile.isProspectingActive ?? true,
        isActive: profile.isActive ?? true
      });
    } else {
      setEditingProfile(null);
      setForm({
        name: "",
        niche: "",
        role: "",
        location: "Brasil",
        relevantInfo: "Stack tecnológica, notícias recentes de expansão, faturamento estimado.",
        searchKeywords: "linkedin, news, expansion, hiring",
        dailyResearchLimit: 10,
        dailyLimit: 200,
        isAutoHunterEnabled: true,
        isProspectingActive: true,
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast({ title: "Nome do Perfil é obrigatório", variant: "destructive" });
    const token = localStorage.getItem("token");
    try {
      const url = editingProfile ? `/api/icp-profiles/${editingProfile.id}` : "/api/icp-profiles";
      const method = editingProfile ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        toast({ title: editingProfile ? "🎯 Perfil Atualizado" : "🚀 Jornada de Prospecção Criada" });
        setIsModalOpen(false);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const deleteProfile = async (id: string) => {
    if (!confirm("Remover este perfil de prospecção?")) return;
    const token = localStorage.getItem("token");
    await fetch(`/api/icp-profiles/${id}`, { 
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    fetchData();
    toast({ title: "🗑️ Perfil Removido" });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 p-6 lg:p-10 max-w-screen-2xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-12 rounded-[50px] shadow-3xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 blur-[130px] rounded-full translate-x-1/2 -translate-y-1/2" />
           <div className="space-y-3 relative z-10">
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase flex items-center gap-4">
                 Jornadas de <span className="text-blue-500 italic">Deep Research</span>
              </h1>
              <p className="text-white/30 font-bold uppercase tracking-widest text-[9px] pl-[56px] leading-relaxed max-w-md">Configure como o seu Agente de IA deve caçar e investigar leads no mercado.</p>
           </div>
           
           <Button onClick={() => handleOpenModal()} className="h-16 px-10 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl transition-all hover:-translate-y-1 bg-blue-600 hover:bg-blue-700 text-white relative z-10">
              <Plus className="w-5 h-5 mr-3" /> Nova Jornada
           </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-30">
             <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sincronizando Inteligência...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {profiles.map(profile => (
              <Card key={profile.id} className="border-none shadow-2xl rounded-[45px] bg-white overflow-hidden hover:scale-[1.01] transition-all group relative">
                <div className="p-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center shadow-sm">
                        <Target className="w-8 h-8 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-slate-900 font-black text-xl uppercase leading-none">{profile.name}</h3>
                        <div className="flex gap-2 mt-2">
                           <Badge className="bg-blue-500/10 text-blue-600 font-black text-[8px] uppercase border-none">{profile.niche || 'Nicho Global'}</Badge>
                           <Badge className={`font-black text-[8px] uppercase border-none ${profile.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                              {profile.isActive ? 'Ativa' : 'Pausada'}
                           </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <Button variant="ghost" size="icon" onClick={() => handleOpenModal(profile)} className="w-10 h-10 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-900">
                          <Sliders className="w-5 h-5" />
                       </Button>
                       <Button variant="ghost" size="icon" onClick={() => deleteProfile(profile.id)} className="w-10 h-10 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500">
                          <Trash2 className="w-5 h-5" />
                       </Button>
                    </div>
                  </div>

                  <div className="space-y-6 flex-1">
                    <div className="bg-slate-50 p-6 rounded-[30px] space-y-4">
                       <div className="flex items-center gap-3">
                          <Brain className="w-4 h-4 text-blue-500" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Foco da Investigação</p>
                       </div>
                       <p className="text-xs text-slate-500 font-medium leading-relaxed italic">"{profile.relevantInfo || 'Nenhuma instrução específica de pesquisa.'}"</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-5 bg-blue-50/50 rounded-3xl">
                          <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">Pesquisas/Dia</p>
                          <p className="text-xl font-black text-slate-900">{profile.dailyResearchLimit}</p>
                       </div>
                       <div className="p-5 bg-emerald-50/50 rounded-3xl">
                          <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Contatos/Dia</p>
                          <p className="text-xl font-black text-slate-900">{profile.dailyLimit}</p>
                       </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <Zap className={`w-4 h-4 ${profile.isAutoHunterEnabled ? 'text-amber-500' : 'text-slate-300'}`} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Auto-Hunter: {profile.isAutoHunterEnabled ? 'ATIVO' : 'OFF'}</span>
                     </div>
                     <Button onClick={() => handleOpenModal(profile)} className="h-10 px-6 rounded-xl bg-slate-900 hover:bg-black text-white font-black uppercase text-[9px] tracking-widest">
                        Configurar
                     </Button>
                  </div>
                </div>
              </Card>
            ))}

            {profiles.length === 0 && (
              <div className="col-span-full py-40 text-center opacity-30 flex flex-col items-center gap-5">
                 <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
                    <Target className="w-12 h-12 text-slate-300" />
                 </div>
                 <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Crie sua primeira jornada de Deep Research</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-0 border-none shadow-3xl bg-white overflow-hidden rounded-[40px]">
          <div className="flex flex-col md:flex-row h-[85vh]">
            <div className="w-full md:w-80 bg-slate-900 p-12 flex flex-col justify-between relative overflow-hidden">
               <div className="absolute top-0 left-0 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full translate-x-[-50%] translate-y-[-50%]" />
               <div className="space-y-12 relative z-10">
                  <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl">
                     <Target className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-4">
                     <h3 className="text-3xl font-black text-white tracking-tighter uppercase leading-tight">Configurar <span className="text-blue-500 italic">Jornada</span></h3>
                     <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest leading-relaxed">Defina o alvo, o comportamento e a profundidade da investigação.</p>
                  </div>
               </div>
               <div className="p-6 bg-white/5 rounded-[30px] border border-white/5 space-y-3">
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Dica Premium</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Quanto mais específicas as palavras-chave, mais assertivo será o Ice-Breaker do SDR.</p>
               </div>
            </div>

            <div className="flex-1 p-12 overflow-y-auto bg-white">
               <div className="space-y-10">
                  <section className="space-y-6">
                     <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                        <Layout className="w-4 h-4 text-blue-500" /> Identificação do Alvo
                     </h4>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome da Jornada</Label>
                           <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-14 rounded-2xl border-none bg-slate-50 px-6 font-bold shadow-inner" placeholder="Ex: CEOs de Startups Logtech" />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Região de Atuação</Label>
                           <Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="h-14 rounded-2xl border-none bg-slate-50 px-6 font-bold shadow-inner" placeholder="Brasil, São Paulo, Global..." />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Nicho / Vertical</Label>
                           <Input value={form.niche} onChange={e => setForm({...form, niche: e.target.value})} className="h-14 rounded-2xl border-none bg-slate-50 px-6 font-bold shadow-inner" placeholder="Saúde, Logística, Jurídico..." />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Cargo Decisor</Label>
                           <Input value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="h-14 rounded-2xl border-none bg-slate-50 px-6 font-bold shadow-inner" placeholder="CEO, Diretor, Head de Vendas..." />
                        </div>
                     </div>
                  </section>

                  <section className="space-y-6">
                     <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                        <Brain className="w-4 h-4 text-blue-500" /> Inteligência de Pesquisa
                     </h4>
                     <div className="space-y-4">
                        <div className="space-y-2">
                           <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Informações de Alto Valor (Instrução para IA)</Label>
                           <Textarea value={form.relevantInfo} onChange={e => setForm({...form, relevantInfo: e.target.value})} className="min-h-[100px] rounded-2xl border-none bg-slate-50 p-6 font-medium text-sm shadow-inner" placeholder="O que a IA deve procurar especificamente? Ex: Tech stack, notícias de aporte, expansão para o exterior..." />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Palavras-Chave de Busca (Serper)</Label>
                           <Input value={form.searchKeywords} onChange={e => setForm({...form, searchKeywords: e.target.value})} className="h-14 rounded-2xl border-none bg-slate-50 px-6 font-bold shadow-inner" placeholder="linkedin, contratação, aporte, news, faturamento..." />
                        </div>
                     </div>
                  </section>

                  <section className="space-y-6">
                     <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                        <Sliders className="w-4 h-4 text-blue-500" /> Limites e Automação
                     </h4>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Pesquisas IA (Deep) por Dia</Label>
                           <Input type="number" value={form.dailyResearchLimit} onChange={e => setForm({...form, dailyResearchLimit: parseInt(e.target.value)})} className="h-14 rounded-2xl border-none bg-slate-50 px-6 font-bold shadow-inner" />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Máximo de Novos Contatos por Dia</Label>
                           <Input type="number" value={form.dailyLimit} onChange={e => setForm({...form, dailyLimit: parseInt(e.target.value)})} className="h-14 rounded-2xl border-none bg-slate-50 px-6 font-bold shadow-inner" />
                        </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl">
                           <div className="space-y-0.5">
                              <p className="text-xs font-black text-slate-900">Ativar Auto-Hunter</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">Busca leads sozinho</p>
                           </div>
                           <Switch checked={form.isAutoHunterEnabled} onCheckedChange={v => setForm({...form, isAutoHunterEnabled: v})} className="data-[state=checked]:bg-blue-600" />
                        </div>
                        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl">
                           <div className="space-y-0.5">
                              <p className="text-xs font-black text-slate-900">Ativar Outbound</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">Inicia WhatsApp sozinho</p>
                           </div>
                           <Switch checked={form.isProspectingActive} onCheckedChange={v => setForm({...form, isProspectingActive: v})} className="data-[state=checked]:bg-blue-600" />
                        </div>
                     </div>
                  </section>

                  <div className="flex gap-4 pt-6 border-t border-slate-100">
                     <Button onClick={handleSave} className="flex-[3] h-20 bg-slate-900 hover:bg-black text-white font-black rounded-3xl uppercase tracking-widest shadow-2xl transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                        <Save className="w-5 h-5 text-blue-500" /> Salvar Configurações da Jornada
                     </Button>
                     <Button onClick={() => setIsModalOpen(false)} variant="ghost" className="flex-1 h-20 rounded-3xl font-black uppercase text-xs text-slate-400">Cancelar</Button>
                  </div>
               </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
