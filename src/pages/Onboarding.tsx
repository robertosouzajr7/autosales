import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Stethoscope, Sparkles, Dumbbell, Briefcase, UtensilsCrossed, HelpCircle,
  ArrowRight, ArrowLeft, Check, Loader2, Smartphone, Bot, Building2, MessageCircleQuestion,
} from "lucide-react";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const VERTICALS = [
  {
    id: "CLINIC",
    label: "Clínica de saúde",
    hint: "Odonto, médica, veterinária, fisio, psicologia",
    icon: Stethoscope,
    example: "Consulta, retorno, procedimentos, convênios",
  },
  {
    id: "BEAUTY",
    label: "Beleza e estética",
    hint: "Salão, barbearia, spa, manicure",
    icon: Sparkles,
    example: "Corte, coloração, escova, design de sobrancelha",
  },
  {
    id: "FITNESS",
    label: "Fitness",
    hint: "Academia, personal, pilates, crossfit, yoga",
    icon: Dumbbell,
    example: "Aula experimental, avaliação física, planos mensais",
  },
  {
    id: "SERVICES",
    label: "Serviços profissionais",
    hint: "Advocacia, contabilidade, consultoria, coaching",
    icon: Briefcase,
    example: "Consulta inicial, reunião de diagnóstico",
  },
  {
    id: "RESTAURANT",
    label: "Restaurante",
    hint: "Reservas, cardápio, eventos",
    icon: UtensilsCrossed,
    example: "Reserva de mesa, eventos privados, encomendas",
  },
  {
    id: "OTHER",
    label: "Outro",
    hint: "Configuração manual",
    icon: HelpCircle,
    example: "Você personaliza tudo",
  },
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

  const [step, setStep] = useState(0);
  const [vertical, setVertical] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>({
    businessAbout: "",
    businessAddress: "",
    businessPayment: "",
  });
  const [hours, setHours] = useState(
    WEEKDAYS.map((_, wd) => ({
      weekday: wd,
      openTime: wd === 0 ? "" : "09:00",
      closeTime: wd === 0 ? "" : "18:00",
      isClosed: wd === 0,
    }))
  );
  const [saving, setSaving] = useState(false);

  // Se o tenant já configurou vertical, redireciona para o dashboard.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/business", { headers: authHeaders() });
        const d = await res.json();
        if (d?.profile?.businessType) {
          navigate("/dashboard");
        }
      } catch {
        /* segue com o wizard mesmo se falhar */
      }
    })();
  }, [navigate]);

  const canAdvance = useMemo(() => {
    if (step === 0) return !!vertical;
    if (step === 1) return true;
    return true;
  }, [step, vertical]);

  const finish = async () => {
    if (!vertical) return;
    setSaving(true);
    try {
      // 1) Salva perfil (inclui businessType).
      await fetch("/api/business/profile", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ ...profile, businessType: vertical }),
      });
      // 2) Salva horários.
      await fetch("/api/business/hours", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ hours }),
      });
      // 3) Aplica template (sem sobrescrever).
      await fetch("/api/business/apply-template", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ businessType: vertical }),
      });
      toast({
        title: "Tudo pronto!",
        description: "Seu agente já tem uma base para começar. Vamos conectar o WhatsApp?",
      });
      navigate("/dashboard");
    } catch (e) {
      toast({ title: "Erro ao concluir onboarding", variant: "destructive" });
    }
    setSaving(false);
  };

  const V = VERTICALS.find((v) => v.id === vertical);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-foreground">Configurar o seu negócio</span>
          </div>
          <div className="text-xs text-muted-foreground">Passo {step + 1} de 3</div>
        </div>
        {/* Barra de progresso */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((step + 1) / 3) * 100}%` }}
          />
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-10">
          {/* STEP 1: escolher vertical */}
          {step === 0 && (
            <section className="space-y-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
                  Que tipo de negócio você tem?
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Vamos preparar o agente com serviços, FAQ e vocabulário certos para o seu setor.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {VERTICALS.map((v) => {
                  const Icon = v.icon;
                  const active = vertical === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setVertical(v.id)}
                      className={`text-left rounded-2xl border p-5 transition-all ${
                        active
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`h-11 w-11 shrink-0 rounded-xl grid place-items-center ${
                            active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-foreground">{v.label}</h3>
                            {active && (
                              <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{v.hint}</p>
                          <p className="text-xs text-muted-foreground/80 mt-2 italic">
                            Ex.: {v.example}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* STEP 2: perfil básico + horários */}
          {step === 1 && (
            <section className="space-y-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
                  Conte um pouco sobre o seu {V?.label?.toLowerCase() || "negócio"}
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Esses dados alimentam o agente. Você pode ajustar tudo depois em "Meu Negócio".
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Apresentação (o que você faz)</Label>
                  <Textarea
                    rows={3}
                    value={profile.businessAbout}
                    onChange={(e) => setProfile({ ...profile, businessAbout: e.target.value })}
                    placeholder="Ex.: Salão especializado em coloração e alisamento, com 8 anos no bairro..."
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Endereço</Label>
                    <Input
                      value={profile.businessAddress}
                      onChange={(e) => setProfile({ ...profile, businessAddress: e.target.value })}
                      placeholder="Rua, número, bairro, cidade"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Formas de pagamento aceitas</Label>
                    <Input
                      value={profile.businessPayment}
                      onChange={(e) => setProfile({ ...profile, businessPayment: e.target.value })}
                      placeholder="Dinheiro, Pix, cartão em até 6x"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="text-sm font-semibold text-foreground mb-3">Horário de atendimento</h2>
                <div className="space-y-2">
                  {hours.map((h, i) => (
                    <div key={h.weekday} className="flex items-center gap-3">
                      <span className="w-10 text-sm text-foreground">{WEEKDAYS[h.weekday]}</span>
                      <Switch
                        checked={!h.isClosed}
                        onCheckedChange={(v) => {
                          const n = [...hours];
                          n[i] = { ...h, isClosed: !v };
                          setHours(n);
                        }}
                      />
                      {h.isClosed ? (
                        <span className="text-sm text-muted-foreground">Fechado</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            className="w-28"
                            value={h.openTime || ""}
                            onChange={(e) => {
                              const n = [...hours];
                              n[i] = { ...h, openTime: e.target.value };
                              setHours(n);
                            }}
                          />
                          <span className="text-muted-foreground text-sm">às</span>
                          <Input
                            type="time"
                            className="w-28"
                            value={h.closeTime || ""}
                            onChange={(e) => {
                              const n = [...hours];
                              n[i] = { ...h, closeTime: e.target.value };
                              setHours(n);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* STEP 3: revisão + próximos passos */}
          {step === 2 && (
            <section className="space-y-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Tudo certo!</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Vamos aplicar o template do seu setor — serviços e perguntas frequentes de exemplo
                  que você pode ajustar depois.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  {V && (
                    <div className="h-11 w-11 rounded-xl grid place-items-center bg-primary/10 text-primary">
                      <V.icon className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{V?.label}</p>
                    <p className="text-xs text-muted-foreground">{V?.hint}</p>
                  </div>
                </div>

                <ul className="space-y-2 text-sm text-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> Vocabulário do painel adaptado à sua vertical
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> Serviços de exemplo pré-cadastrados
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> Perguntas frequentes prontas para o agente
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> Prompt-base com metodologia SDR (SPIN + LAER)
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="text-sm font-semibold text-foreground mb-3">Depois disso, você precisa:</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <NextStep icon={<Smartphone className="h-4 w-4" />} label="Conectar o WhatsApp" />
                  <NextStep icon={<Bot className="h-4 w-4" />} label="Criar seu agente de IA" />
                  <NextStep icon={<MessageCircleQuestion className="h-4 w-4" />} label="Ajustar serviços e FAQ" />
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  A gente te leva direto para essas telas depois.
                </p>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Footer navegação */}
      <footer className="border-t border-border bg-card sticky bottom-0">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <Button
              disabled={!canAdvance}
              onClick={() => setStep(step + 1)}
              className="gap-2"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Concluir e ir para o painel
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function NextStep({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 flex items-center gap-2">
      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
        {icon}
      </div>
      <span className="text-sm text-foreground">{label}</span>
    </div>
  );
}
