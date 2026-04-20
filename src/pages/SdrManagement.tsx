import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Bot, Plus, Trash2, Brain, Zap, Globe, Save, RefreshCw, Sliders, User, ShieldCheck, Clock, CheckCircle2, MessageSquare, Upload, FileText, FileJson, Power
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";

export default function SdrManagement() {
  const [sdrs, setSdrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSdr, setEditingSdr] = useState<any>(null);

  const [form, setForm] = useState({
    name: "",
    role: "SDR",
    prompt: "",
    knowledgeBase: "",
    trainingUrls: "",
    responseDelay: 2000,
    voiceTone: "PROFESSIONAL",
    escalationKeywords: "atendente, falar com humano, ajuda, queima, dor, bolha",
    followUpInterval: 120,
    preConfirmationHours: 12,
    noShowGraceMinutes: 15,
    postServiceCheckHours: 24,
    enableWaitlist: true,
    active: true
  });
  
  const [uploading, setUploading] = useState(false);

  const [hasWhatsApp, setHasWhatsApp] = useState<boolean>(false);

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    try {
      const [sdrsRes, settingsRes] = await Promise.all([
        fetch("/api/sdrs", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/tenant/settings", { headers: { "Authorization": `Bearer ${token}` } })
      ]);
      
      const sdrData = await sdrsRes.json();
      const settingsData = await settingsRes.json();
      
      setSdrs(Array.isArray(sdrData) ? sdrData : []);
      setHasWhatsApp(!!settingsData.hasWhatsAppConnection);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenModal = (sdr: any = null) => {
    if (sdr) {
      setEditingSdr(sdr);
      setForm({
        name: sdr.name || "",
        role: sdr.role || "SDR",
        prompt: sdr.prompt || "",
        knowledgeBase: sdr.knowledgeBase || "",
        trainingUrls: sdr.trainingUrls || "",
        responseDelay: sdr.responseDelay || 2000,
        voiceTone: sdr.voiceTone || "PROFESSIONAL",
        escalationKeywords: sdr.escalationKeywords || "atendente, falar com humano, ajuda, queima, dor, bolha",
        followUpInterval: sdr.followUpInterval || 120,
        preConfirmationHours: sdr.preConfirmationHours || 12,
        noShowGraceMinutes: sdr.noShowGraceMinutes || 15,
        postServiceCheckHours: sdr.postServiceCheckHours || 24,
        enableWaitlist: sdr.enableWaitlist ?? true,
        active: sdr.active ?? true
      });
    } else {
      setEditingSdr(null);
      setForm({
        name: "",
        role: "SDR",
        prompt: "Você é um SDR amigável focado em conversão e agendamento.",
        knowledgeBase: "",
        trainingUrls: "",
        responseDelay: 2000,
        voiceTone: "PROFESSIONAL",
        escalationKeywords: "atendente, falar com humano, ajuda, queima, dor, bolha",
        followUpInterval: 120,
        preConfirmationHours: 12,
        noShowGraceMinutes: 15,
        postServiceCheckHours: 24,
        enableWaitlist: true,
        active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast({ title: "Nome obrigatório", variant: "destructive" });
    const token = localStorage.getItem("token");
    try {
      const url = editingSdr ? `/api/sdrs/${editingSdr.id}` : "/api/sdrs";
      const method = editingSdr ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        toast({ title: editingSdr ? "🧠 Parâmetros Atualizados" : "🤖 SDR Contratado" });
        setIsModalOpen(false);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const handleFileUpload = async (e: any) => {
    console.log(`[Neural-Training] Iniciando upload para SDR: ${editingSdr?.id}`);
    const file = e.target.files[0];
    if (!file || !editingSdr) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`/api/sdrs/${editingSdr.id}/training`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "📚 Conhecimento Absorvido", description: "O SDR agora é especialista no documento enviado." });
        setForm({...form, knowledgeBase: data.sdr.knowledgeBase});
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast({ title: "Erro no treinamento", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteSdr = async (id: string) => {
    if (!confirm("Remover este robô do time?")) return;
    const token = localStorage.getItem("token");
    await fetch(`/api/sdrs/${id}`, { 
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    fetchData();
    toast({ title: "🗑️ Removido" });
  };

  const toggleSdrActive = async (sdr: any) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/sdrs/${sdr.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ...sdr, active: !sdr.active })
      });
      if (res.ok) {
        toast({ title: !sdr.active ? "🟢 Robô Ativado" : "🔴 Robô Desativado" });
        fetchData();
      }
    } catch (e) {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 p-6 lg:p-10 max-w-screen-2xl mx-auto">
        
        {/* HEADER ESTRATÉGICO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-12 rounded-[50px] shadow-3xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 blur-[130px] rounded-full translate-x-1/2 -translate-y-1/2" />
           <div className="space-y-3 relative z-10">
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase flex items-center gap-4">
                 Frota de <span className="text-emerald-500 italic">SDRs IA</span>
              </h1>
              <p className="text-white/30 font-bold uppercase tracking-widest text-[9px] pl-[56px] leading-relaxed max-w-md">Gerencie e treine seu time de SDRs inteligentes para atuar em qualquer tipo de negócio.</p>
           </div>
           
           <div className="flex flex-col items-end gap-2 relative z-10">
              <Button 
                onClick={() => hasWhatsApp ? handleOpenModal() : toast({ title: "WhatsApp Necessário", description: "Conecte um WhatsApp antes de contratar um SDR.", variant: "destructive" })} 
                className={`h-16 px-10 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl transition-all hover:-translate-y-1 text-white ${!hasWhatsApp ? 'bg-slate-700 cursor-not-allowed border-none' : 'bg-emerald-500 hover:bg-emerald-600'}`}
              >
                <Plus className="w-5 h-5 mr-3" /> Contratar SDR
              </Button>
              {!hasWhatsApp && (
                <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Requer conexão WhatsApp</p>
              )}
           </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-30">
             <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin" />
             <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando IA...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sdrs.map(sdr => (
              <Card key={sdr.id} className="border-none shadow-2xl rounded-[45px] bg-white overflow-hidden hover:scale-[1.01] transition-all group relative">
                <div className="p-8 bg-slate-50 flex items-center justify-between group-hover:bg-slate-900 transition-all duration-500">
                   <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-white group-hover:bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg transition-all">
                         <Bot className="w-7 h-7 text-slate-800 group-hover:text-white" />
                      </div>
                      <div>
                         <h3 className="text-slate-900 group-hover:text-white font-black text-lg leading-none uppercase">{sdr.name}</h3>
                         <Badge className="bg-emerald-500/10 text-emerald-600 font-black text-[8px] mt-1 uppercase border-none">{sdr.role}</Badge>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSdrActive(sdr); }}
                        className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-full border transition-all ${sdr.active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700 text-slate-400 group-hover:bg-slate-800'}`}
                        title={sdr.active ? "Desativar SDR" : "Ativar SDR"}
                      >
                         <Power className={`w-4 h-4 ${sdr.active ? 'text-emerald-500' : 'text-slate-400'}`} />
                         <span className="text-[9px] font-black uppercase tracking-widest leading-none">{sdr.active ? 'ON' : 'OFF'}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" onClick={(e) => { e.stopPropagation(); deleteSdr(sdr.id); }}>
                         <Trash2 className="w-5 h-5" />
                      </Button>
                   </div>
                </div>
                
                <div className="p-8 space-y-6">
                   <div className="grid grid-cols-3 gap-2">
                      <div className="bg-slate-50 p-3 rounded-2xl text-center">
                         <MessageSquare className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                         <span className="text-[9px] font-black text-slate-800 block">{sdr.followUpInterval}m</span>
                         <span className="text-[7px] font-bold text-slate-400 uppercase">Followup</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl text-center">
                         <Clock className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                         <span className="text-[9px] font-black text-slate-800 block">{sdr.preConfirmationHours}h</span>
                         <span className="text-[7px] font-bold text-slate-400 uppercase">Confirm</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl text-center">
                         <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                         <span className="text-[9px] font-black text-slate-800 block">{sdr.enableWaitlist ? "ON" : "OFF"}</span>
                         <span className="text-[7px] font-bold text-slate-400 uppercase">Encaixe</span>
                      </div>
                   </div>

                   <Button onClick={() => handleOpenModal(sdr)} className="w-full h-14 bg-slate-900 hover:bg-black text-white font-black rounded-2xl uppercase text-[10px] tracking-widest transition-all">
                      Ajustar Parâmetros IA
                   </Button>
                </div>
              </Card>
            ))}
            {sdrs.length === 0 && (
               <div className="col-span-full py-20 text-center opacity-30 flex flex-col items-center gap-3">
                  <Bot className="w-12 h-12 text-slate-300" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Nenhum robô contratado</p>
               </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-0 border-none shadow-3xl bg-white overflow-hidden rounded-[40px]">
          <div className="flex flex-col md:flex-row h-[85vh]">
            <div className="w-full md:w-80 bg-slate-900 p-10 flex flex-col justify-between relative overflow-hidden">
              <DialogHeader className="hidden">
                 <DialogTitle>Gerenciador de SDR Inteligente</DialogTitle>
                 <DialogDescription>Ajuste os parâmetros de comportamento e conhecimento do seu robô.</DialogDescription>
              </DialogHeader>
              <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full translate-x-[-50%] translate-y-[-50%]" />
              <div className="space-y-10 relative z-10">
                 <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg"><Brain className="w-8 h-8 text-white" /></div>
                 <div className="space-y-3">
                    <h3 className="text-2xl font-black text-white tracking-tighter uppercase leading-tight">Módulo <span className="text-emerald-500 italic font-medium">Global</span></h3>
                    <p className="text-white/30 text-[9px] font-bold uppercase tracking-widest leading-relaxed">Personalize a inteligência e o comportamento para o fluxo de qualquer negócio.</p>
                 </div>
              </div>
              <div className="p-5 bg-white/5 rounded-3xl border border-white/5 space-y-2">
                 <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Nota Técnica</p>
                 <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Este robô agora gerencia automaticamente a lista de espera e cobrança de vouchers promocionais.</p>
              </div>
            </div>

            <div className="flex-1 p-10 overflow-y-auto bg-white">
               <Tabs defaultValue="perfil" className="space-y-8">
                  <TabsList className="bg-slate-100 p-1.5 rounded-[25px] h-16 w-full shadow-inner">
                    <TabsTrigger value="perfil" className="flex-1 rounded-[20px] font-black uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-md">Perfil</TabsTrigger>
                    <TabsTrigger value="knowledge" className="flex-1 rounded-[20px] font-black uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-md">Conhecimento</TabsTrigger>
                    <TabsTrigger value="params" className="flex-1 rounded-[20px] font-black uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-md">Parâmetros</TabsTrigger>
                  </TabsList>

                  <TabsContent value="perfil" className="space-y-6 animate-in fade-in slide-in-from-top-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="font-black text-[9px] uppercase tracking-widest text-slate-400 pl-1">Identificação da IA</Label>
                          <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-14 rounded-2xl border-none bg-slate-50 font-bold px-6 shadow-inner" placeholder="Ex: Joana Bronze" />
                       </div>
                       <div className="space-y-2">
                          <Label className="font-black text-[9px] uppercase tracking-widest text-slate-400 pl-1">Especialidade</Label>
                          <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                             <SelectTrigger className="h-14 rounded-2xl border-none bg-slate-50 font-bold shadow-inner"><SelectValue /></SelectTrigger>
                             <SelectContent className="rounded-xl border-none shadow-2xl">
                                <SelectItem value="SDR" className="font-bold py-2">PRÉ-VENDAS / AGENDAMENTO</SelectItem>
                                <SelectItem value="POS_VENDAS" className="font-bold py-2">PÓS-VENDAS / FEEDBACK</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label className="font-black text-[9px] uppercase tracking-widest text-slate-400 pl-1">Diretriz de Comportamento (Prompt)</Label>
                       <Textarea value={form.prompt} onChange={e => setForm({...form, prompt: e.target.value})} className="min-h-[140px] rounded-2xl border-none bg-slate-50 p-6 font-medium italic leading-relaxed" placeholder="Como ele deve se comportar?" />
                    </div>
                  </TabsContent>

                  <TabsContent value="knowledge" className="space-y-6 animate-in fade-in slide-in-from-top-4">
                    {editingSdr && (
                      <div className="p-6 bg-emerald-50 rounded-[30px] border-2 border-dashed border-emerald-200 space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <Upload className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-emerald-900 uppercase tracking-tighter">Treinamento Neural</h4>
                            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Upload de PDF, DOCX ou TXT</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Input 
                            type="file" 
                            accept=".pdf,.docx,.txt" 
                            onChange={handleFileUpload}
                            disabled={uploading}
                            className="hidden" 
                            id="training-file"
                          />
                          <Button 
                            asChild 
                            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest cursor-pointer shadow-lg"
                          >
                            <label htmlFor="training-file">
                              {uploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                              {uploading ? "Absorvendo conteúdo..." : "Selecionar Documento"}
                            </label>
                          </Button>
                        </div>
                        <p className="text-[9px] text-emerald-400 italic font-medium text-center">O robô lerá o arquivo e especializará sua base de respostas automaticamente.</p>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                       <Label className="font-black text-[9px] uppercase tracking-widest text-slate-400 pl-1">Cérebro do Agente (Texto Consolidado)</Label>
                       <Textarea value={form.knowledgeBase} onChange={e => setForm({...form, knowledgeBase: e.target.value})} className="min-h-[200px] rounded-2xl border-none bg-slate-50 p-6 font-medium leading-relaxed text-sm" placeholder="O conteúdo dos arquivos e textos manuais aparecerão aqui..." />
                    </div>
                  </TabsContent>

                  <TabsContent value="params" className="space-y-8 animate-in fade-in slide-in-from-top-4 py-2">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                       <div className="space-y-2">
                          <Label className="font-black text-[9px] uppercase tracking-widest text-slate-400 pl-1">Follow-up de Venda (Minutos)</Label>
                          <Input type="number" value={form.followUpInterval} onChange={e => setForm({...form, followUpInterval: parseInt(e.target.value)})} className="h-14 rounded-2xl border-none bg-slate-50 font-bold px-6 shadow-inner" />
                          <p className="text-[8px] font-bold text-slate-400 pl-1">Tempo para cobrar resposta após info de preço.</p>
                       </div>
                       <div className="space-y-2">
                          <Label className="font-black text-[9px] uppercase tracking-widest text-slate-400 pl-1">Janela Pré-Confirmação (Horas)</Label>
                          <Input type="number" value={form.preConfirmationHours} onChange={e => setForm({...form, preConfirmationHours: parseInt(e.target.value)})} className="h-14 rounded-2xl border-none bg-slate-50 font-bold px-6 shadow-inner" />
                          <p className="text-[8px] font-bold text-slate-400 pl-1">Quanto tempo antes enviar o 1º lembrete.</p>
                       </div>
                       <div className="space-y-2">
                          <Label className="font-black text-[9px] uppercase tracking-widest text-slate-400 pl-1">Tolerância No-Show (Minutos)</Label>
                          <Input type="number" value={form.noShowGraceMinutes} onChange={e => setForm({...form, noShowGraceMinutes: parseInt(e.target.value)})} className="h-14 rounded-2xl border-none bg-slate-50 font-bold px-6 shadow-inner" />
                          <p className="text-[8px] font-bold text-slate-400 pl-1">Atraso permitido antes de perguntar se ainda vem.</p>
                       </div>
                       <div className="space-y-2">
                          <Label className="font-black text-[9px] uppercase tracking-widest text-slate-400 pl-1">Pós-Venda Checkup (Horas)</Label>
                          <Input type="number" value={form.postServiceCheckHours} onChange={e => setForm({...form, postServiceCheckHours: parseInt(e.target.value)})} className="h-14 rounded-2xl border-none bg-slate-50 font-bold px-6 shadow-inner" />
                          <p className="text-[8px] font-bold text-slate-400 pl-1">Tempo após serviço para checar se está tudo OK.</p>
                       </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                       <div className="space-y-0.5">
                          <Label className="text-sm font-black text-slate-900 tracking-tight">Gestão de Encaixe Automático</Label>
                          <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Busca leads na lista de espera em caso de desistência</p>
                       </div>
                       <Switch checked={form.enableWaitlist} onCheckedChange={v => setForm({...form, enableWaitlist: v})} className="data-[state=checked]:bg-emerald-500" />
                    </div>

                    <div className="space-y-2">
                       <Label className="font-black text-[9px] uppercase tracking-widest text-slate-400 pl-1">Gatilhos de Alerta Humano (Separados por vírgula)</Label>
                       <Input value={form.escalationKeywords} onChange={e => setForm({...form, escalationKeywords: e.target.value})} className="h-14 rounded-2xl border-none bg-slate-50 font-bold px-6 shadow-inner" />
                    </div>
                  </TabsContent>

                  <div className="flex gap-4 pt-4 pb-2">
                     <Button onClick={handleSave} className="flex-[3] h-20 bg-slate-900 hover:bg-black text-white font-black rounded-3xl uppercase tracking-widest shadow-2xl transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                        <Save className="w-5 h-5 text-emerald-500" /> Salvar Agente Inteligente
                     </Button>
                     <Button onClick={() => setIsModalOpen(false)} variant="ghost" className="flex-1 h-20 rounded-3xl font-black uppercase text-xs text-slate-400 leading-none">Cancelar</Button>
                  </div>
               </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
