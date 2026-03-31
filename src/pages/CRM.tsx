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
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [newLead, setNewLead] = useState({ name: "", phone: "", email: "", status: "NEW" });
  const { toast } = useToast();

  const statuses = [
    { label: "Novos", id: "NEW", color: "bg-blue-500" },
    { label: "Qualificando", id: "QUALIFYING", color: "bg-orange-500" },
    { label: "Interessados", id: "INTERESTED", color: "bg-emerald-500" },
    { label: "Agendados", id: "APPOINTMENT", color: "bg-purple-500" },
    { label: "Convertidos", id: "CONVERTED", color: "bg-slate-900" }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch (e) { toast({ title: "Erro ao carregar leads", variant: "destructive" }); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateLead = async () => {
    if (!newLead.name || !newLead.phone) return toast({ title: "Preencha Nome e Telefone", variant: "destructive" });
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLead)
      });
      if (res.ok) {
        toast({ title: "Lead cadastrado!" });
        setIsAddModalOpen(false);
        setNewLead({ name: "", phone: "", email: "", status: "NEW" });
        fetchData();
      }
    } catch (e) { toast({ title: "Falha ao salvar lead", variant: "destructive" }); }
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;
    try {
      const res = await fetch(`/api/contacts/${selectedLead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedLead)
      });
      if (res.ok) {
        toast({ title: "Lead atualizado no Pipeline!" });
        setSelectedLead(null);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm("Remover este lead permanentemente?")) return;
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
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

  const onDrop = async (e: any, newStatus: string) => {
    const leadId = e.dataTransfer.getData("leadId");
    const lead = leads.find(l => l.id === leadId);
    if (lead && lead.status !== newStatus) {
      try {
        const res = await fetch(`/api/contacts/${leadId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...lead, status: newStatus })
        });
        if (res.ok) {
          toast({ title: `🚀 Lead movido para ${newStatus}` });
          fetchData();
        }
      } catch (e) { toast({ title: "Erro ao mover lead", variant: "destructive" }); }
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1800px] mx-auto animate-in fade-in duration-700">
        
        {/* HEADER CRM COMPACTO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border-2 border-slate-50 p-8 rounded-[35px] shadow-sm relative overflow-hidden">
           <div className="space-y-1 relative z-10">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                 Sales <span className="text-emerald-500 italic">Pipeline</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Gargalo de Conversão & Oportunidades</p>
           </div>
           
           <div className="flex gap-3 relative z-10">
              <div className="relative hidden lg:block">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                 <Input placeholder="Buscar oportunidade..." className="h-12 pl-10 w-64 bg-slate-50 border-none text-slate-900 rounded-xl font-bold text-xs" />
              </div>
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="h-12 bg-slate-900 hover:bg-black px-6 rounded-xl font-black uppercase text-[10px] tracking-widest text-white shadow-lg"
              >
                 <Plus className="w-4 h-4 mr-2" /> Novo Lead
              </Button>
           </div>
        </div>

        {/* KANBAN BOARD LEAN */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {statuses.map(status => (
              <div 
                key={status.id} 
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, status.id)}
                className="bg-slate-50/50 p-4 rounded-[30px] border-2 border-transparent hover:border-emerald-200 transition-all flex flex-col gap-4 min-h-[500px]"
              >
                 <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                       <div className={`w-1.5 h-1.5 rounded-full ${status.color} shadow-sm`} />
                       <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500">{status.label}</h3>
                    </div>
                    <Badge className="bg-white text-slate-400 border border-slate-100 font-black text-[9px] h-6 px-2.5 rounded-lg">
                      {leads.filter(l => l.status === status.id).length}
                    </Badge>
                 </div>

                <ScrollArea className="h-[calc(100vh-320px)] pr-2">
                   <div className="space-y-3">
                      {leads.filter(l => l.status === status.id).map(lead => (
                        <Card 
                          key={lead.id} 
                          draggable
                          onDragStart={(e) => onDragStart(e, lead.id)}
                          onClick={() => setSelectedLead(lead)}
                          className="border-none shadow-md rounded-2xl bg-white p-4 hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300 group cursor-grab active:cursor-grabbing border-l-4 border-l-transparent hover:border-l-emerald-500"
                        >
                           <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                 <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-slate-100 text-slate-600 font-black text-[10px]">
                                       {lead.name.substring(0,2).toUpperCase()}
                                    </AvatarFallback>
                                 </Avatar>
                                 <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-slate-800 leading-tight truncate group-hover:text-emerald-500 transition-colors uppercase tracking-tight">{lead.name}</p>
                                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{lead.source || "Manual"}</p>
                                 </div>
                              </div>

                              <div className="flex items-center justify-between pt-2">
                                 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <Phone className="w-3 h-3 text-emerald-500/50" /> {lead.phone}
                                 </div>
                                 <div className="h-6 w-6 bg-slate-50 rounded-lg flex items-center justify-center text-slate-300 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
                                    <ArrowRight className="w-3 h-3" />
                                 </div>
                              </div>
                           </div>
                        </Card>
                      ))}
                      
                      {leads.filter(l => l.status === status.id).length === 0 && (
                        <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-40">
                           <Circle className="w-6 h-6 text-slate-200" />
                        </div>
                      )}
                   </div>
                </ScrollArea>
             </div>
           ))}
        </div>
      </div>

      {/* MODAL DETALHES COMPLETO (EDITAR / APAGAR EM TEMPO REAL) */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-3xl rounded-[40px]">
           <div className={`p-12 text-white relative ${statuses.find(s => s.id === selectedLead?.status)?.color || 'bg-slate-900'}`}>
              <Button onClick={() => setSelectedLead(null)} variant="ghost" className="absolute top-8 right-8 text-white/50 hover:text-white"><X className="w-6 h-6" /></Button>
              <div className="flex items-center gap-6">
                 <Avatar className="h-20 w-20 border-4 border-white/10 shadow-2xl">
                    <AvatarFallback className="bg-white/10 text-white font-black text-2xl backdrop-blur-xl">
                       {selectedLead?.name?.substring(0,2).toUpperCase()}
                    </AvatarFallback>
                 </Avatar>
                 <div className="space-y-1">
                    <h2 className="text-3xl font-black leading-none uppercase tracking-tighter">{selectedLead?.name}</h2>
                    <Badge className="bg-white/10 text-white border-none font-black text-[9px] tracking-widest uppercase py-1 px-4 backdrop-blur-md">Fase: {selectedLead?.status}</Badge>
                 </div>
              </div>
           </div>

           <div className="p-10 space-y-8 bg-white">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Nome Completo</Label>
                    <Input value={selectedLead?.name} onChange={e => setSelectedLead({...selectedLead, name: e.target.value})} className="h-14 border-2 border-slate-50 rounded-2xl font-bold bg-slate-50/20" />
                 </div>
                 <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Status no Pipeline</Label>
                    <Select value={selectedLead?.status} onValueChange={v => setSelectedLead({...selectedLead, status: v})}>
                       <SelectTrigger className="h-14 rounded-2xl border-2 border-slate-50 font-bold bg-slate-50/20">
                          <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="rounded-xl border-none shadow-2xl">
                          {statuses.map(s => <SelectItem key={s.id} value={s.id} className="font-bold">{s.label}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="col-span-2 space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Anotações da Oportunidade</Label>
                    <textarea 
                      value={selectedLead?.notes || ""} 
                      onChange={e => setSelectedLead({...selectedLead, notes: e.target.value})}
                      className="w-full min-h-[140px] p-6 border-2 border-slate-50 rounded-[30px] font-medium bg-slate-50/20 focus:ring-2 ring-emerald-500/20 outline-none transition-all text-sm leading-relaxed"
                      placeholder="Descreva o andamento da negociação..."
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
