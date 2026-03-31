import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Target, Mail, Lock, Loader2, ArrowRight, CheckCircle2, 
  CreditCard, Calendar, ShieldCheck, Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [step, setStep] = useState(1); // 1: Conta, 2: Plano, 3: Pagamento (Trial)
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
    plan: "PRO"
  });

  const nextStep = () => setStep(prev => prev + 1);

  const handleFinish = async () => {
    setLoading(true);
    // Simulação de criação de conta SaaS + Registro no Mercado Pago
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({ 
      title: "🚀 Conta Criada com Sucesso!", 
      description: "Seu trial de 7 dias começou. Você não será cobrado hoje." 
    });
    
    // Redireciona para o Dashboard (Na vida real, criaria o tenant no backend aqui)
    localStorage.setItem("userRole", "OWNER");
    localStorage.setItem("userPlan", formData.plan);
    navigate("/crm");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 lg:p-12 font-sans overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-primary/5 blur-3xl rounded-full translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-blue-500/5 blur-3xl rounded-full -translate-x-1/2" />

      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[40px] shadow-3xl border border-slate-100 overflow-hidden relative z-10">
        
        {/* LEFT SIDE - CONTEXT */}
        <div className="bg-slate-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-10 left-10 w-40 h-40 border border-white rounded-full" />
              <div className="absolute bottom-20 right-10 w-64 h-64 border border-white rounded-full translate-x-1/2" />
           </div>

           <div className="flex items-center gap-3 relative z-10">
              <Target className="w-8 h-8 text-primary" />
              <span className="text-2xl font-black tracking-tighter">AutoSales <span className="text-primary italic">AI</span></span>
           </div>

           <div className="space-y-6 relative z-10">
              <h2 className="text-4xl font-black leading-none tracking-tight">Comece sua jornada de escala.</h2>
              <p className="text-white/40 font-bold leading-relaxed">Assuma o controle total de seus leads com a potência de SDRs de inteligência artificial.</p>
              
              <div className="space-y-4 pt-10">
                 {[
                   "Trial Grátis de 7 Dias",
                   "Cobrança apenas após o teste",
                   "Cancele em um clique no painel",
                   "Acesso imediato ao Prospector Pro"
                 ].map(t => (
                   <div key={t} className="flex items-center gap-3 text-xs font-black text-white/50">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {t}
                   </div>
                 ))}
              </div>
           </div>

           <div className="relative z-10 opacity-30 text-[10px] font-black uppercase tracking-widest pt-10">
              Transformando o futuro das vendas B2B
           </div>
        </div>

        {/* RIGHT SIDE - PROGRESSIVE FORM */}
        <div className="p-12 lg:p-16 flex flex-col justify-center">
            
            {/* PROGRESS INDICATOR */}
            <div className="flex gap-2 mb-10">
               {[1,2,3].map(i => (
                 <div key={i} className={`h-2 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-primary' : 'bg-slate-100'}`} />
               ))}
            </div>

            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                 <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Criar Conta</h3>
                    <p className="text-slate-400 font-bold text-sm">Dados básicos da sua empresa.</p>
                 </div>
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome Completo</Label>
                       <Input placeholder="Seu nome" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-14 border-slate-100 rounded-2xl bg-slate-50 shadow-none text-lg font-bold" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome da Empresa</Label>
                       <Input placeholder="Ex: AutoSales Tech" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="h-14 border-slate-100 rounded-2xl bg-slate-50 shadow-none text-lg font-bold" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">E-mail Corporativo</Label>
                       <Input placeholder="seu@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-14 border-slate-100 rounded-2xl bg-slate-50 shadow-none text-lg font-bold" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Senha</Label>
                       <Input type="password" placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="h-14 border-slate-100 rounded-2xl bg-slate-50 shadow-none text-lg font-bold" />
                    </div>
                 </div>
                 <Button onClick={nextStep} className="w-full h-16 bg-slate-900 hover:bg-black rounded-2xl font-black text-lg gap-3">
                    Próximo Passo <ArrowRight className="w-5 h-5" />
                 </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                 <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Escolha seu Plano</h3>
                    <p className="text-slate-400 font-bold text-sm">7 dias grátis em qualquer opção.</p>
                 </div>
                 <div className="grid grid-cols-1 gap-4">
                    <div 
                      className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${formData.plan === 'BASIC' ? 'border-primary bg-primary/5' : 'border-slate-100 hover:bg-slate-50'}`}
                      onClick={() => setFormData({...formData, plan: 'BASIC'})}
                    >
                       <div className="flex justify-between items-center">
                          <span className="font-black text-lg text-slate-900">Plano Basic</span>
                          <span className="font-black text-slate-400">R$ 197/mês</span>
                       </div>
                       <p className="text-xs text-slate-400 font-bold mt-1">Ideal para começar.</p>
                    </div>
                    <div 
                      className={`p-6 rounded-3xl border-2 cursor-pointer relative overflow-hidden transition-all ${formData.plan === 'PRO' ? 'border-primary bg-primary/5 shadow-xl' : 'border-slate-100 hover:bg-slate-50'}`}
                      onClick={() => setFormData({...formData, plan: 'PRO'})}
                    >
                       <div className="flex justify-between items-center">
                          <span className="font-black text-lg text-slate-900 flex items-center gap-2">PLATINUM PRO <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" /></span>
                          <span className="font-black text-slate-900">R$ 497/mês</span>
                       </div>
                       <p className="text-xs text-slate-400 font-bold mt-1">Multi-SDR e Leads Ilimitados.</p>
                       {formData.plan === 'PRO' && <div className="absolute top-0 right-0 h-1 bg-primary w-full" />}
                    </div>
                 </div>
                 <Button onClick={nextStep} className="w-full h-16 bg-slate-900 hover:bg-black rounded-2xl font-black text-lg gap-3">
                    Continuar para Pagamento <ArrowRight className="w-5 h-5" />
                 </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                 <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Checkout Seguro</h3>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Powered by Mercado Pago</p>
                 </div>
                 <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 blur-2xl rounded-full" />
                    <div className="flex justify-between items-start">
                       <CreditCard className="w-8 h-8 opacity-50" />
                       <div className="flex gap-1">
                          <div className="w-8 h-6 bg-white/10 rounded" />
                          <div className="w-8 h-6 bg-white/10 rounded" />
                       </div>
                    </div>
                    <div className="space-y-4">
                       <div className="space-y-1">
                          <Label className="text-[9px] font-black text-white/30 tracking-widest">NÚMERO DO CARTÃO</Label>
                          <Input placeholder="0000 0000 0000 0000" className="h-10 bg-white/10 border-none text-white font-black text-lg placeholder:text-white/20" />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                             <Label className="text-[9px] font-black text-white/30 tracking-widest">VALIDADE</Label>
                             <div className="relative">
                               <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                               <Input placeholder="MM/AA" className="h-10 pl-10 bg-white/10 border-none text-white font-black placeholder:text-white/20" />
                             </div>
                          </div>
                          <div className="space-y-1">
                             <Label className="text-[9px] font-black text-white/30 tracking-widest">CVV</Label>
                             <Input placeholder="123" className="h-10 bg-white/10 border-none text-white font-black placeholder:text-white/20" />
                          </div>
                       </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 bg-emerald-50 p-4 rounded-2xl">
                    <ShieldCheck className="w-6 h-6 text-emerald-600" />
                    <p className="text-[10px] font-bold text-emerald-700 uppercase leading-snug">Você não será cobrado agora. Período de teste válido até {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}.</p>
                 </div>
                 <Button onClick={handleFinish} className="w-full h-16 bg-primary hover:bg-primary/90 rounded-2xl font-black text-xl shadow-2xl shadow-primary/20" disabled={loading}>
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Iniciar Meu Trial Agora"}
                 </Button>
              </div>
            )}

            <div className="mt-8 text-center">
               <p className="text-sm font-bold text-slate-400">Já tem conta? <Link to="/login" className="text-primary hover:underline">Fazer Login</Link></p>
            </div>
        </div>

      </div>
    </div>
  );
}
