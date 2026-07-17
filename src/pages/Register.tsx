import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ArrowRight, Loader2, Sparkles, MessageSquare, Instagram, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthShell, glass } from "@/components/auth/AuthShell";

const field =
  "h-13 rounded-2xl bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 font-medium h-14 focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 transition";

export default function Register() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", password: "", companyName: "",
    planId: params.get("plan") || "",
  });

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
        body: JSON.stringify(formData),
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
        // Com plano escolhido → checkout (cartão + 7 dias grátis). Senão, onboarding.
        const plan = formData.planId || params.get("plan");
        navigate(plan ? `/checkout?plan=${plan}` : "/onboarding");
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
    <AuthShell wide>
      <div className={`grid grid-cols-1 lg:grid-cols-2 ${glass} rounded-3xl overflow-hidden shadow-xl shadow-slate-200/40 dark:shadow-black/30`}>
        {/* LADO ESQUERDO — CONTEXTO */}
        <div className="relative hidden lg:flex flex-col justify-between p-11 text-white bg-gradient-to-br from-[#0B1120] via-[#0F1B3D] to-[#1E1B4B] overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 -left-16 w-72 h-72 rounded-full blur-[90px] bg-[#3b6cff]/30" />
            <div className="absolute bottom-0 -right-10 w-72 h-72 rounded-full blur-[90px] bg-[#a855f7]/25" />
          </div>

          <div className="relative z-10">
            <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-balance">
              Seu melhor vendedor <span className="bg-gradient-to-r from-[#7ca0ff] via-[#c084fc] to-[#5eead4] bg-clip-text text-transparent">nunca dorme.</span>
            </h2>
            <p className="text-white/60 font-medium leading-relaxed mt-5 max-w-sm">
              Um agente de IA que atende, vende e agenda pelo seu negócio — no WhatsApp, Instagram e no seu site, 24 horas por dia.
            </p>

            <div className="flex items-center gap-3 mt-7">
              {[MessageSquare, Instagram, Globe].map((Icon, i) => (
                <div key={i} className="h-10 w-10 rounded-xl bg-white/10 border border-white/15 grid place-items-center backdrop-blur-sm">
                  <Icon className="w-4.5 h-4.5 text-white/80" />
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 space-y-3 pt-10">
            {["7 dias grátis para testar", "Sem cartão de crédito agora", "Cancele em um clique no painel", "Templates prontos para o seu segmento"].map((t) => (
              <div key={t} className="flex items-center gap-3 text-[13px] font-medium text-white/70">
                <CheckCircle2 className="w-4 h-4 text-[#5eead4] shrink-0" /> {t}
              </div>
            ))}
          </div>
        </div>

        {/* LADO DIREITO — FORMULÁRIO */}
        <div className="p-8 lg:p-11 flex flex-col justify-center">
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h3 className="text-2xl font-bold tracking-[-0.02em]">Criar conta</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">7 dias grátis para testar. Sem cartão agora.</p>
            </div>

            {selectedPlan && (
              <div className={`rounded-2xl ${glass} p-4 flex items-center gap-3`}>
                <div className="h-10 w-10 rounded-xl bg-[#2563EB] text-white grid place-items-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-[#2563EB] uppercase tracking-wide">Plano escolhido</p>
                  <p className="text-sm font-semibold truncate">
                    {selectedPlan.name} — 7 dias grátis, depois R$ {selectedPlan.priceMonthly}/mês
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">Nome completo</Label>
                <Input placeholder="Seu nome" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={field} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">Nome do seu negócio</Label>
                <Input placeholder="Ex.: Studio Bem-Estar" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className={field} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">WhatsApp</Label>
                  <Input placeholder="11 99999-9999" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={field} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">Senha</Label>
                  <Input type="password" placeholder="mín. 8 caracteres" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className={field} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">E-mail</Label>
                <Input placeholder="seu@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={field} />
              </div>
            </div>

            <Button
              onClick={handleRegister}
              disabled={loading}
              className="w-full h-14 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-2xl font-semibold text-base gap-2 shadow-[0_14px_34px_-8px_rgba(37,99,235,0.5)] border-none"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Começar teste grátis <ArrowRight className="w-4 h-4" /></>}
            </Button>

            <p className="text-xs text-center text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
              Ao criar a conta você concorda com os Termos de Uso e a Política de Privacidade.
            </p>

            <div className="text-center pt-1">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Já tem conta? <Link to="/login" className="text-[#2563EB] font-semibold hover:underline">Fazer login</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
