import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Bot, Plus, Trash2, Brain, Zap, Globe, Save, RefreshCw, Sliders, User, ShieldCheck, Clock, CheckCircle2, MessageSquare, Upload, FileText, FileJson, Power, Check
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
import { Separator } from "@/components/ui/separator";

export default function SdrManagement() {
  const [sdrs, setSdrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSdr, setEditingSdr] = useState<any>(null);

  const [functions, setFunctions] = useState<any[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<any[]>([]);

  const [form, setForm] = useState({
    name: "",
    role: "SDR",
    agentFunction: "SCHEDULER",
    skills: [] as string[],
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
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    responseMode: "TEXT",
    active: true
  });
  
  const [uploading, setUploading] = useState(false);

  const [hasWhatsApp, setHasWhatsApp] = useState<boolean>(false);

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    try {
      const [sdrsRes, settingsRes, fnRes] = await Promise.all([
        fetch("/api/sdrs", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/settings", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/agent-functions", { headers: { "Authorization": `Bearer ${token}` } })
      ]);

      const sdrData = await sdrsRes.json();
      const settingsData = await settingsRes.json();
      const fnData = await fnRes.json();

      setSdrs(Array.isArray(sdrData) ? sdrData : []);
      setHasWhatsApp(!!settingsData.hasWhatsAppConnection);
      setFunctions(fnData.functions || []);
      setSkillsCatalog(fnData.skills || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenModal = (sdr: any = null) => {
    if (sdr) {
      setEditingSdr(sdr);
      let parsedSkills: string[] = [];
      try { parsedSkills = sdr.skills ? JSON.parse(sdr.skills) : []; } catch { parsedSkills = []; }
      setForm({
        name: sdr.name || "",
        role: sdr.role || "SDR",
        agentFunction: sdr.agentFunction || "SCHEDULER",
        skills: parsedSkills,
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
        voiceId: sdr.voiceId || "21m00Tcm4TlvDq8ikWAM",
        responseMode: sdr.responseMode || "TEXT",
        active: sdr.active ?? true
      });
    } else {
      setEditingSdr(null);
      const defaultFn = functions.find((f) => f.id === "SCHEDULER") || functions[0];
      setForm({
        name: "",
        role: "SDR",
        agentFunction: defaultFn?.id || "SCHEDULER",
        skills: defaultFn?.skills || [],
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
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        responseMode: "TEXT",
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
        toast({ title: "Documento processado", description: `${(data.extractedChars || 0).toLocaleString()} caracteres extraídos e adicionados à base de conhecimento.` });
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
        <PageHeader
          icon={<Bot className="w-5 h-5" />}
          title="Assistente de IA"
          subtitle="Crie e treine o assistente que atende seus pacientes no WhatsApp."
          actions={
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={() => hasWhatsApp ? handleOpenModal() : toast({ title: "WhatsApp necessário", description: "Conecte um WhatsApp antes de criar um assistente.", variant: "destructive" })}
                disabled={!hasWhatsApp}
              >
                <Plus className="w-4 h-4 mr-2" /> Criar assistente
              </Button>
              {!hasWhatsApp && (
                <p className="text-xs text-muted-foreground">Requer conexão com o WhatsApp</p>
              )}
            </div>
          }
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-30">
             <RefreshCw className="w-10 h-10 text-[#2563EB] animate-spin" />
             <p className="text-xs font-semibold ">Sincronizando IA...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sdrs.map(sdr => (
              <Card key={sdr.id} className="border-none shadow-sm rounded-2xl bg-white overflow-hidden hover:scale-[1.01] transition-all group relative">
                <div className="p-8 bg-slate-50 flex items-center justify-between group-hover:bg-slate-900 transition-all duration-500">
                   <div className="flex items-center gap-5">
                      <div className="w-10 h-10 bg-white group-hover:bg-[#2563EB] rounded-2xl flex items-center justify-center shadow-lg transition-all">
                         <Bot className="w-7 h-7 text-slate-800 group-hover:text-white" />
                      </div>
                      <div>
                         <h3 className="text-slate-900 group-hover:text-white font-semibold text-lg leading-none uppercase">{sdr.name}</h3>
                         <Badge className="bg-[#2563EB]/10 text-[#2563EB] font-semibold text-xs mt-1 uppercase border-none">{functions.find((f) => f.id === sdr.agentFunction)?.label || sdr.role}</Badge>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSdrActive(sdr); }}
                        className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-full border transition-all ${sdr.active ? 'bg-[#2563EB]/10 border-[#2563EB]/20 text-[#2563EB] hover:bg-[#2563EB]/20' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700 text-slate-400 group-hover:bg-slate-800'}`}
                        title={sdr.active ? "Desativar SDR" : "Ativar SDR"}
                      >
                         <Power className={`w-4 h-4 ${sdr.active ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                         <span className="text-xs font-semibold leading-none">{sdr.active ? 'ON' : 'OFF'}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" onClick={(e) => { e.stopPropagation(); deleteSdr(sdr.id); }}>
                         <Trash2 className="w-5 h-5" />
                      </Button>
                   </div>
                </div>
                
                <div className="p-8 space-y-6">
                   <div className="grid grid-cols-3 gap-2">
                      <div className="bg-slate-50 p-3 rounded-2xl text-center">
                         <MessageSquare className="w-4 h-4 text-[#2563EB] mx-auto mb-1" />
                         <span className="text-xs font-semibold text-slate-800 block">{sdr.followUpInterval}m</span>
                         <span className="text-xs font-bold text-slate-400 uppercase">Followup</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl text-center">
                         <Clock className="w-4 h-4 text-[#2563EB] mx-auto mb-1" />
                         <span className="text-xs font-semibold text-slate-800 block">{sdr.preConfirmationHours}h</span>
                         <span className="text-xs font-bold text-slate-400 uppercase">Confirm</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl text-center">
                         <CheckCircle2 className="w-4 h-4 text-[#2563EB] mx-auto mb-1" />
                         <span className="text-xs font-semibold text-slate-800 block">{sdr.enableWaitlist ? "ON" : "OFF"}</span>
                         <span className="text-xs font-bold text-slate-400 uppercase">Encaixe</span>
                      </div>
                   </div>

                   <Button onClick={() => handleOpenModal(sdr)} className="w-full h-10 bg-slate-900 hover:bg-black text-white font-semibold rounded-2xl uppercase text-xs transition-all">
                      Ajustar Parâmetros IA
                   </Button>
                </div>
              </Card>
            ))}
            {sdrs.length === 0 && (
               <div className="col-span-full py-20 text-center opacity-30 flex flex-col items-center gap-3">
                  <Bot className="w-10 h-10 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-300">Nenhum robô contratado</p>
               </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-0 border-none shadow-sm bg-white overflow-hidden rounded-2xl">
          <div className="flex flex-col md:flex-row h-[85vh]">
            <div className="w-full md:w-80 bg-slate-900 p-10 flex flex-col justify-between relative overflow-hidden">
              <DialogHeader className="hidden">
                 <DialogTitle>Gerenciador de SDR Inteligente</DialogTitle>
                 <DialogDescription>Ajuste os parâmetros de comportamento e conhecimento do seu robô.</DialogDescription>
              </DialogHeader>
              <div className="absolute top-0 left-0 w-32 h-32 bg-[#2563EB]/10 blur-3xl rounded-full translate-x-[-50%] translate-y-[-50%]" />
              <div className="space-y-10 relative z-10">
                 <div className="w-16 h-11 bg-[#2563EB] rounded-2xl flex items-center justify-center shadow-lg"><Brain className="w-8 h-8 text-white" /></div>
                 <div className="space-y-3">
                    <h3 className="text-2xl font-semibold text-white tracking-tight uppercase leading-tight">Módulo <span className="text-[#2563EB] font-medium">Global</span></h3>
                    <p className="text-white/30 text-xs font-bold leading-relaxed">Personalize a inteligência e o comportamento para o fluxo de qualquer negócio.</p>
                 </div>
              </div>
              <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                 <p className="text-xs font-semibold text-[#2563EB] mb-1">Nota Técnica</p>
                 <p className="text-xs text-slate-400 leading-relaxed font-medium">Este robô agora gerencia automaticamente a lista de espera e cobrança de vouchers promocionais.</p>
              </div>
            </div>

            <div className="flex-1 p-10 overflow-y-auto bg-white">
               <Tabs defaultValue="perfil" className="space-y-8">
                  <TabsList className="bg-slate-100 p-1.5 rounded-2xl h-16 w-full shadow-inner">
                    <TabsTrigger value="perfil" className="flex-1 rounded-2xl font-semibold uppercase text-xs data-[state=active]:bg-white data-[state=active]:shadow-md">Perfil</TabsTrigger>
                    <TabsTrigger value="knowledge" className="flex-1 rounded-2xl font-semibold uppercase text-xs data-[state=active]:bg-white data-[state=active]:shadow-md">Conhecimento</TabsTrigger>
                    <TabsTrigger value="params" className="flex-1 rounded-2xl font-semibold uppercase text-xs data-[state=active]:bg-white data-[state=active]:shadow-md">Parâmetros</TabsTrigger>
                  </TabsList>

                  <TabsContent value="perfil" className="space-y-6 animate-in fade-in slide-in-from-top-4">
                    <div className="space-y-2">
                       <Label className="font-semibold text-xs text-slate-400 pl-1">Identificação da IA</Label>
                       <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-10 rounded-2xl border-none bg-slate-50 font-bold px-6 shadow-inner" placeholder="Ex: Joana Bronze" />
                    </div>

                    {/* FUNÇÃO DO AGENTE */}
                    <div className="space-y-2">
                       <Label className="font-semibold text-xs text-slate-400 pl-1">Função do agente</Label>
                       <div className="grid sm:grid-cols-2 gap-2">
                          {functions.map((f) => {
                            const active = form.agentFunction === f.id;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setForm({ ...form, agentFunction: f.id, skills: f.skills })}
                                className={`text-left rounded-2xl border p-3 transition-all ${active ? "border-[#2563EB] bg-[#2563EB]/5 ring-2 ring-[#2563EB]/20" : "border-slate-200 hover:border-[#2563EB]/40"}`}
                              >
                                <p className="text-sm font-semibold text-slate-900">{f.label}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{f.hint}</p>
                              </button>
                            );
                          })}
                       </div>
                       <p className="text-xs text-slate-400 pl-1">A função define a persona e liga as skills recomendadas. Você ajusta abaixo.</p>
                    </div>

                    {/* SKILLS */}
                    <div className="space-y-2">
                       <Label className="font-semibold text-xs text-slate-400 pl-1">Skills (o que o agente pode fazer)</Label>
                       <div className="grid sm:grid-cols-2 gap-2">
                          {skillsCatalog.map((s) => {
                            const on = form.skills.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setForm({ ...form, skills: on ? form.skills.filter((x) => x !== s.id) : [...form.skills, s.id] })}
                                className={`text-left rounded-2xl border p-3 flex items-start gap-2 transition-all ${on ? "border-emerald-300 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}
                              >
                                <div className={`h-4 w-4 rounded mt-0.5 shrink-0 grid place-items-center ${on ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>
                                  {on && <Check className="w-3 h-3" />}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{s.label}</p>
                                  <p className="text-xs text-slate-500">{s.desc}</p>
                                </div>
                              </button>
                            );
                          })}
                       </div>
                    </div>

                    <div className="space-y-2">
                       <Label className="font-semibold text-xs text-slate-400 pl-1">Instruções adicionais (opcional)</Label>
                       <Textarea value={form.prompt} onChange={e => setForm({...form, prompt: e.target.value})} className="min-h-[120px] rounded-2xl border-none bg-slate-50 p-6 font-medium leading-relaxed" placeholder="Regras específicas do seu negócio, tom de voz, o que evitar…" />
                    </div>
                  </TabsContent>

                  <TabsContent value="knowledge" className="space-y-6 animate-in fade-in slide-in-from-top-4">
                    {editingSdr && (
                      <div className="p-6 bg-blue-50 rounded-2xl border-2 border-dashed border-slate-300 space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-[#2563EB] rounded-2xl flex items-center justify-center shadow-lg">
                            <Upload className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-[#0F172A] tracking-tight">Treinar por documento</h4>
                            <p className="text-xs text-[#2563EB] font-bold ">PDF, DOCX, planilha (XLSX/CSV) ou TXT</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Input
                            type="file"
                            accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
                            onChange={handleFileUpload}
                            disabled={uploading}
                            className="hidden" 
                            id="training-file"
                          />
                          <Button 
                            asChild 
                            className="w-full h-10 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl uppercase text-xs cursor-pointer shadow-lg"
                          >
                            <label htmlFor="training-file">
                              {uploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                              {uploading ? "Absorvendo conteúdo..." : "Selecionar Documento"}
                            </label>
                          </Button>
                        </div>
                        <p className="text-xs text-[#2DD4BF] font-medium text-center">O robô lerá o arquivo e especializará sua base de respostas automaticamente.</p>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                       <Label className="font-semibold text-xs text-slate-400 pl-1">Cérebro do Agente (Texto Consolidado)</Label>
                       <Textarea value={form.knowledgeBase} onChange={e => setForm({...form, knowledgeBase: e.target.value})} className="min-h-[200px] rounded-2xl border-none bg-slate-50 p-6 font-medium leading-relaxed text-sm" placeholder="O conteúdo dos arquivos e textos manuais aparecerão aqui..." />
                    </div>
                  </TabsContent>

                  <TabsContent value="params" className="space-y-8 animate-in fade-in slide-in-from-top-4 py-2">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                       <div className="space-y-2">
                          <Label className="font-semibold text-xs text-slate-400 pl-1">Follow-up de Venda (Minutos)</Label>
                          <Input type="number" value={form.followUpInterval} onChange={e => setForm({...form, followUpInterval: parseInt(e.target.value)})} className="h-10 rounded-2xl border-none bg-slate-50 font-bold px-6 shadow-inner" />
                          <p className="text-xs font-bold text-slate-400 pl-1">Tempo para cobrar resposta após info de preço.</p>
                       </div>
                       <div className="space-y-2">
                          <Label className="font-semibold text-xs text-slate-400 pl-1">Janela Pré-Confirmação (Horas)</Label>
                          <Input type="number" value={form.preConfirmationHours} onChange={e => setForm({...form, preConfirmationHours: parseInt(e.target.value)})} className="h-10 rounded-2xl border-none bg-slate-50 font-bold px-6 shadow-inner" />
                          <p className="text-xs font-bold text-slate-400 pl-1">Quanto tempo antes enviar o 1º lembrete.</p>
                       </div>
                       <div className="space-y-2">
                          <Label className="font-semibold text-xs text-slate-400 pl-1">Tolerância No-Show (Minutos)</Label>
                          <Input type="number" value={form.noShowGraceMinutes} onChange={e => setForm({...form, noShowGraceMinutes: parseInt(e.target.value)})} className="h-10 rounded-2xl border-none bg-slate-50 font-bold px-6 shadow-inner" />
                          <p className="text-xs font-bold text-slate-400 pl-1">Atraso permitido antes de perguntar se ainda vem.</p>
                       </div>
                       <div className="space-y-2">
                          <Label className="font-semibold text-xs text-slate-400 pl-1">Pós-Venda Checkup (Horas)</Label>
                          <Input type="number" value={form.postServiceCheckHours} onChange={e => setForm({...form, postServiceCheckHours: parseInt(e.target.value)})} className="h-10 rounded-2xl border-none bg-slate-50 font-bold px-6 shadow-inner" />
                          <p className="text-xs font-bold text-slate-400 pl-1">Tempo após serviço para checar se está tudo OK.</p>
                       </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                       <div className="space-y-0.5">
                          <Label className="text-sm font-semibold text-slate-900 tracking-tight">Gestão de Encaixe Automático</Label>
                          <p className="text-xs font-bold text-slate-400 uppercase leading-none">Busca leads na lista de espera em caso de desistência</p>
                       </div>
                       <Switch checked={form.enableWaitlist} onCheckedChange={v => setForm({...form, enableWaitlist: v})} className="data-[state=checked]:bg-[#2563EB]" />
                    </div>

                    <div className="space-y-2">
                       <Label className="font-semibold text-xs text-slate-400 pl-1">Gatilhos de Alerta Humano (Separados por vírgula)</Label>
                       <Input value={form.escalationKeywords} onChange={e => setForm({...form, escalationKeywords: e.target.value})} className="h-10 rounded-2xl border-none bg-slate-50 font-bold px-6 shadow-inner" />
                    </div>

                    <Separator className="opacity-50" />

                    <div className="bg-slate-900 p-8 rounded-2xl space-y-6">
                       <div className="flex items-center gap-3 text-[#2DD4BF] mb-2">
                          <Zap className="w-5 h-5" />
                          <h4 className="font-semibold uppercase text-xs ">Configuração de Voz (Neural)</h4>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <Label className="font-semibold text-xs text-white/50 pl-1">Modo de Resposta</Label>
                             <Select value={form.responseMode} onValueChange={v => setForm({...form, responseMode: v})}>
                                <SelectTrigger className="h-10 rounded-2xl border-none bg-white/5 text-white font-bold px-6 shadow-inner">
                                   <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-sm">
                                   <SelectItem value="TEXT" className="font-bold">APENAS TEXTO</SelectItem>
                                   <SelectItem value="AUDIO" className="font-bold">APENAS ÁUDIO (Voz)</SelectItem>
                                   <SelectItem value="BOTH" className="font-bold">AMBOS (Texto + Áudio)</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                          
                          <div className="space-y-2">
                             <Label className="font-semibold text-xs text-white/50 pl-1">ID da Voz (ElevenLabs)</Label>
                             <Input value={form.voiceId} onChange={e => setForm({...form, voiceId: e.target.value})} className="h-10 rounded-2xl border-none bg-white/5 text-white font-bold px-6 shadow-inner" placeholder="Ex: 21m00Tcm4TlvDq8ikWAM" />
                             <p className="text-xs font-bold text-white/20 pl-1">Rachel: 21m00Tcm4TlvDq8ikWAM</p>
                          </div>
                       </div>
                    </div>
                  </TabsContent>

                  <div className="flex gap-4 pt-4 pb-2">
                     <Button onClick={handleSave} className="flex-[3] h-20 bg-slate-900 hover:bg-black text-white font-semibold rounded-2xl shadow-sm transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                        <Save className="w-5 h-5 text-[#2563EB]" /> Salvar Agente Inteligente
                     </Button>
                     <Button onClick={() => setIsModalOpen(false)} variant="ghost" className="flex-1 h-20 rounded-2xl font-semibold uppercase text-xs text-slate-400 leading-none">Cancelar</Button>
                  </div>
               </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
