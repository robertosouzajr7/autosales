import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Bot, Plus, Trash2, Edit3, Settings2, Brain, Link as LinkIcon, 
  FileText, Activity, CheckCircle2, AlertCircle, Save, Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SdrManagement() {
  const [sdrs, setSdrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSdr, setEditingSdr] = useState<any>(null);

  // Form State
  const [form, setForm] = useState({
    name: "",
    role: "INBOUND",
    prompt: "Você é um SDR focado em qualificar leads.",
    knowledgeBase: "",
    trainingUrls: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sdrs");
      const data = await res.json();
      setSdrs(Array.isArray(data) ? data : []);
    } catch (e) {
      toast({ title: "Erro ao carregar SDRs", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenModal = (sdr: any = null) => {
    if (sdr) {
      setEditingSdr(sdr);
      setForm({
        name: sdr.name,
        role: sdr.role,
        prompt: sdr.prompt || "",
        knowledgeBase: sdr.knowledgeBase || "",
        trainingUrls: sdr.trainingUrls || ""
      });
    } else {
      setEditingSdr(null);
      setForm({
        name: "",
        role: "INBOUND",
        prompt: "Você é um SDR focado em qualificar leads.",
        knowledgeBase: "",
        trainingUrls: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast({ title: "Dê um nome ao seu SDR", variant: "destructive" });
    
    try {
      const url = editingSdr ? `/api/sdrs/${editingSdr.id}` : "/api/sdrs";
      const method = editingSdr ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      
      if (res.ok) {
        toast({ title: editingSdr ? "SDR Atualizado" : "SDR Criado", description: "O treinamento está sendo processado." });
        setIsModalOpen(false);
        fetchData();
      } else {
        const error = await res.json();
        toast({ title: "Erro", description: error.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Falha na conexão", variant: "destructive" });
    }
  };

  const deleteSdr = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este agente?")) return;
    await fetch(`/api/sdrs/${id}`, { method: "DELETE" });
    fetchData();
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-10 max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
           <div className="space-y-1">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
                 <Bot className="w-8 h-8 text-emerald-500" />
                 Time de <span className="text-emerald-500 italic">SDRs IA</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Agentes Inteligentes de Prospecção e Qualificação</p>
           </div>
           
           <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 h-14 px-8 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-500/20">
              <Plus className="w-4 h-4 mr-2" /> Contratar Robô
           </Button>
        </div>

        {/* SDR LIST GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sdrs.map(sdr => (
            <Card key={sdr.id} className="border-none shadow-2xl rounded-[40px] bg-white overflow-hidden hover:scale-[1.02] transition-all duration-500 group">
              <CardContent className="p-0">
                <div className="p-8 bg-slate-900 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <Bot className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-black text-lg">{sdr.name}</h3>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-none text-[8px] font-black uppercase tracking-widest mt-1">
                        {sdr.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 h-fit">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(sdr)} className="text-white/20 hover:text-white hover:bg-white/10 rounded-xl">
                      <Settings2 className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteSdr(sdr.id)} className="text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-xl">
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Status</p>
                      <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Operando
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Leads Ativos</p>
                      <p className="text-xs font-bold text-slate-700">124 hoje</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DNA do Agente (Prompt Personalizado)</p>
                    <div className="p-4 bg-slate-50 rounded-2xl text-[10px] font-medium text-slate-500 leading-relaxed max-h-20 overflow-hidden relative">
                      {sdr.prompt}
                      <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-slate-50 to-transparent" />
                    </div>
                  </div>
                  
                  <Button onClick={() => handleOpenModal(sdr)} className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl uppercase tracking-widest text-[10px]">
                    <Brain className="w-3.5 h-3.5 mr-2 text-emerald-500" /> Ver Treinamento
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {sdrs.length === 0 && !loading && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300">
               <Bot className="w-16 h-16 opacity-20 mb-4" />
               <p className="text-sm font-black uppercase tracking-widest">Nenhum agente no time</p>
               <p className="text-xs mt-2">Clique em "Contratar Robô" para começar.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CONFIGURAÇÃO SDR (Requirement 4 & 5) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl rounded-[40px] p-0 overflow-hidden border-none shadow-3xl bg-slate-50">
          <div className="flex h-[80vh]">
            
            {/* SIDEBAR MODAL */}
            <div className="w-72 bg-slate-900 p-10 flex flex-col justify-between">
              <div className="space-y-8">
                <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/40">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white tracking-tighter uppercase leading-none">Cérebro <br/><span className="text-emerald-500 italic tracking-normal">do Agente</span></h3>
                  <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Configuração Individual</p>
                </div>
              </div>
              <div className="p-6 bg-white/5 rounded-3xl">
                <p className="text-[9px] text-white/40 font-bold uppercase leading-relaxed uppercase">Dica: Quanto mais contexto, processos e links você fornecer, mais preciso o SDR será.</p>
              </div>
            </div>

            {/* CONTENT MODAL */}
            <div className="flex-1 overflow-y-auto p-12 bg-white rounded-l-[50px] shadow-2xl">
              <Tabs defaultValue="perfil" className="space-y-10">
                <TabsList className="bg-slate-100 p-1 rounded-2xl h-14">
                  <TabsTrigger value="perfil" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">Perfil e DNA</TabsTrigger>
                  <TabsTrigger value="treinamento" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">Base de Conhecimento</TabsTrigger>
                </TabsList>

                <TabsContent value="perfil" className="space-y-8 animate-in fade-in duration-500">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Nome do SDR</Label>
                      <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-14 rounded-2xl border-2 border-slate-100 font-bold px-6" placeholder="Ex: Robô de Vendas XP" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Tipo de Agente</Label>
                      <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                        <SelectTrigger className="h-14 rounded-2xl border-2 border-slate-100 font-bold ">
                          <SelectValue placeholder="Selecione o papel" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="INBOUND">Inbound (Atendimento Receptivo)</SelectItem>
                          <SelectItem value="OUTBOUND">Outbound (Prospecção Ativa)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Prompt de Comportamento (DNA)</Label>
                      <Badge className="bg-slate-100 text-slate-400 text-[9px] border-none font-bold">IA Inteligente</Badge>
                    </div>
                    <Textarea 
                      value={form.prompt} 
                      onChange={e => setForm({...form, prompt: e.target.value})}
                      className="min-h-[150px] rounded-3xl border-2 border-slate-100 p-6 font-medium text-slate-600 leading-relaxed focus:border-emerald-500/50 transition-all" 
                      placeholder="Instruções de como o SDR deve agir, tom de voz, gatilhos de fechamento..."
                    />
                  </div>
                </TabsContent>

                <TabsContent value="treinamento" className="space-y-8 animate-in slide-in-from-right duration-500">
                   <div className="space-y-3">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <FileText className="w-5 h-5" />
                        <h4 className="font-black text-sm uppercase tracking-tighter">Treinamento Massivo via Texto</h4>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Cole aqui manuais da empresa, PDFs convertidos, textos de treinamento ou FAQs para a IA aprender sobre seu produto.</p>
                      <Textarea 
                        value={form.knowledgeBase} 
                        onChange={e => setForm({...form, knowledgeBase: e.target.value})}
                        className="min-h-[180px] rounded-3xl border-2 border-slate-100 p-6 font-medium text-slate-600 leading-relaxed" 
                        placeholder="Ex: Nossos preços são baseados na metragem da obra. Oferecemos 10% de desconto para pagamento à vista..."
                      />
                   </div>

                   <div className="space-y-3">
                      <div className="flex items-center gap-2 text-blue-600">
                        <LinkIcon className="w-5 h-5" />
                        <h4 className="font-black text-sm uppercase tracking-tighter">Fontes Digitais (Links de Sites/Arquivos)</h4>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Links públicos do seu site ou documentos hospedados (PDF/Docs) que a IA deve ler.</p>
                      <Input 
                        value={form.trainingUrls}
                        onChange={e => setForm({...form, trainingUrls: e.target.value})}
                        className="h-14 rounded-2xl border-2 border-slate-100 font-bold px-6" 
                        placeholder="https://meusite.com.br/precos, https://docs.google.com/pdf..." 
                      />
                   </div>
                </TabsContent>

                <div className="flex gap-4 pt-4">
                   <Button onClick={handleSave} className="flex-1 h-16 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl uppercase tracking-widest shadow-2xl transition-all">
                     <Save className="w-4 h-4 mr-2 text-emerald-500" /> Salvar Agente
                   </Button>
                   <Button onClick={() => setIsModalOpen(false)} variant="outline" className="px-10 h-16 rounded-2xl border-2 font-black uppercase text-[10px] tracking-widest">Cancelar</Button>
                </div>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
