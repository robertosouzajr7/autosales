import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Send, Users, MessageSquare, Mail, 
  Search, Filter, CheckCircle2, AlertCircle, 
  Clock, Play, RefreshCw, Smartphone
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

export default function BulkMessaging() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      setContacts(Array.isArray(data) ? data : []);
    } catch (e) { toast({ title: "Erro ao carregar contatos", variant: "destructive" }); }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selected.length === contacts.length) setSelected([]);
    else setSelected(contacts.map(c => c.id));
  };

  const handleSend = async () => {
    if (selected.length === 0) return toast({ title: "Selecione ao menos um contato", variant: "destructive" });
    if (!message) return toast({ title: "Escreva uma mensagem", variant: "destructive" });

    setSending(true);
    setProgress(0);
    
    // Simulação de progresso de envio em massa
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 300));
      setProgress(i);
    }

    try {
      const res = await fetch("/api/bulk-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          leadIds: selected, 
          message, 
          channel 
        })
      });
      
      if (res.ok) {
        toast({ 
          title: "🚀 Campanha Iniciada!", 
          description: `Enviando para ${selected.length} contatos via ${channel}.` 
        });
        setSelected([]);
        setMessage("");
      }
    } catch (e) { toast({ title: "Erro no disparo", variant: "destructive" }); }
    
    setSending(false);
    setProgress(0);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-10 max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="space-y-1">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
                 <Send className="w-8 h-8 text-emerald-500" />
                 Disparos em <span className="text-emerald-500 italic">Massa</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Envio de Campanhas Direcionadas via WhatsApp e E-mail</p>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUNA ESQUERDA: SELEÇÃO DE CONTATOS */}
          <Card className="lg:col-span-2 border-none shadow-2xl rounded-[40px] overflow-hidden bg-white">
            <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <Checkbox checked={selected.length === contacts.length && contacts.length > 0} onCheckedChange={selectAll} />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Selecionar Todos ({contacts.length})</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input placeholder="Filtrar por nome ou tag..." className="h-10 pl-10 pr-4 border border-slate-200 rounded-xl bg-white w-64 text-[10px] font-bold focus:outline-none" />
              </div>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-2">
                {contacts.map(contact => (
                  <div key={contact.id} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${selected.includes(contact.id) ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100 hover:border-slate-300'}`} onClick={() => toggleSelect(contact.id)}>
                    <div className="flex items-center gap-4">
                      <Checkbox checked={selected.includes(contact.id)} />
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800">{contact.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">{contact.phone} {contact.email && `· ${contact.email}`}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black uppercase border-slate-200 text-slate-400">{contact.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* COLUNA DIREITA: CONFIGURAÇÃO DO DISPARO */}
          <div className="space-y-6">
            <Card className="border-none shadow-2xl rounded-[40px] bg-white p-8 space-y-8">
              <div className="space-y-4">
                <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Canal de Envio</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant={channel === 'WHATSAPP' ? 'default' : 'outline'} onClick={() => setChannel("WHATSAPP")} className={`h-14 rounded-2xl gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${channel === 'WHATSAPP' ? 'bg-slate-900' : 'border-2'}`}>
                    <Smartphone className="w-4 h-4" /> WhatsApp
                  </Button>
                  <Button variant={channel === 'EMAIL' ? 'default' : 'outline'} onClick={() => setChannel("EMAIL")} className={`h-14 rounded-2xl gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${channel === 'EMAIL' ? 'bg-slate-900' : 'border-2'}`}>
                    <Mail className="w-4 h-4" /> E-mail
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Mensagem da Campanha</Label>
                <Textarea 
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="min-h-[200px] rounded-3xl border-2 border-slate-100 p-6 font-medium text-slate-600 leading-relaxed" 
                  placeholder="Olá [nome], gostaria de te convidar para conhecer nossa nova..."
                />
                <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest">Dica: Use [nome] para personalizar a mensagem.</p>
              </div>

              {sending && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-emerald-600">
                    <span>Enviando...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-slate-100" />
                </div>
              )}

              <Button disabled={sending} onClick={handleSend} className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl uppercase tracking-widest text-sm shadow-2xl flex items-center justify-center gap-3">
                {sending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />} 
                {sending ? "Processando..." : "Iniciar Disparo"}
              </Button>
              
              <p className="text-[9px] text-center text-slate-400 font-bold uppercase px-4 leading-relaxed">
                Atenção: Disparos em massa podem causar bloqueios se enviados em alta velocidade. Utilizamos delay inteligente.
              </p>
            </Card>

            <Card className="border-none shadow-2xl rounded-[40px] bg-slate-900 text-white p-8">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-xl">
                    <Users className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Resumo da Seleção</p>
                    <p className="text-xl font-black text-white">{selected.length} Contatos</p>
                  </div>
               </div>
            </Card>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
