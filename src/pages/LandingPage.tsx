import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Zap, Check, Target, MessageSquare, ArrowRight, Shield, TrendingUp, Users,
  BarChart, Globe, Mail, Phone, ExternalLink, Star, Play
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* HEADER PREMIUM */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 lg:px-20 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
             <Target className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tighter">AutoSales <span className="text-primary italic">AI</span></span>
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

      {/* HERO SECTION - THE WOW FACTOR */}
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6">
               <Link to="/register">
                 <Button className="h-16 px-12 bg-primary hover:bg-primary/90 text-xl font-black rounded-2xl shadow-2xl shadow-primary/30 gap-4 flex items-center transition-transform hover:scale-105 active:scale-95">
                    Teste Grátis por 7 Dias <ArrowRight className="w-6 h-6" />
                 </Button>
               </Link>
               <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                     {[1,2,3].map(i => <div key={i} className="w-10 h-10 border-2 border-white rounded-full bg-slate-200" />)}
                  </div>
                  <span className="text-sm font-bold text-slate-400">+500 empresas minerando agora</span>
               </div>
            </div>
         </div>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section className="px-6 lg:px-20 -mt-20 lg:-mt-40 relative z-10">
         <div className="max-w-6xl mx-auto bg-white p-4 rounded-[40px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden group">
            <div className="bg-slate-900 rounded-[30px] aspect-video flex flex-col p-10 relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent" />
               <div className="flex justify-between items-center mb-8 relative z-10">
                  <div className="flex gap-2">
                     <div className="w-3 h-3 rounded-full bg-red-400/50" />
                     <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                     <div className="w-3 h-3 rounded-full bg-emerald-400/50" />
                  </div>
                  <Badge variant="outline" className="text-white/40 border-white/10 font-black">V1.0 PROSPECTOR PRO</Badge>
               </div>
               <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10 space-y-6">
                  <Play className="w-20 h-20 text-white/10 group-hover:text-primary transition-all group-hover:scale-110 cursor-pointer" fill="currentColor" />
                  <p className="text-white/20 font-black text-4xl uppercase tracking-[0.2em]">Preview da Plataforma</p>
               </div>
            </div>
         </div>
      </section>

      {/* FEATURES - BOLD & ICONIC */}
      <section id="features" className="py-40 bg-white px-6 lg:px-20">
         <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
               <div className="space-y-6">
                  <div className="bg-blue-50 w-16 h-16 rounded-[20px] flex items-center justify-center text-blue-600 shadow-md">
                     <Target className="w-8 h-8" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">Mineração Geo-Inteligente</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">Pesque todos os negócios de qualquer rua, bairro ou cidade do Brasil diretamente do Google Places com dados reais.</p>
               </div>
               <div className="space-y-6">
                  <div className="bg-emerald-50 w-16 h-16 rounded-[20px] flex items-center justify-center text-emerald-600 shadow-md">
                     <MessageSquare className="w-8 h-8" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">SDRs de IA Ilimitados</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">Crie quantos bots quiser. Configure funções Inbound ou Outbound e defina o tom de voz da sua marca.</p>
               </div>
               <div className="space-y-6">
                  <div className="bg-indigo-50 w-16 h-16 rounded-[20px] flex items-center justify-center text-indigo-600 shadow-md">
                     <Shield className="w-8 h-8" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">Check Automático de Whats</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">Identifique números ativos no WhatsApp instantaneamente. Sem tempo perdido com leads que não existem no canal certo.</p>
               </div>
            </div>
         </div>
      </section>

      {/* PRICING - PREMIUM CARDS */}
      <section id="pricing" className="py-40 bg-slate-900 px-6 lg:px-20">
         <div className="max-w-7xl mx-auto space-y-20">
            <div className="text-center space-y-6">
               <h2 className="text-4xl lg:text-6xl font-black text-white tracking-tighter leading-none">Preço Justo para <span className="text-primary italic">Resultados Reais</span>.</h2>
               <p className="text-white/40 text-lg font-medium">Todos os planos incluem 7 dias de teste grátis. Cancele quando quiser.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto items-end">
               {/* BASIC PLAN */}
               <Card className="p-12 border-white/5 bg-white/5 text-white rounded-[40px] shadow-2xl space-y-10">
                  <div className="space-y-2">
                     <Badge className="bg-white/10 text-white border-none py-1.5 px-4 font-black text-[10px] uppercase tracking-widest">BASIC</Badge>
                     <h3 className="text-4xl font-black tracking-tight">R$ 197<span className="text-sm font-medium text-white/40">/mês</span></h3>
                  </div>
                  <ul className="space-y-6">
                     {["Ate 300 Leads/mês", "1 SDR de IA Ativo", "Suporte via E-mail", "Check de Whats Básico", "CRM Integrado"].map(f => (
                        <li key={f} className="flex items-center gap-4 text-sm font-bold text-white/60">
                           <Check className="w-5 h-5 text-emerald-400 group-hover:scale-110" /> {f}
                        </li>
                     ))}
                  </ul>
                  <Link to="/register" className="block w-full">
                    <Button variant="outline" className="w-full h-16 border-white/10 hover:bg-white/10 text-white font-black rounded-2xl text-lg">Começar Agora</Button>
                  </Link>
               </Card>

               {/* PRO PLAN (RECOMMENDED) */}
               <Card className="p-12 border-primary bg-primary text-white rounded-[40px] shadow-[0_40px_100px_rgba(var(--primary),0.3)] space-y-10 relative overflow-hidden transform scale-110">
                  <div className="absolute top-0 right-0 bg-white/20 px-8 py-3 rounded-bl-3xl font-black text-[10px] uppercase tracking-widest">MAIS ESCOLHIDO</div>
                  <div className="space-y-2">
                     <Badge className="bg-black/20 text-white border-none py-1.5 px-4 font-black text-[10px] uppercase tracking-widest">PLATINUM PRO</Badge>
                     <h3 className="text-6xl font-black tracking-tighter leading-none">R$ 497<span className="text-sm font-medium text-white/40">/mês</span></h3>
                  </div>
                  <ul className="space-y-6">
                     {["Leads Ilimitados", "Múltiplos SDRs (In/Out)", "Suporte Prioritário", "Webhooks & API", "Mercado Pago Integrado", "Sincronização de Agenda"].map(f => (
                        <li key={f} className="flex items-center gap-4 text-sm font-black">
                           <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300 shadow-xl" /> {f}
                        </li>
                     ))}
                  </ul>
                  <Link to="/register" className="block w-full">
                    <Button className="w-full h-20 bg-white text-primary hover:bg-slate-50 font-black rounded-2xl text-xl shadow-2xl transition-transform active:scale-95">Escolher Plano Pro</Button>
                  </Link>
               </Card>
            </div>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="py-20 bg-slate-50 px-6 lg:px-20 border-t border-slate-100">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-3 grayscale opacity-60">
               <Target className="w-6 h-6 text-slate-900" />
               <span className="text-xl font-black text-slate-900 tracking-tighter">AutoSales AI</span>
            </div>
            <div className="text-slate-400 text-sm font-bold">
               © 2026 AutoSales Solutions Ltda. Todos os direitos reservados.
            </div>
            <div className="flex gap-6 text-slate-400 font-bold text-sm">
               <a href="#" className="hover:text-primary">Termos</a>
               <a href="#" className="hover:text-primary">Privacidade</a>
            </div>
         </div>
      </footer>
    </div>
  );
}

function Building2(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
    </svg>
  );
}
