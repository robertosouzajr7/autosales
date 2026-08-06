import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import { Textarea } from "@/components/ui/textarea";
import { Bot, CreditCard, Globe, Loader2, ShieldCheck, Save, Coins, Mic, RefreshCw, Megaphone, Plus, Quote, Star, Trash2 } from "lucide-react";

const brl = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function SettingsPanel({ sdrs, plans }: { sdrs: any[]; plans: any[] }) {
  const { toast } = useToast();

  // Gateway
  const [gw, setGw] = useState<any>(null);
  const [provider, setProvider] = useState("MERCADO_PAGO");
  const [mpToken, setMpToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [stripeKey, setStripeKey] = useState("");
  const [stripeWebhook, setStripeWebhook] = useState("");
  const [stripePublishable, setStripePublishable] = useState("");
  const [trialDays, setTrialDays] = useState<number | string>(7);
  const [savingGw, setSavingGw] = useState(false);

  // Motor de IA (multi-provedor)
  const [aiProvider, setAiProvider] = useState("GEMINI");
  const [aiModel, setAiModel] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [savingAi, setSavingAi] = useState(false);

  // Motor de VOZ (global): provedor, chave e vozes liberadas para as contas
  const [voiceProvider, setVoiceProvider] = useState("GEMINI");
  const [elevenKey, setElevenKey] = useState("");
  const [providerVoices, setProviderVoices] = useState<any[]>([]);
  const [enabledVoices, setEnabledVoices] = useState<any[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [savingVoice, setSavingVoice] = useState(false);

  // Precificação de tokens (câmbio + markup padrão) e tabela de custo real
  const [usdToBrl, setUsdToBrl] = useState<number | string>(5.5);
  const [tokenMarkup, setTokenMarkup] = useState<number | string>(5);
  const [pricing, setPricing] = useState<any>(null);
  const [savingPricing, setSavingPricing] = useState(false);

  // Custo de disparo no WhatsApp: tarifa da Meta por categoria (USD) e a
  // margem aplicada em cima. É o que define o preço da franquia dos planos.
  const [waRates, setWaRates] = useState<any>({ MARKETING: 0.0625, UTILITY: 0.0068, AUTHENTICATION: 0.0068, SERVICE: 0 });
  const [waMarkup, setWaMarkup] = useState<number | string>(2);
  const [baileysCost, setBaileysCost] = useState<number | string>(0);
  const [savingWa, setSavingWa] = useState(false);

  // Landing CMS
  const [lp, setLp] = useState<any>({
    logoUrl: "", contactWhatsApp: "", contactEmail: "", contactInstagram: "",
    selectedSdrId: "", visiblePlanIds: "",
  });
  const [savingLp, setSavingLp] = useState(false);

  // Depoimentos da landing. Ficam em estado próprio porque na tela são uma
  // lista editável, e viram JSON só na hora de salvar.
  const [depoimentos, setDepoimentos] = useState<any[]>([]);

  const load = async () => {
    const [gwRes, lpRes, prRes] = await Promise.all([
      adminApi.get("/api/admin/platform-settings"),
      adminApi.get("/api/admin/landing-settings"),
      adminApi.get("/api/admin/token-pricing"),
    ]);
    if (gwRes.ok) {
      setGw(gwRes.data);
      setProvider(gwRes.data.paymentProvider || "MERCADO_PAGO");
      setTrialDays(gwRes.data.defaultTrialDays ?? 7);
      setAiProvider(gwRes.data.aiProvider || "GEMINI");
      setAiModel(gwRes.data.aiModel || "");
      setUsdToBrl(gwRes.data.usdToBrl ?? 5.5);
      setTokenMarkup(gwRes.data.tokenMarkup ?? 5);
      if (gwRes.data.waRates) setWaRates(gwRes.data.waRates);
      setWaMarkup(gwRes.data.waMarkup ?? 2);
      setBaileysCost(gwRes.data.baileysNumberCost ?? 0);
      setVoiceProvider(gwRes.data.voiceProvider || "GEMINI");
      setEnabledVoices(gwRes.data.enabledVoices || []);
    }
    if (lpRes.ok && lpRes.data) {
      setLp((prev: any) => ({ ...prev, ...lpRes.data }));
      try {
        const lista = JSON.parse(lpRes.data.testimonials || "[]");
        setDepoimentos(Array.isArray(lista) ? lista : []);
      } catch { setDepoimentos([]); }
    }
    if (prRes.ok) setPricing(prRes.data);
  };
  useEffect(() => { load(); }, []);

  // Carrega as vozes do provedor ativo (ElevenLabs via chave global).
  const loadVoices = async () => {
    setVoicesLoading(true);
    const res = await adminApi.get("/api/admin/voices");
    if (res.ok) {
      setProviderVoices(res.data?.voices || []);
      if (res.data?.error) toast({ title: "Vozes", description: res.data.error, variant: "destructive" });
    }
    setVoicesLoading(false);
  };
  useEffect(() => { loadVoices(); }, [voiceProvider]);

  const toggleVoice = (v: any) => {
    const exists = enabledVoices.some((e: any) => e.id === v.id);
    setEnabledVoices(exists
      ? enabledVoices.filter((e: any) => e.id !== v.id)
      : [...enabledVoices, { id: v.id, name: v.name }]);
  };

  const saveVoice = async () => {
    setSavingVoice(true);
    const res = await adminApi.put("/api/admin/platform-settings", {
      voiceProvider,
      elevenLabsApiKey: elevenKey || undefined,
      enabledVoices,
    });
    setSavingVoice(false);
    if (res.ok) {
      toast({ title: "Motor de voz atualizado" });
      setElevenKey("");
      load();
      loadVoices();
    } else {
      toast({ title: "Erro ao salvar", description: res.data?.error, variant: "destructive" });
    }
  };

  const savePricing = async () => {
    setSavingPricing(true);
    const res = await adminApi.put("/api/admin/platform-settings", {
      usdToBrl: Number(usdToBrl),
      tokenMarkup: Number(tokenMarkup),
    });
    setSavingPricing(false);
    if (res.ok) { toast({ title: "Precificação atualizada" }); load(); }
    else toast({ title: "Erro ao salvar", description: res.data?.error, variant: "destructive" });
  };

  const saveDispatch = async () => {
    setSavingWa(true);
    const res = await adminApi.put("/api/admin/platform-settings", {
      waRates: {
        MARKETING: Number(waRates.MARKETING),
        UTILITY: Number(waRates.UTILITY),
        AUTHENTICATION: Number(waRates.AUTHENTICATION),
        SERVICE: Number(waRates.SERVICE),
      },
      waMarkup: Number(waMarkup),
      baileysNumberCost: Number(baileysCost),
    });
    setSavingWa(false);
    if (res.ok) { toast({ title: "Precificação de disparo atualizada" }); load(); }
    else toast({ title: "Erro ao salvar", description: res.data?.error, variant: "destructive" });
  };

  const saveGateway = async () => {
    setSavingGw(true);
    const res = await adminApi.put("/api/admin/platform-settings", {
      paymentProvider: provider,
      mpAccessToken: mpToken || undefined,
      paymentWebhookSecret: webhookSecret || undefined,
      stripeSecretKey: stripeKey || undefined,
      stripeWebhookSecret: stripeWebhook || undefined,
      stripePublishableKey: stripePublishable || undefined,
      defaultTrialDays: trialDays,
    });
    setSavingGw(false);
    if (res.ok) {
      toast({ title: "Configurações salvas" });
      setMpToken("");
      setWebhookSecret("");
      setStripeKey("");
      setStripeWebhook("");
      setStripePublishable("");
      load();
    } else {
      toast({ title: "Erro ao salvar", description: res.data?.error, variant: "destructive" });
    }
  };

  const saveAI = async () => {
    setSavingAi(true);
    const res = await adminApi.put("/api/admin/platform-settings", {
      aiProvider,
      aiModel,
      geminiApiKey: geminiKey || undefined,
      openaiApiKey: openaiKey || undefined,
      anthropicApiKey: anthropicKey || undefined,
    });
    setSavingAi(false);
    if (res.ok) {
      toast({ title: "Motor de IA atualizado" });
      setGeminiKey("");
      setOpenaiKey("");
      setAnthropicKey("");
      load();
    } else {
      toast({ title: "Erro ao salvar", description: res.data?.error, variant: "destructive" });
    }
  };

  const modelCatalog: Record<string, string[]> = gw?.aiModelCatalog || {
    GEMINI: ["gemini-2.5-flash"],
    OPENAI: ["gpt-4o-mini"],
    ANTHROPIC: ["claude-opus-4-8"],
  };

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhook/${provider === "STRIPE" ? "stripe" : "payment"}` : "";

  const saveLanding = async () => {
    const incompletos = depoimentos.filter((d) => !d.nome?.trim() || !d.texto?.trim()).length;
    if (incompletos) {
      toast({
        title: "Depoimento sem nome ou sem texto",
        description: "O servidor descarta esses; preencha quem falou e o que foi dito.",
        variant: "destructive",
      });
      return;
    }
    setSavingLp(true);
    const res = await adminApi.put("/api/admin/landing-settings", { ...lp, testimonials: depoimentos });
    setSavingLp(false);
    if (res.ok) {
      toast({ title: "Landing page atualizada" });
      try {
        const lista = JSON.parse(res.data?.testimonials || "[]");
        setDepoimentos(Array.isArray(lista) ? lista : []);
      } catch { setDepoimentos([]); }
    } else toast({ title: "Erro ao salvar", description: res.data?.error, variant: "destructive" });
  };

  const mudarDepoimento = (i: number, campo: string, valor: any) =>
    setDepoimentos(depoimentos.map((d, k) => (k === i ? { ...d, [campo]: valor } : d)));

  const togglePlanVisible = (planId: string) => {
    const ids = (lp.visiblePlanIds || "").split(",").filter(Boolean);
    const next = ids.includes(planId) ? ids.filter((i: string) => i !== planId) : [...ids, planId];
    setLp({ ...lp, visiblePlanIds: next.join(",") });
  };

  return (
    <div className="space-y-6">
      {/* GATEWAY DE PAGAMENTO */}
      <Card className="rounded-2xl border-border p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Gateway de pagamento</h3>
            <p className="text-xs text-muted-foreground">Escolha o provedor ativo. O valor salvo aqui tem precedência sobre variáveis de ambiente.</p>
          </div>
        </div>

        {/* Seletor de provider */}
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { id: "MERCADO_PAGO", label: "Mercado Pago", hint: "PIX, boleto e cartão (BR)", ok: gw?.mpConfigured },
            { id: "STRIPE", label: "Stripe", hint: "Cartão internacional", ok: gw?.stripeConfigured },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProvider(p.id)}
              className={`text-left rounded-2xl border p-4 transition-all ${
                provider === p.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{p.label}</span>
                {p.ok
                  ? <Badge className="bg-emerald-100 text-emerald-700 border-none text-xs">Configurado</Badge>
                  : <Badge className="bg-amber-100 text-amber-800 border-none text-xs">Pendente</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{p.hint}</p>
              {provider === p.id && <p className="text-xs text-primary mt-2 font-medium">✓ Provedor ativo</p>}
            </button>
          ))}
        </div>

        {/* Campos do Mercado Pago */}
        {provider === "MERCADO_PAGO" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Access Token {gw?.mpAccessTokenMasked && <span className="font-mono">({gw.mpAccessTokenMasked})</span>}
              </Label>
              <Input type="password" placeholder="Cole um novo token para substituir" value={mpToken} onChange={(e) => setMpToken(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Webhook Secret {gw?.webhookSecretMasked && <span className="font-mono">({gw.webhookSecretMasked})</span>}
              </Label>
              <Input type="password" placeholder="Segredo HMAC do webhook" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
            </div>
          </div>
        )}

        {/* Campos do Stripe */}
        {provider === "STRIPE" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Secret Key {gw?.stripeSecretMasked && <span className="font-mono">({gw.stripeSecretMasked})</span>}
              </Label>
              <Input type="password" placeholder="sk_live_… ou sk_test_…" value={stripeKey} onChange={(e) => setStripeKey(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Webhook Signing Secret {gw?.stripeWebhookMasked && <span className="font-mono">({gw.stripeWebhookMasked})</span>}
              </Label>
              <Input type="password" placeholder="whsec_…" value={stripeWebhook} onChange={(e) => setStripeWebhook(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">
                Publishable Key {gw?.stripePublishableMasked && <span className="font-mono">({gw.stripePublishableMasked})</span>}
              </Label>
              <Input placeholder="pk_live_… ou pk_test_…" value={stripePublishable} onChange={(e) => setStripePublishable(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Usada no checkout embutido (exposta ao navegador — pode ser pública).</p>
            </div>
          </div>
        )}

        {/* URL do webhook para colar no painel do gateway */}
        <div className="rounded-xl bg-slate-950 text-slate-100 p-3 space-y-1">
          <p className="text-xs text-slate-400">URL do webhook (cole no painel do {provider === "STRIPE" ? "Stripe" : "Mercado Pago"}):</p>
          <p className="text-xs font-mono break-all">{webhookUrl}</p>
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

      {/* MOTOR DE IA (multi-provedor) */}
      <Card className="rounded-2xl border-border p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Motor de IA</h3>
            <p className="text-xs text-muted-foreground">Provedor e modelo usados pelos agentes em toda a plataforma. O valor salvo aqui tem precedência sobre chaves dos clientes e variáveis de ambiente.</p>
          </div>
        </div>

        {/* Seletor de provedor */}
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { id: "GEMINI", label: "Google Gemini", hint: "Família Gemini 2.x", ok: gw?.geminiKeyConfigured },
            { id: "OPENAI", label: "OpenAI (GPT)", hint: "GPT-4o, GPT-4.1, o4", ok: gw?.openaiKeyConfigured },
            { id: "ANTHROPIC", label: "Anthropic (Claude)", hint: "Claude Opus, Sonnet, Haiku", ok: gw?.anthropicKeyConfigured },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { setAiProvider(p.id); setAiModel(""); }}
              className={`text-left rounded-2xl border p-4 transition-all ${
                aiProvider === p.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{p.label}</span>
                {p.ok
                  ? <Badge className="bg-emerald-100 text-emerald-700 border-none text-xs">Chave OK</Badge>
                  : <Badge className="bg-amber-100 text-amber-800 border-none text-xs">Sem chave</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{p.hint}</p>
              {aiProvider === p.id && <p className="text-xs text-primary mt-2 font-medium">✓ Provedor ativo</p>}
            </button>
          ))}
        </div>

        {/* Modelo */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Modelo</Label>
            <Select value={aiModel || "__default__"} onValueChange={(v) => setAiModel(v === "__default__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Padrão do provedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Padrão do provedor (recomendado)</SelectItem>
                {(modelCatalog[aiProvider] || []).map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Vale para respostas do agente, ferramentas (agendamento, catálogo), classificação e e-mails.</p>
          </div>
        </div>

        {/* Chaves por provedor */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Chave Gemini {gw?.geminiKeyMasked && <span className="font-mono">({gw.geminiKeyMasked})</span>}
            </Label>
            <Input type="password" placeholder="AIza…" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Chave OpenAI {gw?.openaiKeyMasked && <span className="font-mono">({gw.openaiKeyMasked})</span>}
            </Label>
            <Input type="password" placeholder="sk-…" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Chave Anthropic {gw?.anthropicKeyMasked && <span className="font-mono">({gw.anthropicKeyMasked})</span>}
            </Label>
            <Input type="password" placeholder="sk-ant-…" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">Deixe a chave vazia para manter a atual. O provedor ativo precisa de uma chave configurada.</p>
          <Button onClick={saveAI} disabled={savingAi} className="gap-2">
            {savingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar IA
          </Button>
        </div>
      </Card>

      {/* MOTOR DE VOZ (global — igual à LLM) */}
      <Card className="rounded-2xl border-border p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Mic className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Motor de voz</h3>
            <p className="text-xs text-muted-foreground">Provedor e vozes usados pelos agentes. A chave é da plataforma — o cliente só escolhe entre as vozes que você liberar.</p>
          </div>
        </div>

        {/* Provedor */}
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { id: "ELEVENLABS", label: "ElevenLabs", hint: "Vozes naturais (premium)", ok: gw?.elevenLabsKeyConfigured },
            { id: "GEMINI", label: "Google Gemini", hint: "Incluso na chave do Gemini", ok: gw?.geminiKeyConfigured },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setVoiceProvider(p.id)}
              className={`text-left rounded-2xl border p-4 transition-all ${
                voiceProvider === p.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{p.label}</span>
                {p.ok
                  ? <Badge className="bg-emerald-100 text-emerald-700 border-none text-xs">Chave OK</Badge>
                  : <Badge className="bg-amber-100 text-amber-800 border-none text-xs">Sem chave</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{p.hint}</p>
              {voiceProvider === p.id && <p className="text-xs text-primary mt-2 font-medium">✓ Provedor ativo</p>}
            </button>
          ))}
        </div>

        {voiceProvider === "ELEVENLABS" && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Chave da ElevenLabs {gw?.elevenLabsKeyMasked && <span className="font-mono">({gw.elevenLabsKeyMasked})</span>}
            </Label>
            <Input type="password" placeholder="Cole uma nova chave para substituir" value={elevenKey} onChange={(e) => setElevenKey(e.target.value)} />
          </div>
        )}

        {/* Vozes liberadas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Vozes liberadas para as contas {enabledVoices.length > 0 && `(${enabledVoices.length} selecionada${enabledVoices.length > 1 ? "s" : ""})`}
            </Label>
            <button onClick={loadVoices} className="text-[11px] text-primary hover:underline flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${voicesLoading ? "animate-spin" : ""}`} /> Atualizar lista
            </button>
          </div>
          {providerVoices.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {voicesLoading ? "Carregando vozes…" : "Nenhuma voz disponível — configure a chave do provedor e atualize."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
              {providerVoices.map((v: any) => {
                const on = enabledVoices.some((e: any) => e.id === v.id);
                return (
                  <button
                    key={v.id}
                    onClick={() => toggleVoice(v)}
                    title={v.labels ? Object.values(v.labels).join(" · ") : v.name}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      on ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Nenhuma selecionada = todas as vozes do provedor ficam disponíveis.</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">A chave nunca é exposta ao cliente — ele vê apenas o nome das vozes liberadas.</p>
          <Button onClick={saveVoice} disabled={savingVoice} className="gap-2">
            {savingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar voz
          </Button>
        </div>
      </Card>

      {/* PRECIFICAÇÃO DE TOKENS */}
      <Card className="rounded-2xl border-border p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Coins className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Precificação de tokens</h3>
            <p className="text-xs text-muted-foreground">O custo dos tokens é calculado automaticamente a partir do preço real do modelo ativo. Ajuste o câmbio e o markup padrão de venda.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Câmbio USD → BRL</Label>
            <Input type="number" step="0.01" min={0.1} value={usdToBrl} onChange={(e) => setUsdToBrl(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Usado para converter o preço dos provedores (que é em dólar).</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Markup padrão de venda (x)</Label>
            <Input type="number" step="0.1" min={1} value={tokenMarkup} onChange={(e) => setTokenMarkup(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Ex.: 5 = preço sugerido de venda é 5x o custo real.</p>
          </div>
        </div>

        {/* Tabela de custo real por modelo */}
        {pricing?.catalog && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-2.5 bg-muted flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Custo real por modelo (BRL por 1M tokens)</span>
              <span className="text-[11px] text-muted-foreground">modelo ativo: {pricing.activeModel}</span>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Modelo</th>
                    <th className="px-4 py-2 font-medium">Provedor</th>
                    <th className="px-4 py-2 font-medium text-right">Input $/1M</th>
                    <th className="px-4 py-2 font-medium text-right">Output $/1M</th>
                    <th className="px-4 py-2 font-medium text-right">Custo R$/1M</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.catalog.map((m: any) => {
                    const active = m.model === pricing.activeModel;
                    return (
                      <tr key={m.model} className={`border-b border-border/60 ${active ? "bg-primary/5" : ""}`}>
                        <td className="px-4 py-2 font-medium text-foreground">
                          {m.model} {active && <Badge className="ml-1 bg-primary/10 text-primary border-none text-[10px]">ativo</Badge>}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground capitalize">{String(m.provider).toLowerCase()}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{m.inputUSD != null ? `$${m.inputUSD}` : "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{m.outputUSD != null ? `$${m.outputUSD}` : "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-foreground">R$ {m.costBRLPer1M.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">Os preços são estimados (proporção input/output de conversa). Confirme a tabela oficial dos provedores periodicamente.</p>
          <Button onClick={savePricing} disabled={savingPricing} className="gap-2">
            {savingPricing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar precificação
          </Button>
        </div>
      </Card>

      {/* CUSTO DE DISPARO (WHATSAPP) */}
      <Card className="rounded-2xl border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Custo de disparo (WhatsApp)</h3>
            <p className="text-xs text-muted-foreground">
              A Meta cobra por mensagem entregue, com tarifa diferente por categoria. Aqui você
              informa o que ela cobra e a margem que quer aplicar — os planos e o módulo de disparo
              passam a usar estes números.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { key: "MARKETING", label: "Marketing", hint: "Promoções e reengajamento" },
            { key: "UTILITY", label: "Utilidade", hint: "Lembretes e confirmações" },
            { key: "AUTHENTICATION", label: "Autenticação", hint: "Códigos de verificação" },
            { key: "SERVICE", label: "Serviço", hint: "Resposta na janela de 24h — grátis até out/2026" },
          ].map(({ key, label, hint }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label} — US$ por mensagem</Label>
              <Input
                type="number" step="0.0001" min={0}
                value={waRates[key] ?? 0}
                onChange={(e) => setWaRates({ ...waRates, [key]: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Margem sobre o disparo (x)</Label>
            <Input type="number" step="0.1" min={1} value={waMarkup} onChange={(e) => setWaMarkup(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">
              Ex.: 2 = você cobra o dobro do que a Meta cobra. Mínimo 1 (vender pelo custo).
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Custo por número no QR Code (R$/mês)</Label>
            <Input type="number" step="0.01" min={0} value={baileysCost} onChange={(e) => setBaileysCost(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">
              Planos por QR Code não pagam a Meta, mas custam a sessão de pé. Sem este número,
              eles aparecem como se custassem zero.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Câmbio em uso</Label>
            <div className="h-10 rounded-md border border-border px-3 flex items-center text-sm text-muted-foreground">
              US$ 1,00 = R$ {Number(usdToBrl).toFixed(2)}
            </div>
            <p className="text-[11px] text-muted-foreground">Editado no bloco de precificação de tokens.</p>
          </div>
        </div>

        {/* Prévia: sem isso o admin ajusta números soltos sem ver o efeito. */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted">
            <span className="text-xs font-semibold text-foreground">Quanto custa e por quanto você vende</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Categoria</th>
                  <th className="px-4 py-2 font-medium text-right">Seu custo / msg</th>
                  <th className="px-4 py-2 font-medium text-right">Preço / msg</th>
                  <th className="px-4 py-2 font-medium text-right">1.000 disparos</th>
                  <th className="px-4 py-2 font-medium text-right">Lucro em 1.000</th>
                </tr>
              </thead>
              <tbody>
                {["MARKETING", "UTILITY", "AUTHENTICATION", "SERVICE"].map((cat) => {
                  const custo = (Number(waRates[cat]) || 0) * Number(usdToBrl);
                  const preco = custo * (Number(waMarkup) || 1);
                  return (
                    <tr key={cat} className="border-b border-border/60">
                      <td className="px-4 py-2 font-medium text-foreground capitalize">{cat.toLowerCase()}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{brl(custo)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-foreground">{brl(preco)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{brl(preco * 1000)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-600">
                        {brl((preco - custo) * 1000)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            A Meta reajusta as tarifas sem aviso. Serviço é grátis hoje e passa a ser cobrado
            em outubro de 2026 — deixe em 0 até a tabela sair.
          </p>
          <Button onClick={saveDispatch} disabled={savingWa} className="gap-2">
            {savingWa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar custo de disparo
          </Button>
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

        {/* DEPOIMENTOS ─────────────────────────────────────── */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Quote className="h-3.5 w-3.5" /> Depoimentos
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Só de cliente real, com autorização. Sem nenhum cadastrado, a seção mostra
                apenas os números do produto. A landing exibe os quatro primeiros.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => setDepoimentos([...depoimentos, { nome: "", papel: "", texto: "", nota: 5 }])}
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>

          {depoimentos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
              Nenhum depoimento cadastrado.
            </p>
          ) : (
            <div className="space-y-3">
              {depoimentos.map((d, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
                  <div className="flex items-center gap-2">
                    <Badge className="shrink-0 border-none bg-primary/10 px-2 text-[10px] font-semibold text-primary">
                      {i < 4 ? `#${i + 1}` : "não exibido"}
                    </Badge>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Nome de quem falou"
                      value={d.nome || ""}
                      onChange={(e) => mudarDepoimento(i, "nome", e.target.value)}
                    />
                    <Input
                      className="h-8 text-xs"
                      placeholder="Cargo e empresa"
                      value={d.papel || ""}
                      onChange={(e) => mudarDepoimento(i, "papel", e.target.value)}
                    />
                    <button
                      onClick={() => setDepoimentos(depoimentos.filter((_, k) => k !== i))}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600"
                      title="Remover depoimento"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Textarea
                    rows={2}
                    className="text-xs"
                    placeholder="O que o cliente disse, nas palavras dele."
                    value={d.texto || ""}
                    onChange={(e) => mudarDepoimento(i, "texto", e.target.value)}
                  />
                  <div className="flex items-center gap-1">
                    <span className="mr-1 text-[11px] text-muted-foreground">Nota</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => mudarDepoimento(i, "nota", n)} title={`${n} de 5`}>
                        <Star
                          className={`h-4 w-4 transition-colors ${
                            n <= (Number(d.nota) || 5) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
