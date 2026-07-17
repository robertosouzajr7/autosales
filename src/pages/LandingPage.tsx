import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Check, MessageSquare, ArrowRight, Users, Star, Send, X, Clock, AlertCircle,
  Sun, Moon, Bot, Instagram, Package, CalendarDays, LayoutGrid, Menu, Phone, Globe
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ChatMockup } from "@/components/landing/ChatMockup";
import { DashboardMockup } from "@/components/landing/DashboardMockup";
import { Logo } from "@/components/Logo";

const CHANNELS = ["no WhatsApp", "no Instagram", "no seu site"];

export default function LandingPage() {
  const [settings, setSettings] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [channelIdx, setChannelIdx] = useState(0);
  const [leadId, setLeadId] = useState<string | null>(() => sessionStorage.getItem("landing_lead_id") || null);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem("landing_theme");
    return savedTheme !== "light"; // dark por padrão
  });

  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>(() => {
    const saved = sessionStorage.getItem("landing_chat_history");
    return saved ? JSON.parse(saved) : [];
  });

  const [loadingChat, setLoadingChat] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/public/landing")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
        if (data.plans) setPlans(data.plans);
      })
      .catch((err) => console.error("Error loading landing data:", err));
  }, []);

  useEffect(() => {
    if (chatHistory.length > 0) sessionStorage.setItem("landing_chat_history", JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDarkMode]);

  // Palavra do canal que cicla (respeita prefers-reduced-motion)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setChannelIdx((i) => (i + 1) % CHANNELS.length), 2200);
    return () => clearInterval(t);
  }, []);

  // Trava o scroll do body quando o menu mobile está aberto
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem("landing_theme", next ? "dark" : "light");
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
        body: JSON.stringify({ sdrId: settings.selectedSdrId, message: userMsg, history: chatHistory, leadId }),
      });
      const data = await res.json();
      if (data.leadId && !leadId) {
        setLeadId(data.leadId);
        sessionStorage.setItem("landing_lead_id", data.leadId);
      }
      if (data.response) setChatHistory((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch (e) {
      toast({ title: "Erro no chat", description: "Não foi possível falar com o agente agora.", variant: "destructive" });
    } finally {
      setLoadingChat(false);
    }
  };

  const visiblePlans = plans.filter((p) => !settings?.visiblePlanIds || settings.visiblePlanIds.split(",").includes(p.id));

  const navLinks = [
    { href: "#problem", label: "O Problema" },
    { href: "#how-it-works", label: "Como Funciona" },
    { href: "#painel", label: "O Painel" },
    { href: "#features", label: "Funcionalidades" },
    { href: "#pricing", label: "Planos" },
    { href: "#faq", label: "FAQ" },
  ];

  // Vidro reutilizável (claro/escuro)
  const glass =
    "bg-white/70 dark:bg-white/[0.05] backdrop-blur-xl border border-slate-200/70 dark:border-white/10";

  return (
    <div className="min-h-screen bg-white dark:bg-[#05070F] text-slate-900 dark:text-slate-100 font-sans overflow-x-hidden selection:bg-[#2563EB] selection:text-white transition-colors duration-300">
      {/* keyframes / util local */}
      <style>{`
        @keyframes drift{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(50px,40px) scale(1.1)}66%{transform:translate(-40px,25px) scale(.94)}}
        @keyframes floaty{50%{transform:translateY(-14px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes scrimIn{from{opacity:0}to{opacity:1}}
        .an-drift{animation:drift 24s ease-in-out infinite}
        .an-float{animation:floaty 7s ease-in-out infinite}
        .an-up{animation:fadeUp .6s cubic-bezier(.22,1,.36,1) both}
        .an-drawer{animation:slideInRight .24s cubic-bezier(.22,1,.36,1) both}
        .an-scrim{animation:scrimIn .18s ease-out both}
        @media (prefers-reduced-motion: reduce){.an-drift,.an-float,.an-up,.an-drawer,.an-scrim{animation:none!important}}
      `}</style>

      {/* ===================== HEADER ===================== */}
      <header className={`sticky top-0 z-50 ${glass} border-b px-5 lg:px-16 h-[68px] flex items-center justify-between transition-colors duration-300`}>
        <Link to="/" className="flex items-center gap-2.5">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-8 w-auto" />
          ) : (
            <Logo />
          )}
        </Link>

        {/* Nav desktop */}
        <nav className="hidden lg:flex items-center gap-8 text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-slate-900 dark:hover:text-white transition-colors">{l.label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl ${glass} hover:scale-105 transition-transform`}
            title={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
            aria-label="Alternar tema"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          <Link to="/login" className="hidden sm:block text-sm font-semibold px-2 text-slate-600 dark:text-slate-300 hover:text-[#2563EB] transition-colors">Entrar</Link>
          <Link to="/register" className="hidden sm:block">
            <Button className="font-semibold h-10 px-5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-lg shadow-[#2563EB]/25 hover:scale-105 transition-transform border-none">Testar Grátis</Button>
          </Link>

          {/* Botão do menu mobile */}
          <button
            onClick={() => setMenuOpen(true)}
            className={`lg:hidden p-2.5 rounded-xl ${glass}`}
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ===================== DRAWER MOBILE ===================== */}
      {menuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="an-scrim absolute inset-0 bg-slate-950/60" onClick={() => setMenuOpen(false)} />
          <div className="an-drawer absolute right-0 top-0 h-full w-[82%] max-w-sm bg-white dark:bg-[#0A0F1F] border-l border-slate-200 dark:border-white/10 p-6 flex flex-col will-change-transform">
            <div className="flex items-center justify-between mb-8">
              <span className="text-lg font-bold tracking-tight">Agentes <span className="text-[#2563EB]">Virtuais</span></span>
              <button onClick={() => setMenuOpen(false)} className={`p-2 rounded-xl ${glass}`} aria-label="Fechar menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-2xl font-semibold tracking-tight py-3 border-b border-slate-100 dark:border-white/5 hover:text-[#2563EB] transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-3 pt-8">
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                <Button variant="outline" className="w-full h-12 rounded-xl font-semibold border-slate-300 dark:border-white/15 bg-transparent">Entrar</Button>
              </Link>
              <Link to="/register" onClick={() => setMenuOpen(false)}>
                <Button className="w-full h-12 rounded-xl font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white border-none">Testar 7 dias grátis</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden px-5 lg:px-16 pt-16 pb-24 lg:pt-24 lg:pb-32">
        {/* Aurora */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="an-drift absolute -top-40 -left-32 w-[620px] h-[620px] rounded-full blur-[150px] bg-[#2563EB]/15 dark:bg-[#3b6cff]/25" />
          <div className="an-drift absolute -top-20 right-[-80px] w-[520px] h-[520px] rounded-full blur-[150px] bg-[#a855f7]/10 dark:bg-[#a855f7]/20" style={{ animationDelay: "-8s" }} />
          <div className="an-drift absolute top-64 left-1/3 w-[460px] h-[460px] rounded-full blur-[150px] bg-[#22d3ee]/10 dark:bg-[#22d3ee]/15" style={{ animationDelay: "-14s" }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          <div className="text-center lg:text-left an-up">
            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full ${glass} text-[11.5px] font-medium tracking-wide mb-7`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" />
              Agente de IA multicanal · online 24h
            </div>

            <h1 className="text-5xl lg:text-[64px] font-bold tracking-[-0.035em] leading-[0.98] text-balance">
              Um agente de IA que{" "}
              <span className="bg-gradient-to-r from-[#2563EB] via-[#7c5cff] to-[#22d3ee] bg-clip-text text-transparent">atende, vende e agenda</span>{" "}
              pelo seu negócio.
            </h1>

            {/* Linha do canal que cicla */}
            <p className="mt-5 text-base lg:text-lg text-slate-500 dark:text-slate-400 font-medium">
              Ele responde na hora e converte{" "}
              <span key={channelIdx} className="an-up inline-block font-semibold text-[#2563EB]">{CHANNELS[channelIdx]}</span>.
            </p>

            <p className="mt-4 text-[15.5px] lg:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Tira dúvidas, apresenta seus produtos com foto e vídeo, qualifica com metodologia de vendas, agenda na sua agenda e organiza tudo no CRM. Para clínicas, salões, academias, restaurantes, lojas e escritórios.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3.5">
              <Link to="/register">
                <Button className="h-14 px-8 text-base font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-2xl shadow-[0_16px_40px_-8px_rgba(37,99,235,0.5)] hover:scale-105 transition-transform border-none">
                  Criar meu agente de IA
                </Button>
              </Link>
              <a href="#how-it-works" className={`h-14 px-7 flex items-center justify-center text-sm font-semibold rounded-2xl ${glass} hover:scale-105 transition-transform`}>
                Ver como funciona <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </div>

            <div className="mt-8 flex items-center lg:justify-start justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
              <span><b className="text-slate-800 dark:text-slate-100 font-semibold">+120</b> agendamentos/mês</span>
              <span><b className="text-slate-800 dark:text-slate-100 font-semibold">−48%</b> de faltas</span>
              <span><b className="text-slate-800 dark:text-slate-100 font-semibold">7 dias</b> grátis</span>
            </div>
          </div>

          {/* Mockup do chat com brilho */}
          <div className="relative flex justify-center lg:justify-end an-float">
            <div aria-hidden className="absolute inset-0 -z-10 blur-[80px] bg-gradient-to-br from-[#2563EB]/30 to-[#7c5cff]/20 rounded-full scale-90" />
            <ChatMockup dark={isDarkMode} />
          </div>
        </div>
      </section>

      {/* ===================== STATS (editorial) ===================== */}
      <section className="px-5 lg:px-16 border-y border-slate-200/70 dark:border-white/10">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4">
          {[
            { n: "24/7", l: "Atendendo sem pausa" },
            { n: "3", l: "Canais, uma caixa de entrada" },
            { n: "−48%", l: "Menos faltas com lembretes" },
            { n: "<5s", l: "Tempo médio de resposta" },
          ].map((s, i) => (
            <div key={s.l} className={`py-9 lg:py-11 px-4 lg:px-8 ${i % 2 === 0 ? "border-r" : ""} lg:border-r ${i === 3 ? "lg:border-r-0" : ""} ${i < 2 ? "border-b lg:border-b-0" : ""} border-slate-200/70 dark:border-white/10`}>
              <div className="text-3xl lg:text-[42px] font-bold tracking-tight tabular-nums">{s.n}</div>
              <div className="text-xs lg:text-[13px] text-slate-500 dark:text-slate-400 mt-1.5">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== PROBLEMA ===================== */}
      <section id="problem" className="py-24 px-5 lg:px-16">
        <div className="max-w-6xl mx-auto space-y-14">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-5xl font-bold tracking-[-0.03em] text-balance">
              Por que seu negócio perde vendas <span className="text-red-500 font-serif italic font-medium">todos os dias</span>?
            </h2>
            <p className="text-slate-500 dark:text-slate-400">Três gargalos silenciosos deixam dinheiro na mesa sem que ninguém perceba.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Clock, t: "Resposta que demora", d: "Cliente sem resposta em minutos vira cliente do concorrente. Quem responde primeiro fecha — e uma equipe não dá conta de WhatsApp, Instagram e site ao mesmo tempo, 24h por dia." },
              { icon: Users, t: "Equipe sobrecarregada", d: "Mensagem no WhatsApp, DM no Instagram, dúvida no site — tudo junto. As conversas acumulam, as respostas atrasam e o cliente desiste no meio do caminho." },
              { icon: AlertCircle, t: "Fora do horário", d: "Boa parte das mensagens chega à noite e nos fins de semana. Sem ninguém para responder e apresentar o produto, o interesse esfria e a venda não acontece." },
            ].map((p) => (
              <div key={p.t} className={`p-7 rounded-3xl ${glass} space-y-4`}>
                <div className="w-11 h-11 rounded-xl bg-red-500/10 text-red-500 grid place-items-center"><p.icon className="w-5 h-5" /></div>
                <h3 className="text-lg font-semibold tracking-tight">{p.t}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== COMO FUNCIONA ===================== */}
      <section id="how-it-works" className="py-24 px-5 lg:px-16 border-t border-slate-200/70 dark:border-white/10">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-5xl font-bold tracking-[-0.03em] text-balance">
              Do primeiro "oi" ao <span className="font-serif italic font-medium text-[#2563EB]">cliente fechado</span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400">Seus agentes de IA cuidam de todos os canais enquanto você cuida do que importa.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            {[
              { k: "O cliente chama", t: "Responde na hora, em qualquer canal", d: "WhatsApp, Instagram ou o chat do seu site — com o tom e a identidade do seu negócio. Tira dúvidas de serviços, valores, endereço e pagamento sem deixar ninguém esperando." },
              { k: "Entende e apresenta", t: "Qualifica e mostra o produto certo", d: "Com metodologia de vendas (SPIN Selling, escuta ativa, objeções), entende a necessidade, recomenda a solução ideal e envia foto, áudio e vídeo do seu catálogo na conversa." },
              { k: "Converte", t: "Agenda, vende ou passa pra equipe", d: "Marca na sua agenda sem conflito, encaminha pro fechamento ou passa a conversa a um humano — e organiza cada contato no CRM, com lembretes que reduzem as faltas." },
            ].map((s, i) => (
              <div key={s.t} className="relative space-y-4">
                <div className="text-6xl font-bold text-[#2563EB]/10 dark:text-white/[0.06] tabular-nums leading-none">0{i + 1}</div>
                <div className="text-[#2563EB] font-semibold text-[11px] tracking-widest uppercase">{s.k}</div>
                <h3 className="text-xl font-semibold tracking-tight">{s.t}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== PAINEL (showcase) ===================== */}
      <section id="painel" className="relative py-24 px-5 lg:px-16 overflow-hidden border-t border-slate-200/70 dark:border-white/10">
        <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[380px] rounded-full blur-[160px] bg-[#2563EB]/10 dark:bg-[#3b6cff]/15" />
        <div className="relative z-10 max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <div className={`inline-flex items-center px-3.5 py-1.5 rounded-full ${glass} text-[11px] font-semibold tracking-widest uppercase text-[#2563EB]`}>Um painel, todos os canais</div>
            <h2 className="text-3xl lg:text-5xl font-bold tracking-[-0.03em] text-balance">Tudo o que acontece, <span className="font-serif italic font-medium text-[#2563EB]">num lugar só</span></h2>
            <p className="text-slate-500 dark:text-slate-400">WhatsApp, Instagram e site na mesma caixa de entrada, com o funil de clientes atualizado em tempo real.</p>
          </div>
          <div className="max-w-5xl mx-auto">
            <DashboardMockup dark={isDarkMode} />
          </div>
        </div>
      </section>

      {/* ===================== FUNCIONALIDADES ===================== */}
      <section id="features" className="py-24 px-5 lg:px-16 border-t border-slate-200/70 dark:border-white/10">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-5xl font-bold tracking-[-0.03em] text-balance">Uma plataforma completa de <span className="font-serif italic font-medium text-[#2563EB]">agentes de IA</span></h2>
            <p className="text-slate-500 dark:text-slate-400">Muito além de agendar: atendimento, vendas e organização — tudo num lugar só.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Bot, t: "Agente de IA personalizável", d: "Escolha a função — Vendedor, Atendimento, Agendador, Consultor ou SDR — cada uma com skills próprias. Treine com seus documentos e ele fala com a identidade do seu negócio." },
              { icon: Instagram, t: "Multicanal de verdade", d: "O mesmo agente atende no WhatsApp oficial, no Instagram Direct e num chat que você instala no site. Todas as conversas caem numa caixa de entrada só." },
              { icon: Package, t: "Catálogo com mídia", d: "Cadastre produtos e serviços com foto, áudio e vídeo. Na conversa, o agente apresenta o item certo e envia a mídia automaticamente." },
              { icon: CalendarDays, t: "Agenda + lembretes", d: "Marca direto no Google Calendar, sem conflito de horário, confirma na hora e dispara lembretes automáticos que reduzem as faltas." },
              { icon: LayoutGrid, t: "CRM e funil de clientes", d: "Cada contato do primeiro \"oi\" ao fechamento, num quadro visual. Veja quem está sendo atendido, quem qualificou, quem agendou e quem comprou." },
              { icon: MessageSquare, t: "Central de conversas + humano", d: "Inbox unificado dos seus canais. Sua equipe assume qualquer conversa a qualquer momento, com todo o histórico, exatamente onde a IA parou." },
            ].map((f) => (
              <Card key={f.t} className={`p-7 rounded-3xl ${glass} space-y-5 group hover:-translate-y-1.5 hover:border-[#2563EB]/40 transition-all`}>
                <div className="w-12 h-12 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] grid place-items-center group-hover:scale-110 transition-transform"><f.icon className="w-6 h-6" /></div>
                <h3 className="text-lg font-semibold tracking-tight">{f.t}</h3>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">{f.d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== DEPOIMENTOS ===================== */}
      <section id="testimonials" className="py-24 px-5 lg:px-16 border-t border-slate-200/70 dark:border-white/10">
        <div className="max-w-6xl mx-auto space-y-14">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-5xl font-bold tracking-[-0.03em] text-balance">Negócios que pararam de <span className="font-serif italic font-medium text-[#2563EB]">perder clientes</span></h2>
            <p className="text-slate-500 dark:text-slate-400">Histórias de quem atende, vende e agenda no automático — sem sobrecarregar a equipe.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { q: "O agente responde os clientes na hora, mesmo de madrugada. A equipe parou de viver apagando incêndio no WhatsApp e a agenda encheu — mais de 120 horários marcados sozinhos no primeiro mês.", a: "Thiago Fonseca", r: "Gestor · Vida Plena Studio", i: "TF" },
              { q: "Ligamos o agente no WhatsApp e no Instagram. Ele responde na hora, manda a foto do procedimento, tira as dúvidas e já agenda. Vendeu mais no primeiro mês do que a gente respondendo na mão.", a: "Aline Mendes", r: "Fundadora · Odonto Sorriso", i: "AM" },
              { q: "Reduzimos as faltas quase pela metade com os lembretes automáticos. E a equipe, que vivia presa no celular, voltou a focar no cliente que está no local.", a: "Ricardo Cruz", r: "Gestor · Fisio Movimento", i: "RC" },
            ].map((t) => (
              <Card key={t.a} className={`p-7 rounded-3xl ${glass} flex flex-col justify-between gap-6`}>
                <div className="space-y-4">
                  <div className="flex text-amber-400 gap-0.5">{Array.from({ length: 5 }).map((_, k) => <Star key={k} className="fill-current w-4 h-4" />)}</div>
                  <p className="text-sm italic leading-relaxed text-slate-700 dark:text-slate-200">"{t.q}"</p>
                </div>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-200/70 dark:border-white/10">
                  <div className="w-10 h-10 rounded-full bg-[#2563EB]/15 text-[#2563EB] grid place-items-center font-bold text-sm">{t.i}</div>
                  <div>
                    <p className="text-sm font-semibold">{t.a}</p>
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500">{t.r}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== PLANOS ===================== */}
      <section id="pricing" className="py-24 px-5 lg:px-16 border-t border-slate-200/70 dark:border-white/10">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-5xl font-bold tracking-[-0.03em] text-balance">Preço justo para <span className="font-serif italic font-medium text-[#2563EB]">vender mais</span></h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">Sem taxas ocultas. Escolha o plano ideal para o tamanho do seu negócio. Teste 7 dias grátis.</p>
          </div>

          <div className={`grid grid-cols-1 ${visiblePlans.length === 2 ? "md:grid-cols-2" : visiblePlans.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-1"} gap-8 max-w-5xl mx-auto items-end`}>
            {visiblePlans.length > 0 ? (
              [...visiblePlans].sort((a, b) => a.priceMonthly - b.priceMonthly).map((plan) => {
                const isRecommended = plan.priceMonthly === 797;
                let featuresData: any = {};
                try { featuresData = JSON.parse(plan.features || "{}"); } catch (e) {}
                return (
                  <Card
                    key={plan.id}
                    className={`p-9 rounded-3xl space-y-7 relative overflow-hidden transition-transform hover:-translate-y-1 ${
                      isRecommended
                        ? "bg-[#2563EB] text-white border-none shadow-2xl shadow-[#2563EB]/30"
                        : `${glass}`
                    }`}
                  >
                    {isRecommended && <div className="absolute top-0 right-0 bg-white/20 px-6 py-2.5 rounded-bl-2xl font-bold text-[11px] tracking-wide">RECOMENDADO</div>}
                    <div className="space-y-2">
                      <Badge className={`${isRecommended ? "bg-white/20 text-white" : "bg-[#2563EB]/15 text-[#2563EB]"} border-none py-1 px-3.5 font-semibold text-[11px]`}>{plan.name}</Badge>
                      <h3 className="text-5xl font-bold tracking-tight tabular-nums">
                        R$ {plan.priceMonthly}
                        <span className={`text-sm font-medium ${isRecommended ? "text-white/70" : "text-slate-400 dark:text-slate-500"}`}>/mês</span>
                      </h3>
                    </div>

                    <ul className={`space-y-3 pt-5 border-t ${isRecommended ? "border-white/15" : "border-slate-200/70 dark:border-white/10"}`}>
                      {["Agente de IA no WhatsApp oficial", "Agenda integrada (Google Calendar)", "Funil de Clientes (Kanban)", "Central de Conversas + atendimento humano", `Lembretes e automações ${featuresData.automations || "inclusos"}`].map((li) => (
                        <li key={li} className="flex items-center gap-2 text-[12.5px] font-medium"><Check className="w-4 h-4 shrink-0" /><span>{li}</span></li>
                      ))}
                      {featuresData.webhooks && (
                        <li className="flex items-center gap-2 text-[12.5px] font-medium"><Check className="w-4 h-4 shrink-0" /><span>Webhooks &amp; API de Integração</span></li>
                      )}
                    </ul>

                    <div className={`space-y-2.5 pt-5 border-t ${isRecommended ? "border-white/15" : "border-slate-200/70 dark:border-white/10"}`}>
                      <p className={`text-[11px] font-semibold mb-3 ${isRecommended ? "text-white/70" : "text-slate-400 dark:text-slate-500"}`}>Limites do plano</p>
                      {[
                        { on: plan.enableSdr, k: "Agentes de IA ativos", v: plan.enableSdr ? `Até ${plan.maxSdrs}` : "Não disponível" },
                        { on: plan.enableTokens, k: "Créditos de IA", v: plan.enableTokens ? `${(plan.maxTokens / 1000).toLocaleString()}k Tokens` : "Não disponível" },
                        { on: plan.enableMessages, k: "Mensagens/mês", v: plan.enableMessages ? `${plan.maxMessages.toLocaleString()} Mensagens` : "Não disponível" },
                      ].map((row) => (
                        <div key={row.k} className={`flex justify-between items-center text-[12px] font-medium ${!row.on ? "opacity-40" : ""}`}>
                          <span className={`${isRecommended ? "text-white/70" : "text-slate-400 dark:text-slate-500"} ${!row.on ? "line-through" : ""}`}>{row.k}</span>
                          <span>{row.v}</span>
                        </div>
                      ))}
                    </div>

                    <Link to={`${localStorage.getItem("token") ? "/checkout" : "/register"}?plan=${plan.id}`} className="block w-full">
                      <Button className={`w-full h-14 font-semibold rounded-2xl text-base border-none transition-transform active:scale-95 ${isRecommended ? "bg-white text-[#2563EB] hover:bg-slate-50 shadow-xl" : "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"}`}>
                        Testar 7 dias grátis
                      </Button>
                    </Link>
                  </Card>
                );
              })
            ) : (
              <p className="text-slate-400 text-center col-span-full py-20 font-semibold">Nenhum plano disponível no momento.</p>
            )}
          </div>
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section id="faq" className="py-24 px-5 lg:px-16 border-t border-slate-200/70 dark:border-white/10">
        <div className="max-w-4xl mx-auto space-y-14">
          <div className="text-center space-y-4">
            <h2 className="text-3xl lg:text-5xl font-bold tracking-[-0.03em] text-balance">Perguntas <span className="font-serif italic font-medium text-[#2563EB]">frequentes</span></h2>
            <p className="text-slate-500 dark:text-slate-400">Esclareça suas dúvidas e ative sua operação com segurança.</p>
          </div>
          <div className="space-y-4">
            {[
              { q: "Os clientes percebem que estão falando com uma IA?", a: "A conversa é natural e humanizada, com o tom e as informações do seu negócio. E, sempre que o cliente pedir ou o assunto exigir, a conversa passa para a sua equipe com todo o histórico." },
              { q: "Em quais canais o agente atende?", a: "WhatsApp oficial (Meta), Instagram Direct e um chat que você instala no seu site com uma linha de código. O mesmo agente atende os três, e todas as conversas chegam numa caixa de entrada só." },
              { q: "Serve para qualquer tipo de negócio?", a: "Sim. Clínicas, salões, academias, restaurantes, lojas, escritórios — qualquer negócio que atende e vende por mensagem. Templates prontos por segmento aceleram a configuração, e você personaliza a função do agente e a base de conhecimento." },
              { q: "O agente consegue apresentar meus produtos?", a: "Sim. Você cadastra produtos e serviços com foto, áudio e vídeo no catálogo, e na conversa o agente apresenta o item certo e envia a mídia automaticamente." },
              { q: "Uso o WhatsApp oficial? Meu número corre risco?", a: "Trabalhamos com a API oficial do WhatsApp (Meta), o canal aprovado para empresas — sem gambiarras que arriscam o seu número. Sua equipe pode intervir na conversa a qualquer momento." },
              { q: "E a LGPD? Como ficam os dados dos clientes?", a: "A plataforma nasce adequada à LGPD: consentimento registrado, descadastro imediato quando o cliente pede (\"PARAR\"), e exportação ou exclusão definitiva dos dados direto no painel." },
            ].map((f) => (
              <div key={f.q} className={`p-6 rounded-2xl ${glass} space-y-2`}>
                <h4 className="font-semibold text-base">{f.q}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CTA FINAL ===================== */}
      <section className="relative py-28 px-5 lg:px-16 overflow-hidden border-t border-slate-200/70 dark:border-white/10 text-center">
        <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[160px] bg-[#2563EB]/15 dark:bg-[#3b6cff]/20" />
        <div className="relative z-10 max-w-3xl mx-auto space-y-7">
          <h2 className="text-4xl lg:text-6xl font-bold tracking-[-0.035em] leading-[0.98] text-balance">
            Chegou a hora de ter um time de IA <span className="bg-gradient-to-r from-[#2563EB] via-[#7c5cff] to-[#22d3ee] bg-clip-text text-transparent">trabalhando por você.</span>
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Pare de perder cliente por demora. Crie seu agente e veja ele atendendo, apresentando produtos, agendando e vendendo — no WhatsApp, no Instagram e no seu site.
          </p>
          <div className="pt-2">
            <Link to="/register">
              <Button className="h-15 px-10 py-4 text-base font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-2xl shadow-[0_16px_40px_-8px_rgba(37,99,235,0.5)] hover:scale-105 transition-transform border-none">
                Testar a plataforma grátis
              </Button>
            </Link>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-4">Teste grátis • Sem cartão de crédito • Cancele quando quiser</p>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="py-14 px-5 lg:px-16 border-t border-slate-200/70 dark:border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-3 text-center md:text-left">
            <Logo className="justify-center md:justify-start" />
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">Agentes de IA multicanal — atendimento, vendas e agendamento no WhatsApp, Instagram e site.</p>
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center md:text-right space-y-1.5">
            <div>E-mail: contato@agentesvirtuais.com</div>
            <div>Suporte via WhatsApp: 71 99204-2802</div>
            <div>Rua Vereador Zezeu Ribeiro, 1117, Boca da Mata, Salvador - BA · CEP 41.345-100</div>
            <div className="pt-2 text-slate-400 dark:text-slate-500">© 2026 Agentes Virtuais. Todos os direitos reservados.</div>
          </div>
        </div>
      </footer>

      {/* ===================== BOTÕES FLUTUANTES ===================== */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-[9999]">
        <a href="https://wa.me/5571992042802" target="_blank" rel="noreferrer"
          className="w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform"
          aria-label="Falar no WhatsApp">
          <Phone className="w-6 h-6 fill-current" />
        </a>
        <button onClick={() => setIsChatOpen(!isChatOpen)}
          className={`w-14 h-14 ${glass} rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform`}
          aria-label="Abrir chat">
          {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6 text-[#2563EB]" />}
        </button>
      </div>

      {/* ===================== CHAT DO AGENTE ===================== */}
      {isChatOpen && (
        <div className={`fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 ${glass} rounded-3xl shadow-2xl flex flex-col overflow-hidden z-[9999] an-up`}>
          <div className="p-5 flex items-center gap-3 border-b border-slate-200/70 dark:border-white/10">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2563EB] to-[#7c5cff] grid place-items-center font-bold text-white text-sm">AI</div>
            <div>
              <h4 className="font-semibold text-sm">Assistente Agentes Virtuais</h4>
              <p className="text-[11px] text-[#2563EB] font-semibold flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" /> online agora</p>
            </div>
          </div>
          <div className="flex-1 h-96 p-5 overflow-y-auto space-y-3">
            {chatHistory.length === 0 && (
              <div className={`p-4 rounded-2xl text-[13px] italic ${glass} text-slate-600 dark:text-slate-300`}>
                Olá! Sou o assistente da Agentes Virtuais. Quer ver como um agente de IA pode atender, vender e agendar para o seu negócio 24h por dia?
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] p-3.5 rounded-2xl text-[13px] whitespace-pre-wrap leading-relaxed ${msg.role === "user" ? "bg-[#2563EB] text-white rounded-br-md" : `${glass} rounded-bl-md`}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loadingChat && <div className="text-xs font-semibold text-[#2563EB] animate-pulse pl-1">digitando…</div>}
          </div>
          <div className="p-3.5 border-t border-slate-200/70 dark:border-white/10 flex gap-2">
            <input
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Tire suas dúvidas…"
              className="flex-1 h-11 px-4 rounded-xl text-[13px] outline-none bg-slate-100 dark:bg-white/5 focus:ring-2 ring-[#2563EB]/30 transition"
            />
            <Button onClick={handleSendMessage} disabled={loadingChat} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white w-11 h-11 rounded-xl p-0 shrink-0">
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
