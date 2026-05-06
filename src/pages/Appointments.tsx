import { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, 
  Trash2, Plus, ArrowRight, User, 
  Search, Filter, Smartphone, MoreHorizontal,
  ChevronRight, CalendarDays, Save, LayoutGrid, List,
  Calendar as LucideCalendar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isSameDay, isToday, isTomorrow, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";

interface Appointment {
  id: string;
  title: string;
  date: string;
  notes?: string;
  status: string;
  leadId: string;
  lead?: {
    id: string;
    name: string;
    phone: string;
  };
}

export default function Appointments() {
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAppt, setNewAppt] = useState({ title: "", date: "", leadId: "", notes: "" });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "upcoming">("upcoming");
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const [aRes, lRes] = await Promise.all([
        fetch("/api/appointments", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/leads", { headers: { "Authorization": `Bearer ${token}` } })
      ]);
      const aData = await aRes.json();
      const lData = await lRes.json();
      setAppts(Array.isArray(aData) ? aData : []);
      setLeads(Array.isArray(lData) ? lData : []);
    } catch (e) {
      toast({ title: "Erro na agenda", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateAppt = async () => {
    if (!newAppt.title || !newAppt.date || !newAppt.leadId) {
      return toast({ title: "Dados incompletos", variant: "destructive" });
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(newAppt)
      });
      if (res.ok) {
        toast({ title: "Compromisso Agendado!" });
        setIsAddModalOpen(false);
        setNewAppt({ title: "", date: "", leadId: "", notes: "" });
        fetchData();
      }
    } catch (e) { toast({ title: "Falha ao agendar", variant: "destructive" }); }
  };

  const deleteAppt = async (id: string) => {
    if (!confirm("Remover este compromisso?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/appointments/${id}`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        toast({ title: "Agendamento removido" });
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const toggleComplete = async (appt: Appointment) => {
    try {
      const token = localStorage.getItem("token");
      const newStatus = appt.status === "COMPLETED" ? "PENDING" : "COMPLETED";
      const res = await fetch(`/api/appointments/${appt.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        toast({ title: newStatus === "COMPLETED" ? "Reunião Concluída! ✅" : "Status resetado." });
        fetchData();
      }
    } catch (e) { toast({ title: "Ops! Erro ao atualizar", variant: "destructive" }); }
  };

  const stats = (() => {
    const now = new Date();
    const monthAppts = appts.filter(a => {
      const d = new Date(a.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const completed = monthAppts.filter(a => a.status === "COMPLETED").length;
    const rate = monthAppts.length > 0 ? Math.round((completed / monthAppts.length) * 100) : 0;
    return { total: monthAppts.length, rate };
  })();

  const filteredAppts = appts.filter(appt => {
    const apptDate = new Date(appt.date);
    
    // Visão "Próximos" mostra TUDO que for futuro ou hoje
    if (viewMode === "upcoming") {
      return apptDate >= new Date(new Date().setHours(0,0,0,0)); 
    }
    
    if (!selectedDate) return true;

    if (viewMode === "day") {
      return isSameDay(apptDate, selectedDate);
    } else if (viewMode === "week") {
      return isWithinInterval(apptDate, {
        start: startOfWeek(selectedDate, { weekStartsOn: 0 }),
        end: endOfWeek(selectedDate, { weekStartsOn: 0 })
      });
    } else {
      return isWithinInterval(apptDate, {
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate)
      });
    }
  }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const groupedAppts = filteredAppts.reduce((acc: any, appt) => {
    try {
      const dateStr = format(new Date(appt.date), "yyyy-MM-dd");
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(appt);
    } catch (e) {
      console.warn("[Agenda] Erro ao agrupar agendamento:", appt.id, e.message);
    }
    return acc;
  }, {});

  const getDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T12:00:00");
      if (isToday(d)) return "Hoje";
      if (isTomorrow(d)) return "Amanhã";
      return format(d, "eeee, d 'de' MMMM", { locale: ptBR });
    } catch (e) { return "Data Inválida"; }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-screen-2xl mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="space-y-1">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-emerald-500/10 rounded-2xl">
                    <CalendarIcon className="w-6 h-6 text-emerald-500" />
                 </div>
                 <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
                    Agenda de <span className="text-emerald-500 italic">Negócios</span>
                 </h1>
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] pl-[52px]">Gestão de Reuniões e Call de Fechamento</p>
           </div>
           
           <div className="flex items-center gap-3">
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="h-14 bg-slate-900 hover:bg-black px-8 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-2xl transition-all hover:-translate-y-1 active:scale-95"
              >
                 <Plus className="w-5 h-5 mr-3 text-emerald-400" /> Novo Agendamento
              </Button>
           </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
           
           <div className="xl:col-span-1 space-y-6">
              <Card className="border-none shadow-3xl rounded-[40px] bg-white overflow-hidden">
                 <CardHeader className="pb-0 pt-8 px-8">
                    <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-tighter">Explorar Data</CardTitle>
                 </CardHeader>
                 <div className="p-4 flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-3xl border-none font-bold"
                      locale={ptBR}
                    />
                 </div>
              </Card>

              <Card className="border-none shadow-3xl rounded-[40px] bg-slate-900 p-8 text-white space-y-6">
                 <div>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Visão Rápida</p>
                    <h4 className="text-xl font-black">Performance SDR</h4>
                 </div>
                 <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                       <span className="text-xs font-bold text-slate-400">Total no Mês</span>
                       <span className="text-lg font-black text-white">{stats.total}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                       <span className="text-xs font-bold text-slate-400">Taxa de Show</span>
                       <span className="text-lg font-black text-emerald-400">{stats.rate}%</span>
                    </div>
                 </div>
              </Card>
           </div>

           <div className="xl:col-span-3 space-y-6">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
                 <div className="flex items-center justify-between bg-white p-2 rounded-3xl shadow-xl border border-slate-50 mb-8">
                    <TabsList className="bg-transparent border-none">
                       <TabsTrigger value="day" className="h-11 px-8 rounded-2xl data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all">Dia</TabsTrigger>
                       <TabsTrigger value="week" className="h-11 px-8 rounded-2xl data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all">Semana</TabsTrigger>
                       <TabsTrigger value="month" className="h-11 px-8 rounded-2xl data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all">Mês</TabsTrigger>
                       <TabsTrigger value="upcoming" className="h-11 px-8 rounded-2xl data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all">Próximos</TabsTrigger>
                    </TabsList>
                    
                    <div className="flex items-center gap-3 pr-2">
                       <div className="hidden md:flex items-center bg-slate-50 rounded-2xl px-4 py-2 border border-slate-100">
                          <CalendarDays className="w-4 h-4 text-emerald-500 mr-3" />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                             {format(selectedDate || new Date(), "MMMM yyyy", { locale: ptBR })}
                          </span>
                       </div>
                    </div>
                 </div>

                 <ScrollArea className="h-[calc(100vh-320px)] pr-6">
                    <div className="space-y-12">
                       {Object.keys(groupedAppts).length > 0 ? (
                         Object.keys(groupedAppts).map(dateKey => (
                           <div key={dateKey} className="space-y-6">
                              <div className="flex items-center gap-4">
                                 <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic pl-2">{getDateLabel(dateKey)}</h2>
                                 <div className="flex-1 h-px bg-slate-100" />
                              </div>

                              <div className="grid grid-cols-1 gap-4">
                                 {groupedAppts[dateKey].map((appt: Appointment) => (
                                   <Card key={appt.id} className="group border-none shadow-xl hover:shadow-2xl rounded-[35px] bg-white transition-all duration-500 overflow-hidden hover:translate-x-2 border-l-8 border-emerald-500">
                                      <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                                         <div className="flex items-center gap-8 w-full md:w-auto">
                                            <div className="flex flex-col items-center justify-center min-w-[80px]">
                                               <span className="text-3xl font-black text-slate-900 tracking-tighter italic -mb-1">
                                                 {(() => {
                                                   try { return format(new Date(appt.date), "HH:mm"); } catch(e) { return "--:--"; }
                                                 })()}
                                               </span>
                                               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                                 {(() => {
                                                   try { return format(new Date(appt.date), "aaa"); } catch(e) { return ""; }
                                                 })()}
                                               </span>
                                            </div>
                                            
                                            <div className="h-12 w-px bg-slate-100 hidden md:block" />

                                            <div className="space-y-1">
                                               <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none group-hover:text-emerald-600 transition-colors">{appt.title}</h3>
                                               <div className="flex items-center gap-3">
                                                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                                                     <User className="w-3 h-3 text-slate-400" />
                                                     <span className="text-[10px] font-bold text-slate-500 uppercase">{appt.lead?.name || "Contato"}</span>
                                                  </div>
                                                  <Badge className={cn(
                                                    "text-[8px] font-black uppercase tracking-tighter px-2 h-5 border-none",
                                                    appt.status === "SCHEDULED" ? "bg-indigo-500 text-white" :
                                                    appt.status === "COMPLETED" ? "bg-emerald-500 text-white" :
                                                    appt.status === "CANCELLED" ? "bg-red-500 text-white" :
                                                    appt.status === "NOSHOW" ? "bg-orange-500 text-white" :
                                                    "bg-slate-200 text-slate-600"
                                                  )}>
                                                    {appt.status === "SCHEDULED" ? "Agendado" : 
                                                     appt.status === "COMPLETED" ? "Concluído" :
                                                     appt.status === "CANCELLED" ? "Cancelado" :
                                                     appt.status === "NOSHOW" ? "No-Show" : "Pendente"}
                                                  </Badge>
                                               </div>
                                            </div>
                                         </div>

                                         <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                                            <Button 
                                              onClick={() => toggleComplete(appt)}
                                              className={cn(
                                                "px-5 py-2.5 rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-sm transition-all",
                                                appt.status === "COMPLETED" 
                                                  ? "bg-emerald-500 text-white hover:bg-emerald-600" 
                                                  : "bg-slate-100 text-slate-500 hover:bg-emerald-500 hover:text-white"
                                              )}
                                            >
                                               {appt.status === "COMPLETED" ? <><CheckCircle2 className="w-3 h-3 mr-2" /> Concluído</> : "Marcar Concluído"}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="w-12 h-12 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all text-slate-200" onClick={() => deleteAppt(appt.id)}>
                                               <Trash2 className="w-5 h-5" />
                                            </Button>
                                         </div>
                                      </div>
                                   </Card>
                                 ))}
                              </div>
                           </div>
                         ))
                       ) : (
                         <div className="py-24 text-center border-4 border-dashed border-slate-100 rounded-[60px] flex flex-col items-center justify-center gap-8 bg-white/50">
                            <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center relative">
                               <LucideCalendar className="w-10 h-10 text-slate-200" />
                               <div className="absolute top-0 right-0 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white animate-pulse" />
                            </div>
                            <div className="space-y-2">
                               <p className="text-lg font-black text-slate-900 tracking-tighter uppercase">Nenhum agendamento encontrado</p>
                               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-12">Experimente mudar o filtro de data ou criar uma nova reunião.</p>
                            </div>
                            <Button onClick={() => setIsAddModalOpen(true)} variant="outline" className="h-12 border-2 border-slate-100 rounded-2xl px-8 font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 hover:text-white transition-all">
                               Agendar Agora
                            </Button>
                         </div>
                       )}
                    </div>
                 </ScrollArea>
              </Tabs>
           </div>
        </div>
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="rounded-[40px] p-10 max-w-lg border-none shadow-3xl bg-white overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-2">
              Nova <span className="text-emerald-500 italic">Reunião</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preencha os detalhes para travar a agenda do SDR.</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-8">
            <div className="space-y-3">
              <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Título do Compromisso</Label>
              <Input 
                value={newAppt.title} 
                onChange={e => setNewAppt({...newAppt, title: e.target.value})} 
                className="h-14 rounded-2xl border-none bg-slate-50 font-bold text-slate-900 px-6 focus:ring-2 focus:ring-emerald-500 transition-all" 
                placeholder="Ex: Call de Fechamento Vendas" 
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-3">
                 <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Data e Hora</Label>
                 <Input 
                   type="datetime-local" 
                   value={newAppt.date} 
                   onChange={e => setNewAppt({...newAppt, date: e.target.value})} 
                   className="h-14 rounded-2xl border-none bg-slate-50 font-bold text-slate-900 px-6 focus:ring-2 focus:ring-emerald-500 transition-all" 
                 />
               </div>
               
               <div className="space-y-3">
                 <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Vincular Lead</Label>
                 <Select value={newAppt.leadId} onValueChange={v => setNewAppt({...newAppt, leadId: v})}>
                   <SelectTrigger className="h-14 rounded-2xl border-none bg-slate-50 font-bold text-slate-900 px-6 focus:ring-2 focus:ring-emerald-500 transition-all">
                     <SelectValue placeholder="Selecione..." />
                   </SelectTrigger>
                   <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                     {leads.map(l => (
                       <SelectItem key={l.id} value={l.id} className="font-bold py-3">
                         {l.name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
            </div>

            <div className="space-y-3">
              <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Notas Adicionais</Label>
              <Input 
                value={newAppt.notes} 
                onChange={e => setNewAppt({...newAppt, notes: e.target.value})} 
                className="h-14 rounded-2xl border-none bg-slate-50 font-bold text-slate-900 px-6 focus:ring-2 focus:ring-emerald-500 transition-all" 
                placeholder="Observações importantes..." 
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
             <Button 
               onClick={handleCreateAppt} 
               className="w-full h-16 bg-slate-900 hover:bg-black text-white font-black rounded-3xl uppercase tracking-widest text-sm transition-all shadow-2xl hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3"
             >
               <Save className="w-5 h-5 text-emerald-400" /> Confirmar e Salvar
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
