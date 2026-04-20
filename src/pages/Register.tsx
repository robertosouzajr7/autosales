import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Target, CheckCircle2, 
  CreditCard, Calendar, ShieldCheck, Zap, ArrowRight, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [step, setStep] = useState(1); // 1: Conta, 2: Code, 3: Plano, 4: Pagamento
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", password: "", companyName: "", plan: "PRO"
  });
  
  const [verificationCode, setVerificationCode] = useState("");
  const [cardData, setCardData] = useState({ number: "", expiry: "", cvv: "" });

  const handleSendCode = async () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.password || !formData.companyName) {
      return toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email })
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Código enviado!", description: "Verifique seu e-mail." });
        setStep(2);
      } else {
        toast({ title: "Erro", description: data.error || "Erro ao enviar código.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro", description: "Falha de conexão.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) return toast({ title: "Erro", description: "Digite o código.", variant: "destructive" });
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, code: verificationCode })
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "E-mail verificado!", description: "Pode continuar com o registro." });
        setStep(3);
      } else {
        toast({ title: "Erro", description: data.error || "Código inválido.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro", description: "Falha de conexão.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!cardData.number || !cardData.expiry || !cardData.cvv) {
      return toast({ title: "Erro", description: "Preencha todos os dados do cartão.", variant: "destructive" });
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (res.ok) {
        toast({ title: "🚀 Conta Criada com Sucesso!", description: "Seu trial de 7 dias começou." });
        localStorage.setItem("token", data.token);
        localStorage.setItem("userRole", "OWNER");
        localStorage.setItem("userPlan", formData.plan);
        localStorage.setItem("tenantId", data.tenant.id);
        localStorage.setItem("userId", data.user.id);
        navigate("/dashboard");
      } else {
        toast({ title: "Erro no registro", description: data.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro na conexão", description: "Não foi possível registrar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 lg:p-12 font-sans overflow-hidden relative">
      <div className="absolute top-0 right-0 w-1/3 h-full bg-emerald-500/5 blur-3xl rounded-full translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-blue-500/5 blur-3xl rounded-full -translate-x-1/2" />

      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[40px] shadow-3xl border border-slate-100 overflow-hidden relative z-10">
        
        {/* LEFT SIDE - CONTEXT */}
        <div className="bg-slate-900 p-12 text-white flex flex-col justify-between relative overflow-hidden hidden lg:flex">
           <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-10 left-10 w-40 h-40 border border-white rounded-full" />
              <div className="absolute bottom-20 right-10 w-64 h-64 border border-white rounded-full translate-x-1/2" />
           </div>
           <div className="flex items-center gap-3 relative z-10">
              <Target className="w-8 h-8 text-emerald-500" />
              <span className="text-2xl font-black tracking-tighter">Agentes Virtuais <span className="text-emerald-500 italic">AI</span></span>
           </div>
           <div className="space-y-6 relative z-10">
              <h2 className="text-4xl font-black leading-none tracking-tight">Comece sua jornada de escala.</h2>
              <p className="text-white/40 font-bold leading-relaxed">Assuma o controle total de seus leads com a potência de SDRs de inteligência artificial.</p>
              <div className="space-y-4 pt-10">
                 {["Trial Grátis de 7 Dias", "Cobrança apenas após o teste", "Cancele em um clique no painel", "Acesso imediato ao Prospector Pro"].map(t => (
                   <div key={t} className="flex items-center gap-3 text-xs font-black text-white/50">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {t}
                   </div>
                 ))}
              </div>
           </div>
           <div className="relative z-10 opacity-30 text-[10px] font-black uppercase tracking-widest pt-10">Transformando o futuro das vendas B2B</div>
        </div>

        {/* RIGHT SIDE - PROGRESSIVE FORM */}
        <div className="p-8 lg:p-12 flex flex-col justify-center">
            <div className="flex gap-2 mb-8">
               {[1,2,3,4].map(i => (
                 <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-emerald-500' : 'bg-slate-100'}`} />
               ))}
            </div>

            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                 <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Criar Conta</h3>
                    <p className="text-slate-400 font-bold text-xs">Dados básicos da sua empresa.</p>
                 </div>
                 <div className="space-y-3">
                    <div className="space-y-1">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome Completo</Label>
                       <Input placeholder="Seu nome" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 border-slate-100 rounded-2xl bg-slate-50 shadow-none font-bold" />
                    </div>
                    <div className="space-y-1">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome da Empresa</Label>
                       <Input placeholder="Ex: Agentes Virtuais Tech" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="h-12 border-slate-100 rounded-2xl bg-slate-50 shadow-none font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">WhatsApp</Label>
                          <Input placeholder="11 99999-9999" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="h-12 border-slate-100 rounded-2xl bg-slate-50 shadow-none font-bold" />
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Senha</Label>
                          <Input type="password" placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="h-12 border-slate-100 rounded-2xl bg-slate-50 shadow-none font-bold" />
                       </div>
                    </div>
                    <div className="space-y-1">
                       <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">E-mail Corporativo</Label>
                       <Input placeholder="seu@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-12 border-slate-100 rounded-2xl bg-slate-50 shadow-none font-bold" />
                    </div>
                 </div>
                 <Button onClick={handleSendCode} disabled={loading} className="w-full h-14 bg-slate-900 hover:bg-black rounded-2xl font-black text-base gap-3">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verificar E-mail <ArrowRight className="w-4 h-4" /></>}
                 </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                 <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Verifique seu E-mail</h3>
                    <p className="text-slate-400 font-bold text-xs leading-relaxed">
                      Enviamos um código de 6 dígitos para o e-mail <br/><strong className="text-slate-700">{formData.email}</strong>.
                    </p>
                 </div>
                 <div className="space-y-2 pt-4">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Código de Segurança</Label>
                    <Input 
                      placeholder="000000" 
                      value={verificationCode} 
                      onChange={e => setVerificationCode(e.target.value)} 
                      className="h-14 border-slate-100 rounded-2xl bg-slate-50 text-center tracking-[0.5em] text-2xl font-black shadow-inner" 
                      maxLength={6}
                    />
                 </div>
                 <div className="space-y-3 pt-6">
                   <Button onClick={handleVerifyCode} disabled={loading} className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 rounded-2xl font-black text-base gap-3 text-white shadow-xl shadow-emerald-500/20">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Validar Código"}
                   </Button>
                   <Button variant="ghost" onClick={() => setStep(1)} className="w-full text-xs font-bold text-slate-400 hover:text-slate-700 h-10">Voltar e corrigir e-mail</Button>
                 </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                 <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Escolha seu Plano</h3>
                    <p className="text-slate-400 font-bold text-xs">7 dias grátis em qualquer opção.</p>
                 </div>
                 <div className="grid grid-cols-1 gap-3">
                    <div onClick={() => setFormData({...formData, plan: 'BASIC'})} className={`p-5 rounded-3xl border-2 cursor-pointer transition-all ${formData.plan === 'BASIC' ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-100 hover:bg-slate-50'}`}>
                       <div className="flex justify-between items-center text-slate-900">
                          <span className="font-black">Plano Basic</span>
                          <span className="font-black text-sm">R$ 197/mês</span>
                       </div>
                       <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Ideal para começar.</p>
                    </div>
                    <div onClick={() => setFormData({...formData, plan: 'PRO'})} className={`p-5 rounded-3xl border-2 cursor-pointer relative overflow-hidden transition-all ${formData.plan === 'PRO' ? 'border-emerald-500 bg-emerald-500/5 shadow-xl' : 'border-slate-100 hover:bg-slate-50'}`}>
                       <div className="flex justify-between items-center text-slate-900">
                          <span className="font-black flex items-center gap-1.5">PLATINUM PRO <Zap className="w-3 h-3 text-orange-500 fill-orange-500" /></span>
                          <span className="font-black text-sm">R$ 497/mês</span>
                       </div>
                       <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Multi-SDR e Leads Ilimitados.</p>
                       {formData.plan === 'PRO' && <div className="absolute top-0 right-0 h-1 bg-emerald-500 w-full" />}
                    </div>
                 </div>
                 <Button onClick={() => setStep(4)} className="w-full h-14 bg-slate-900 hover:bg-black rounded-2xl font-black text-base gap-3 mt-4">
                    Prosseguir <ArrowRight className="w-4 h-4" />
                 </Button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                 <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Pagamento</h3>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Acesso liberado na hora.</p>
                 </div>
                 <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/20 blur-2xl rounded-full pointer-events-none" />
                    <div className="flex justify-between items-start relative z-10">
                       <CreditCard className="w-6 h-6 opacity-50" />
                    </div>
                    <div className="space-y-4 relative z-10">
                       <div className="space-y-1">
                          <Label className="text-[8px] font-black text-white/30 tracking-widest">NÚMERO DO CARTÃO</Label>
                          <Input value={cardData.number} onChange={e => setCardData({...cardData, number: e.target.value})} placeholder="0000 0000 0000 0000" className="h-10 bg-white/10 border-none text-white font-black text-sm placeholder:text-white/20" />
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                             <Label className="text-[8px] font-black text-white/30 tracking-widest">VALIDADE</Label>
                             <div className="relative">
                               <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
                               <Input value={cardData.expiry} onChange={e => setCardData({...cardData, expiry: e.target.value})} placeholder="MM/AA" className="h-10 pl-8 bg-white/10 border-none text-white font-black text-sm placeholder:text-white/20" />
                             </div>
                          </div>
                          <div className="space-y-1">
                             <Label className="text-[8px] font-black text-white/30 tracking-widest">CVV</Label>
                             <Input value={cardData.cvv} onChange={e => setCardData({...cardData, cvv: e.target.value})} placeholder="123" className="h-10 bg-white/10 border-none text-white font-black text-sm placeholder:text-white/20" />
                          </div>
                       </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 bg-emerald-50 p-4 rounded-2xl">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-[9px] font-bold text-emerald-700 uppercase leading-snug">Você não será cobrado agora. Período de teste válido até {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}.</p>
                 </div>
                 <Button onClick={handleFinish} className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 rounded-2xl font-black text-base shadow-xl shadow-emerald-500/20" disabled={loading}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Iniciar Meu Trial Agora"}
                 </Button>
              </div>
            )}

            <div className="mt-8 text-center pb-4">
               <p className="text-xs font-bold text-slate-400">Já tem conta? <Link to="/login" className="text-emerald-500 hover:underline">Fazer Login</Link></p>
            </div>
        </div>

      </div>
    </div>
  );
}
