import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, Target, Search, Filter, 
  MoreHorizontal, Plus, Star, Zap, 
  ArrowRight, CheckCircle2, AlertCircle,
  Phone, Mail, Calendar, UserPlus, Circle,
  Clock, X, Save, Trash2, Edit3
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function CRM() {
  const [leads, setLeads] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditStagesOpen, setIsEditStagesOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [newLead, setNewLead] = useState({ name: "", phone: "", email: "", stageId: "" });
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const tenantId = localStorage.getItem("tenantId");
    try {
      const [lRes, sRes] = await Promise.all([
        fetch("/api/leads", { headers: { "x-tenant-id": tenantId || "" } }),
        fetch("/api/pipeline-stages", { headers: { "x-tenant-id": tenantId || "" } })
      ]);
      const leadsData = await lRes.json();
      const stagesData = await sRes.json();
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setStages(Array.isArray(stagesData) ? stagesData : []);
      if (stagesData.length > 0 && !newLead.stageId) {
        setNewLead(prev => ({ ...prev, stageId: stagesData[0].id }));
      }
    } catch (e) { toast({ title: "Erro ao carregar dados", variant: "destructive" }); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateLead = async () => {
    if (!newLead.name || !newLead.phone) return toast({ title: "Preencha Nome e Telefone", variant: "destructive" });
    const tenantId = localStorage.getItem("tenantId");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": tenantId || ""
        },
        body: JSON.stringify(newLead)
      });
      if (res.ok) {
        toast({ title: "Lead cadastrado!" });
        setIsAddModalOpen(false);
        setNewLead({ name: "", phone: "", email: "", stageId: stages[0]?.id || "" });
        fetchData();
      }
    } catch (e) { toast({ title: "Falha ao salvar lead", variant: "destructive" }); }
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;
    const tenantId = localStorage.getItem("tenantId");
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": tenantId || ""
        },
        body: JSON.stringify({
          name: selectedLead.name,
          phone: selectedLead.phone,
          email: selectedLead.email,
          stageId: selectedLead.stageId,
          notes: selectedLead.notes,
          source: selectedLead.source
        })
      });
      if (res.ok) {
        toast({ title: "Lead atualizado!" });
        setSelectedLead(null);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm("Remover este lead permanentemente?")) return;
    const tenantId = localStorage.getItem("tenantId");
    try {
      const res = await fetch(`/api/leads/${id}`, { 
        method: "DELETE",
        headers: { "x-tenant-id": tenantId || "" }
      });
      if (res.ok) {
        toast({ title: "Lead removido." });
        setSelectedLead(null);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const onDragStart = (e: any, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const onDrop = async (e: any, newStageId: string) => {
    const leadId = e.dataTransfer.getData("leadId");
    const lead = leads.find(l => l.id === leadId);
    
    if (lead && lead.stageId !== newStageId) {
      // 🚀 Atualização Otimista (Move o card visualmente antes da API responder)
      const updatedLeads = leads.map(l => l.id === leadId ? { ...l, stageId: newStageId } : l);
      setLeads(updatedLeads);

      try {
        const tenantId = localStorage.getItem("tenantId");
        const res = await fetch(`/api/leads/${leadId}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "x-tenant-id": tenantId || ""
          },
          // Enviar apenas os campos necessários para evitar erros de validação
          body: JSON.stringify({
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            stageId: newStageId,
            notes: lead.notes,
            source: lead.source
          })
        });
        if (!res.ok) {
          fetchData(); // Se falhou na API, volta o card pro lugar original
          toast({ title: "Erro ao sincronizar com servidor", variant: "destructive" });
        } else {
          toast({ title: `🚀 Lead movido!` });
        }
      } catch (e) { 
        fetchData(); 
        toast({ title: "Erro de conexão", variant: "destructive" }); 
      }
    }
  };

  const handleAddStage = async () => {
    const name = prompt("Nome do novo pipeline:");
    if (!name) return;
    const tenantId = localStorage.getItem("tenantId");
    try {
      await fetch("/api/pipeline-stages", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": tenantId || ""
        },
        body: JSON.stringify({ name, order: stages.length })
      });
      fetchData();
    } catch (e) {}
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1800px] mx-auto animate-in fade-in duration-700">
        
        {/* HEADER CRM */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border-2 border-slate-50 p-6 rounded-[30px] shadow-sm">
           <div className="space-y-1">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                 Sales <span className="text-emerald-500 italic">Pipeline</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Gargalo de Conversão & Oportunidades</p>
           </div>
           
           <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsEditStagesOpen(true)}
                className="h-12 border-2 rounded-xl font-bold uppercase text-[10px] tracking-widest px-6"
              >
                 <Edit3 className="w-4 h-4 mr-2" /> Editar Pipelines
              </Button>
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="h-12 bg-slate-900 hover:bg-black px-6 rounded-xl font-black uppercase text-[10px] tracking-widest text-white shadow-lg"
              >
                 <Plus className="w-4 h-4 mr-2" /> Novo Lead
              </Button>
           </div>
        </div>

        {/* KANBAN BOARD */}
        <div className="flex gap-4 overflow-x-auto pb-8 snap-x">
            {stages.map(stage => (
              <div 
                key={stage.id} 
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, stage.id)}
                className="flex-shrink-0 w-80 bg-slate-50/50 p-4 rounded-[25px] border-2 border-transparent hover:border-emerald-200 transition-all flex flex-col gap-4 snap-start h-[calc(100vh-250px)]"
              >
                 <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: stage.color }} />
                       <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-600">{stage.name}</h3>
                    </div>
                    <Badge className="bg-white text-slate-400 border border-slate-100 font-black text-[10px] h-6 px-2.5 rounded-lg">
                      {leads.filter(l => l.stageId === stage.id).length}
                    </Badge>
                 </div>

                <ScrollArea className="flex-1 pr-2">
                   <div className="space-y-3">
                      {leads.filter(l => l.stageId === stage.id).map(lead => (
                        <Card 
                          key={lead.id} 
                          draggable
                          onDragStart={(e) => onDragStart(e, lead.id)}
                          onClick={() => setSelectedLead(lead)}
                          className="border-none shadow-sm rounded-xl bg-white p-3 hover:shadow-md hover:translate-y-[-2px] transition-all duration-300 group cursor-grab active:cursor-grabbing border-l-4 border-l-transparent hover:border-l-emerald-500"
                        >
                           <div className="space-y-2">
                              <p className="text-[13px] font-black text-slate-800 leading-tight truncate group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{lead.name}</p>
                              
                              <div className="flex items-center justify-between pt-1">
                                 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <Phone className="w-3 h-3 text-emerald-500/50" /> {lead.phone}
                                 </div>
                                 {lead.source && (
                                   <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-300 border-slate-100">{lead.source}</Badge>
                                 )}
                              </div>
                           </div>
                        </Card>
                      ))}
                      
                      {leads.filter(l => l.stageId === stage.id).length === 0 && (
                        <div 
                          onClick={() => { setNewLead(prev => ({...prev, stageId: stage.id})); setIsAddModalOpen(true); }}
                          className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-40 hover:opacity-100 hover:bg-white hover:border-emerald-300 cursor-pointer transition-all"
                        >
                           <Plus className="w-6 h-6 text-slate-300" />
                        </div>
                      )}
                   </div>
                </ScrollArea>
              </div>
            ))}
            
            <button 
              onClick={handleAddStage}
              className="flex-shrink-0 w-80 border-4 border-dashed border-slate-100 rounded-[25px] flex flex-col items-center justify-center gap-4 hover:border-emerald-200 group transition-all h-[calc(100vh-250px)]"
            >
               <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-emerald-500 transition-all">
                  <Plus className="w-8 h-8 text-slate-400 group-hover:text-white" />
               </div>
               <span className="font-black text-xs uppercase tracking-widest text-slate-300 group-hover:text-emerald-500">Novo Pipeline</span>
            </button>
        </div>
      </div>

      {/* MODAL DETALHES LEAD */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-3xl rounded-[40px]">
           <div className="p-12 bg-slate-900 text-white relative">
              <Button onClick={() => setSelectedLead(null)} variant="ghost" className="absolute top-8 right-8 text-white/50 hover:text-white"><X className="w-6 h-6" /></Button>
              <div className="flex items-center gap-6">
                 <Avatar className="h-20 w-20 border-4 border-white/10 shadow-2xl">
                    <AvatarFallback className="bg-emerald-500 text-white font-black text-2xl">
                       {selectedLead?.name?.substring(0,2).toUpperCase()}
                    </AvatarFallback>
                 </Avatar>
                 <div className="space-y-1">
                    <h2 className="text-3xl font-black leading-none uppercase tracking-tighter">{selectedLead?.name}</h2>
                    <Badge className="bg-white/10 text-white border-none font-black text-[9px] tracking-widest uppercase py-1 px-4 backdrop-blur-md">
                      Status: {stages.find(s => s.id === selectedLead?.stageId)?.name || "N/A"}
                    </Badge>
                 </div>
              </div>
           </div>

           <div className="p-10 space-y-8 bg-white">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Nome Completo</Label>
                    <Input value={selectedLead?.name} onChange={e => setSelectedLead({...selectedLead, name: e.target.value})} className="h-14 border-2 border-slate-50 rounded-2xl font-bold bg-slate-50/20" />
                 </div>
                 <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Pipeline Atual</Label>
                    <Select value={selectedLead?.stageId} onValueChange={v => setSelectedLead({...selectedLead, stageId: v})}>
                       <SelectTrigger className="h-14 rounded-2xl border-2 border-slate-50 font-bold bg-slate-50/20">
                          <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="rounded-xl border-none shadow-2xl">
                          {stages.map(s => <SelectItem key={s.id} value={s.id} className="font-bold">{s.name}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="col-span-2 space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Anotações</Label>
                    <textarea 
                      value={selectedLead?.notes || ""} 
                      onChange={e => setSelectedLead({...selectedLead, notes: e.target.value})}
                      className="w-full min-h-[140px] p-6 border-2 border-slate-50 rounded-[30px] font-medium bg-slate-50/20 outline-none transition-all text-sm"
                      placeholder="Descreva o andamento..."
                    />
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                 <Button onClick={handleUpdateLead} className="flex-[4] h-16 bg-slate-900 hover:bg-black text-white font-black rounded-2xl uppercase tracking-widest shadow-2xl transition-all">
                    <Save className="w-5 h-5 mr-3 text-emerald-500" /> Atualizar Pipeline
                 </Button>
                 <Button onClick={() => handleDeleteLead(selectedLead.id)} variant="outline" className="flex-1 h-16 border-2 border-red-50 text-red-500 hover:bg-red-50 hover:text-red-600 font-black rounded-2xl transition-all uppercase tracking-widest">
                    <Trash2 className="w-5 h-5" />
                 </Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* MODAL EDITAR STAGES */}
      <Dialog open={isEditStagesOpen} onOpenChange={setIsEditStagesOpen}>
        <DialogContent className="max-w-md p-10 rounded-[40px] border-none shadow-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-emerald-500" /> Gerenciar Pipelines
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
             {stages.map((s, idx) => (
               <div key={s.id} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <Input 
                    value={s.name} 
                    onChange={async (e) => {
                      const newStages = [...stages];
                      newStages[idx].name = e.target.value;
                      setStages(newStages);
                      const tenantId = localStorage.getItem("tenantId");
                      await fetch(`/api/pipeline-stages/${s.id}`, {
                        method: "PUT",
                        headers: { 
                          "Content-Type": "application/json",
                          "x-tenant-id": tenantId || ""
                        },
                        body: JSON.stringify({ name: e.target.value })
                      });
                    }}
                    className="border-none bg-transparent font-bold text-xs" 
                  />
                  <Button variant="ghost" size="icon" onClick={async () => {
                    const tenantId = localStorage.getItem("tenantId");
                    if (confirm("Deletar stage? Todos os leads nela ficarão órfãos.")) {
                       await fetch(`/api/pipeline-stages/${s.id}`, { 
                         method: "DELETE",
                         headers: { "x-tenant-id": tenantId || "" }
                       });
                       fetchData();
                    }
                  }}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
               </div>
             ))}
             <Button onClick={handleAddStage} variant="ghost" className="w-full h-12 border-2 border-dashed border-slate-200 rounded-xl font-bold uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-50">
                + Adicionar Etapa
             </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* MODAL NOVO LEAD */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="rounded-[40px] p-10 max-w-lg border-none shadow-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <div className="bg-emerald-500 p-2 rounded-xl shadow-lg"><UserPlus className="text-white w-5 h-5" /></div> Adicionar Lead
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Nome do Contato</Label>
              <Input value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} className="h-14 rounded-2xl border-2 border-slate-50 font-bold bg-slate-50/20" placeholder="Ex: Roberto Carlos" />
            </div>
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">WhatsApp / Telefone</Label>
              <Input value={newLead.phone} onChange={e => setNewLead({...newLead, phone: e.target.value})} className="h-14 rounded-2xl border-2 border-slate-50 font-bold bg-slate-50/20" placeholder="55..." />
            </div>
          </div>
          <DialogFooter>
             <Button onClick={handleCreateLead} className="w-full h-16 bg-slate-900 hover:bg-black text-white font-black rounded-2xl uppercase tracking-widest text-sm transition-all shadow-2xl">
               Salvar Lead no Pipeline
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
