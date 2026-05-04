import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Send, Users, MessageSquare, Mail, 
  Search, Filter, CheckCircle2, AlertCircle, AlertTriangle,
  Clock, Play, RefreshCw, Smartphone,
  FileUp, Eye, Calendar, BarChart3, ChevronRight, ChevronLeft
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STEPS = [
  { id: 1, title: "Canal", description: "Escolha como quer falar" },
  { id: 2, title: "Mensagem", description: "Crie o conteúdo do disparo" },
  { id: 3, title: "Contatos", description: "Quem vai receber?" },
  { id: 4, title: "Preview", description: "Veja antes de enviar" },
  { id: 5, title: "Agendamento", description: "Escolha o melhor momento" },
  { id: 6, title: "Envio", description: "Execução da campanha" }
];

export default function BulkMessaging() {
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL" | null>(null);
  const [message, setMessage] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<any[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [contacts, setContacts] = useState<any[]>([]);
  const { toast } = useToast();

  const [hasWhatsApp, setHasWhatsApp] = useState(false);
  const [hasEmail, setHasEmail] = useState(true);
  const [smtpConfig, setSmtpConfig] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("token");
      const headers = { "Authorization": `Bearer ${token}` };
      
      try {
        const leadsRes = await fetch("/api/leads", { headers });
        const leadsData = await leadsRes.json();
        setContacts(leadsData);

        const waRes = await fetch("/api/whatsapp/accounts", { headers });
        const waData = await waRes.json();
        const connected = waData.some((acc: { status: string }) => acc.status === "CONNECTED");
        setHasWhatsApp(connected);
        if (connected) setChannel("WHATSAPP");
        else if (hasEmail) setChannel("EMAIL");

        const settRes = await fetch("/api/settings", { headers });
        const settData = await settRes.json();
        setSmtpConfig({
           from: settData.smtpFrom || ""
        });
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };
    fetchData();
  }, [hasEmail]);

  const nextStep = () => {
    if (step === 1 && !channel) {
      toast({ title: "Selecione um canal", variant: "destructive" });
      return;
    }
    setStep(s => Math.min(s + 1, 6));
  };
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      toast({ title: "Arquivo recebido", description: `${file.name} pronto para processamento.` });
      // Lógica de parser CSV aqui ou via backend
    }
  };

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } : { "Content-Type": "application/json" };
  };

  const toggleContact = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedContacts(prev => [...prev, id]);
    } else {
      setSelectedContacts(prev => prev.filter(c => c !== id));
    }
  };

  const startCampaign = async () => {
    if (selectedContacts.length === 0) {
      toast({ title: "Aviso", description: "Selecione pelo menos um contato.", variant: "destructive" });
      return;
    }
    
    setSending(true);
    try {
      const campRes = await fetch("/api/bulk/campaigns", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ name: `Disparo via Painel - ${new Date().toLocaleDateString()}`, channel, message })
      });
      const campaign = await campRes.json();
      
      const sendRes = await fetch(`/api/bulk/campaigns/${campaign.id}/send`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ leadIds: selectedContacts })
      });

      if (!sendRes.ok) throw new Error("Erro no disparo");

      toast({ title: "Campanha Iniciada", description: "Acompanhe os resultados em tempo real." });
      setStep(6);
    } catch (e) {
      toast({ title: "Falha ao enviar", variant: "destructive", description: "Verifique suas configurações de canal." });
    }
    setSending(false);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-10 max-w-7xl mx-auto">
        
        {/* STEPPER HEADER */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
              <Send className="w-8 h-8 text-emerald-500" />
              Campanha <span className="text-emerald-500 italic">Multicanal</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Passo {step} de 6: {STEPS[step-1].description}</p>
          </div>
          
          <div className="flex gap-2">
            {STEPS.map((s) => (
              <div 
                key={s.id} 
                className={`h-2 w-12 rounded-full transition-all ${s.id <= step ? 'bg-emerald-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* MAIN CONTENT AREA */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* STEP 1: CANAL */}
            {step === 1 && (
              <Card className="border-none shadow-2xl rounded-[40px] bg-white p-12 text-center space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900 uppercase">Escolha o Canal</h2>
                  <p className="text-slate-400 font-medium">Por onde você deseja alcançar seus leads hoje?</p>
                </div>
                
                {(!hasWhatsApp && !hasEmail) && (
                   <div className="bg-red-50 border-2 border-red-100 p-6 rounded-3xl flex items-center gap-4 text-left">
                      <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
                      <div>
                        <p className="font-black text-red-800 uppercase text-xs">Atenção: Nenhum canal configurado!</p>
                        <p className="text-red-600 text-[11px] font-bold">Você precisa conectar seu WhatsApp ou configurar seu E-mail antes de criar disparos.</p>
                      </div>
                      <Button variant="outline" className="ml-auto rounded-xl border-red-200 text-red-700 font-black text-[10px] uppercase" onClick={() => window.location.href="/connections"}>
                        Configurar Agora
                      </Button>
                   </div>
                )}

                <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
                  <button 
                    disabled={!hasWhatsApp}
                    onClick={() => setChannel("WHATSAPP")}
                    className={`p-10 rounded-[40px] border-4 transition-all flex flex-col items-center gap-4 relative ${channel === 'WHATSAPP' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-50 hover:border-slate-100'} ${!hasWhatsApp ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
                  >
                    {!hasWhatsApp && <div className="absolute top-4 right-4"><AlertTriangle className="w-5 h-5 text-orange-500" /></div>}
                    <div className="p-4 bg-emerald-100 rounded-3xl">
                      <Smartphone className="w-10 h-10 text-emerald-600" />
                    </div>
                    <span className="font-black uppercase tracking-widest text-slate-800">WhatsApp</span>
                    <Badge className={hasWhatsApp ? "bg-emerald-500" : "bg-slate-300"}>{hasWhatsApp ? "Disponível" : "Desconectado"}</Badge>
                  </button>
                  <button 
                    disabled={!hasEmail}
                    onClick={() => setChannel("EMAIL")}
                    className={`p-10 rounded-[40px] border-4 transition-all flex flex-col items-center gap-4 relative ${channel === 'EMAIL' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-50 hover:border-slate-100'} ${!hasEmail ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
                  >
                    {!hasEmail && <div className="absolute top-4 right-4"><AlertTriangle className="w-5 h-5 text-orange-500" /></div>}
                    <div className="p-4 bg-blue-100 rounded-3xl">
                      <Mail className="w-10 h-10 text-blue-600" />
                    </div>
                    <span className="font-black uppercase tracking-widest text-slate-800">E-mail</span>
                    <Badge variant="outline" className={hasEmail ? "text-blue-500 border-blue-200" : "text-slate-400 border-slate-200"}>{hasEmail ? "Disponível" : "Indisponível"}</Badge>
                  </button>
                </div>
              </Card>
            )}

            {/* STEP 2: MENSAGEM */}
            {step === 2 && (
              <Card className="border-none shadow-2xl rounded-[40px] bg-white p-12 space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900 uppercase">Conteúdo da Mensagem</h2>
                  <p className="text-slate-400 font-medium">Use variáveis como [nome] para personalizar.</p>
                </div>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    {["[nome]", "[email]", "[empresa]"].map(v => (
                      <Button key={v} variant="outline" size="sm" onClick={() => setMessage(prev => prev + ' ' + v)} className="rounded-full text-[10px] font-black uppercase border-slate-200">
                        {v}
                      </Button>
                    ))}
                  </div>
                  <Textarea 
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="min-h-[300px] rounded-3xl border-2 border-slate-100 p-8 text-lg font-medium leading-relaxed italic text-slate-700"
                    placeholder="Escreva sua mensagem aqui..."
                  />
                </div>
              </Card>
            )}

            {/* STEP 3: CONTATOS */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <Card className="border-none shadow-2xl rounded-[40px] bg-slate-900 text-white p-12 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase">Importar Lista</h2>
                    <p className="text-white/40 font-medium">Suba um arquivo CSV ou Excel com seus contatos.</p>
                  </div>
                  <Label htmlFor="csv-upload" className="cursor-pointer">
                    <div className="h-20 px-10 bg-emerald-500 hover:bg-emerald-600 rounded-3xl flex items-center gap-4 transition-all shadow-xl shadow-emerald-500/20">
                      <FileUp className="w-8 h-8 text-white" />
                      <span className="text-lg font-black uppercase tracking-widest">Selecionar Arquivo</span>
                    </div>
                    <Input id="csv-upload" type="file" className="hidden" onChange={handleFileUpload} />
                  </Label>
                </Card>

                <Card className="border-none shadow-2xl rounded-[40px] bg-white overflow-hidden">
                   <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                      <span className="font-black uppercase tracking-widest text-slate-400 text-xs">Ou selecione de seus contatos existentes</span>
                      <div className="flex items-center gap-4">
                        <Input placeholder="Buscar contatos..." className="h-10 w-64 rounded-xl border-slate-200" />
                        <Button variant="ghost" className="rounded-xl"><Filter className="w-4 h-4" /></Button>
                      </div>
                   </div>
                   <CardContent className="p-4 max-h-[400px] overflow-y-auto">
                      <div className="space-y-2">
                        {contacts.map(c => (
                          <div key={c.id} className="p-4 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-all">
                            <div className="flex items-center gap-4">
                              <Checkbox 
                                checked={selectedContacts.includes(c.id)} 
                                onCheckedChange={(checked) => toggleContact(c.id, checked === true)} 
                              />
                              <div>
                                <p className="font-black text-slate-800">{c.name}</p>
                                <p className="text-[10px] font-bold text-slate-400">{c.phone}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase font-black">{c.status}</Badge>
                          </div>
                        ))}
                      </div>
                   </CardContent>
                </Card>
              </div>
            )}

            {/* STEP 4: PREVIEW */}
            {step === 4 && (
              <Card className="border-none shadow-2xl rounded-[40px] bg-white p-12 space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900 uppercase text-center text-emerald-500 italic">Visualização Final</h2>
                  <p className="text-slate-400 font-medium text-center">É assim que seu lead receberá a mensagem.</p>
                </div>
                
                {channel === "WHATSAPP" ? (
                   <div className="max-w-md mx-auto aspect-[9/16] border-[12px] border-slate-900 rounded-[50px] p-6 bg-slate-100 relative shadow-2xl">
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-900 rounded-b-xl" />
                      <div className="mt-8 bg-[#e5ddd5] p-3 rounded-2xl h-[calc(100%-40px)] overflow-hidden flex flex-col">
                         <div className="flex items-center gap-3 bg-[#075e54] text-white p-4 -mx-3 -mt-3 mb-4 shrink-0">
                            <div className="w-8 h-8 rounded-full bg-white/20" />
                            <span className="font-bold text-xs uppercase tracking-widest">SDR Agent</span>
                         </div>
                         <div className="bg-white p-4 rounded-xl shadow-sm relative mr-6 ml-1">
                            <p className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">
                               {message.replace("[nome]", "João Silva") || "Sua mensagem aparecerá aqui..."}
                            </p>
                            <span className="text-[8px] text-slate-400 absolute bottom-1 right-2 uppercase font-black">12:30 PM</span>
                            <div className="absolute -left-2 top-0 border-[10px] border-transparent border-r-white" />
                         </div>
                      </div>
                   </div>
                ) : (
                   <div className="max-w-2xl mx-auto border-4 border-slate-100 rounded-[40px] overflow-hidden bg-white shadow-2xl">
                      <div className="bg-slate-50 p-6 flex items-center gap-3 border-b">
                         <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-400" />
                            <div className="w-3 h-3 rounded-full bg-amber-400" />
                            <div className="w-3 h-3 rounded-full bg-emerald-400" />
                         </div>
                         <div className="bg-white px-4 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-400 flex-1">
                            {smtpConfig.from || "remetente@seu-dominio.com"}
                         </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-8 border-b border-slate-50 relative z-10 bg-slate-50/50">
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Alvo Selecionado</p>
                          <p className="text-2xl font-black text-slate-800">{selectedContacts.length} <span className="text-sm">Contatos</span></p>
                        </div>
                      </div>
                      <div className="p-10 space-y-6 text-left">
                         <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Para:</p>
                            <p className="font-bold text-slate-700 border-b pb-4">João Silva (joao@exemplo.com)</p>
                         </div>
                         <div className="prose prose-slate max-w-none">
                            <p className="text-lg leading-relaxed text-slate-700 whitespace-pre-wrap italic">
                               {message.replace("[nome]", "João Silva") || "O conteúdo do seu e-mail aparecerá aqui..."}
                            </p>
                         </div>
                         <div className="pt-10 border-t border-slate-100 mt-10">
                            <div className="w-32 h-10 bg-emerald-500 rounded-xl" />
                         </div>
                      </div>
                   </div>
                )}
              </Card>
            )}

            {/* STEP 5: AGENDAMENTO */}
            {step === 5 && (
              <Card className="border-none shadow-2xl rounded-[40px] bg-white p-20 text-center space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="p-6 bg-emerald-50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4">
                   <Calendar className="w-12 h-12 text-emerald-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-slate-900 uppercase">Quando disparar?</h2>
                  <p className="text-slate-400 font-medium tracking-widest text-xs uppercase">Escolha agora ou agende para depois</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto">
                   <Button variant="outline" className="h-20 rounded-3xl font-black uppercase text-xs tracking-widest border-2">Disparar Agora</Button>
                   <Input type="datetime-local" className="h-20 rounded-3xl border-2 font-black uppercase text-xs px-6" />
                </div>
                <div className="pt-10 flex flex-col items-center">
                  <Badge className="bg-emerald-100 text-emerald-600 hover:bg-emerald-100 border-none px-6 py-2 rounded-full font-black uppercase tracking-widest text-[10px]">Custo Estimado: R$ {channel === "WHATSAPP" ? "0,08" : "0,01"} / envio</Badge>
                </div>
              </Card>
            )}

            {/* STEP 6: RELATÓRIO / EXECUTANDO */}
            {step === 6 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   {[
                     { label: "Enviados", value: "0", color: "text-blue-600", icon: Send },
                     { label: "Entregues", value: "0", color: "text-emerald-600", icon: CheckCircle2 },
                     { label: "Vistos", value: "0", color: "text-purple-600", icon: Eye },
                     { label: "Cliques/Erros", value: "0", color: "text-rose-600", icon: AlertCircle },
                   ].map((stat, i) => (
                     <Card key={i} className="border-none shadow-xl rounded-3xl p-6 bg-white overflow-hidden relative group">
                        <stat.icon className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-50 group-hover:text-slate-100 transition-all opacity-20" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">{stat.label}</p>
                        <p className={`text-3xl font-black tracking-tighter relative z-10 ${stat.color}`}>{stat.value}</p>
                     </Card>
                   ))}
                 </div>
                         {!sending && (
                   <Card className="border-none shadow-2xl rounded-[40px] bg-slate-50 p-12 text-center">
                     <div className="py-10 opacity-30 flex flex-col items-center gap-4">
                        <BarChart3 className="w-12 h-12 text-slate-300" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                           Nenhuma campanha ativa no momento.<br/>Os resultados aparecerão aqui após o disparo.
                        </p>
                     </div>
                   </Card>
                 )}

                 {sending && (
                   <Card className="border-none shadow-2xl rounded-[40px] bg-white p-12 space-y-6">
                     <div className="flex items-center justify-between font-black uppercase tracking-widest text-xs text-slate-800">
                       <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Progresso da Campanha</span>
                       <span>{progress}%</span>
                     </div>
                     <Progress value={progress} className="h-4 bg-slate-100 rounded-full" />
                     
                     <div className="pt-8 grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                           <Label className="font-black uppercase tracking-widest text-[10px] text-slate-400">Status</Label>
                           <Badge className="bg-emerald-50 text-emerald-600 px-4 py-1 rounded-full border-none font-black animate-pulse">EM EXECUÇÃO</Badge>
                        </div>
                     </div>
                   </Card>
                 )}
              </div>
            )}

            {/* NAVIGATION BUTTONS */}
            <div className="flex items-center justify-between pt-8 border-t border-slate-100">
              <Button 
                variant="ghost" 
                onClick={prevStep}
                disabled={step === 1 || sending}
                className="h-14 px-8 rounded-2xl gap-2 font-black text-slate-400 uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
              >
                <ChevronLeft className="w-4 h-4" /> Voltar
              </Button>
              
              {step < 5 ? (
                <Button 
                  onClick={nextStep}
                  className="h-16 px-12 rounded-[25px] bg-slate-900 hover:bg-slate-800 text-white gap-2 font-black uppercase tracking-widest text-[10px] shadow-2xl transition-all"
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </Button>
              ) : step === 5 ? (
                <Button 
                  onClick={startCampaign}
                  disabled={sending}
                  className="h-20 px-16 rounded-[30px] bg-emerald-600 hover:bg-emerald-700 text-white gap-3 font-black uppercase tracking-widest text-sm shadow-2xl shadow-emerald-500/30 transition-all"
                >
                  {sending ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
                  Lançar Campanha
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="h-16 px-12 rounded-3xl border-2 font-black uppercase tracking-widest text-[10px]"
                >
                  Nova Campanha
                </Button>
              )}
            </div>

          </div>

          {/* SIDEBAR SUMMARY */}
          <div className="space-y-6">
            <Card className="border-none shadow-2xl rounded-[40px] bg-slate-900 text-white p-8 space-y-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16" />
               <div className="space-y-4 relative z-10">
                  <div className="flex items-center gap-3">
                     <BarChart3 className="w-5 h-5 text-emerald-400" />
                     <span className="text-[10px] font-black uppercase tracking-tighter text-white/50">Resumo da Campanha</span>
                  </div>
                  <div className="space-y-6 pt-4 border-t border-white/10">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Canal</span>
                      <Badge className={channel === 'WHATSAPP' ? 'bg-emerald-500' : 'bg-blue-500'}>{channel}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Contatos</span>
                      <span className="text-sm font-black text-white">{selectedContacts.length || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Investimento</span>
                      <span className="text-sm font-black text-emerald-400">R$ {(selectedContacts.length * (channel === "WHATSAPP" ? 0.08 : 0.01)).toFixed(2)}</span>
                    </div>
                  </div>
               </div>
            </Card>

            <Card className="border-none shadow-2xl rounded-[40px] bg-white p-8 space-y-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <span className="text-[10px] font-black uppercase text-slate-800">Boas Práticas</span>
              </div>
              <ul className="space-y-2">
                {[
                  "Use delay de 15s entre envios",
                  "Evite links encurtados",
                  "Personalize sempre o [nome]",
                  "Escolha horários comerciais"
                ].map((tip, i) => (
                  <li key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-400 italic">
                    <div className="w-1 h-1 rounded-full bg-slate-300" /> {tip}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
