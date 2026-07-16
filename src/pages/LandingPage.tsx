import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Zap, Check, Target, MessageSquare, ArrowRight, Shield, TrendingUp, Users,
  BarChart, Globe, Mail, Phone, Star, Send, X, Play, Clock, Sparkles, AlertCircle,
  Sun, Moon, Bot, Instagram, Package, CalendarDays, LayoutGrid
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ChatMockup } from "@/components/landing/ChatMockup";
import { DashboardMockup } from "@/components/landing/DashboardMockup";

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

  // Dynamic Theme Styling Variables - Health Palette Theme (#2563EB teal based)
  const sBg = isDarkMode ? "bg-[#0F172A] text-slate-100" : "bg-[#F8FAFC] text-[#0F172A]";
  const sHeader = isDarkMode ? "bg-[#0F172A]/85 border-slate-900/40" : "bg-white/85 border-slate-200";
  const sHeaderText = isDarkMode ? "text-slate-300 hover:text-[#2563EB]" : "text-[#0F172A] hover:text-[#2563EB]";
  const sLogoText = isDarkMode ? "text-white" : "text-[#0F172A]";
  
  const sHero = isDarkMode ? "bg-[#0F172A] border-b border-slate-900/40" : "bg-white border-b border-slate-200/60";
  const sHeroTitle = isDarkMode ? "text-white" : "text-[#0F172A]";
  const sHeroDesc = isDarkMode ? "text-slate-300/70" : "text-slate-900/70";
  const sButtonSecondary = isDarkMode ? "bg-white/5 border-slate-900/30 text-slate-300 hover:bg-white/10" : "bg-blue-50 border-slate-200 text-[#2563EB] hover:bg-slate-200";
  
  const sSectionProblem = isDarkMode ? "bg-[#020617] border-b border-slate-900/40" : "bg-[#F1F5F9] border-b border-slate-200/40";
  const sSectionTitle = isDarkMode ? "text-white" : "text-[#0F172A]";
  const sSectionDesc = isDarkMode ? "text-slate-300/70" : "text-slate-900/70";
  const sProblemCard = isDarkMode ? "bg-[#1E293B]/65 border-slate-900/40" : "bg-white border-slate-200 shadow-xl ";
  const sProblemTitle = isDarkMode ? "text-white" : "text-[#0F172A]";
  const sProblemDesc = isDarkMode ? "text-slate-300/60" : "text-slate-900/60";

  const sHowItWorks = isDarkMode ? "bg-[#0F172A] border-b border-slate-900/40" : "bg-white border-b border-slate-200";
  const sHowNumberText = isDarkMode ? "text-slate-900/10" : "text-[#2563EB]/5";
  const sHowTitle = isDarkMode ? "text-white" : "text-[#0F172A]";
  
  const sFeatures = isDarkMode ? "bg-[#020617] border-b border-slate-900/40" : "bg-[#F8FAFC] border-b border-slate-200";
  const sFeatureCard = isDarkMode ? "bg-[#1E293B]/65 border-slate-900/40 hover:border-[#2563EB]/40" : "bg-white border-slate-200 hover:border-[#2563EB]/30 hover:shadow-xl hover:";
  const sFeatureTitle = isDarkMode ? "text-white" : "text-[#0F172A]";
  const sFeatureDesc = isDarkMode ? "text-slate-300/60" : "text-slate-900/60";

  const sTestimonials = isDarkMode ? "bg-[#0F172A] border-b border-slate-900/40" : "bg-white border-b border-slate-200";
  const sTestimonialCard = isDarkMode ? "bg-[#1E293B]/65 border-slate-900/40 text-white" : "bg-[#F8FAFC] border-slate-200 text-[#0F172A] shadow-md";
  const sTestimonialText = isDarkMode ? "text-slate-200" : "text-slate-900/80";
  const sTestimonialAuthor = isDarkMode ? "text-white" : "text-[#0F172A]";
  const sTestimonialRole = isDarkMode ? "text-slate-400" : "text-slate-900/50";

  const sPricing = isDarkMode ? "bg-[#020617] border-b border-slate-900/40" : "bg-[#F1F5F9] border-b border-slate-200";
  const sPricingCardRecommended = "bg-[#2563EB] text-white border-none shadow-2xl ";
  const sPricingCardStandard = isDarkMode ? "bg-[#1E293B]/80 border-slate-900/40 text-white" : "bg-white border-slate-200 text-[#0F172A] shadow-xl ";
  const sPricingTextMuted = (recom: boolean) => recom ? "text-slate-200" : (isDarkMode ? "text-slate-400" : "text-slate-900/50");
  const sPricingBorderMuted = (recom: boolean) => recom ? "border-white/10" : (isDarkMode ? "border-slate-900/30" : "border-slate-200");

  const sFaq = isDarkMode ? "bg-[#0F172A] border-b border-slate-900/40" : "bg-white border-b border-slate-200";
  const sFaqItem = isDarkMode ? "bg-[#1E293B]/65 border-slate-900/40" : "bg-[#F8FAFC] border-slate-200";
  const sFaqTitle = isDarkMode ? "text-white" : "text-[#0F172A]";
  const sFaqDesc = isDarkMode ? "text-slate-300/60" : "text-slate-900/60";

  const sCTA = isDarkMode ? "bg-[#020617]" : "bg-[#0F172A] text-white";
  const sCTADesc = isDarkMode ? "text-slate-300/70" : "text-slate-300";
  
  const sFooter = isDarkMode ? "bg-[#0F172A] border-t border-slate-900 text-slate-500" : "bg-white border-t border-slate-200 text-slate-900/65";
  const sFooterTitle = isDarkMode ? "text-white" : "text-[#0F172A]";
  const sFooterDesc = isDarkMode ? "text-slate-400" : "text-slate-900/55";

  return (
    <div className={`min-h-screen ${sBg} flex flex-col font-sans overflow-x-hidden selection:bg-[#2563EB] selection:text-white transition-colors duration-300`}>
      
      {/* HEADER */}
      <header className={`sticky top-0 z-50 ${sHeader} backdrop-blur-xl border-b px-6 lg:px-20 h-20 flex items-center justify-between transition-colors duration-300`}>
        <div className="flex items-center gap-3">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-10 w-auto" />
          ) : (
            <>
              <img src="/logo.png" alt="Agentes Virtuais" className="h-10 w-auto" />
              <span className={`text-2xl font-bold ${sLogoText} tracking-tight uppercase italic`}>Agentes <span className="text-[#2563EB]">Virtuais</span></span>
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
             className={`p-2.5 rounded-xl border ${isDarkMode ? 'border-slate-900/40 hover:bg-white/5 text-[#2563EB]' : 'border-slate-200 hover:bg-blue-50 text-[#2563EB]'} transition-all`}
             title={isDarkMode ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
           >
             {isDarkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-800" />}
           </button>

           <Link to="/login" className={`text-sm font-bold ${isDarkMode ? 'text-slate-300 hover:text-[#2563EB]' : 'text-[#0F172A] hover:text-[#2563EB]'} transition-colors pr-2`}>Entrar</Link>
           <Link to="/register">
             <Button className="font-bold h-11 px-6 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xl hover:scale-105 transition-transform border-none">Testar Grátis</Button>
           </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className={`relative pt-24 pb-32 lg:pt-36 lg:pb-44 overflow-hidden px-6 lg:px-20 ${sHero} transition-colors duration-300`}>
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(37, 99, 235, 0.08),transparent_50%)]" />
         <div className="absolute top-10 right-10 w-96 h-96 bg-[#2563EB]/10 rounded-full blur-[150px] pointer-events-none" />
         
         <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center relative z-10">
            <div className="text-center lg:text-left space-y-8">
               <Badge className="bg-[#2563EB]/10 text-[#2563EB] border-none py-1.5 px-4 font-bold text-xs leading-loose">
                  ⚡ AGENTES DE IA MULTICANAL · WHATSAPP · INSTAGRAM · SITE
               </Badge>
               <h1 className={`text-5xl lg:text-6xl font-bold ${sHeroTitle} tracking-tight leading-[0.95] text-balance`}>
                  Um agente de IA que <span className="text-[#2563EB] italic">atende, vende e agenda</span> pelo seu negócio.
               </h1>
               <p className={`text-lg lg:text-xl ${sHeroDesc} font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed`}>
                  Plataforma de agentes de IA no WhatsApp, Instagram e no seu site. Ele responde na hora, tira dúvidas, apresenta seus produtos, qualifica, agenda na sua agenda e organiza tudo no CRM — 24 horas por dia. Para clínicas, salões, academias, restaurantes, lojas e escritórios.
               </p>
               <div className="flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-4 pt-4">
                  <Link to="/register">
                    <Button className="h-16 px-10 text-lg font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-2xl shadow-[0_20px_40px_-5px_rgba(37, 99, 235, 0.4)] hover:scale-105 transition-all border-none">
                      Criar meu agente de IA
                    </Button>
                  </Link>
                  <a href="#how-it-works" className={`h-16 px-10 flex items-center justify-center text-sm font-bold border rounded-2xl ${sButtonSecondary} transition-all`}>
                    Ver Como Funciona <ArrowRight className="ml-2 w-4 h-4" />
                  </a>
               </div>
            </div>

            {/* Mockup do chat de venda */}
            <div className="flex justify-center lg:justify-end">
               <ChatMockup dark={isDarkMode} />
            </div>
         </div>
      </section>

      {/* PAIN SECTION */}
      <section id="problem" className={`py-24 ${sSectionProblem} px-6 lg:px-20 transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className={`text-3xl lg:text-5xl font-bold tracking-tight ${sSectionTitle}`}>Por que seu negócio perde vendas <span className="text-red-500 italic">todos os dias</span>?</h2>
            <p className={`${sSectionDesc} font-medium max-w-2xl mx-auto`}>Três gargalos silenciosos deixam dinheiro na mesa sem que ninguém perceba:</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className={`p-8 border rounded-3xl space-y-4 ${sProblemCard} transition-all`}>
              <div className="bg-red-500/10 p-3 w-fit rounded-xl text-red-500"><Clock className="w-6 h-6" /></div>
              <h3 className={`text-xl font-bold ${sProblemTitle}`}>Resposta que demora</h3>
              <p className={`${sProblemDesc} text-sm leading-relaxed`}>
                Cliente sem resposta em minutos vira cliente do concorrente. Quem responde primeiro fecha — e uma equipe humana não dá conta de WhatsApp, Instagram e site ao mesmo tempo, 24h por dia.
              </p>
            </div>
            <div className={`p-8 border rounded-3xl space-y-4 ${sProblemCard} transition-all`}>
              <div className="bg-red-500/10 p-3 w-fit rounded-xl text-red-500"><Users className="w-6 h-6" /></div>
              <h3 className={`text-xl font-bold ${sProblemTitle}`}>Equipe sobrecarregada em vários canais</h3>
              <p className={`${sProblemDesc} text-sm leading-relaxed`}>
                Mensagem no WhatsApp, DM no Instagram, dúvida no site — tudo ao mesmo tempo. As conversas acumulam, as respostas atrasam e o cliente desiste no meio do caminho.
              </p>
            </div>
            <div className={`p-8 border rounded-3xl space-y-4 ${sProblemCard} transition-all`}>
              <div className="bg-red-500/10 p-3 w-fit rounded-xl text-red-500"><AlertCircle className="w-6 h-6" /></div>
              <h3 className={`text-xl font-bold ${sProblemTitle}`}>Fora do horário</h3>
              <p className={`${sProblemDesc} text-sm leading-relaxed`}>
                Boa parte das mensagens chega à noite e nos fins de semana. Sem ninguém pra responder, tirar a dúvida e apresentar o produto, o interesse esfria e a venda não acontece.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className={`py-28 ${sHowItWorks} px-6 lg:px-20 transition-colors duration-300`}>
         <div className="max-w-6xl mx-auto space-y-20">
            <div className="text-center space-y-4">
               <h2 className={`text-3xl lg:text-5xl font-bold tracking-tight ${sHowTitle}`}>Do primeiro "oi" ao <span className="text-[#2563EB] italic">cliente fechado</span></h2>
               <p className={`${sSectionDesc} font-medium max-w-xl mx-auto`}>Seus agentes de IA cuidam de todos os canais enquanto você cuida do que importa.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
               <div className="space-y-6 relative">
                  <div className={`absolute -top-6 -left-6 text-9xl font-bold ${sHowNumberText} pointer-events-none select-none`}>01</div>
                  <div className="text-[#2563EB] font-bold text-xs ">PASSO 1: O CLIENTE CHAMA</div>
                  <h3 className={`text-2xl font-bold ${sHowTitle} tracking-tight`}>Responde na hora, em qualquer canal</h3>
                  <p className={`${sSectionDesc} text-sm leading-relaxed`}>
                     WhatsApp, Instagram ou o chat do seu site — o agente responde na hora, com o tom e a identidade do seu negócio. Tira dúvidas de serviços, valores, endereço e formas de pagamento sem deixar ninguém esperando.
                  </p>
               </div>

               <div className="space-y-6 relative">
                  <div className={`absolute -top-6 -left-6 text-9xl font-bold ${sHowNumberText} pointer-events-none select-none`}>02</div>
                  <div className="text-[#2563EB] font-bold text-xs ">PASSO 2: ENTENDE E APRESENTA</div>
                  <h3 className={`text-2xl font-bold ${sHowTitle} tracking-tight`}>Qualifica e mostra o produto certo</h3>
                  <p className={`${sSectionDesc} text-sm leading-relaxed`}>
                     Com metodologia de vendas profissional (SPIN Selling, escuta ativa, tratamento de objeções), a IA entende a necessidade, recomenda a solução ideal e envia foto, áudio e vídeo do seu catálogo na conversa.
                  </p>
               </div>

               <div className="space-y-6 relative">
                  <div className={`absolute -top-6 -left-6 text-9xl font-bold ${sHowNumberText} pointer-events-none select-none`}>03</div>
                  <div className="text-[#2563EB] font-bold text-xs ">PASSO 3: CONVERTE</div>
                  <h3 className={`text-2xl font-bold ${sHowTitle} tracking-tight`}>Agenda, vende ou passa pra equipe</h3>
                  <p className={`${sSectionDesc} text-sm leading-relaxed`}>
                     O agente marca na sua agenda sem conflito, encaminha pro fechamento ou passa a conversa pra um humano — e organiza cada contato no CRM, com lembretes automáticos que reduzem as faltas.
                  </p>
               </div>
            </div>
         </div>
      </section>

      {/* DASHBOARD SHOWCASE */}
      <section className={`py-28 ${sFeatures} px-6 lg:px-20 transition-colors duration-300 relative overflow-hidden`}>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#2563EB]/10 rounded-full blur-[180px] pointer-events-none" />
         <div className="max-w-6xl mx-auto space-y-14 relative z-10">
            <div className="text-center space-y-4">
               <Badge className="bg-[#2563EB]/10 text-[#2563EB] border-none py-1.5 px-4 font-bold text-xs">
                  UM PAINEL, TODOS OS CANAIS
               </Badge>
               <h2 className={`text-3xl lg:text-5xl font-bold tracking-tight ${sSectionTitle}`}>Tudo o que acontece, <span className="text-[#2563EB] italic">num lugar só</span></h2>
               <p className={`${sSectionDesc} font-medium max-w-xl mx-auto`}>WhatsApp, Instagram e site na mesma caixa de entrada, com o funil de clientes atualizado em tempo real.</p>
            </div>
            <div className="max-w-5xl mx-auto">
               <DashboardMockup dark={isDarkMode} />
            </div>
         </div>
      </section>

      {/* CORE FEATURES */}
      <section id="features" className={`py-28 ${sFeatures} px-6 lg:px-20 transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto space-y-20">
          <div className="text-center space-y-4">
            <h2 className={`text-3xl lg:text-5xl font-bold tracking-tight ${sSectionTitle}`}>Uma plataforma completa de <span className="text-[#2563EB] italic">agentes de IA</span></h2>
            <p className={`${sSectionDesc} font-medium max-w-xl mx-auto`}>Muito além de agendar: atendimento, vendas e organização — tudo num lugar só.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className={`p-8 border rounded-2xl space-y-6 transition-all group ${sFeatureCard}`}>
              <div className="w-12 h-12 bg-[#2563EB]/10 text-[#2563EB] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className={`text-xl font-bold ${sFeatureTitle} tracking-tight`}>Agente de IA personalizável</h3>
              <p className={`${sFeatureDesc} text-xs leading-relaxed`}>
                Escolha a função — Vendedor, Atendimento, Agendador, Consultor ou SDR — e cada uma vem com skills especializadas. Treine com seus documentos (PDF, DOCX, planilha) e ele fala com a identidade do seu negócio.
              </p>
            </Card>

            <Card className={`p-8 border rounded-2xl space-y-6 transition-all group ${sFeatureCard}`}>
              <div className="w-12 h-12 bg-[#2563EB]/10 text-[#2563EB] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Instagram className="w-6 h-6" />
              </div>
              <h3 className={`text-xl font-bold ${sFeatureTitle} tracking-tight`}>Multicanal de verdade</h3>
              <p className={`${sFeatureDesc} text-xs leading-relaxed`}>
                O mesmo agente atende no WhatsApp oficial, no Instagram Direct e num chat que você instala no seu site. Todas as conversas caem numa caixa de entrada só.
              </p>
            </Card>

            <Card className={`p-8 border rounded-2xl space-y-6 transition-all group ${sFeatureCard}`}>
              <div className="w-12 h-12 bg-[#2563EB]/10 text-[#2563EB] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package className="w-6 h-6" />
              </div>
              <h3 className={`text-xl font-bold ${sFeatureTitle} tracking-tight`}>Catálogo com mídia</h3>
              <p className={`${sFeatureDesc} text-xs leading-relaxed`}>
                Cadastre produtos e serviços com foto, áudio e vídeo. Na conversa, o agente apresenta o item certo e envia a mídia automaticamente — como um vendedor mostrando a vitrine.
              </p>
            </Card>

            <Card className={`p-8 border rounded-2xl space-y-6 transition-all group ${sFeatureCard}`}>
              <div className="w-12 h-12 bg-[#2563EB]/10 text-[#2563EB] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <CalendarDays className="w-6 h-6" />
              </div>
              <h3 className={`text-xl font-bold ${sFeatureTitle} tracking-tight`}>Agenda integrada + lembretes</h3>
              <p className={`${sFeatureDesc} text-xs leading-relaxed`}>
                Marca direto no Google Calendar, sem conflito de horário, confirma na hora e dispara lembretes automáticos que reduzem as faltas (no-show).
              </p>
            </Card>

            <Card className={`p-8 border rounded-2xl space-y-6 transition-all group ${sFeatureCard}`}>
              <div className="w-12 h-12 bg-[#2563EB]/10 text-[#2563EB] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <h3 className={`text-xl font-bold ${sFeatureTitle} tracking-tight`}>CRM e funil de clientes</h3>
              <p className={`${sFeatureDesc} text-xs leading-relaxed`}>
                Cada contato do primeiro "oi" ao fechamento, num quadro visual (Kanban). Veja quem está sendo atendido, quem qualificou, quem agendou e quem comprou.
              </p>
            </Card>

            <Card className={`p-8 border rounded-2xl space-y-6 transition-all group ${sFeatureCard}`}>
              <div className="w-12 h-12 bg-[#2563EB]/10 text-[#2563EB] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className={`text-xl font-bold ${sFeatureTitle} tracking-tight`}>Central de conversas + humano</h3>
              <p className={`${sFeatureDesc} text-xs leading-relaxed`}>
                Inbox unificado dos seus canais. Sua equipe assume qualquer conversa a qualquer momento, com todo o histórico, exatamente onde a IA parou.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className={`py-24 ${sTestimonials} px-6 lg:px-20 transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
             <h2 className={`text-3xl lg:text-5xl font-bold tracking-tight ${sSectionTitle}`}>Negócios que pararam de <span className="text-[#2563EB] italic">perder clientes</span></h2>
             <p className={`${sSectionDesc} font-medium max-w-xl mx-auto`}>Histórias de quem atende, vende e agenda no automático — sem sobrecarregar a equipe.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <Card className={`p-8 border rounded-3xl space-y-6 flex flex-col justify-between ${sTestimonialCard}`}>
                <div className="space-y-4">
                   <div className="flex text-amber-500"><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/></div>
                   <p className={`${sTestimonialText} text-sm italic leading-relaxed`}>
                      "O agente responde os clientes na hora, mesmo de madrugada. Nossa equipe parou de viver apagando incêndio no WhatsApp e a agenda encheu — mais de 120 horários marcados sozinhos no primeiro mês."
                   </p>
                </div>
                <div className={`flex items-center gap-3 pt-4 border-t ${isDarkMode ? 'border-slate-900/30' : 'border-slate-200'}`}>
                   <div className="w-10 h-10 bg-[#2563EB]/20 rounded-full flex items-center justify-center font-bold text-[#2563EB]">TF</div>
                   <div>
                      <p className={`text-sm font-bold ${sTestimonialAuthor}`}>Thiago Fonseca</p>
                      <p className={`text-xs uppercase font-bold ${sTestimonialRole}`}>Gestor - Vida Plena Studio</p>
                   </div>
                </div>
             </Card>

             <Card className={`p-8 border rounded-3xl space-y-6 flex flex-col justify-between ${sTestimonialCard}`}>
                <div className="space-y-4">
                   <div className="flex text-amber-500"><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/></div>
                   <p className={`${sTestimonialText} text-sm italic leading-relaxed`}>
                      "Ligamos o agente no WhatsApp e no Instagram. Ele responde na hora, manda a foto do procedimento, tira as dúvidas e já agenda. Vendeu mais no primeiro mês do que a gente conseguia respondendo na mão."
                   </p>
                </div>
                <div className={`flex items-center gap-3 pt-4 border-t ${isDarkMode ? 'border-slate-900/30' : 'border-slate-200'}`}>
                   <div className="w-10 h-10 bg-[#2563EB]/20 rounded-full flex items-center justify-center font-bold text-[#2563EB]">AM</div>
                   <div>
                      <p className={`text-sm font-bold ${sTestimonialAuthor}`}>Aline Mendes</p>
                      <p className={`text-xs uppercase font-bold ${sTestimonialRole}`}>Fundadora - Odonto Sorriso</p>
                   </div>
                </div>
             </Card>

             <Card className={`p-8 border rounded-3xl space-y-6 flex flex-col justify-between ${sTestimonialCard}`}>
                <div className="space-y-4">
                   <div className="flex text-amber-500"><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/><Star className="fill-current w-4 h-4"/></div>
                   <p className={`${sTestimonialText} text-sm italic leading-relaxed`}>
                      "Reduzimos as faltas quase pela metade com os lembretes automáticos. E a equipe, que vivia presa no celular, voltou a focar no cliente que está no local. A IA cuida do primeiro contato."
                   </p>
                </div>
                <div className={`flex items-center gap-3 pt-4 border-t ${isDarkMode ? 'border-slate-900/30' : 'border-slate-200'}`}>
                   <div className="w-10 h-10 bg-[#2563EB]/20 rounded-full flex items-center justify-center font-bold text-[#2563EB]">RC</div>
                   <div>
                      <p className={`text-sm font-bold ${sTestimonialAuthor}`}>Ricardo Cruz</p>
                      <p className={`text-xs uppercase font-bold ${sTestimonialRole}`}>Gestor - Fisio Movimento</p>
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
               <h2 className={`text-3xl lg:text-5xl font-bold ${sSectionTitle} tracking-tight leading-none`}>Preço justo para <span className="text-[#2563EB] italic">vender mais</span></h2>
               <p className={`${sSectionDesc} text-lg font-medium`}>Sem taxas ocultas. Escolha o plano ideal para o tamanho do seu negócio. Teste 7 dias grátis.</p>
            </div>
            
            <div className={`grid grid-cols-1 ${visiblePlans.length === 2 ? 'md:grid-cols-2' : visiblePlans.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-10 max-w-5xl mx-auto items-end pt-8`}>
               {visiblePlans.length > 0 ? visiblePlans.sort((a,b) => a.priceMonthly - b.priceMonthly).map((plan) => {
                  const isRecommended = plan.priceMonthly === 797;
                  let featuresData = {};
                  try { featuresData = JSON.parse(plan.features || "{}"); } catch(e){}

                  return (
                    <Card key={plan.id} className={`p-10 ${isRecommended ? sPricingCardRecommended : sPricingCardStandard} rounded-3xl space-y-8 relative overflow-hidden transition-all duration-300 group`}>
                       {isRecommended && <div className="absolute top-0 right-0 bg-white/20 px-8 py-3 rounded-bl-3xl font-bold text-xs text-white">RECOMENDADO</div>}
                       
                       <div className="space-y-2">
                          <Badge className={`${isRecommended ? 'bg-black/20 text-white' : 'bg-[#2563EB]/15 text-[#2563EB]'} border-none py-1 px-4 font-bold text-xs `}>{plan.name}</Badge>
                          <h3 className="text-5xl font-bold tracking-tight">
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
                             <span>Funil de Clientes (Kanban)</span>
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
                           <p className={`text-xs font-bold mb-4 ${sPricingTextMuted(isRecommended)}`}>Limites do Plano</p>
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
                       
                       <Link to={`/register?plan=${plan.id}`} className="block w-full">
                          <Button className={`w-full h-16 ${isRecommended ? 'bg-white text-[#2563EB] hover:bg-slate-50 shadow-2xl' : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'} font-bold rounded-2xl text-lg transition-transform active:scale-95 border-none`}>
                            Testar 7 dias grátis
                          </Button>
                       </Link>
                    </Card>
                  );
               }) : (
                  <p className="text-white/20 text-center col-span-full py-20 font-bold uppercase italic ">Nenhum plano disponível no momento.</p>
               )}
            </div>
         </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className={`py-24 ${sFaq} px-6 lg:px-20 transition-colors duration-300`}>
         <div className="max-w-4xl mx-auto space-y-16">
            <div className="text-center space-y-4">
               <h2 className={`text-3xl lg:text-5xl font-bold tracking-tight ${sSectionTitle}`}>Perguntas <span className="text-[#2563EB] italic">Frequentes</span></h2>
               <p className={`${sSectionDesc} font-medium`}>Esclareça suas dúvidas e ative sua operação com total segurança.</p>
            </div>

            <div className="space-y-6">
               <div className={`p-6 border rounded-2xl space-y-2 ${sFaqItem}`}>
                  <h4 className={`font-bold ${sFaqTitle} text-base`}>Os clientes percebem que estão falando com uma Inteligência Artificial?</h4>
                  <p className={`${sFaqDesc} text-sm leading-relaxed`}>
                     A conversa é natural e humanizada, com o tom e as informações do seu negócio (base de conhecimento própria). E, sempre que o cliente pedir ou o assunto exigir, a conversa passa para a sua equipe com todo o histórico.
                  </p>
               </div>

               <div className={`p-6 border rounded-2xl space-y-2 ${sFaqItem}`}>
                  <h4 className={`font-bold ${sFaqTitle} text-base`}>Em quais canais o agente atende?</h4>
                  <p className={`${sFaqDesc} text-sm leading-relaxed`}>
                     WhatsApp oficial (Meta), Instagram Direct e um chat que você instala no seu site com uma linha de código. O mesmo agente atende os três, e todas as conversas chegam numa caixa de entrada só.
                  </p>
               </div>

               <div className={`p-6 border rounded-2xl space-y-2 ${sFaqItem}`}>
                  <h4 className={`font-bold ${sFaqTitle} text-base`}>Serve para qualquer tipo de negócio?</h4>
                  <p className={`${sFaqDesc} text-sm leading-relaxed`}>
                     Sim. Clínicas, salões, academias, restaurantes, lojas, escritórios profissionais — qualquer negócio que atende e vende por mensagem. Templates prontos por segmento aceleram a configuração, e você personaliza a função do agente (vendedor, atendimento, agendador, consultor) e a base de conhecimento.
                  </p>
               </div>

               <div className={`p-6 border rounded-2xl space-y-2 ${sFaqItem}`}>
                  <h4 className={`font-bold ${sFaqTitle} text-base`}>O agente consegue apresentar meus produtos?</h4>
                  <p className={`${sFaqDesc} text-sm leading-relaxed`}>
                     Sim. Você cadastra produtos e serviços com foto, áudio e vídeo no catálogo, e na conversa o agente apresenta o item certo e envia a mídia automaticamente — como um vendedor mostrando a vitrine.
                  </p>
               </div>

               <div className={`p-6 border rounded-2xl space-y-2 ${sFaqItem}`}>
                  <h4 className={`font-bold ${sFaqTitle} text-base`}>Uso o WhatsApp oficial? Meu número corre risco de bloqueio?</h4>
                  <p className={`${sFaqDesc} text-sm leading-relaxed`}>
                     Trabalhamos com a API oficial do WhatsApp (Meta), o canal aprovado para empresas — sem gambiarras que arriscam o seu número. Sua equipe pode intervir na conversa a qualquer momento pela Central de Atendimento.
                  </p>
               </div>

               <div className={`p-6 border rounded-2xl space-y-2 ${sFaqItem}`}>
                  <h4 className={`font-bold ${sFaqTitle} text-base`}>E a LGPD? Como ficam os dados dos clientes?</h4>
                  <p className={`${sFaqDesc} text-sm leading-relaxed`}>
                     A plataforma nasce adequada à LGPD: consentimento registrado, descadastro imediato quando o cliente pede ("PARAR"), e exportação ou exclusão definitiva dos dados de qualquer cliente direto no painel.
                  </p>
               </div>
            </div>
         </div>
      </section>

      {/* FINAL CTA */}
      <section className={`py-28 text-center relative overflow-hidden ${sCTA} transition-colors duration-300`}>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#2563EB]/10 rounded-full blur-[180px] pointer-events-none" />
         <div className="max-w-4xl mx-auto space-y-8 relative z-10">
            <h2 className="text-4xl lg:text-6xl font-bold tracking-tight">Chegou a hora de ter um time de IA trabalhando por você.</h2>
            <p className={`font-medium text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed ${sCTADesc}`}>
               Pare de perder cliente por demora. Crie seu agente de IA e veja ele atendendo, apresentando produtos, agendando e vendendo — no WhatsApp, no Instagram e no seu site, de dia, de noite e no fim de semana.
            </p>
            <div className="pt-4">
               <Link to="/register">
                 <Button className="h-16 px-12 text-lg font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-2xl shadow-xl hover:scale-105 transition-all border-none">
                   Testar a Plataforma Grátis
                 </Button>
               </Link>
               <p className="text-xs text-slate-400 font-bold mt-4">Teste grátis • Sem cartão de crédito • Cancele quando quiser</p>
            </div>
         </div>
      </section>

      {/* FOOTER */}
      <footer className={`py-16 px-6 lg:px-20 ${sFooter} transition-colors duration-300`}>
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col gap-3">
               <div className="flex items-center gap-3">
                  {settings?.logoUrl ? <img src={settings.logoUrl} className="h-8 grayscale opacity-60" /> : <img src="/logo.png" className="h-8 w-auto grayscale opacity-60" />}
                  <span className={`text-xl font-bold ${sFooterTitle} tracking-tight uppercase italic`}>Agentes <span className="text-[#2563EB]">Virtuais</span></span>
               </div>
               <p className={`text-xs font-bold ${sFooterDesc}`}>Agentes de IA multicanal — atendimento, vendas e agendamento no WhatsApp, Instagram e site.</p>
            </div>
            <div className="text-xs font-bold text-center md:text-right space-y-2">
               <div>E-mail oficial: contato@agentesvirtuais.com</div>
               <div>Suporte via WhatsApp: 71 99204-2802</div>
               <div>Endereço: Rua Vereador Zezeu Ribeiro, 1117, Boca da Mata, Salvador - Ba. Cep: 41.345-100</div>
               <div className={`pt-2 ${sFooterDesc}`}>© 2026 Agentes Virtuais. Todos os direitos reservados.</div>
            </div>
         </div>
      </footer>

      {/* FLOATING BUTTONS */}
      <div className="fixed bottom-10 right-10 flex flex-col gap-4 z-[9999]">
         {/* WHATSAPP */}
         <a 
           href={`https://wa.me/5571992042802`} 
           target="_blank" 
           className="w-16 h-16 bg-[#2563EB] hover:bg-emerald-400 text-slate-950 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all animate-bounce"
         >
            <Phone className="w-8 h-8 fill-current" />
         </a>

         {/* SDR CHAT BUTTON */}
         <button 
           onClick={() => setIsChatOpen(!isChatOpen)}
           className={`w-16 h-16 ${isDarkMode ? 'bg-[#0F172A] border-slate-900/40 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all`}
         >
            {isChatOpen ? <X className="w-8 h-8" /> : <MessageSquare className="w-8 h-8" />}
         </button>
      </div>

      {/* SDR CHAT BOX */}
      {isChatOpen && (
        <div className={`fixed bottom-32 right-10 w-96 ${isDarkMode ? 'bg-[#0F172A] border-slate-900/40' : 'bg-white border-slate-200'} border rounded-2xl shadow-[0_50px_100px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden z-[9999] animate-in slide-in-from-bottom-10 duration-500`}>
           <div className={`p-6 text-white flex items-center gap-4 border-b ${isDarkMode ? 'bg-[#1E293B] border-slate-900/40' : 'bg-blue-50 border-slate-200'}`}>
              <div className="w-12 h-12 bg-[#2563EB] rounded-full flex items-center justify-center font-bold text-white">AI</div>
              <div>
                 <h4 className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>Assistente Agentes Virtuais</h4>
                 <p className="text-xs text-[#2563EB] font-bold flex items-center gap-1"><span className="w-2 h-2 bg-[#2563EB] rounded-full animate-ping" /> Especialista online agora</p>
              </div>
           </div>
           
           <div className={`flex-1 h-96 p-6 overflow-y-auto space-y-4 ${isDarkMode ? 'bg-[#0F172A]' : 'bg-[#F8FAFC]'}`}>
              {chatHistory.length === 0 && (
                <div className={`p-4 rounded-2xl border text-xs font-bold italic ${isDarkMode ? 'bg-[#1E293B] border-slate-900/40 text-slate-300' : 'bg-white border-slate-200 text-slate-900/70'}`}>
                   Olá! Sou o assistente da Agentes Virtuais. Quer ver como uma IA de agendamento pode atender e marcar clientes para o seu negócio 24h por dia?
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] p-4 rounded-3xl text-sm font-bold whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'bg-[#2563EB] text-white' : (isDarkMode ? 'bg-[#1E293B] border border-slate-900/40 text-slate-200' : 'bg-white border border-slate-200 text-[#0F172A]')}`}>
                      {msg.content}
                   </div>
                </div>
              ))}
              {loadingChat && <div className="text-xs font-bold text-blue-500 animate-pulse pl-2">SDR está elaborando resposta...</div>}
           </div>

           <div className={`p-4 border-t ${isDarkMode ? 'bg-[#0F172A] border-slate-900/40' : 'bg-[#F8FAFC] border-slate-200'} flex gap-2`}>
              <input 
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Tire suas dúvidas conosco..."
                className={`flex-1 h-12 px-6 rounded-xl border-none text-xs font-bold focus:ring-1 ring-[#2563EB]/40 transition-all outline-none ${isDarkMode ? 'bg-[#1E293B] text-white' : 'bg-white text-[#0F172A]'}`}
              />
              <Button onClick={handleSendMessage} disabled={loadingChat} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white w-12 h-12 rounded-xl p-0 shrink-0">
                 <Send className="w-5 h-5" />
              </Button>
           </div>
        </div>
      )}
    </div>
  );
}
