import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/lib/useTheme";
import {
  Stethoscope, Sparkles, Dumbbell, Briefcase, UtensilsCrossed, HelpCircle,
  ArrowRight, ArrowLeft, Check, Loader2, Smartphone, Bot, MessageCircleQuestion, Sun, Moon,
} from "lucide-react";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const glass =
  "bg-white/70 dark:bg-white/[0.05] backdrop-blur-xl border border-slate-200/70 dark:border-white/10";
const field =
  "rounded-xl bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 focus-visible:ring-2 focus-visible:ring-[#2563EB]/30";

const VERTICALS = [
  { id: "CLINIC", label: "Clínica de saúde", hint: "Odonto, médica, veterinária, fisio, psicologia", icon: Stethoscope, example: "Consulta, retorno, procedimentos, convênios" },
  { id: "BEAUTY", label: "Beleza e estética", hint: "Salão, barbearia, spa, manicure", icon: Sparkles, example: "Corte, coloração, escova, design de sobrancelha" },
  { id: "FITNESS", label: "Fitness", hint: "Academia, personal, pilates, crossfit, yoga", icon: Dumbbell, example: "Aula experimental, avaliação física, planos mensais" },
  { id: "SERVICES", label: "Serviços profissionais", hint: "Advocacia, contabilidade, consultoria, coaching", icon: Briefcase, example: "Consulta inicial, reunião de diagnóstico" },
  { id: "RESTAURANT", label: "Restaurante", hint: "Reservas, cardápio, eventos", icon: UtensilsCrossed, example: "Reserva de mesa, eventos privados, encomendas" },
  { id: "OTHER", label: "Outro", hint: "Configuração manual", icon: HelpCircle, example: "Você personaliza tudo" },
];

