import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Zap, Check, Target, MessageSquare, ArrowRight, Shield, TrendingUp, Users,
  BarChart, Globe, Mail, Phone, ExternalLink, Star, Play, 
  Instagram, Linkedin, Youtube, Send, X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

export default function LandingPage() {
  const [settings, setSettings] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/public/landing")
      .then(res => res.json())
      .then(data => {
        if (data.settings) setSettings(data.settings);
        if (data.plans) setPlans(data.plans);
      })
      .catch(err => console.error("Error loading landing data:", err));
  }, []);

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !settings?.selectedSdrId) return;
    
    const userMsg = chatMessage;
    setChatMessage("");
    setChatHistory(prev => [...prev, { role: "user", content: userMsg }]);
    setLoadingChat(true);

    try {
      const res = await fetch("/api/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sdrId: settings.selectedSdrId, 
          message: userMsg,
          history: chatHistory 
        })
      });
      const data = await res.json();
      if (data.response) {
        setChatHistory(prev => [...prev, { role: "assistant", content: data.response }]);
      }
    } catch (e) {
      toast({ title: "Erro no chat", description: "Não foi possível falar com o SDR agora.", variant: "destructive" });
    } finally {
      setLoadingChat(false);
    }
  };

  const visiblePlans = plans.filter(p => !settings?.visiblePlanIds || settings.visiblePlanIds.split(",").includes(p.id));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* HEADER PREMIUM */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 lg:px-20 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-10 w-auto" />
          ) : (
            <>
              <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                <Target className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Vend<span className="text-primary">Ai</span></span>
            </>
          )}
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
           <a href="#features" className="hover:text-primary transition-colors">Funcionalidades</a>
           <a href="#solutions" className="hover:text-primary transition-colors">Soluções</a>
           <a href="#pricing" className="hover:text-primary transition-colors">Planos</a>
        </nav>

        <div className="flex items-center gap-4">
           <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-primary transition-colors pr-4">Entrar</Link>
           <Link to="/register">
             <Button className="font-black h-11 px-8 rounded-xl bg-slate-900 hover:bg-black shadow-xl shadow-slate-200">Começar Trial Grátis</Button>
           </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-32 lg:pt-32 lg:pb-52 overflow-hidden px-6 lg:px-20">
         <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-primary/5 via-primary/0 to-transparent -z-10 rounded-full translate-x-1/2 blur-3xl opacity-50" />
         
         <div className="max-w-4xl mx-auto text-center space-y-10">
            <Badge className="bg-primary/10 text-primary border-none py-1.5 px-4 font-black text-xs uppercase tracking-widest leading-loose">
               A NOVA GERAÇÃO DE VENDAS B2B ESTÁ AQUI
            </Badge>
            <h1 className="text-5xl lg:text-8xl font-black text-slate-900 tracking-tighter leading-[0.9] text-balance">
               Scale suas Vendas com <span className="text-primary italic">SDRs Infinitos</span> de IA.
            </h1>
            <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
               Minere milhares de leads em segundos e deixe nossa IA Inbound & Outbound qualificar, conversar e agendar reuniões 24/7. O fim das planilhas frias chegou.
            </p>
         </div>
      </section>

      {/* PRICING - DYNAMIC */}
      <section id="pricing" className="py-40 bg-slate-900 px-6 lg:px-20">
         <div className="max-w-7xl mx-auto space-y-20">
            <div className="text-center space-y-6">
               <h2 className="text-4xl lg:text-6xl font-black text-white tracking-tighter leading-none">Preço Justo para <span className="text-primary italic">Resultados Reais</span>.</h2>
               <p className="text-white/40 text-lg font-medium">Escolha o plano ideal para o seu momento de escala.</p>
            </div>
            
            <div className={`grid grid-cols-1 ${visiblePlans.length === 2 ? 'md:grid-cols-2' : visiblePlans.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-10 max-w-6xl mx-auto items-end`}>
               {visiblePlans.length > 0 ? visiblePlans.map((plan, idx) => (
                  <Card key={plan.id} className={`p-10 border-none ${idx === 1 ? 'bg-primary text-white scale-110 shadow-3xl z-10' : 'bg-white/5 text-white shadow-xl'} rounded-[40px] space-y-8 relative overflow-hidden transition-all duration-500`}>
                     {idx === 1 && <div className="absolute top-0 right-0 bg-white/20 px-8 py-3 rounded-bl-3xl font-black text-[10px] uppercase tracking-widest">MELHOR VALOR</div>}
                     <div className="space-y-2">
                        <Badge className={`${idx === 1 ? 'bg-black/20' : 'bg-white/10'} text-white border-none py-1 px-4 font-black text-[10px] uppercase tracking-widest`}>{plan.name}</Badge>
                        <h3 className="text-5xl font-black tracking-tighter">R$ {plan.priceMonthly}<span className="text-sm font-medium text-white/40">/mês</span></h3>
                     </div>
                     <ul className="space-y-5">
                        <li className="flex items-center gap-3 text-sm font-bold text-white/60">
                           <Check className={`w-5 h-5 ${idx === 1 ? 'text-white' : 'text-emerald-400'}`} /> {plan.maxLeads} Leads/mês
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold text-white/60">
                           <Check className={`w-5 h-5 ${idx === 1 ? 'text-white' : 'text-emerald-400'}`} /> {plan.maxSdrs} SDRs de IA
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold text-white/60">
                           <Check className={`w-5 h-5 ${idx === 1 ? 'text-white' : 'text-emerald-400'}`} /> Suporte Prioritário
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold text-white/60">
                           <Check className={`w-5 h-5 ${idx === 1 ? 'text-white' : 'text-emerald-400'}`} /> Check de WhatsApp
                        </li>
                     </ul>
                     <Link to="/register" className="block w-full">
                       <Button className={`w-full h-16 ${idx === 1 ? 'bg-white text-primary hover:bg-slate-50' : 'bg-white/10 text-white hover:bg-white/20'} font-black rounded-2xl text-lg transition-transform active:scale-95`}>
                         Escolher Plano
                       </Button>
                     </Link>
                  </Card>
               )) : (
                  <p className="text-white/20 text-center col-span-full py-20 font-black uppercase italic tracking-widest">Nenhum plano disponível no momento.</p>
               )}
            </div>
         </div>
      </section>

      {/* FOOTER COM LINKS SOCIAIS DINÂMICOS */}
      <footer className="py-20 bg-white px-6 lg:px-20 border-t border-slate-100">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex flex-col gap-4">
               <div className="flex items-center gap-3">
                  {settings?.logoUrl ? <img src={settings.logoUrl} className="h-8 grayscale opacity-60" /> : <Target className="w-6 h-6 text-slate-900" />}
                  <span className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">VendAi</span>
               </div>
               <div className="flex gap-4">
                  {settings?.contactInstagram && <a href={settings.contactInstagram} target="_blank" className="text-slate-300 hover:text-pink-500"><Instagram className="w-5 h-5" /></a>}
                  {settings?.contactLinkedIn && <a href={settings.contactLinkedIn} target="_blank" className="text-slate-300 hover:text-blue-600"><Linkedin className="w-5 h-5" /></a>}
                  {settings?.contactYouTube && <a href={settings.contactYouTube} target="_blank" className="text-slate-300 hover:text-red-600"><Youtube className="w-5 h-5" /></a>}
               </div>
            </div>
            <div className="text-slate-400 text-sm font-bold text-center md:text-left">
               {settings?.contactEmail && <div>Contato: {settings.contactEmail}</div>}
               © 2026 VendAi S.A. Todos os direitos reservados.
            </div>
         </div>
      </footer>

      {/* FLOATING BUTTONS */}
      <div className="fixed bottom-10 right-10 flex flex-col gap-4 z-[9999]">
         {/* WHATSAPP */}
         {settings?.contactWhatsApp && (
           <a 
             href={`https://wa.me/${settings.contactWhatsApp}`} 
             target="_blank" 
             className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all animate-bounce"
           >
              <Phone className="w-8 h-8" />
           </a>
         )}

         {/* SDR CHAT BUTTON */}
         <button 
           onClick={() => setIsChatOpen(!isChatOpen)}
           className="w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
         >
            {isChatOpen ? <X className="w-8 h-8" /> : <MessageSquare className="w-8 h-8" />}
         </button>
      </div>

      {/* SDR CHAT BOX */}
      {isChatOpen && (
        <div className="fixed bottom-32 right-10 w-96 bg-white rounded-[30px] shadow-[0_50px_100px_rgba(0,0,0,0.2)] border border-slate-100 flex flex-col overflow-hidden z-[9999] animate-in slide-in-from-bottom-10 duration-500">
           <div className="bg-slate-900 p-6 text-white flex items-center gap-4">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center font-black">AI</div>
              <div>
                 <h4 className="font-black text-sm uppercase tracking-widest">Consultor Estratégico</h4>
                 <p className="text-[10px] text-white/40 font-bold flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full" /> Online para ajudar você</p>
              </div>
           </div>
           
           <div className="flex-1 h-96 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
              {chatHistory.length === 0 && (
                <div className="bg-white p-4 rounded-2xl border border-slate-100 text-xs font-bold text-slate-500 italic">
                  Olá! Sou o especialista da VendAi. Como posso ajudar você a escalar suas vendas hoje?
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] p-4 rounded-3xl text-sm font-bold ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white border border-slate-100 text-slate-800'}`}>
                      {msg.content}
                   </div>
                </div>
              ))}
              {loadingChat && <div className="text-[10px] font-black text-slate-400 animate-pulse">SDR está digitando...</div>}
           </div>

           <div className="p-4 bg-white border-t border-slate-50 flex gap-2">
              <input 
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Tire suas dúvidas..."
                className="flex-1 h-12 px-6 rounded-xl bg-slate-50 border-none text-xs font-bold focus:ring-2 ring-primary/20 transition-all outline-none"
              />
              <Button onClick={handleSendMessage} disabled={loadingChat} className="bg-slate-900 w-12 h-12 rounded-xl p-0">
                 <Send className="w-5 h-5" />
              </Button>
           </div>
        </div>
      )}
    </div>
  );
}
