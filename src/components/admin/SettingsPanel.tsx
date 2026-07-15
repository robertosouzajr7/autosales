import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import { CreditCard, Globe, Loader2, ShieldCheck, Save } from "lucide-react";

export function SettingsPanel({ sdrs, plans }: { sdrs: any[]; plans: any[] }) {
  const { toast } = useToast();

  // Gateway
  const [gw, setGw] = useState<any>(null);
  const [mpToken, setMpToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [trialDays, setTrialDays] = useState<number | string>(7);
  const [savingGw, setSavingGw] = useState(false);

  // Landing CMS
  const [lp, setLp] = useState<any>({
    logoUrl: "", contactWhatsApp: "", contactEmail: "", contactInstagram: "",
    selectedSdrId: "", visiblePlanIds: "",
  });
  const [savingLp, setSavingLp] = useState(false);

  const load = async () => {
    const [gwRes, lpRes] = await Promise.all([
      adminApi.get("/api/admin/platform-settings"),
      adminApi.get("/api/admin/landing-settings"),
    ]);
    if (gwRes.ok) {
      setGw(gwRes.data);
      setTrialDays(gwRes.data.defaultTrialDays ?? 7);
    }
    if (lpRes.ok && lpRes.data) setLp((prev: any) => ({ ...prev, ...lpRes.data }));
  };
  useEffect(() => { load(); }, []);

  const saveGateway = async () => {
    setSavingGw(true);
    const res = await adminApi.put("/api/admin/platform-settings", {
      mpAccessToken: mpToken || undefined,
      paymentWebhookSecret: webhookSecret || undefined,
      defaultTrialDays: trialDays,
    });
    setSavingGw(false);
    if (res.ok) {
      toast({ title: "Configurações salvas" });
      setMpToken("");
      setWebhookSecret("");
      load();
    } else {
      toast({ title: "Erro ao salvar", description: res.data?.error, variant: "destructive" });
    }
  };

  const saveLanding = async () => {
    setSavingLp(true);
    const res = await adminApi.put("/api/admin/landing-settings", lp);
    setSavingLp(false);
    if (res.ok) toast({ title: "Landing page atualizada" });
    else toast({ title: "Erro ao salvar", description: res.data?.error, variant: "destructive" });
  };

  const togglePlanVisible = (planId: string) => {
    const ids = (lp.visiblePlanIds || "").split(",").filter(Boolean);
    const next = ids.includes(planId) ? ids.filter((i: string) => i !== planId) : [...ids, planId];
    setLp({ ...lp, visiblePlanIds: next.join(",") });
  };

  return (
    <div className="space-y-6">
      {/* GATEWAY DE PAGAMENTO */}
      <Card className="rounded-2xl border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Gateway de pagamento (Mercado Pago)</h3>
            <p className="text-xs text-muted-foreground">O valor salvo aqui tem precedência sobre a variável de ambiente.</p>
          </div>
          {gw?.mpConfigured ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-none">Configurado</Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 border-none">Pendente</Badge>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Access Token {gw?.mpAccessTokenMasked && <span className="font-mono">({gw.mpAccessTokenMasked})</span>}
            </Label>
            <Input
              type="password"
              placeholder="Cole um novo token para substituir"
              value={mpToken}
              onChange={(e) => setMpToken(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Webhook Secret {gw?.webhookSecretMasked && <span className="font-mono">({gw.webhookSecretMasked})</span>}
            </Label>
            <Input
              type="password"
              placeholder="Segredo HMAC do webhook"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dias de trial padrão</Label>
            <Input type="number" min={1} max={90} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} className="max-w-[120px]" />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveGateway} disabled={savingGw} className="gap-2">
              {savingGw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar gateway
            </Button>
          </div>
        </div>

        <div className="rounded-xl bg-muted p-3 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Segredos nunca são exibidos em claro — apenas a máscara. Deixe o campo vazio para manter o valor atual.</span>
        </div>
      </Card>

      {/* LANDING PAGE CMS */}
      <Card className="rounded-2xl border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Landing page</h3>
            <p className="text-xs text-muted-foreground">Contatos, logo e o que aparece na página pública.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">URL do logo</Label>
            <Input value={lp.logoUrl || ""} onChange={(e) => setLp({ ...lp, logoUrl: e.target.value })} placeholder="https://…/logo.png" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">WhatsApp de contato</Label>
            <Input value={lp.contactWhatsApp || ""} onChange={(e) => setLp({ ...lp, contactWhatsApp: e.target.value })} placeholder="5511999999999" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">E-mail de contato</Label>
            <Input value={lp.contactEmail || ""} onChange={(e) => setLp({ ...lp, contactEmail: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Instagram</Label>
            <Input value={lp.contactInstagram || ""} onChange={(e) => setLp({ ...lp, contactInstagram: e.target.value })} placeholder="@agentesvirtuais" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Agente do chat da landing</Label>
            <Select value={lp.selectedSdrId || ""} onValueChange={(v) => setLp({ ...lp, selectedSdrId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar agente…" /></SelectTrigger>
              <SelectContent>
                {sdrs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Planos visíveis na landing</Label>
          <div className="flex flex-wrap gap-2">
            {plans.map((p) => {
              const visible = (lp.visiblePlanIds || "").split(",").includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlanVisible(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    visible ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={saveLanding} disabled={savingLp} className="gap-2">
            {savingLp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar landing
          </Button>
        </div>
      </Card>
    </div>
  );
}