function authHeaders() {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDark, toggle } = useTheme();

  const [step, setStep] = useState(0);
  const [vertical, setVertical] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>({ businessAbout: "", businessAddress: "", businessPayment: "" });
  const [hours, setHours] = useState(
    WEEKDAYS.map((_, wd) => ({ weekday: wd, openTime: wd === 0 ? "" : "09:00", closeTime: wd === 0 ? "" : "18:00", isClosed: wd === 0 }))
  );
  const [saving, setSaving] = useState(false);

  // Se o tenant já configurou vertical, redireciona para o dashboard.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/business", { headers: authHeaders() });
        const d = await res.json();
        if (d?.profile?.businessType) navigate("/dashboard");
      } catch {
        /* segue com o wizard mesmo se falhar */
      }
    })();
  }, [navigate]);

  const canAdvance = useMemo(() => {
    if (step === 0) return !!vertical;
    return true;
  }, [step, vertical]);

  const finish = async () => {
    if (!vertical) return;
    setSaving(true);
    try {
      await fetch("/api/business/profile", { method: "PUT", headers: authHeaders(), body: JSON.stringify({ ...profile, businessType: vertical }) });
      await fetch("/api/business/hours", { method: "PUT", headers: authHeaders(), body: JSON.stringify({ hours }) });
      await fetch("/api/business/apply-template", { method: "POST", headers: authHeaders(), body: JSON.stringify({ businessType: vertical }) });
      toast({ title: "Tudo pronto!", description: "Seu agente já tem uma base para começar. Vamos conectar o WhatsApp?" });
      navigate("/dashboard");
    } catch (e) {
      toast({ title: "Erro ao concluir onboarding", variant: "destructive" });
    }
    setSaving(false);
  };

  const V = VERTICALS.find((v) => v.id === vertical);

  return (
    <div className="min-h-screen bg-white dark:bg-[#05070F] text-slate-900 dark:text-slate-100 font-sans flex flex-col relative overflow-hidden">
      <style>{`
        @keyframes drift{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(46px,36px) scale(1.1)}66%{transform:translate(-38px,22px) scale(.94)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .an-drift{animation:drift 24s ease-in-out infinite}.an-up{animation:fadeUp .5s cubic-bezier(.22,1,.36,1) both}
        @media (prefers-reduced-motion: reduce){.an-drift,.an-up{animation:none!important}}
      `}</style>

      {/* Aurora */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="an-drift absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full blur-[150px] bg-[#2563EB]/12 dark:bg-[#3b6cff]/20" />
        <div className="an-drift absolute -bottom-40 right-0 w-[480px] h-[480px] rounded-full blur-[150px] bg-[#a855f7]/10 dark:bg-[#a855f7]/18" style={{ animationDelay: "-8s" }} />
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-30 ${glass} border-b`}>
        <div className="mx-auto max-w-4xl px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#7c5cff] shadow-lg shadow-[#2563EB]/30" />
            <span className="text-sm font-bold tracking-tight">Configurar o seu negócio</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">Passo {step + 1} de 3</span>
            <button onClick={toggle} className={`p-2 rounded-xl ${glass}`} title={isDark ? "Modo claro" : "Modo escuro"} aria-label="Alternar tema">
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </div>
        <div className="h-1 bg-slate-200/70 dark:bg-white/10">
          <div className="h-full bg-gradient-to-r from-[#2563EB] to-[#7c5cff] transition-all" style={{ width: `${((step + 1) / 3) * 100}%` }} />
        </div>
      </header>

      <main className="flex-1 relative z-10">
        <div className="mx-auto max-w-4xl px-6 py-10">
          {/* STEP 1 */}
          {step === 0 && (
            <section className="space-y-8 an-up">
              <div>
                <h1 className="text-2xl md:text-4xl font-bold tracking-[-0.03em] text-balance">Que tipo de negócio você tem?</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">Vamos preparar o agente com serviços, FAQ e vocabulário certos para o seu setor.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {VERTICALS.map((v) => {
                  const Icon = v.icon;
                  const active = vertical === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setVertical(v.id)}
                      className={`text-left rounded-2xl p-5 transition-all ${
                        active
                          ? "border-2 border-[#2563EB] bg-[#2563EB]/5 dark:bg-[#2563EB]/10"
                          : `${glass} hover:border-[#2563EB]/40 hover:-translate-y-0.5`
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`h-11 w-11 shrink-0 rounded-xl grid place-items-center ${active ? "bg-[#2563EB] text-white" : "bg-slate-100 dark:bg-white/10 text-[#2563EB]"}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">{v.label}</h3>
                            {active && <div className="h-5 w-5 rounded-full bg-[#2563EB] text-white grid place-items-center"><Check className="h-3 w-3" /></div>}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{v.hint}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">Ex.: {v.example}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* STEP 2 */}
          {step === 1 && (
            <section className="space-y-8 an-up">
              <div>
                <h1 className="text-2xl md:text-4xl font-bold tracking-[-0.03em] text-balance">Conte um pouco sobre o seu {V?.label?.toLowerCase() || "negócio"}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">Esses dados alimentam o agente. Você pode ajustar tudo depois em "Meu Negócio".</p>
              </div>

              <div className={`rounded-2xl ${glass} p-6 space-y-4`}>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Apresentação (o que você faz)</Label>
                  <Textarea rows={3} value={profile.businessAbout} onChange={(e) => setProfile({ ...profile, businessAbout: e.target.value })} placeholder="Ex.: Studio especializado em coloração e alisamento, com 8 anos no bairro..." className={field} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Endereço</Label>
                    <Input value={profile.businessAddress} onChange={(e) => setProfile({ ...profile, businessAddress: e.target.value })} placeholder="Rua, número, bairro, cidade" className={field} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Formas de pagamento aceitas</Label>
                    <Input value={profile.businessPayment} onChange={(e) => setProfile({ ...profile, businessPayment: e.target.value })} placeholder="Dinheiro, Pix, cartão em até 6x" className={field} />
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl ${glass} p-6`}>
                <h2 className="text-sm font-semibold mb-4">Horário de atendimento</h2>
                <div className="space-y-2.5">
                  {hours.map((h, i) => (
                    <div key={h.weekday} className="flex items-center gap-3">
                      <span className="w-10 text-sm font-medium">{WEEKDAYS[h.weekday]}</span>
                      <Switch checked={!h.isClosed} onCheckedChange={(v) => { const n = [...hours]; n[i] = { ...h, isClosed: !v }; setHours(n); }} />
                      {h.isClosed ? (
                        <span className="text-sm text-slate-400 dark:text-slate-500">Fechado</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input type="time" className={`w-28 ${field}`} value={h.openTime || ""} onChange={(e) => { const n = [...hours]; n[i] = { ...h, openTime: e.target.value }; setHours(n); }} />
                          <span className="text-slate-400 dark:text-slate-500 text-sm">às</span>
                          <Input type="time" className={`w-28 ${field}`} value={h.closeTime || ""} onChange={(e) => { const n = [...hours]; n[i] = { ...h, closeTime: e.target.value }; setHours(n); }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* STEP 3 */}
          {step === 2 && (
            <section className="space-y-8 an-up">
              <div>
                <h1 className="text-2xl md:text-4xl font-bold tracking-[-0.03em] text-balance">Tudo certo!</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">Vamos aplicar o template do seu setor — serviços e perguntas frequentes de exemplo que você pode ajustar depois.</p>
              </div>

              <div className={`rounded-2xl ${glass} p-6 space-y-5`}>
                <div className="flex items-center gap-3">
                  {V && <div className="h-11 w-11 rounded-xl grid place-items-center bg-[#2563EB]/10 text-[#2563EB]"><V.icon className="h-5 w-5" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{V?.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{V?.hint}</p>
                  </div>
                </div>

                <ul className="space-y-2.5 text-sm">
                  {["Vocabulário do painel adaptado à sua vertical", "Serviços de exemplo pré-cadastrados", "Perguntas frequentes prontas para o agente", "Prompt-base com metodologia SDR (SPIN + LAER)"].map((t) => (
                    <li key={t} className="flex items-center gap-2.5"><Check className="h-4 w-4 text-[#2563EB] shrink-0" /> {t}</li>
                  ))}
                </ul>
              </div>

              <div className={`rounded-2xl ${glass} p-6`}>
                <h2 className="text-sm font-semibold mb-4">Depois disso, você precisa:</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <NextStep icon={<Smartphone className="h-4 w-4" />} label="Conectar o WhatsApp" />
                  <NextStep icon={<Bot className="h-4 w-4" />} label="Criar seu agente de IA" />
                  <NextStep icon={<MessageCircleQuestion className="h-4 w-4" />} label="Ajustar serviços e FAQ" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">A gente te leva direto para essas telas depois.</p>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Footer navegação */}
      <footer className={`sticky bottom-0 z-30 ${glass} border-t`}>
        <div className="mx-auto max-w-4xl px-6 py-3.5 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <Button disabled={!canAdvance} onClick={() => setStep(step + 1)} className="gap-2 h-12 px-6 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold border-none shadow-lg shadow-[#2563EB]/25">
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={saving} className="gap-2 h-12 px-6 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold border-none shadow-lg shadow-[#2563EB]/25">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Concluir e ir para o painel
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function NextStep({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl bg-white/70 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/10 p-3 flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-[#2563EB]/10 text-[#2563EB] grid place-items-center">{icon}</div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
