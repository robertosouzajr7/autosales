import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ArrowRight, Loader2, Sparkles, MessageSquare, Instagram, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthShell, glass } from "@/components/auth/AuthShell";

/**
 * Mesma regra do servidor (SignupPolicy). Repetida aqui de propósito: a
 * tela precisa reagir enquanto se digita, e o servidor precisa recusar
 * mesmo que alguém pule a tela.
 */
function avaliarSenha(senha: string, nome: string, email: string) {
  const s = senha || "";
  const criterios = [
    { ok: s.length >= 8, texto: "8 caracteres ou mais" },
    { ok: /[a-z]/.test(s) && /[A-Z]/.test(s), texto: "maiúscula e minúscula" },
    { ok: /\d/.test(s), texto: "pelo menos um número" },
    { ok: /[^A-Za-z0-9]/.test(s), texto: "um símbolo (opcional, mas ajuda)", opcional: true },
  ];
  const local = String(email || "").split("@")[0].toLowerCase();
  const primeiro = String(nome || "").trim().split(/\s+/)[0]?.toLowerCase();
  const contemDados =
    (local.length >= 4 && s.toLowerCase().includes(local)) ||
    (primeiro && primeiro.length >= 4 && s.toLowerCase().includes(primeiro));

  const obrigatorios = criterios.filter((c) => !c.opcional);
  const ok = obrigatorios.every((c) => c.ok) && !contemDados;
  const forca = criterios.filter((c) => c.ok).length;
  return { ok, forca, criterios, contemDados };
}

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
  const senha = avaliarSenha(formData.password, formData.name, formData.email);
  const [aceitou, setAceitou] = useState(false);
  const emailValido = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(formData.email.trim());

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
    if (!emailValido) {
      return toast({ title: "E-mail inválido", description: "Confira o endereço — é por ele que você recebe o acesso.", variant: "destructive" });
    }
    if (!senha.ok) {
      return toast({
        title: "Senha fraca",
        description: senha.contemDados
          ? "A senha não pode conter seu nome ou e-mail."
          : "Use ao menos 8 caracteres, com maiúscula, minúscula e número.",
        variant: "destructive",
      });
    }

    if (!aceitou) {
      return toast({
        title: "Falta aceitar os termos",
        description: "Leia e marque o aceite dos Termos de Uso e da Política de Privacidade.",
        variant: "destructive",
      });
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          acceptedTerms: true,
          // Respostas do questionário de contratação, quando veio de lá.
          onboarding: (() => {
            try { return JSON.parse(sessionStorage.getItem("respostasOnboarding") || "null"); }
            catch { return null; }
          })(),
        }),
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
        // O e-mail precisa ser confirmado antes de operar, então a próxima
        // tela é a de confirmação — com o plano guardado para depois.
        const plan = formData.planId || params.get("plan");
        if (plan) sessionStorage.setItem("planoPendente", plan);
        navigate(`/verify-email?aguardando=${encodeURIComponent(formData.email)}`);
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
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">E-mail</Label>
                  <Input placeholder="seu@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={field} />
                </div>
              </div>
              {/* Senha ocupa a linha inteira: a lista de critérios não cabe em meia coluna. */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">Senha</Label>
                <Input type="password" placeholder="mín. 8 caracteres" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className={field} />
                {formData.password && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i < senha.forca
                              ? senha.forca <= 2 ? "bg-amber-500" : "bg-emerald-500"
                              : "bg-slate-200 dark:bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {senha.criterios.map((c) => (
                        <li key={c.texto} className={`text-[11px] ${c.ok ? "text-emerald-600" : "text-slate-400"}`}>
                          {c.ok ? "✓" : "○"} {c.texto}
                        </li>
                      ))}
                      {senha.contemDados && (
                        <li className="col-span-2 text-[11px] text-rose-500">✗ não use seu nome nem seu e-mail na senha</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Aceite explícito: marcar uma caixa é ato, ler uma frase abaixo
                do botão não é. É isso que fica gravado como prova. */}
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
              <input
                type="checkbox"
                checked={aceitou}
                onChange={(e) => setAceitou(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-[#2563EB] dark:border-white/20"
              />
              <span className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Li e aceito os{" "}
                <Link to="/termos" target="_blank" className="font-semibold text-[#2563EB] hover:underline">
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link to="/privacidade" target="_blank" className="font-semibold text-[#2563EB] hover:underline">
                  Política de Privacidade
                </Link>
                , incluindo o tratamento dos meus dados como descrito nela.
              </span>
            </label>

            <Button
              onClick={handleRegister}
              disabled={loading || !aceitou}
              className="w-full h-14 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-2xl font-semibold text-base gap-2 shadow-[0_14px_34px_-8px_rgba(37,99,235,0.5)] border-none disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Começar teste grátis <ArrowRight className="w-4 h-4" /></>}
            </Button>

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
