import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Zap, Check, Target, MessageSquare, ArrowRight, Shield, TrendingUp, Users,
  BarChart, Globe, Mail, Phone, Star, Send, X, Play, Clock, Sparkles, AlertCircle,
  Sun, Moon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

export default function LandingPage() {
  const [settings, setSettings] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [leadId, setLeadId] = useState<string | null>(() => {
    return sessionStorage.getItem("landing_lead_id") || null;
  });

  // Theme state: defaults to dark theme as requested (using Nubank Deep Dark)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem("landing_theme");
    return savedTheme !== "light"; // true if dark (default), false if light
  });

  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>(() => {
    const savedHistory = sessionStorage.getItem("landing_chat_history");
    return savedHistory ? JSON.parse(savedHistory) : [];
  });

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

  useEffect(() => {
    if (chatHistory.length > 0) {
      sessionStorage.setItem("landing_chat_history", JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    localStorage.setItem("landing_theme", nextTheme ? "dark" : "light");
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !settings?.selectedSdrId) return;
    
    const userMsg = chatMessage;
    setChatMessage("");
    const newHistory = [...chatHistory, { role: "user", content: userMsg }];
    setChatHistory(newHistory);
    setLoadingChat(true);

    try {
      const res = await fetch("/api/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sdrId: settings.selectedSdrId, 
          message: userMsg,
          history: chatHistory,
          leadId: leadId
        })
      });
      const data = await res.json();
      
      if (data.leadId && !leadId) {
        setLeadId(data.leadId);
        sessionStorage.setItem("landing_lead_id", data.leadId);
      }

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

  // Dynamic Theme Styling Variables - Health Palette Theme (#0D9488 teal based)
  const sBg = isDarkMode ? "bg-[#042F2E] text-slate-100" : "bg-[#F0FDFA] text-[#134E4A]";
  const sHeader = isDarkMode ? "bg-[#042F2E]/85 border-teal-950/40" : "bg-white/85 border-teal-100";
  const sHeaderText = isDarkMode ? "text-teal-200 hover:text-[#0D9488]" : "text-[#134E4A] hover:text-[#0D9488]";
  const sLogoText = isDarkMode ? "text-white" : "text-[#134E4A]";
  
  const sHero = isDarkMode ? "bg-[#042F2E] border-b border-teal-950/40" : "bg-white border-b border-teal-100/60";
  const sHeroTitle = isDarkMode ? "text-white" : "text-[#134E4A]";
  const sHeroDesc = isDarkMode ? "text-teal-200/70" : "text-teal-950/70";
  const sButtonSecondary = isDarkMode ? "bg-white/5 border-teal-900/30 text-teal-200 hover:bg-white/10" : "bg-teal-50 border-teal-100 text-[#0D9488] hover:bg-teal-100";
  
  const sSectionProblem = isDarkMode ? "bg-[#032726] border-b border-teal-950/40" : "bg-[#E9FBF7] border-b border-teal-100/40";
  const sSectionTitle = isDarkMode ? "text-white" : "text-[#134E4A]";
  const sSectionDesc = isDarkMode ? "text-teal-200/70" : "text-teal-950/70";
  const sProblemCard = isDarkMode ? "bg-[#0B3A38]/65 border-teal-950/40" : "bg-white border-teal-100 shadow-xl shadow-teal-950/5";
  const sProblemTitle = isDarkMode ? "text-white" : "text-[#134E4A]";
  const sProblemDesc = isDarkMode ? "text-teal-200/60" : "text-teal-950/60";

  const sHowItWorks = isDarkMode ? "bg-[#042F2E] border-b border-teal-950/40" : "bg-white border-b border-teal-100";
  const sHowNumberText = isDarkMode ? "text-teal-950/10" : "text-[#0D9488]/5";
  const sHowTitle = isDarkMode ? "text-white" : "text-[#134E4A]";
  
  const sFeatures = isDarkMode ? "bg-[#032726] border-b border-teal-950/40" : "bg-[#F0FDFA] border-b border-teal-100";
  const sFeatureCard = isDarkMode ? "bg-[#0B3A38]/65 border-teal-950/40 hover:border-[#0D9488]/40" : "bg-white border-teal-100 hover:border-[#0D9488]/30 hover:shadow-xl hover:shadow-teal-950/5";
  const sFeatureTitle = isDarkMode ? "text-white" : "text-[#134E4A]";
  const sFeatureDesc = isDarkMode ? "text-teal-200/60" : "text-teal-950/60";

  const sTestimonials = isDarkMode ? "bg-[#042F2E] border-b border-teal-950/40" : "bg-white border-b border-teal-100";
  const sTestimonialCard = isDarkMode ? "bg-[#0B3A38]/65 border-teal-950/40 text-white" : "bg-[#F0FDFA] border-teal-100 text-[#134E4A] shadow-md";
  const sTestimonialText = isDarkMode ? "text-teal-100" : "text-teal-950/80";
  const sTestimonialAuthor = isDarkMode ? "text-white" : "text-[#134E4A]";
  const sTestimonialRole = isDarkMode ? "text-teal-300" : "text-teal-950/50";

  const sPricing = isDarkMode ? "bg-[#032726] border-b border-teal-950/40" : "bg-[#E9FBF7] border-b border-teal-100";
  const sPricingCardRecommended = "bg-[#0D9488] text-white border-none shadow-2xl shadow-[#0D9488]/30";
  const sPricingCardStandard = isDarkMode ? "bg-[#0B3A38]/80 border-teal-950/40 text-white" : "bg-white border-teal-100 text-[#134E4A] shadow-xl shadow-teal-950/5";
  const sPricingTextMuted = (recom: boolean) => recom ? "text-teal-100" : (isDarkMode ? "text-teal-300" : "text-teal-950/50");
  const sPricingBorderMuted = (recom: boolean) => recom ? "border-white/10" : (isDarkMode ? "border-teal-950/30" : "border-teal-100");

  const sFaq = isDarkMode ? "bg-[#042F2E] border-b border-teal-950/40" : "bg-white border-b border-teal-100";
  const sFaqItem = isDarkMode ? "bg-[#0B3A38]/65 border-teal-950/40" : "bg-[#F0FDFA] border-teal-100";
  const sFaqTitle = isDarkMode ? "text-white" : "text-[#134E4A]";
  const sFaqDesc = isDarkMode ? "text-teal-200/60" : "text-teal-950/60";

  const sCTA = isDarkMode ? "bg-[#032726]" : "bg-[#134E4A] text-white";
  const sCTADesc = isDarkMode ? "text-teal-200/70" : "text-teal-200";
  
  const sFooter = isDarkMode ? "bg-[#042F2E] border-t border-teal-950 text-teal-400" : "bg-white border-t border-teal-100 text-teal-950/65";
  const sFooterTitle = isDarkMode ? "text-white" : "text-[#134E4A]";
  const sFooterDesc = isDarkMode ? "text-teal-300" : "text-teal-950/55";

  return (
    <div className={`min-h-screen ${sBg} flex flex-col font-sans overflow-x-hidden selection:bg-[#0D9488] selection:text-white transition-colors duration-300`}>
      
      {/* HEADER */}
      <header className={`sticky top-0 z-50 ${sHeader} backdrop-blur-xl border-b px-6 lg:px-20 h-20 flex items-center justify-between transition-colors duration-300`}>
        <div className="flex items-center gap-3">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-10 w-auto" />
          ) : (
            <>
              <img src="/logo.png" alt="AutoSales Logo" className="h-10 w-auto" />
              <span className={`text-2xl font-black ${sLogoText} tracking-tighter uppercase italic`}>Auto<span className="text-[#0D9488]">Sales</span></span>
            </>
          )}
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-sm font-bold">
           <a href="#problem" className={`${sHeaderText} transition-colors`}>O Problema</a>
           <a href="#how-it-works" className={`${sHeaderText} transition-colors`}>Como Funciona</a>
           <a href="#features" className={`${sHeaderText} transition-colors`}>Funcionalidades</a>
           <a href="#testimonials" className={`${sHeaderText} transition-colors`}>Casos de Sucesso</a>
           <a href="#pricing" className={`${sHeaderText} transition-colors`}>Planos</a>
           <a href="#faq" className={`${sHeaderText} transition-colors`}>FAQ</a>
        </nav>

        <div className="flex items-center gap-4">
           {/* THEME TOGGLE BUTTON */}
           <button 
             onClick={toggleTheme} 
             className={`p-2.5 rounded-xl border ${isDarkMode ? 'border-teal-950/40 hover:bg-white/5 text-[#0D9488]' : 'border-teal-100 hover:bg-teal-50 text-[#0D9488]'} transition-all`}
             title={isDarkMode ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
           >
             {isDarkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-teal-800" />}
           </button>

           <Link to="/login" className={`text-sm font-bold ${isDarkMode ? 'text-teal-200 hover:text-[#0D9488]' : 'text-[#134E4A] hover:text-[#0D9488]'} transition-colors pr-2`}>Entrar</Link>
           <Link to="/register">
             <Button className="font-black h-11 px-6 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white shadow-xl shadow-[#0D9488]/20 hover:scale-105 transition-transform border-none">Testar Grátis</Button>
           </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className={`relative pt-24 pb-32 lg:pt-36 lg:pb-44 overflow-hidden px-6 lg:px-20 ${sHero} transition-colors duration-300`}>
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(13,148,136,0.08),transparent_50%)]" />
         <div className="absolute top-10 right-10 w-96 h-96 bg-[#0D9488]/10 rounded-full blur-[150px] pointer-events-none" />
         
         <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
            <Badge className="bg-[#0D9488]/10 text-[#0D9488] border-none py-1.5 px-4 font-black text-xs uppercase tracking-widest leading-loose">
               ⚡ SEU ATENDENTE DE IA NO WHATSAPP OFICIAL
            </Badge>
            <h1 className={`text-5xl lg:text-7xl font-black ${sHeroTitle} tracking-tighter leading-[0.95] text-balance`}>
               Nenhum paciente sem resposta.<br/>Sua clínica <span className="text-[#0D9488] italic">agendando 24h</span> por dia.
            </h1>
            <p className={`text-lg lg:text-xl ${sHeroDesc} font-medium max-w-3xl mx-auto leading-relaxed`}>
               Um agente de IA no WhatsApp oficial que responde na hora, qualifica o paciente e agenda a consulta direto na sua agenda — enquanto a sua recepção cuida de quem está na clínica.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
               <Link to="/register">
                 <Button className="h-16 px-10 text-lg font-black bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-2xl shadow-[0_20px_40px_-5px_rgba(13,148,136,0.4)] hover:scale-105 transition-all border-none">
                   Ativar meu atendente de IA
                 </Button>
               </Link>
               <a href="#how-it-works" className={`h-16 px-10 flex items-center justify-center text-sm font-bold border rounded-2xl ${sButtonSecondary} transition-all`}>
                 Ver Como Funciona <ArrowRight className="ml-2 w-4 h-4" />
               </a>
            </div>
         </div>
      </section>

      {/* PAIN SECTION */}
      <section id="problem" className={`py-24 ${sSectionProblem} px-6 lg:px-20 transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className={`text-3xl lg:text-5xl font-black tracking-tighter ${sSectionTitle}`}>Por que sua clínica perde pacientes <span className="text-red-500 italic">todos os dias</span>?</h2>
            <p className={`${sSectionDesc} font-medium max-w-2xl mx-auto`}>Três gargalos silenciosos esvaziam a sua agenda sem que ninguém perceba:</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className={`p-8 border rounded-3xl space-y-4 ${sProblemCard} transition-all`}>
              <div className="bg-red-500/10 p-3 w-fit rounded-xl text-red-500"><Clock className="w-6 h-6" /></div>
              <h3 className={`text-xl font-black ${sProblemTitle}`}>Resposta que demora</h3>
              <p className={`${sProblemDesc} text-sm leading-relaxed`}>
                Paciente sem resposta em minutos vira paciente do concorrente. No WhatsApp, quem responde primeiro agenda — e uma recepção humana não dá conta 24h por dia.
              </p>
            </div>
            <div className={`p-8 border rounded-3xl space-y-4 ${sProblemCard} transition-all`}>
              <div className="bg-red-500/10 p-3 w-fit rounded-xl text-red-500"><Users className="w-6 h-6" /></div>
              <h3 className={`text-xl font-black ${sProblemTitle}`}>Recepção sobrecarregada</h3>
              <p className={`${sProblemDesc} text-sm leading-relaxed`}>
                Sua equipe não consegue atender o balcão e o WhatsApp ao mesmo tempo. As mensagens acumulam, as ligações caem e o paciente desiste.
              </p>
            </div>
            <div className={`p-8 border rounded-3xl space-y-4 ${sProblemCard} transition-all`}>
              <div className="bg-red-500/10 p-3 w-fit rounded-xl text-red-500"><AlertCircle className="w-6 h-6" /></div>
              <h3 className={`text-xl font-black ${sProblemTitle}`}>Fora do horário</h3>
              <p className={`${sProblemDesc} text-sm leading-relaxed`}>
                Grande parte das mensagens chega à noite e nos fins de semana. Sem ninguém para responder, o interesse esfria e a agenda da semana seguinte fica vazia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className={`py-28 ${sHowItWorks} px-6 lg:px-20 transition-colors duration-300`}>
         <div className="max-w-6xl mx-auto space-y-20">
            <div className="text-center space-y-4">
               <h2 className={`text-3xl lg:text-5xl font-black tracking-tighter ${sHowTitle}`}>Do "oi" ao agendamento em <span className="text-[#0D9488] italic">3 passos simples</span></h2>
               <p className={`${sSectionDesc} font-medium max-w-xl mx-auto`}>Seu atendente de IA cuida do WhatsApp enquanto você cuida dos pacientes.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
               <div className="space-y-6 relative">
                  <div className={`absolute -top-6 -left-6 text-9xl font-black ${sHowNumberText} pointer-events-none select-none`}>01</div>
                  <div className="text-[#0D9488] font-black text-xs uppercase tracking-widest">PASSO 1: O PACIENTE CHAMA</div>
                  <h3 className={`text-2xl font-black ${sHowTitle} tracking-tight`}>Responde na hora, com a sua voz</h3>
                  <p className={`${sSectionDesc} text-sm leading-relaxed`}>
                     A qualquer hora do dia, o agente responde no WhatsApp oficial da clínica com o tom que você definir. Tira as dúvidas comuns — convênios, valores, endereço, preparo — sem deixar ninguém esperando.
                  </p>
               </div>

               <div className="space-y-6 relative">
                  <div className={`absolute -top-6 -left-6 text-9xl font-black ${sHowNumberText} pointer-events-none select-none`}>02</div>
                  <div className="text-[#0D9488] font-black text-xs uppercase tracking-widest">PASSO 2: QUALIFICA COM SEGURANÇA</div>
                  <h3 className={`text-2xl font-black ${sHowTitle} tracking-tight`}>Entende a necessidade do paciente</h3>
                  <p className={`${sSectionDesc} text-sm leading-relaxed`}>
                     A IA descobre o procedimento desejado, o convênio e a urgência para oferecer o melhor horário — sempre dentro do escopo, sem nunca dar diagnóstico ou orientação clínica.
                  </p>
               </div>

               <div className="space-y-6 relative">
                  <div className={`absolute -top-6 -left-6 text-9xl font-black ${sHowNumberText} pointer-events-none select-none`}>03</div>
                  <div className="text-[#0D9488] font-black text-xs uppercase tracking-widest">PASSO 3: AGENDA E CONFIRMA</div>
                  <h3 className={`text-2xl font-black ${sHowTitle} tracking-tight`}>Marca a consulta automaticamente</h3>
                  <p className={`${sSectionDesc} text-sm leading-relaxed`}>
                     O agente consulta os horários livres na sua agenda, marca a consulta sem conflito, confirma na hora e envia lembretes automáticos no WhatsApp para reduzir as faltas.
                  </p>
               </div>
            </div>
         </div>
      </section>

      {/* CORE FEATURES */}
      <section id="features" className={`py-28 ${sFeatures} px-6 lg:px-20 transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto space-y-20">
          <div className="text-center space-y-4">
            <h2 className={`text-3xl lg:text-5xl font-black tracking-tighter ${sSectionTitle}`}>Desenvolvido para gerar <span className="text-[#0D9488] italic">resultados operacionais reais</span></h2>
            <p className={`${sSectionDesc} font-medium max-w-xl mx-auto`}>Funcionalidades nativas, maduras e prontas para rodar no seu negócio.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className={`p-8 border rounded-[30px] space-y-6 transition-all group ${sFeatureCard}`}>
              <div className="w-12 h-12 bg-[#0D9488]/10 text-[#0D9488] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6" />
              </div>
              <h3 className={`text-xl font-black ${sFeatureTitle} tracking-tight`}>Atendente de IA 24/7</h3>
              <p className={`${sFeatureDesc} text-xs leading-relaxed`}>
                Responde todo paciente em segundos, no WhatsApp oficial, com a identidade e as informações da sua clínica (convênios, valores, endereço, preparo).
              </p>
            </Card>

            <Card className={`p-8 border rounded-[30px] space-y-6 transition-all group ${sFeatureCard}`}>
              <div className="w-12 h-12 bg-[#0D9488]/10 text-[#0D9488] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className={`text-xl font-black ${sFeatureTitle} tracking-tight`}>Qualificação com segurança</h3>
              <p className={`${sFeatureDesc} text-xs leading-relaxed`}>
                Entende a necessidade e agenda de forma natural, com guardrails que impedem qualquer diagnóstico ou orientação clínica. Treine o agente com a base de conhecimento da sua clínica.
              </p>
            </Card>

            <Card className={`p-8 border rounded-[30px] space-y-6 transition-all group ${sFeatureCard}`}>
              <div className="w-12 h-12 bg-[#0D9488]/10 text-[#0D9488] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <BarChart className="w-6 h-6" />
              </div>
              <h3 className={`text-xl font-black ${sFeatureTitle} tracking-tight`}>Funil de Pacientes</h3>
              <p className={`${sFeatureDesc} text-xs leading-relaxed`}>
                Acompanhe cada paciente do primeiro contato à consulta marcada, em um quadro visual. Veja quem foi atendido, quem qualificou e quem agendou.
              </p>
            </Card>

            <Card className={`p-8 border rounded-[30px] space-y-6 transition-all group ${sFeatureCard}`}>
              <div className="w-12 h-12 bg-[#0D9488]/10 text-[#0D9488] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className={`text-xl font-black ${sFeatureTitle} tracking-tight`}>Agenda integrada</h3>
              <p className={`${sFeatureDesc} text-xs leading-relaxed`}>
                Marca direto na agenda da clínica (Google Calendar), sem conflito de horário, e confirma a consulta pelo WhatsApp automaticamente em tempo real.
              </p>
            </Card>

            <Card className={`p-8 border rounded-[30px] space-y-6 transition-all group ${sFeatureCard}`}>
              <div className="w-12 h-12 bg-[#0D9488]/10 text-[#0D9488] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className={`text-xl font-black ${sFeatureTitle} tracking-tight`}>Lembretes e follow-up</h3>
              <p className={`${sFeatureDesc} text-xs leading-relaxed`}>
                Confirmações e lembretes automáticos antes da consulta para reduzir faltas (no-show), além de retomar conversas paradas — tudo no-code.
              </p>
            </Card>

            <Card className={`p-8 border rounded-[30px] space-y-6 transition-all group ${sFeatureCard}`}>
              <div className="w-12 h-12 bg-[#0D9488]/10 text-[#0D9488] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className={`text-xl font-black ${sFeatureTitle} tracking-tight`}>Atendimento humano quando precisa</h3>
              <p className={`${sFeatureDesc} text-xs leading-relaxed`}>
                Central de mensagens do WhatsApp oficial. Sua recepção assume a conversa a qualquer momento, com todo o histórico, exatamente onde a IA parou.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className={`py-24 ${sTestimonials} px-6 lg:px-20 transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
             <h2 className={`text-3xl lg:text-5xl font-black tracking-tighter ${sSectionTitle}`}>Clínicas que pararam de <span className="text-[#0D9488] italic">perder pacientes</span></h2>
             <p className={`${sSectionDesc} font-medium max-w-xl mx-auto`}>Histórias de quem encheu a agenda respondendo todo paciente na hora, sem sobrecarregar a recepção.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <Card className={`p-8 border rounded-3xl space-y-6 flex flex-col justify-between ${sTestimonialCard}`}>
                <div className="space-y-4">
                   <div className="flex text-amber-500"><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/></div>
                   <p className={`${sTestimonialText} text-sm italic leading-relaxed`}>
                      "O agente responde os pacientes na hora, mesmo de madrugada. Nossa recepção parou de viver apagando incêndio no WhatsApp e a agenda encheu — mais de 120 consultas marcadas sozinhas no primeiro mês."
                   </p>
                </div>
                <div className={`flex items-center gap-3 pt-4 border-t ${isDarkMode ? 'border-teal-950/30' : 'border-teal-100'}`}>
                   <div className="w-10 h-10 bg-[#0D9488]/20 rounded-full flex items-center justify-center font-black text-[#0D9488]">TF</div>
                   <div>
                      <p className={`text-sm font-black ${sTestimonialAuthor}`}>Thiago Fonseca</p>
                      <p className={`text-[10px] uppercase font-black ${sTestimonialRole}`}>Gestor - Clínica Vida Plena</p>
                   </div>
                </div>
             </Card>

             <Card className={`p-8 border rounded-3xl space-y-6 flex flex-col justify-between ${sTestimonialCard}`}>
                <div className="space-y-4">
                   <div className="flex text-amber-500"><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/></div>
                   <p className={`${sTestimonialText} text-sm italic leading-relaxed`}>
                      "Nossa maior dor era o tempo de resposta no WhatsApp. O paciente chegava e demorava horas para ser atendido. Agora recebe retorno instantâneo, tira as dúvidas e agenda a consulta sozinho, 24h por dia."
                   </p>
                </div>
                <div className={`flex items-center gap-3 pt-4 border-t ${isDarkMode ? 'border-teal-950/30' : 'border-teal-100'}`}>
                   <div className="w-10 h-10 bg-[#0D9488]/20 rounded-full flex items-center justify-center font-black text-[#0D9488]">AM</div>
                   <div>
                      <p className={`text-sm font-black ${sTestimonialAuthor}`}>Aline Mendes</p>
                      <p className={`text-[10px] uppercase font-black ${sTestimonialRole}`}>Fundadora - Clínica Odonto Sorriso</p>
                   </div>
                </div>
             </Card>

             <Card className={`p-8 border rounded-3xl space-y-6 flex flex-col justify-between ${sTestimonialCard}`}>
                <div className="space-y-4">
                   <div className="flex text-amber-500"><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/></div>
                   <p className={`${sTestimonialText} text-sm italic leading-relaxed`}>
                      "Reduzimos as faltas quase pela metade com os lembretes automáticos. E a recepção, que vivia presa no celular, voltou a focar no paciente que está na clínica. A IA cuida do primeiro contato."
                   </p>
                </div>
                <div className={`flex items-center gap-3 pt-4 border-t ${isDarkMode ? 'border-teal-950/30' : 'border-teal-100'}`}>
                   <div className="w-10 h-10 bg-[#0D9488]/20 rounded-full flex items-center justify-center font-black text-[#0D9488]">RC</div>
                   <div>
                      <p className={`text-sm font-black ${sTestimonialAuthor}`}>Ricardo Cruz</p>
                      <p className={`text-[10px] uppercase font-black ${sTestimonialRole}`}>Gestor - Clínica Fisio Movimento</p>
                   </div>
                </div>
             </Card>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className={`py-28 ${sPricing} px-6 lg:px-20 transition-colors duration-300`}>
         <div className="max-w-6xl mx-auto space-y-20">
            <div className="text-center space-y-4">
               <h2 className={`text-3xl lg:text-5xl font-black ${sSectionTitle} tracking-tighter leading-none`}>Preço justo para <span className="text-[#0D9488] italic">agenda cheia</span></h2>
               <p className={`${sSectionDesc} text-lg font-medium`}>Sem taxas ocultas. Escolha o plano ideal para o tamanho da sua clínica.</p>
            </div>
            
            <div className={`grid grid-cols-1 ${visiblePlans.length === 2 ? 'md:grid-cols-2' : visiblePlans.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-10 max-w-5xl mx-auto items-end pt-8`}>
               {visiblePlans.length > 0 ? visiblePlans.sort((a,b) => a.priceMonthly - b.priceMonthly).map((plan) => {
                  const isRecommended = plan.priceMonthly === 797;
                  let featuresData = {};
                  try { featuresData = JSON.parse(plan.features || "{}"); } catch(e){}

                  return (
                    <Card key={plan.id} className={`p-10 ${isRecommended ? sPricingCardRecommended : sPricingCardStandard} rounded-[40px] space-y-8 relative overflow-hidden transition-all duration-300 group`}>
                       {isRecommended && <div className="absolute top-0 right-0 bg-white/20 px-8 py-3 rounded-bl-3xl font-black text-[10px] uppercase tracking-widest text-white">RECOMENDADO</div>}
                       
                       <div className="space-y-2">
                          <Badge className={`${isRecommended ? 'bg-black/20 text-white' : 'bg-[#0D9488]/15 text-[#0D9488]'} border-none py-1 px-4 font-black text-[10px] uppercase tracking-widest`}>{plan.name}</Badge>
                          <h3 className="text-5xl font-black tracking-tighter">
                            R$ {plan.priceMonthly}
                            <span className={`text-sm font-medium ${sPricingTextMuted(isRecommended)}`}>/mês</span>
                          </h3>
                       </div>
                       
                       <ul className={`space-y-3 pt-4 border-t ${sPricingBorderMuted(isRecommended)}`}>
                          <li className="flex items-center gap-2 text-xs font-bold">
                             <Check className="w-4 h-4 shrink-0" />
                             <span>Agente de IA no WhatsApp oficial</span>
                          </li>
                          <li className="flex items-center gap-2 text-xs font-bold">
                             <Check className="w-4 h-4 shrink-0" />
                             <span>Agenda integrada (Google Calendar)</span>
                          </li>
                          <li className="flex items-center gap-2 text-xs font-bold">
                             <Check className="w-4 h-4 shrink-0" />
                             <span>Funil de Pacientes (Kanban)</span>
                          </li>
                          <li className="flex items-center gap-2 text-xs font-bold">
                             <Check className="w-4 h-4 shrink-0" />
                             <span>Central de Conversas + atendimento humano</span>
                          </li>
                          <li className="flex items-center gap-2 text-xs font-bold">
                             <Check className="w-4 h-4 shrink-0" />
                             <span>Lembretes e automações {featuresData.automations || "inclusos"}</span>
                          </li>
                          {featuresData.webhooks && (
                            <li className="flex items-center gap-2 text-xs font-bold">
                               <Check className="w-4 h-4 shrink-0" /> 
                               <span>Webhooks & API de Integração</span>
                            </li>
                          )}
                       </ul>

                       <div className={`space-y-3 pt-6 border-t ${sPricingBorderMuted(isRecommended)}`}>
                           <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-4 ${sPricingTextMuted(isRecommended)}`}>Limites do Plano</p>
                           <div className={`flex justify-between items-center text-xs font-bold ${!plan.enableSdr ? 'opacity-40' : ''}`}>
                              <span className={`${sPricingTextMuted(isRecommended)} ${!plan.enableSdr ? 'line-through' : ''}`}>Agentes de IA Ativos</span>
                              <span>{plan.enableSdr ? `Até ${plan.maxSdrs}` : 'Não disponível'}</span>
                           </div>
                           <div className={`flex justify-between items-center text-xs font-bold ${!plan.enableTokens ? 'opacity-40' : ''}`}>
                              <span className={`${sPricingTextMuted(isRecommended)} ${!plan.enableTokens ? 'line-through' : ''}`}>Créditos de IA</span>
                              <span>{plan.enableTokens ? `${(plan.maxTokens / 1000).toLocaleString()}k Tokens` : 'Não disponível'}</span>
                           </div>
                           <div className={`flex justify-between items-center text-xs font-bold ${!plan.enableMessages ? 'opacity-40' : ''}`}>
                              <span className={`${sPricingTextMuted(isRecommended)} ${!plan.enableMessages ? 'line-through' : ''}`}>Mensagens/mês</span>
                              <span>{plan.enableMessages ? `${plan.maxMessages.toLocaleString()} Mensagens` : 'Não disponível'}</span>
                           </div>
                        </div>
                       
                       <Link to="/register" className="block w-full">
                          <Button className={`w-full h-16 ${isRecommended ? 'bg-white text-[#0D9488] hover:bg-slate-50 shadow-2xl' : 'bg-[#0D9488] text-white hover:bg-[#0F766E]'} font-black rounded-2xl text-lg transition-transform active:scale-95 border-none`}>
                            Começar Agora
                          </Button>
                       </Link>
                    </Card>
                  );
               }) : (
                  <p className="text-white/20 text-center col-span-full py-20 font-black uppercase italic tracking-widest">Nenhum plano disponível no momento.</p>
               )}
            </div>
         </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className={`py-24 ${sFaq} px-6 lg:px-20 transition-colors duration-300`}>
         <div className="max-w-4xl mx-auto space-y-16">
            <div className="text-center space-y-4">
               <h2 className={`text-3xl lg:text-5xl font-black tracking-tighter ${sSectionTitle}`}>Perguntas <span className="text-[#0D9488] italic">Frequentes</span></h2>
               <p className={`${sSectionDesc} font-medium`}>Esclareça suas dúvidas e ative sua operação com total segurança.</p>
            </div>

            <div className="space-y-6">
               <div className={`p-6 border rounded-2xl space-y-2 ${sFaqItem}`}>
                  <h4 className={`font-black ${sFaqTitle} text-base`}>Os pacientes percebem que estão falando com uma Inteligência Artificial?</h4>
                  <p className={`${sFaqDesc} text-sm leading-relaxed`}>
                     A conversa é natural e humanizada, com o tom e as informações da sua clínica (base de conhecimento própria). E, sempre que o paciente pedir ou o assunto exigir, a conversa passa para a sua recepção com todo o histórico.
                  </p>
               </div>

               <div className={`p-6 border rounded-2xl space-y-2 ${sFaqItem}`}>
                  <h4 className={`font-black ${sFaqTitle} text-base`}>A IA dá orientação médica ou responde dúvidas clínicas?</h4>
                  <p className={`${sFaqDesc} text-sm leading-relaxed`}>
                     Não — por design. O agente tem regras invioláveis que o impedem de dar diagnóstico, prescrição ou qualquer orientação clínica. O papel dele é informar, qualificar e agendar; questões de saúde são sempre encaminhadas ao profissional.
                  </p>
               </div>

               <div className={`p-6 border rounded-2xl space-y-2 ${sFaqItem}`}>
                  <h4 className={`font-black ${sFaqTitle} text-base`}>Uso o WhatsApp oficial? Meu número corre risco de bloqueio?</h4>
                  <p className={`${sFaqDesc} text-sm leading-relaxed`}>
                     Trabalhamos com a API oficial do WhatsApp (Meta), o canal aprovado para empresas — sem gambiarras que arriscam o número da clínica. Sua equipe pode intervir na conversa a qualquer momento pela Central de Atendimento.
                  </p>
               </div>

               <div className={`p-6 border rounded-2xl space-y-2 ${sFaqItem}`}>
                  <h4 className={`font-black ${sFaqTitle} text-base`}>E a LGPD? Como ficam os dados dos pacientes?</h4>
                  <p className={`${sFaqDesc} text-sm leading-relaxed`}>
                     A plataforma nasce adequada à LGPD: consentimento registrado, descadastro imediato quando o paciente pede ("PARAR"), e exportação ou exclusão definitiva dos dados de qualquer paciente direto no painel.
                  </p>
               </div>
            </div>
         </div>
      </section>

      {/* FINAL CTA */}
      <section className={`py-28 text-center relative overflow-hidden ${sCTA} transition-colors duration-300`}>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#0D9488]/10 rounded-full blur-[180px] pointer-events-none" />
         <div className="max-w-4xl mx-auto space-y-8 relative z-10">
            <h2 className="text-4xl lg:text-6xl font-black tracking-tighter">Chegou a hora de encher a agenda da sua clínica.</h2>
            <p className={`font-medium text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed ${sCTADesc}`}>
               Pare de perder pacientes por demora no WhatsApp. Ative seu atendente de IA e veja as consultas sendo marcadas sozinhas — de dia, de noite e no fim de semana.
            </p>
            <div className="pt-4">
               <Link to="/register">
                 <Button className="h-16 px-12 text-lg font-black bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-2xl shadow-xl shadow-[#0D9488]/20 hover:scale-105 transition-all border-none">
                   Testar a Plataforma Grátis
                 </Button>
               </Link>
               <p className="text-xs text-teal-300 font-bold uppercase tracking-widest mt-4">Teste grátis • Sem cartão de crédito • Cancele quando quiser</p>
            </div>
         </div>
      </section>

      {/* FOOTER */}
      <footer className={`py-16 px-6 lg:px-20 ${sFooter} transition-colors duration-300`}>
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col gap-3">
               <div className="flex items-center gap-3">
                  {settings?.logoUrl ? <img src={settings.logoUrl} className="h-8 grayscale opacity-60" /> : <img src="/logo.png" className="h-8 w-auto grayscale opacity-60" />}
                  <span className={`text-xl font-black ${sFooterTitle} tracking-tighter uppercase italic`}>Auto<span className="text-[#0D9488]">Sales</span></span>
               </div>
               <p className={`text-xs font-bold ${sFooterDesc}`}>Atendimento inteligente 24h para clínicas no WhatsApp.</p>
            </div>
            <div className="text-xs font-bold text-center md:text-right space-y-2">
               <div>E-mail oficial: contato@agentesvirtuais.com</div>
               <div>Suporte via WhatsApp: 71 99204-2802</div>
               <div>Endereço: Rua Vereador Zezeu Ribeiro, 1117, Boca da Mata, Salvador - Ba. Cep: 41.345-100</div>
               <div className={`pt-2 ${sFooterDesc}`}>© 2026 AutoSales. Todos os direitos reservados.</div>
            </div>
         </div>
      </footer>

      {/* FLOATING BUTTONS */}
      <div className="fixed bottom-10 right-10 flex flex-col gap-4 z-[9999]">
         {/* WHATSAPP */}
         <a 
           href={`https://wa.me/5571992042802`} 
           target="_blank" 
           className="w-16 h-16 bg-[#0D9488] hover:bg-emerald-400 text-slate-950 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all animate-bounce"
         >
            <Phone className="w-8 h-8 fill-current" />
         </a>

         {/* SDR CHAT BUTTON */}
         <button 
           onClick={() => setIsChatOpen(!isChatOpen)}
           className={`w-16 h-16 ${isDarkMode ? 'bg-[#042F2E] border-teal-950/40 text-white' : 'bg-white border-teal-100 text-slate-900'} border rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all`}
         >
            {isChatOpen ? <X className="w-8 h-8" /> : <MessageSquare className="w-8 h-8" />}
         </button>
      </div>

      {/* SDR CHAT BOX */}
      {isChatOpen && (
        <div className={`fixed bottom-32 right-10 w-96 ${isDarkMode ? 'bg-[#042F2E] border-teal-950/40' : 'bg-white border-teal-100'} border rounded-[30px] shadow-[0_50px_100px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden z-[9999] animate-in slide-in-from-bottom-10 duration-500`}>
           <div className={`p-6 text-white flex items-center gap-4 border-b ${isDarkMode ? 'bg-[#0B4A47] border-teal-950/40' : 'bg-teal-50 border-teal-100'}`}>
              <div className="w-12 h-12 bg-[#0D9488] rounded-full flex items-center justify-center font-black text-white">AI</div>
              <div>
                 <h4 className={`font-black text-sm uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-[#134E4A]'}`}>Assistente AutoSales</h4>
                 <p className="text-[10px] text-[#0D9488] font-bold flex items-center gap-1"><span className="w-2 h-2 bg-[#0D9488] rounded-full animate-ping" /> Especialista online agora</p>
              </div>
           </div>
           
           <div className={`flex-1 h-96 p-6 overflow-y-auto space-y-4 ${isDarkMode ? 'bg-[#042F2E]' : 'bg-[#F0FDFA]'}`}>
              {chatHistory.length === 0 && (
                <div className={`p-4 rounded-2xl border text-xs font-bold italic ${isDarkMode ? 'bg-[#0B4A47] border-teal-950/40 text-teal-200' : 'bg-white border-teal-100 text-teal-950/70'}`}>
                   Olá! Sou o assistente da AutoSales. Quer ver como um agente de IA pode atender e agendar os pacientes da sua clínica 24h por dia?
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] p-4 rounded-3xl text-sm font-bold whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'bg-[#0D9488] text-white' : (isDarkMode ? 'bg-[#0B4A47] border border-teal-950/40 text-teal-100' : 'bg-white border border-teal-100 text-[#134E4A]')}`}>
                      {msg.content}
                   </div>
                </div>
              ))}
              {loadingChat && <div className="text-[10px] font-black text-teal-500 animate-pulse pl-2">SDR está elaborando resposta...</div>}
           </div>

           <div className={`p-4 border-t ${isDarkMode ? 'bg-[#042F2E] border-teal-950/40' : 'bg-[#F0FDFA] border-teal-100'} flex gap-2`}>
              <input 
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Tire suas dúvidas conosco..."
                className={`flex-1 h-12 px-6 rounded-xl border-none text-xs font-bold focus:ring-1 ring-[#0D9488]/40 transition-all outline-none ${isDarkMode ? 'bg-[#0B4A47] text-white' : 'bg-white text-[#134E4A]'}`}
              />
              <Button onClick={handleSendMessage} disabled={loadingChat} className="bg-[#0D9488] hover:bg-[#0F766E] text-white w-12 h-12 rounded-xl p-0 shrink-0">
                 <Send className="w-5 h-5" />
              </Button>
           </div>
        </div>
      )}
    </div>
  );
}
