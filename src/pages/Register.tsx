import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", password: "", companyName: "",
    planId: params.get("plan") || "",
  });

  // Plano escolhido (para exibir no topo do form).
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  useEffect(() => {
    const planId = params.get("plan");
    if (!planId) return;
    (async () => {
      try {
        const res = await fetch("/api/billing/plans");
        const plans = await res.json();
        const p = Array.isArray(plans) ? plans.find((x: any) => x.id === planId) : null;
        if (p) setSelectedPlan(p);
      } catch {
        /* silent */
      }
    })();
  }, [params]);

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.password || !formData.companyName) {
      return toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
    }
    if (formData.password.length < 8) {
      return toast({ title: "Senha muito curta", description: "Use ao menos 8 caracteres.", variant: "destructive" });
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Conta criada! Confira seu e-mail",
          description: "Enviamos um link de confirmação para " + formData.email,
        });
        localStorage.setItem("token", data.token);
        localStorage.setItem("userRole", data.user?.role || "OWNER");
        localStorage.setItem("tenantId", data.tenant.id);
        localStorage.setItem("userId", data.user.id);
        navigate("/dashboard");
      } else if (res.status === 409) {
        toast({
          title: "E-mail já cadastrado",
          description: "Se essa conta é sua, faça login ou recupere a senha.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Erro no cadastro", description: data.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro na conexão", description: "Não foi possível cadastrar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 lg:p-12 font-sans overflow-hidden relative">
      <div className="absolute top-0 right-0 w-1/3 h-full bg-[#2563EB]/5 blur-3xl rounded-full translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-[#2563EB]/5 blur-3xl rounded-full -translate-x-1/2" />

      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden relative z-10">

        {/* LADO ESQUERDO - CONTEXTO */}
        <div className="bg-slate-900 p-12 text-white flex flex-col justify-between relative overflow-hidden hidden lg:flex">
           <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-10 left-10 w-40 h-40 border border-white rounded-full" />
              <div className="absolute bottom-20 right-10 w-64 h-64 border border-white rounded-full translate-x-1/2" />
           </div>
           <div className="flex items-center gap-3 relative z-10">
              <img src="/logo.png" alt="Agentes Virtuais" className="h-8 w-auto" />
              <span className="text-2xl font-bold tracking-tight text-white">Agentes <span className="text-[#2563EB] italic">Virtuais</span></span>
           </div>
           <div className="space-y-6 relative z-10">
              <h2 className="text-4xl font-bold leading-none tracking-tight">Sua recepção que nunca dorme.</h2>
              <p className="text-white/40 font-bold leading-relaxed">Um agente de IA no WhatsApp que responde, qualifica e agenda pacientes automaticamente — 24 horas por dia.</p>
              <div className="space-y-4 pt-10">
                 {["Período de teste grátis", "Cobrança só depois do teste", "Cancele em um clique no painel", "Agenda integrada ao Google Calendar"].map(t => (
                   <div key={t} className="flex items-center gap-3 text-xs font-bold text-white/50">
                      <CheckCircle2 className="w-4 h-4 text-[#2DD4BF] shrink-0" /> {t}
                   </div>
                 ))}
              </div>
           </div>
           <div className="relative z-10 opacity-30 text-xs font-bold pt-10">Atendimento inteligente para clínicas</div>
        </div>

        {/* LADO DIREITO - FORMULÁRIO */}
        <div className="p-8 lg:p-12 flex flex-col justify-center">
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
               <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Criar conta</h3>
                  <p className="text-slate-400 font-bold text-xs">7 dias grátis para testar. Sem cartão agora.</p>
               </div>

               {selectedPlan && (
                 <div className="rounded-2xl border border-[#2563EB]/30 bg-[#2563EB]/5 p-4 flex items-center gap-3">
                   <div className="h-10 w-10 rounded-xl bg-[#2563EB] text-white grid place-items-center shrink-0">
                     <Sparkles className="w-5 h-5" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="text-xs font-bold text-[#2563EB] uppercase tracking-wide">Plano escolhido</p>
                     <p className="text-sm font-semibold text-slate-900 truncate">
                       {selectedPlan.name} — 7 dias grátis, depois R$ {selectedPlan.priceMonthly}/mês
                     </p>
                   </div>
                 </div>
               )}
               <div className="space-y-3">
                  <div className="space-y-1">
                     <Label className="text-xs font-bold text-slate-400 pl-1">Nome completo</Label>
                     <Input placeholder="Seu nome" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-14 border-slate-100 rounded-2xl bg-slate-50 shadow-none font-bold" />
                  </div>
                  <div className="space-y-1">
                     <Label className="text-xs font-bold text-slate-400 pl-1">Nome da clínica</Label>
                     <Input placeholder="Ex: Clínica Bem Estar" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="h-14 border-slate-100 rounded-2xl bg-slate-50 shadow-none font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-400 pl-1">WhatsApp</Label>
                        <Input placeholder="11 99999-9999" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="h-14 border-slate-100 rounded-2xl bg-slate-50 shadow-none font-bold" />
                     </div>
                     <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-400 pl-1">Senha</Label>
                        <Input type="password" placeholder="mín. 8 caracteres" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="h-14 border-slate-100 rounded-2xl bg-slate-50 shadow-none font-bold" />
                     </div>
                  </div>
                  <div className="space-y-1">
                     <Label className="text-xs font-bold text-slate-400 pl-1">E-mail</Label>
                     <Input placeholder="seu@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-14 border-slate-100 rounded-2xl bg-slate-50 shadow-none font-bold" />
                  </div>
               </div>
               <Button onClick={handleRegister} disabled={loading} className="w-full h-14 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-2xl font-bold text-base gap-3 shadow-xl ">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Começar teste grátis <ArrowRight className="w-4 h-4" /></>}
               </Button>
               <p className="text-xs text-center text-slate-400 font-bold leading-relaxed">
                 Ao criar a conta você concorda com os Termos de Uso e a Política de Privacidade.
               </p>
            </div>

            <div className="mt-8 text-center pb-4">
               <p className="text-xs font-bold text-slate-400">Já tem conta? <Link to="/login" className="text-[#2563EB] hover:underline">Fazer Login</Link></p>
            </div>
        </div>

      </div>
    </div>
  );
}
