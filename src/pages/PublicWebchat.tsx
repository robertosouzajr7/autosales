import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { 
  Send, Target, Phone, Info, MessageSquare, 
  Shield, CheckCircle2, User, Globe, ChevronLeft 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

export default function PublicWebchat() {
  const { tenantId } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/public/webchat/${tenantId}`)
      .then(res => res.json())
      .then(resData => {
        if (resData.error) throw new Error(resData.error);
        setData(resData);
      })
      .catch(err => {
        toast({ title: "Erro", description: "Portal não encontrado ou inativo.", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSend = async () => {
    if (!message.trim() || !data?.sdr?.id || sending) return;
    
    const userMsg = message;
    setMessage("");
    setChatHistory(prev => [...prev, { role: "user", content: userMsg }]);
    setSending(true);

    try {
      const res = await fetch("/api/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sdrId: data.sdr.id, 
          message: userMsg,
          history: chatHistory 
        })
      });
      const resJson = await res.json();
      if (resJson.response) {
        setChatHistory(prev => [...prev, { role: "assistant", content: resJson.response }]);
      }
    } catch (e) {
      toast({ title: "Erro no envio", description: "O consultor está offline no momento.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
         <div className="animate-pulse flex flex-col items-center gap-4">
            <Target className="w-12 h-12 text-emerald-500 animate-spin" />
            <p className="text-white/20 font-black uppercase tracking-widest text-xs">Carregando Portal de Atendimento...</p>
         </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center space-y-6">
         <Shield className="w-16 h-16 text-red-500/50" />
         <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Portal não encontrado</h1>
         <p className="text-white/40 max-w-sm">Este endereço de webchat pode ter sido removido ou o plano do cliente expirou.</p>
         <Button variant="ghost" className="text-emerald-500 font-bold" onClick={() => window.history.back()}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-0 md:p-10 font-sans selection:bg-emerald-500/30">
      
      {/* BACKGROUND DECORATION */}
      <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full bg-emerald-500/5 blur-[120px] rounded-full" />
      </div>

      <Card className="w-full max-w-5xl h-screen md:h-[85vh] border-none shadow-[0_50px_100px_rgba(0,0,0,0.5)] bg-slate-900/50 backdrop-blur-2xl overflow-hidden flex flex-col md:flex-row rounded-none md:rounded-[40px]">
         
         {/* SIDEBAR - INFO (Visible on Desktop) */}
         <div className="w-full md:w-80 bg-slate-900 flex-shrink-0 p-8 flex flex-col justify-between border-r border-white/5">
            <div className="space-y-10">
               <div className="space-y-4">
                  {data.logo ? (
                    <img src={data.logo} alt="Logo" className="h-10 w-auto" />
                  ) : (
                    <div className="flex items-center gap-3">
                       <div className="bg-emerald-500 p-2 rounded-xl"><Target className="w-6 h-6 text-white" /></div>
                       <span className="text-xl font-black text-white tracking-tighter uppercase italic">{data.tenantName}</span>
                    </div>
                  )}
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[9px] uppercase tracking-widest px-3 py-1">Online agora</Badge>
               </div>

               <div className="space-y-6">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-white/20 uppercase tracking-widest pl-1">Consultor Atribuído</p>
                     <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center font-black text-white">{data.sdr?.name?.[0] || "AI"}</div>
                        <div>
                           <p className="text-sm font-black text-white">{data.sdr?.name || "Especialista Agentes Virtuais"}</p>
                           <p className="text-[10px] text-white/40 font-bold uppercase">{data.sdr?.role || "Inbound SDR"}</p>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-3">
                     <div className="flex items-center gap-2 text-white/40 text-xs font-bold"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Resposta Imediata</div>
                     <div className="flex items-center gap-2 text-white/40 text-xs font-bold"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Sem Espera</div>
                     <div className="flex items-center gap-2 text-white/40 text-xs font-bold"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Agendamento Integrado</div>
                  </div>
               </div>
            </div>

            <div className="pt-10 border-t border-white/5 space-y-4">
               <p className="text-[10px] text-white/20 font-bold leading-relaxed">Este é um canal oficial da <b>{data.tenantName}</b> operado por Inteligência Artificial Especializada.</p>
               <Button variant="ghost" className="w-full justify-start text-white/40 hover:text-white hover:bg-white/5 rounded-xl text-xs gap-3 font-bold group">
                  <Shield className="w-4 h-4 group-hover:text-emerald-500 transition-colors" /> Privacidade & Segurança
               </Button>
            </div>
         </div>

         {/* CHAT AREA */}
         <div className="flex-1 flex flex-col min-h-0">
            {/* MOBILE HEADER */}
            <div className="md:hidden bg-slate-900 p-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center"><Target className="w-4 h-4 text-white" /></div>
                   <span className="font-black text-white text-sm uppercase tracking-tighter">{data.tenantName}</span>
                </div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            </div>

            {/* MESSAGES */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar">
               
               <div className="flex flex-col items-center text-center space-y-4 py-10 opacity-30">
                  <Globe className="w-12 h-12 text-white" />
                  <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Criptografia ponta-a-ponta ativada</p>
               </div>

               {chatHistory.length === 0 && (
                 <div className="flex justify-start animate-in slide-in-from-left duration-700">
                    <div className="max-w-[85%] p-6 bg-white/5 border border-white/5 rounded-[30px] rounded-tl-none">
                       <p className="text-white/80 font-bold leading-relaxed">
                          Olá! 👋 Bem-vindo ao portal de atendimento da <b>{data.tenantName}</b>. <br/><br/>
                          Eu sou o seu consultor dedicado e estou aqui para tirar todas as suas dúvidas. Como posso te ajudar hoje?
                       </p>
                    </div>
                 </div>
               )}

               {chatHistory.map((msg, i) => (
                 <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in zoom-in-95`}>
                    <div className={`shadow-2xl max-w-[85%] p-6 rounded-[30px] ${
                       msg.role === 'user' 
                       ? 'bg-emerald-500 text-slate-950 font-black rounded-tr-none' 
                       : 'bg-white/5 border border-white/5 text-white font-bold rounded-tl-none'
                    }`}>
                       <p className="leading-relaxed">{msg.content}</p>
                    </div>
                 </div>
               ))}
               
               {sending && (
                 <div className="flex justify-start">
                    <div className="flex items-center gap-2 text-white/20 font-black uppercase text-[10px] tracking-widest pl-4">
                       <div className="flex gap-1">
                          <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                          <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                          <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                       </div>
                       Digitando resposta estratégica...
                    </div>
                 </div>
               )}
            </div>

            {/* INPUT AREA */}
            <div className="p-6 md:p-10 pt-0">
               <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-[30px] blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <div className="relative flex items-center bg-slate-900 border border-white/10 rounded-[30px] p-2 pr-4 shadow-2xl transition-all">
                     <input 
                       value={message}
                       onChange={e => setMessage(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleSend()}
                       placeholder="Sua mensagem aqui..."
                       className="flex-1 bg-transparent border-none text-white font-bold px-6 py-4 focus:ring-0 outline-none placeholder:text-white/10"
                     />
                     <Button 
                       onClick={handleSend}
                       disabled={sending || !message.trim()}
                       className="h-14 w-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/20 active:scale-90 transition-all p-0 flex items-center justify-center shrink-0"
                     >
                        <Send className="w-6 h-6" />
                     </Button>
                  </div>
               </div>
               <p className="text-center text-[9px] font-black text-white/20 uppercase tracking-widest mt-6">Powered by Agentes Virtuais Neural Engine v4.0</p>
            </div>
         </div>
      </Card>
    </div>
  );
}
