import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Zap, Plus, Trash2, Edit3, Settings, 
  Play, Pause, RefreshCw, BarChart,
  ArrowRight, Search, Filter, ShieldCheck, 
  Settings2, Activity, CheckCircle2, AlertCircle,
  MoreVertical, Clock, Save, Code, MessageCircle, Split, Globe, Timer, X, UserPlus, MessageSquare, Target
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Automations() {
  const [autos, setAutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedAuto, setSelectedAuto] = useState<any | null>(null);
  const [newAuto, setNewAuto] = useState({ name: "", trigger: "NEW_LEAD", description: "" });
  const [builderSteps, setBuilderSteps] = useState<any[]>([]);
  const { toast } = useToast();

  const triggers = [
    { id: "NEW_LEAD", label: "Novo Lead Cadastrado", icon: <UserPlus className="w-4 h-4" /> },
    { id: "KEYWORD", label: "Palavra-chave no Chat", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "PIPELINE_MOVE", label: "Mudança de Status CRM", icon: <Target className="w-4 h-4" /> },
    { id: "ABANDONED", label: "Carrinho Abandonado", icon: <Zap className="w-4 h-4" /> }
  ];

  const stepTypes = [
     { id: "SEND_MSG", label: "Enviar WhatsApp", icon: <MessageCircle className="w-4 h-4" />, color: "bg-emerald-500" },
     { id: "WAIT", label: "Aguardar Tempo", icon: <Timer className="w-4 h-4" />, color: "bg-blue-500" },
     { id: "AI_QUALIFY", label: "Qualificar com IA", icon: <Zap className="w-4 h-4" />, color: "bg-purple-500" },
     { id: "HTTP_REQ", label: "Chamada Webhook API", icon: <Globe className="w-4 h-4" />, color: "bg-slate-900" },
     { id: "CONDITION", label: "Condição (IF/ELSE)", icon: <Split className="w-4 h-4" />, color: "bg-orange-500" }
  ];

  const fetchData = async () => {
    try {
      const res = await fetch("/api/automations");
      const data = await res.json();
      setAutos(Array.isArray(data) ? data : []);
    } catch (e) {
      toast({ title: "Erro nas automações", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateAuto = async () => {
    if (!newAuto.name || !newAuto.trigger) return toast({ title: "Preencha o nome do fluxo", variant: "destructive" });
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAuto)
      });
      if (res.ok) {
        toast({ title: "Workflow Criado!" });
        setIsAddModalOpen(false);
        setNewAuto({ name: "", trigger: "NEW_LEAD", description: "" });
        fetchData();
      }
    } catch (e) { toast({ title: "Falha ao criar", variant: "destructive" }); }
  };

  const toggleAuto = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !current })
      });
      if (res.ok) {
         toast({ title: current ? "Fluxo Pausado" : "Fluxo Ativado" });
         fetchData();
      }
    } catch (e) { toast({ title: "Erro ao alternar status", variant: "destructive" }); }
  };

  const deleteAuto = async (id: string) => {
    if (!confirm("Deletar esta automação permanentemente?")) return;
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    fetchData();
  };

  const openBuilder = (auto: any) => {
    setSelectedAuto(auto);
    try {
      setBuilderSteps(JSON.parse(auto.nodes || "[]"));
    } catch(e) { setBuilderSteps([]); }
    setIsBuilderOpen(true);
  };

  const handleSaveWorkflow = async () => {
    try {
      const res = await fetch(`/api/automations/${selectedAuto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: JSON.stringify(builderSteps) })
      });
      if (res.ok) {
        toast({ title: "💎 Workflow Salvo!", description: "Sua lógica de automação foi atualizada." });
        setIsBuilderOpen(false);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const addStep = (typeId: string) => {
    const type = stepTypes.find(t => t.id === typeId);
    setBuilderSteps([...builderSteps, { 
      id: Date.now().toString(), 
      type: typeId, 
      label: type?.label, 
      config: {}, 
      icon: typeId 
    }]);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 p-6 lg:p-10 max-w-[1600px] mx-auto animate-in slide-in-from-top duration-700">
        
        {/* HEADER AUTOMAÇÕES */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="space-y-1">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                 Hub de <span className="text-emerald-500 italic">Automações</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cérebro Operacional e Fluxos de Atendimentos</p>
           </div>
           
           <div className="flex gap-4">
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="h-12 bg-emerald-500 hover:bg-emerald-600 px-8 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-xl shadow-emerald-500/20"
              >
                 <Plus className="w-4 h-4 mr-2" /> Criar Workflow
              </Button>
           </div>
        </div>

        {/* WORKFLOW GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {autos.map(auto => (
             <Card key={auto.id} className="border-none shadow-xl rounded-[40px] bg-white overflow-hidden hover:translate-y-[-4px] transition-all duration-300 group">
                <CardContent className="p-0">
                   <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between group-hover:bg-slate-900 transition-colors">
                      <div className="flex items-center gap-4">
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all ${auto.active ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                            <Zap className="w-8 h-8" />
                         </div>
                         <div className="space-y-1">
                            <h3 className="text-lg font-black text-slate-800 tracking-tight group-hover:text-white transition-colors">{auto.name}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-white/40">{auto.trigger}</p>
                         </div>
                      </div>
                      <Switch 
                        checked={auto.active} 
                        onCheckedChange={() => toggleAuto(auto.id, auto.active)}
                        className="data-[state=checked]:bg-emerald-500" 
                      />
                   </div>

                   <div className="p-8 space-y-6">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                         <p className="text-[9px] font-black text-slate-300 uppercase">Execuções</p>
                         <p className="text-xl font-black text-slate-700 italic">{auto.executions}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                         <div className="flex gap-2">
                            <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl hover:bg-slate-50">
                               <Settings2 className="w-5 h-5 text-slate-300" />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl hover:bg-red-50 hover:text-red-500" onClick={() => deleteAuto(auto.id)}>
                               <Trash2 className="w-5 h-5" />
                            </Button>
                         </div>
                          <button onClick={() => openBuilder(auto)} className="text-emerald-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                             Configurar Workflow <ArrowRight className="w-4 h-4" />
                          </button>
                      </div>
                   </div>
                </CardContent>
             </Card>
           ))}
        </div>
      </div>

      {/* MODAL NOVO WORKFLOW */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="rounded-[40px] p-10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Zap className="text-emerald-500" /> Novo Workflow
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-widest">Nome da Automação</Label>
              <Input value={newAuto.name} onChange={e => setNewAuto({...newAuto, name: e.target.value})} className="h-14 rounded-2xl border-2 border-slate-50" placeholder="Ex: Boas-vindas WhatsApp" />
            </div>
             <div className="space-y-2">
               <Label className="font-bold text-xs uppercase tracking-widest pl-1">Gatilho (Trigger)</Label>
               <Select value={newAuto.trigger} onValueChange={v => setNewAuto({...newAuto, trigger: v})}>
                  <SelectTrigger className="h-14 rounded-2xl border-2 border-slate-50 font-bold bg-slate-50/20">
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                     {triggers.map(t => <SelectItem key={t.id} value={t.id} className="font-bold py-3">{t.label}</SelectItem>)}
                  </SelectContent>
               </Select>
             </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-widest">Descrição do Fluxo</Label>
              <Textarea value={newAuto.description} onChange={e => setNewAuto({...newAuto, description: e.target.value})} className="min-h-[100px] rounded-2xl border-2 border-slate-50" placeholder="O que este fluxo faz?" />
            </div>
          </div>
          <DialogFooter>
             <Button onClick={handleCreateAuto} className="w-full h-16 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl uppercase tracking-widest text-sm transition-all shadow-2xl">
               <Save className="w-4 h-4 mr-2 text-emerald-500" /> Ativar Automação
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
       {/* BUILDER MODAL (Requirement 7) */}
      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className="max-w-[1200px] h-[90vh] p-0 overflow-hidden border-none shadow-3xl rounded-[40px] flex flex-col bg-slate-50">
           <div className="p-8 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="bg-emerald-500 p-2.5 rounded-xl shadow-lg"><Zap className="text-white w-5 h-5" /></div>
                 <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">{selectedAuto?.name}</h2>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest italic">Workflow Visual Builder</p>
                 </div>
              </div>
              <div className="flex gap-3">
                 <Button onClick={() => setIsBuilderOpen(false)} variant="ghost" className="h-12 w-12 rounded-2xl text-slate-300 hover:text-slate-900"><X className="w-5 h-5" /></Button>
                 <Button onClick={handleSaveWorkflow} className="h-12 bg-slate-900 hover:bg-black px-8 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-xl">
                    <Save className="w-4 h-4 mr-2 text-emerald-500" /> Salvar Lógica
                 </Button>
              </div>
           </div>

           <div className="flex-1 flex overflow-hidden">
              {/* SIDEBAR PALETTE */}
              <div className="w-72 bg-white border-r border-slate-100 p-6 flex flex-col gap-6">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Blocos de Ações</h4>
                 <div className="grid gap-4">
                    {stepTypes.map(st => (
                       <button 
                         key={st.id} 
                         onClick={() => addStep(st.id)}
                         className="flex items-center gap-4 p-4 rounded-[25px] hover:bg-slate-50 active:scale-95 transition-all text-left border border-transparent hover:border-slate-100 group"
                       >
                          <div className={`w-10 h-10 ${st.color} rounded-xl flex items-center justify-center text-white shadow-lg`}>{st.icon}</div>
                          <span className="text-[11px] font-black uppercase text-slate-600 tracking-tight group-hover:text-slate-900">{st.label}</span>
                       </button>
                    ))}
                 </div>
                 <div className="mt-auto p-4 bg-emerald-50 border border-emerald-100 rounded-3xl">
                    <p className="text-[9px] font-bold text-emerald-700 leading-normal uppercase">Dica: Adicione blocos para construir a jornada do seu lead em tempo real.</p>
                 </div>
              </div>

              {/* BUILDER CANVAS */}
              <div className="flex-1 overflow-auto p-12 relative flex flex-col items-center gap-8">
                 {/* START NODE */}
                 <div className="flex flex-col items-center gap-4">
                    <div className="px-8 py-4 bg-white shadow-xl rounded-full border-2 border-emerald-100 flex items-center gap-3">
                       <Play className="text-emerald-500 w-4 h-4" />
                       <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 italic">Início: {selectedAuto?.trigger}</span>
                    </div>
                    <div className="w-0.5 h-8 bg-slate-200" />
                 </div>

                 {builderSteps.map((step, idx) => (
                    <div key={step.id} className="flex flex-col items-center gap-4 group">
                       <div className="relative">
                          <Card className="w-80 p-6 rounded-[35px] border-none shadow-2xl bg-white hover:scale-105 transition-all duration-300 ring-2 ring-transparent hover:ring-emerald-500/20">
                             <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 ${stepTypes.find(t => t.id === step.type)?.color || 'bg-slate-200'} rounded-2xl flex items-center justify-center text-white shadow-xl`}>
                                   {stepTypes.find(t => t.id === step.type)?.icon}
                                </div>
                                <div className="flex-1">
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{step.type}</p>
                                   <p className="text-[12px] font-black text-slate-900 italic">{step.label}</p>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => setBuilderSteps(builderSteps.filter(s => s.id !== step.id))}
                                  className="w-8 h-8 rounded-xl text-slate-200 hover:text-red-500"
                                >
                                   <Trash2 className="w-3 h-3" />
                                </Button>
                             </div>
                             <div className="mt-6 space-y-4">
                                {step.type === 'SEND_MSG' && (
                                   <Input placeholder="Mensagem Customizada" className="h-10 text-[10px] rounded-xl border-slate-50 bg-slate-50/50" />
                                )}
                                {step.type === 'WAIT' && (
                                   <Input placeholder="Tempo (ex: 2h)" className="h-10 text-[10px] rounded-xl border-slate-50 bg-slate-50/50" />
                                )}
                             </div>
                          </Card>
                       </div>
                       {idx < builderSteps.length - 1 && <div className="w-0.5 h-8 bg-slate-200" />}
                    </div>
                 ))}

                 {builderSteps.length === 0 && (
                    <div className="flex flex-col items-center gap-4 py-20 opacity-30">
                       <div className="w-16 h-16 rounded-full border-4 border-dashed border-slate-300 flex items-center justify-center">
                          <Plus className="text-slate-300" />
                       </div>
                       <p className="text-xs font-black uppercase tracking-widest text-slate-400">Arraste um bloco do menu lateral</p>
                    </div>
                 )}
              </div>
           </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
