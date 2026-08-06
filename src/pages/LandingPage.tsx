import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, ArrowRight, Send, X, Check, ChevronDown, Play, Phone,
  Bot, Instagram, Globe, CalendarDays, LayoutGrid, Menu, Star, Shield,
  Zap, Workflow, Megaphone, Mic, Users2, Plug, Package, FileText, BarChart3,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { DashboardMockup } from "@/components/landing/DashboardMockup";
import { Logo } from "@/components/Logo";
import { IdentificacaoVisitante, type Visitante } from "@/components/public/IdentificacaoVisitante";

/**
 * Landing pública.
 *
 * A página alterna claro → escuro → claro em blocos fixos, com ondas SVG nas
 * transições: é a estrutura do handoff, e não um tema que o visitante escolhe.
 * Por isso não há botão de tema aqui — o `dark` do painel é outra coisa.
 */

const NAV = [
  { href: "#resultados", label: "Resultados" },
  { href: "#recursos", label: "Recursos" },
  { href: "#funil", label: "Funil" },
  { href: "#integracoes", label: "Integrações" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

const NUMEROS = [
  { n: "< 5s", l: "Tempo médio de resposta" },
  { n: "24/7", l: "Atendendo sem pausa" },
  { n: "−48%", l: "Menos faltas com lembrete" },
  { n: "+3x", l: "Mais conversas atendidas" },
];

const RECURSOS_MENORES = [
  { icon: Workflow, t: "Fluxos visuais", d: "Monte a conversa arrastando blocos." },
  { icon: Megaphone, t: "Disparos em massa", d: "Campanhas com template aprovado." },
  { icon: Mic, t: "Áudio", d: "O agente ouve e responde falando." },
  { icon: Users2, t: "Equipe e filas", d: "Distribua o atendimento entre pessoas." },
  { icon: Package, t: "Catálogo", d: "O agente manda foto, preço e link." },
  { icon: FileText, t: "Base de conhecimento", d: "Ensine o agente com seus documentos." },
  { icon: BarChart3, t: "Relatórios", d: "Veja o que virou agendamento e venda." },
  { icon: Plug, t: "API e webhooks", d: "Conecte com o que você já usa." },
];

const INTEGRACOES = [
  { n: "WhatsApp", c: "Canal" },
  { n: "Instagram", c: "Canal" },
  { n: "Widget no site", c: "Canal" },
  { n: "Google Agenda", c: "Agenda" },
  { n: "Google Meet", c: "Reunião" },
  { n: "Stripe", c: "Pagamento" },
  { n: "Mercado Pago", c: "Pagamento" },
  { n: "Webhooks", c: "Automação" },
  { n: "API pública", c: "Automação" },
  { n: "Importação CSV", c: "Dados" },
  { n: "Exportação CSV", c: "Dados" },
  { n: "E-mail (SMTP)", c: "Notificação" },
];

const SEM = [
  "Mensagem chega de madrugada e só é vista de manhã",
  "Cliente pergunta preço três vezes até alguém responder",
  "Agendamento anotado no caderno e esquecido",
  "Ninguém sabe quantas conversas viraram venda",
  "WhatsApp, Instagram e site em três telas diferentes",
];
const COM = [
  "Responde em segundos, a qualquer hora",
  "O agente sabe preço, prazo e condição de cor",
  "Marca na agenda e confirma sozinho antes do dia",
  "Funil mostra o que entrou, o que avançou e o que fechou",
  "Os três canais numa caixa de entrada só",
];

const PERGUNTAS = [
  {
    q: "Preciso trocar meu número de WhatsApp?",
    a: "Não. Você conecta o número que já usa. No plano por QR Code é o mesmo aparelho de sempre; no plano com API oficial da Meta o número passa a ser gerenciado pela plataforma, mas continua sendo o seu.",
  },
  {
    q: "O agente responde como um robô?",
    a: "Ele responde com o texto que você definir e com o tom que escolher. Também aprende com os documentos, produtos e perguntas frequentes que você cadastrar — então fala do seu negócio, não do genérico.",
  },
  {
    q: "E quando ele não souber responder?",
    a: "Ele passa a conversa para a fila de atendimento humano e avisa no painel. Você também pode assumir qualquer conversa a qualquer momento, e desligar o agente só naquela conversa.",
  },
  {
    q: "Quanto tempo leva para começar?",
    a: "Conectar o canal leva cerca de um minuto. Depois disso o assistente de configuração pergunta o tipo de negócio e já deixa o agente pronto para atender.",
  },
  {
    q: "Preciso de cartão para testar?",
    a: "Não. São 7 dias grátis em qualquer plano, sem cartão. Se não quiser continuar, é só não assinar — nada é cobrado.",
  },
  {
    q: "Meus dados e os dos meus clientes ficam seguros?",
    a: "As conversas são isoladas por conta e o acesso da equipe é controlado por permissão. O contato pode pedir para não receber mensagens, e esse pedido é respeitado automaticamente em qualquer disparo.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim, em um clique dentro do painel, sem ligar para ninguém e sem multa.",
  },
];

const reais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Onda de transição entre blocos de cor. `cor` é a cor de DESTINO. */
function Onda({ cor, paraBaixo = true }: { cor: string; paraBaixo?: boolean }) {
  return (
    <div aria-hidden className="relative -mx-7 w-[calc(100%+56px)] leading-[0]">
      <svg viewBox="0 0 1440 110" preserveAspectRatio="none" className="block h-[70px] w-full sm:h-[110px]">
        <path
          d={paraBaixo ? "M0,10 C340,110 1100,110 1440,10 L1440,110 L0,110 Z" : "M0,100 C340,0 1100,0 1440,100 L1440,110 L0,110 Z"}
          fill={cor}
        />
      </svg>
    </div>
  );
}

export default function LandingPage() {
  const [settings, setSettings] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [anual, setAnual] = useState(false);
  const [aberta, setAberta] = useState<number | null>(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(() => sessionStorage.getItem("landing_lead_id") || null);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>(() => {
    const saved = sessionStorage.getItem("landing_chat_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [loadingChat, setLoadingChat] = useState(false);
  // Quem está do outro lado. Guardado na sessão para não perguntar de novo a
  // cada mensagem — e para a conversa chegar identificada no painel.
  const [visitante, setVisitante] = useState<Visitante | null>(() => {
    const salvo = sessionStorage.getItem("landing_visitante");
    return salvo ? JSON.parse(salvo) : null;
  });
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/public/landing")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
        if (Array.isArray(data.plans)) setPlans(data.plans);
      })
      .catch((err) => console.error("Erro ao carregar a landing:", err));
  }, []);

  useEffect(() => {
    if (chatHistory.length > 0) sessionStorage.setItem("landing_chat_history", JSON.stringify(chatHistory));
  }, [chatHistory]);

  // A landing é sempre clara: as cores dos blocos são fixas e o `dark` do
  // painel viraria texto escuro sobre fundo escuro aqui.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !settings?.selectedSdrId) return;
    const userMsg = chatMessage;
    setChatMessage("");
    setChatHistory((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoadingChat(true);
    try {
      const res = await fetch("/api/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdrId: settings.selectedSdrId,
          message: userMsg,
          history: chatHistory,
          leadId,
          name: visitante?.name,
          email: visitante?.email,
          phone: visitante?.phone,
        }),
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

  // Os dois planos vêm do banco. Sem eles a seção mostra o caminho do
  // diagnóstico em vez de inventar preço.
  const doBanco = [...plans].sort((a, b) => (a.priceMonthly || 0) - (b.priceMonthly || 0)).slice(0, 2);

  // Desconto do anual calculado dos preços reais, não fixado em −20%: se o
  // admin cadastrar outro valor, a etiqueta acompanha em vez de mentir.
  const desconto = (() => {
    const base = doBanco.find((p) => p.priceMonthly > 0 && p.priceYearly > 0);
    if (!base) return 0;
    return Math.round((1 - base.priceYearly / (base.priceMonthly * 12)) * 100);
  })();

  /**
   * Depoimentos só aparecem se estiverem cadastrados. Escrever exemplos aqui
   * publicaria avaliação inventada como se fosse de cliente real.
   */
  const depoimentos: any[] = (() => {
    try {
      const bruto = settings?.testimonials;
      const lista = typeof bruto === "string" ? JSON.parse(bruto) : bruto;
      return Array.isArray(lista) ? lista.filter((d) => d?.texto) : [];
    } catch { return []; }
  })();

  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-slate-900 selection:bg-[#2563EB] selection:text-white">
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .an-up{animation:fadeUp .6s cubic-bezier(.22,1,.36,1) both}
        html{scroll-behavior:smooth}
        @media (prefers-reduced-motion:reduce){.an-up{animation:none}html{scroll-behavior:auto}}
      `}</style>

      {/* ══════════ HEADER ══════════ */}
      <header className="sticky top-0 z-50 h-[70px] border-b border-[#E9EEF5] bg-white/[0.82] backdrop-blur-[20px]">
        <div className="mx-auto flex h-full max-w-[1240px] items-center justify-between px-5">
          <Link to="/" className="shrink-0"><Logo /></Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((l) => (
              <a key={l.href} href={l.href}
                className="rounded-lg px-3 py-2 text-[14px] font-medium text-slate-600 transition-colors hover:bg-[#F1F5F9] hover:text-slate-900">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden rounded-lg px-3 py-2 text-[14px] font-medium text-slate-600 transition-colors hover:bg-[#F1F5F9] hover:text-slate-900 sm:block">
              Entrar
            </Link>
            <Link to="/register">
              <Button className="h-10 rounded-xl border-none bg-[#2563EB] px-4 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] hover:bg-[#1D4ED8]">
                Testar 7 dias grátis
              </Button>
            </Link>
            <button onClick={() => setMenuOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-[#F1F5F9] lg:hidden" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col gap-1 bg-white p-5 shadow-2xl">
            <button onClick={() => setMenuOpen(false)} className="mb-4 grid h-9 w-9 place-items-center self-end rounded-lg text-slate-500 hover:bg-[#F1F5F9]" aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
            {NAV.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-[#F1F5F9]">
                {l.label}
              </a>
            ))}
            <Link to="/login" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-[#F1F5F9]">
              Entrar
            </Link>
          </div>
        </div>
      )}

      {/* ══════════ HERO ══════════ */}
      <section
        className="relative overflow-hidden px-5 pb-6 pt-14 text-center"
        style={{ background: "radial-gradient(120% 80% at 50% -10%, #EEF4FF 0%, #F8FAFF 42%, #FFFFFF 78%)" }}
      >
        {/* Grade de 64px, mascarada para sumir nas bordas. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage: "linear-gradient(#E2E8F0 1px, transparent 1px), linear-gradient(90deg, #E2E8F0 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            WebkitMaskImage: "radial-gradient(70% 55% at 50% 30%, #000, transparent)",
            maskImage: "radial-gradient(70% 55% at 50% 30%, #000, transparent)",
          }}
        />

        <div className="relative mx-auto max-w-[1240px]">
          <div className="an-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#DBE4F0] bg-white/80 px-3.5 py-1.5 text-[12.5px] font-medium text-slate-600">
              <span className="rounded-full bg-[#2563EB] px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">Novo</span>
              Funil Kanban com IA que move o lead sozinho
            </span>

            <h1 className="mx-auto mt-7 max-w-[900px] text-[40px] font-bold leading-[1.03] tracking-[-0.035em] sm:text-[54px] lg:text-[68px]">
              Automatize seus chats do WhatsApp com{" "}
              <span className="text-[#2563EB]">Assistentes de IA</span>
            </h1>

            <p className="mx-auto mt-5 max-w-[620px] text-[16px] leading-relaxed text-[#475569] sm:text-[18px]">
              Um agente que responde em segundos, tira dúvidas, envia o catálogo e marca na
              agenda — no WhatsApp, no Instagram e no seu site, 24 horas por dia.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register">
                <Button className="h-[54px] rounded-2xl border-none bg-[#2563EB] px-8 text-[15px] font-semibold text-white shadow-[0_16px_40px_-8px_rgba(37,99,235,0.5)] hover:bg-[#1D4ED8]">
                  Testar 7 dias grátis
                </Button>
              </Link>
              <a href="#recursos"
                className="flex h-[54px] items-center gap-2 rounded-2xl border border-[#DBE4F0] bg-white px-7 text-[15px] font-semibold text-slate-700 transition-colors hover:bg-[#F8FAFF]">
                <Play className="h-4 w-4 fill-current text-[#2563EB]" /> Ver demonstração
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[13px] text-slate-600">
              {["Sem cartão de crédito", "Conecta em 1 minuto", "Cancele em um clique"].map((g) => (
                <span key={g} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[#22A06B]" strokeWidth={3} /> {g}
                </span>
              ))}
            </div>
          </div>

          {/* Mockup do painel */}
          <div className="relative mt-14">
            <div aria-hidden className="absolute inset-x-10 top-10 -z-10 h-64 rounded-full bg-[#2563EB]/25 blur-[100px]" />
            <div className="mx-auto max-w-[1080px] overflow-hidden rounded-2xl shadow-[0_40px_80px_-30px_rgba(15,23,42,0.35)]">
              <DashboardMockup />
            </div>
          </div>

          {/* Faixa de logos */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-55">
            {["Clínicas", "Estética", "Academias", "Consultórios", "Serviços", "Restaurantes"].map((n) => (
              <span key={n} className="text-[19px] font-bold text-[#475569]">{n}</span>
            ))}
          </div>
        </div>
      </section>

      <Onda cor="#080C16" />

      {/* ══════════ BLOCO ESCURO ══════════ */}
      <div className="bg-[#080C16] text-white">

        {/* ── Resultados ── */}
        <section id="resultados" className="mx-auto max-w-[1240px] px-5 py-20">
          <div className="mx-auto max-w-[680px] text-center">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#60A5FA]">Resultados</p>
            <h2 className="mt-3 text-[32px] font-bold tracking-[-0.03em] text-white sm:text-[42px]">
              O que muda quando ninguém fica esperando
            </h2>
          </div>

          {depoimentos.length > 0 && (
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {depoimentos.slice(0, 4).map((d, i) => (
                <figure
                  key={i}
                  className="rounded-2xl p-6"
                  style={{
                    background:
                      i === 0 ? "linear-gradient(165deg,#2563EB,#1D4ED8)"
                      : i === 1 ? "linear-gradient(165deg,#1D4ED8,#1E40AF)"
                      : "#0E1525",
                  }}
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: Math.min(Number(d.nota) || 5, 5) }).map((_, k) => (
                      <Star key={k} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <blockquote className="mt-3 text-[14px] leading-relaxed text-white/90">“{d.texto}”</blockquote>
                  <figcaption className="mt-5 flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-[12px] font-bold">
                      {(d.nome || "?").substring(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">{d.nome}</span>
                      {d.papel && <span className="block truncate text-[11.5px] text-white/60">{d.papel}</span>}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 lg:grid-cols-4 ${depoimentos.length > 0 ? "mt-4" : "mt-12"}`}>
            {NUMEROS.map((s) => (
              <div key={s.l} className="bg-[#0E1525] px-6 py-8">
                <div className="text-[34px] font-bold tracking-tight tabular-nums sm:text-[42px]">{s.n}</div>
                <div className="mt-1.5 text-[13px] text-white/55">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Recursos ── */}
        <section id="recursos" className="mx-auto max-w-[1240px] px-5 py-20">
          <div className="mx-auto max-w-[680px] text-center">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#60A5FA]">Recursos</p>
            <h2 className="mt-3 text-[32px] font-bold tracking-[-0.03em] text-white sm:text-[42px]">
              Um agente que sabe do seu negócio
            </h2>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-[1.35fr_1fr_1fr]">
            <article className="rounded-2xl border border-white/10 bg-[#0E1525] p-7">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#2563EB]"><Bot className="h-5 w-5" /></span>
              <h3 className="mt-5 text-[19px] font-semibold text-white">Treinado com o que você já tem</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/60">
                Suba tabela de preços, contrato, cardápio ou manual. O agente passa a responder
                com base neles — sem inventar o que não está escrito.
              </p>
              <ul className="mt-6 space-y-2">
                {[
                  { n: "Tabela de preços 2026.pdf", s: "Aprendido" },
                  { n: "Perguntas frequentes.docx", s: "Aprendido" },
                  { n: "Termos de atendimento.pdf", s: "Aprendido" },
                ].map((f) => (
                  <li key={f.n} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-white/40" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-white/80">{f.n}</span>
                    <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">{f.s}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0E1525] p-7">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#7C5CFF]"><MessageSquare className="h-5 w-5" /></span>
              <h3 className="mt-5 text-[19px] font-semibold text-white">Três canais, uma caixa</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/60">
                O que chega por qualquer canal aparece na mesma lista, com o histórico junto.
              </p>
              <div className="mt-6 space-y-2">
                {[
                  { i: MessageSquare, n: "WhatsApp", c: "bg-[#22A06B]" },
                  { i: Instagram, n: "Instagram", c: "bg-[#DB2777]" },
                  { i: Globe, n: "Site", c: "bg-[#2563EB]" },
                ].map((c) => (
                  <span key={c.n} className={`flex items-center gap-2 rounded-full ${c.c} px-3.5 py-2 text-[13px] font-semibold`}>
                    <c.i className="h-3.5 w-3.5" /> {c.n}
                  </span>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-[#2563EB] bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] p-7">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><CalendarDays className="h-5 w-5" /></span>
              <h3 className="mt-5 text-[19px] font-semibold text-white">Agenda que confirma sozinha</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/75">
                Marca no Google, envia o link da reunião e lembra o cliente antes da hora.
              </p>
              <div className="mt-7">
                <div className="text-[46px] font-bold leading-none tracking-tight">−48%</div>
                <div className="mt-1.5 text-[13px] text-white/70">de faltas com o lembrete automático</div>
              </div>
            </article>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {RECURSOS_MENORES.map((r) => (
              <article key={r.t} className="rounded-2xl border border-white/10 bg-[#0E1525] p-5">
                <r.icon className="h-5 w-5 text-[#60A5FA]" />
                <h3 className="mt-3.5 text-[15px] font-semibold text-white">{r.t}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-white/55">{r.d}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Funil Kanban ── */}
        <section id="funil" className="mx-auto max-w-[1240px] px-5 py-20">
          <div className="mx-auto max-w-[680px] text-center">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#60A5FA]">Funil Kanban</p>
            <h2 className="mt-3 text-[32px] font-bold tracking-[-0.03em] text-white sm:text-[42px]">
              O card anda sozinho conforme a conversa avança
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/60">
              Quando o cliente pede orçamento, o agente move para Proposta. Quando marca, move
              para Agendado. Você abre o funil e vê o estado real, sem arrastar nada.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_40px_90px_-40px_rgba(37,99,235,0.5)]">
            <div className="flex gap-3 overflow-x-auto">
              {[
                { n: "Novos", c: "#2563EB", cards: [["Marina Costa", "Perguntou sobre clareamento", "R$ 1.400", MessageSquare]] },
                { n: "Qualificando", c: "#7C5CFF", cards: [["@lucas.fit", "Interesse no plano trimestral", "R$ 2.100", Instagram]] },
                { n: "Proposta", c: "#DB2777", cards: [["João Pereira", "Recebeu o orçamento", "R$ 2.840", Instagram]] },
                { n: "Agendado", c: "#F59E0B", cards: [["Ana Martins", "Quinta, 10h", "R$ 2.020", MessageSquare]] },
                { n: "Fechado", c: "#22A06B", cards: [["Roberto Alves", "Contrato assinado", "R$ 1.900", Globe]] },
              ].map((col) => (
                <div key={col.n} className="w-[220px] shrink-0 rounded-xl bg-[#F8FAFC] p-2.5">
                  <div className="flex items-center gap-2 px-1 pb-2.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.c }} />
                    <span className="text-[12px] font-semibold text-slate-700">{col.n}</span>
                  </div>
                  {col.cards.map(([nome, nota, valor, Icone]: any) => (
                    <div key={nome} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-5 w-5 place-items-center rounded bg-[#EEF4FF] text-[9px] font-bold text-[#2563EB]">
                          {nome.replace("@", "").substring(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-slate-800">{nome}</span>
                        <Icone className="h-3 w-3 shrink-0 text-slate-400" />
                      </div>
                      <p className="mt-2 truncate text-[11.5px] text-slate-500">{nota}</p>
                      <p className="mt-2 text-[13px] font-bold text-slate-900">{valor}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { i: Zap, t: "Move sozinho", d: "A etapa muda conforme o que o cliente diz." },
              { i: LayoutGrid, t: "Valor por contato", d: "Some quanto está em negociação e o ticket médio." },
              { i: Bot, t: "Sem digitar nada", d: "O agente preenche a ficha durante a conversa." },
              { i: BarChart3, t: "Conversão por etapa", d: "Veja onde os contatos param de avançar." },
            ].map((b) => (
              <div key={b.t} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.07]"><b.i className="h-4 w-4 text-[#60A5FA]" /></span>
                <div>
                  <h3 className="text-[14.5px] font-semibold text-white">{b.t}</h3>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-white/55">{b.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Integrações ── */}
        <section id="integracoes" className="mx-auto max-w-[1240px] px-5 py-20">
          <div className="mx-auto max-w-[680px] text-center">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#60A5FA]">Integrações</p>
            <h2 className="mt-3 text-[32px] font-bold tracking-[-0.03em] text-white sm:text-[42px]">Conecta com o que você já usa</h2>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {INTEGRACOES.map((s) => (
              <div key={s.n} className="flex h-[84px] flex-col justify-center rounded-xl border border-white/10 bg-[#0E1525] px-4">
                <span className="truncate text-[14px] font-semibold">{s.n}</span>
                <span className="mt-0.5 truncate text-[11.5px] text-white/45">{s.c}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Comparativo ── */}
        <section className="mx-auto max-w-[1080px] px-5 pb-24 pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#0E1525] p-7">
              <h3 className="text-[17px] font-semibold text-white/70">Sem Agentes Virtuais</h3>
              <ul className="mt-5 space-y-3.5">
                {SEM.map((t) => (
                  <li key={t} className="flex gap-3 text-[14px] leading-relaxed text-white/55">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" strokeWidth={3} /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[#2563EB] bg-gradient-to-br from-[#12213F] to-[#0E1525] p-7">
              <h3 className="text-[17px] font-semibold text-white">Com Agentes Virtuais</h3>
              <ul className="mt-5 space-y-3.5">
                {COM.map((t) => (
                  <li key={t} className="flex gap-3 text-[14px] leading-relaxed text-white/85">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4ADE80]" strokeWidth={3} /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <Onda cor="#F8FAFF" paraBaixo={false} />
      </div>

      {/* ══════════ PLANOS ══════════ */}
      <section id="planos" className="bg-[#F8FAFF] px-5 py-20">
        <div className="mx-auto max-w-[1080px]">
          <div className="mx-auto max-w-[680px] text-center">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">Planos</p>
            <h2 className="mt-3 text-[32px] font-bold tracking-[-0.03em] sm:text-[42px]">Escolha como quer conectar</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#475569]">
              Sete dias grátis nos dois, sem cartão. A diferença está em como o WhatsApp é
              conectado — e no que isso libera.
            </p>
          </div>

          {doBanco.length >= 1 && (
            <div className="mt-8 flex justify-center">
              <div className="inline-flex rounded-full border border-[#DBE4F0] bg-white p-1">
                {[false, true].map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setAnual(v)}
                    className={`rounded-full px-5 py-2 text-[13.5px] font-semibold transition-colors ${
                      anual === v ? "bg-[#2563EB] text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {v ? "Anual" : "Mensal"}
                    {v && desconto > 0 && (
                      <span className={`ml-1.5 ${anual ? "text-white/80" : "text-[#22A06B]"}`}>−{desconto}%</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {doBanco.length === 0 ? (
            // Sem plano cadastrado a página não inventa preço: manda para o
            // diagnóstico, que é onde o preço certo é calculado.
            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-[#DBE4F0] bg-white p-8 text-center">
              <p className="text-[15px] font-semibold text-slate-800">Monte o plano com a gente</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#475569]">
                Responda cinco perguntas sobre o seu atendimento e mostramos qual plano serve.
              </p>
              <Link to="/comecar">
                <Button className="mt-5 h-12 w-full rounded-xl bg-[#2563EB] font-semibold text-white hover:bg-[#1D4ED8]">
                  Descobrir meu plano
                </Button>
              </Link>
            </div>
          ) : (
            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              {doBanco.map((p, i) => {
                const destaque = i === doBanco.length - 1 && doBanco.length > 1;
                const mensal = anual ? (p.priceYearly || 0) / 12 : p.priceMonthly || 0;
                const limites = [
                  ["Conversas por mês", p.maxConversations > 0 ? p.maxConversations.toLocaleString("pt-BR") : "Ilimitadas"],
                  ["Créditos de IA", `${((p.maxTokens || 0) / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M tokens`],
                  ["Números conectados", String(p.maxWhatsAppNumbers ?? 1)],
                  ["Colaboradores", String(p.maxUsers ?? 1)],
                ];
                const recursos = [
                  ["Agente de IA multicanal", p.enableSdr !== false],
                  ["Agenda com Google e Meet", p.enableCalendar !== false],
                  ["Lembretes e confirmação", p.enableAutomations !== false],
                  ["Funil, catálogo e disparos", true],
                  ["Agente por áudio", !!p.enableVoice],
                  ["API pública e webhooks", !!p.enableWebhooks],
                ];
                return (
                  <article
                    key={p.id}
                    className={`relative rounded-2xl p-8 ${
                      destaque
                        ? "border border-[#2563EB] bg-[#0F172A] text-white"
                        : "border border-[#DBE4F0] bg-white"
                    }`}
                    style={destaque ? { backgroundImage: "radial-gradient(90% 60% at 50% 0%, rgba(37,99,235,0.35), transparent 70%)" } : undefined}
                  >
                    {destaque && (
                      <span className="absolute -top-[13px] left-1/2 -translate-x-1/2 rounded-full bg-[#2563EB] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                        Mais escolhido
                      </span>
                    )}

                    {/* A cor vai explícita: o @layer base pinta h1..h4 de
                        `text-foreground`, que no card escuro some no fundo. */}
                    <h3 className={`text-[20px] font-bold tracking-tight ${destaque ? "text-white" : "text-slate-900"}`}>
                      {p.name}
                    </h3>
                    <p className={`mt-1 text-[13px] ${destaque ? "text-white/60" : "text-[#475569]"}`}>
                      {p.whatsappMode === "BAILEYS"
                        ? "Conexão por QR Code"
                        : p.whatsappMode === "OFFICIAL"
                        ? "API oficial da Meta"
                        : "QR Code ou API oficial"}
                    </p>

                    <div className="mt-6 flex items-baseline gap-1.5">
                      <span className="text-[38px] font-bold tracking-[-0.03em]">{reais(mensal)}</span>
                      <span className={`text-[14px] ${destaque ? "text-white/55" : "text-slate-500"}`}>/mês</span>
                    </div>
                    {anual && (
                      <p className={`mt-1 text-[12.5px] ${destaque ? "text-white/55" : "text-slate-500"}`}>
                        {reais(p.priceYearly || 0)} cobrados uma vez por ano
                      </p>
                    )}

                    <Link to="/register">
                      <Button
                        className={`mt-6 h-12 w-full rounded-xl text-[14.5px] font-semibold ${
                          destaque
                            ? "border-none bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                            : "border border-[#DBE4F0] bg-white text-slate-800 hover:bg-[#F8FAFF]"
                        }`}
                      >
                        Testar 7 dias grátis
                      </Button>
                    </Link>

                    <dl className={`mt-7 space-y-2.5 border-t pt-6 ${destaque ? "border-white/10" : "border-[#E9EEF5]"}`}>
                      {limites.map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-3">
                          <dt className={`text-[13px] ${destaque ? "text-white/55" : "text-[#475569]"}`}>{k}</dt>
                          <dd className="text-[13px] font-semibold">{v}</dd>
                        </div>
                      ))}
                    </dl>

                    <ul className={`mt-6 space-y-2.5 border-t pt-6 ${destaque ? "border-white/10" : "border-[#E9EEF5]"}`}>
                      {recursos.map(([t, tem]: any) => (
                        <li key={t} className={`flex items-start gap-2.5 text-[13.5px] ${
                          tem ? (destaque ? "text-white/90" : "text-slate-700") : "text-slate-400 line-through"
                        }`}>
                          {tem
                            ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#22A06B]" strokeWidth={3} />
                            : <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 no-underline" strokeWidth={3} />}
                          {t}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-[#DBE4F0] bg-white px-6 py-5 text-center">
            <Shield className="h-5 w-5 shrink-0 text-[#22A06B]" />
            <p className="text-[13.5px] text-[#475569]">
              <strong className="font-semibold text-slate-800">7 dias grátis em qualquer plano.</strong>{" "}
              Sem cartão para testar e cancelamento em um clique dentro do painel.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section id="faq" className="bg-white px-5 py-20">
        <div className="mx-auto max-w-[840px]">
          <div className="text-center">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">Dúvidas</p>
            <h2 className="mt-3 text-[32px] font-bold tracking-[-0.03em] sm:text-[42px]">Perguntas frequentes</h2>
          </div>

          <div className="mt-10 divide-y divide-[#E9EEF5] border-y border-[#E9EEF5]">
            {PERGUNTAS.map((p, i) => (
              <div key={p.q}>
                <button
                  onClick={() => setAberta(aberta === i ? null : i)}
                  aria-expanded={aberta === i}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-[15.5px] font-semibold text-slate-800">{p.q}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${aberta === i ? "rotate-180" : ""}`} />
                </button>
                {aberta === i && (
                  <p className="-mt-1 pb-5 pr-9 text-[14.5px] leading-relaxed text-[#475569]">{p.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA FINAL ══════════ */}
      <section className="relative overflow-hidden bg-[#EEF4FF] px-5 py-24 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(60% 60% at 50% 30%, rgba(37,99,235,0.18), transparent 70%)" }} />
        <div className="relative mx-auto max-w-[680px]">
          <h2 className="text-[32px] font-bold tracking-[-0.03em] sm:text-[44px]">
            Seu cliente vai chamar hoje. Alguém vai responder?
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[16px] leading-relaxed text-[#475569]">
            Conecte o WhatsApp em um minuto e deixe o agente atender enquanto você trabalha.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register">
              <Button className="h-[54px] rounded-2xl border-none bg-[#2563EB] px-8 text-[15px] font-semibold text-white shadow-[0_16px_40px_-8px_rgba(37,99,235,0.5)] hover:bg-[#1D4ED8]">
                Testar 7 dias grátis
              </Button>
            </Link>
            <Link to="/comecar">
              <Button variant="outline" className="h-[54px] rounded-2xl border-[#DBE4F0] bg-white px-7 text-[15px] font-semibold">
                Descobrir meu plano <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="bg-[#080C16] px-5 py-16 text-white">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Logo />
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/55">
                Agentes de IA que atendem, vendem e agendam no WhatsApp, Instagram e no seu site.
              </p>
            </div>
            <div>
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-white/40">Produto</h3>
              <ul className="mt-4 space-y-2.5 text-[13.5px] text-white/70">
                <li><a href="#recursos" className="hover:text-white">Recursos</a></li>
                <li><a href="#funil" className="hover:text-white">Funil Kanban</a></li>
                <li><a href="#integracoes" className="hover:text-white">Integrações</a></li>
                <li><Link to="/planos" className="hover:text-white">Planos</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-white/40">Contato</h3>
              <ul className="mt-4 space-y-2.5 text-[13.5px] text-white/70">
                <li>{settings?.contactEmail || "contato@agentesvirtuais.com"}</li>
                <li>WhatsApp: {settings?.contactWhatsApp || "71 99204-2802"}</li>
                <li className="leading-relaxed text-white/50">
                  Rua Vereador Zezeu Ribeiro, 1117, Boca da Mata, Salvador&nbsp;-&nbsp;BA · CEP 41.345-100
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-white/40">Legal</h3>
              <ul className="mt-4 space-y-2.5 text-[13.5px] text-white/70">
                <li><Link to="/termos" className="hover:text-white">Termos de Uso</Link></li>
                <li><Link to="/privacidade" className="hover:text-white">Política de Privacidade</Link></li>
                <li><Link to="/login" className="hover:text-white">Entrar no painel</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-white/10 pt-6 text-[12.5px] text-white/40">
            © {new Date().getFullYear()} Agentes Virtuais. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* ══════════ FLUTUANTES ══════════ */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3">
        <a
          href={`https://wa.me/${(settings?.contactWhatsApp || "5571992042802").replace(/\D/g, "")}`}
          target="_blank" rel="noreferrer"
          className="grid h-14 w-14 place-items-center rounded-full bg-[#22A06B] text-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
          aria-label="Falar no WhatsApp"
        >
          <Phone className="h-6 w-6 fill-current" />
        </a>
        {settings?.selectedSdrId && (
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="grid h-14 w-14 place-items-center rounded-full border border-[#DBE4F0] bg-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
            aria-label={isChatOpen ? "Fechar chat" : "Abrir chat"}
          >
            {isChatOpen ? <X className="h-6 w-6 text-slate-600" /> : <MessageSquare className="h-6 w-6 text-[#2563EB]" />}
          </button>
        )}
      </div>

      {/* ══════════ CHAT DO AGENTE ══════════ */}
      {isChatOpen && (
        <div className="an-up fixed bottom-24 right-4 z-[9999] flex w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[#DBE4F0] bg-white shadow-2xl sm:right-6 sm:w-96">
          <div className="flex items-center gap-3 border-b border-[#E9EEF5] p-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C5CFF] text-[13px] font-bold text-white">AI</div>
            <div>
              <h4 className="text-[14px] font-semibold text-slate-800">Assistente Agentes Virtuais</h4>
              <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#22A06B]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22A06B]" /> online agora
              </p>
            </div>
          </div>
          <div className="h-96 flex-1 space-y-3 overflow-y-auto bg-[#F8FAFF] p-4">
            {chatHistory.length === 0 && (
              <div className="rounded-2xl border border-[#E9EEF5] bg-white p-4 text-[13px] leading-relaxed text-[#475569]">
                Olá! Quer ver como um agente de IA pode atender, vender e agendar para o seu
                negócio 24 horas por dia?
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] whitespace-pre-wrap px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-[14px_14px_4px_14px] bg-[#2563EB] text-white"
                    : "rounded-[14px_14px_14px_4px] border border-[#E9EEF5] bg-white text-slate-700"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loadingChat && <p className="pl-1 text-[12px] font-semibold text-[#2563EB]">digitando…</p>}
          </div>
          {visitante ? (
            <div className="flex gap-2 border-t border-[#E9EEF5] p-3">
              <input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Tire suas dúvidas…"
                className="h-11 flex-1 rounded-xl bg-[#F1F5F9] px-4 text-[13px] outline-none transition focus:ring-2 focus:ring-[#2563EB]/30"
              />
              <Button onClick={handleSendMessage} disabled={loadingChat} className="h-11 w-11 shrink-0 rounded-xl bg-[#2563EB] p-0 hover:bg-[#1D4ED8]">
                <Send className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <IdentificacaoVisitante
              onPronto={(v) => {
                setVisitante(v);
                sessionStorage.setItem("landing_visitante", JSON.stringify(v));
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
