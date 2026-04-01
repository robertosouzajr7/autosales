import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  Bell,
  UserX,
  MessageSquare,
  Save,
  RefreshCw,
  Megaphone,
  ShieldCheck,
  CalendarClock,
  AlertTriangle,
  Handshake,
  Send,
  X,
  Plus,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AutomationConfig {
  id?: string;
  autoConfirmHours: number;
  lateToleranceMin: number;
  postServiceHours: number;
  humanHandoffTags: string;
  confirmMsgTemplate: string;
  lateMsgTemplate: string;
  postServiceMsgTemplate: string;
}

// ─────────────────────────────────────────────────────────────
// Tag Input
// ─────────────────────────────────────────────────────────────

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const tags = value ? value.split(",").map((t) => t.trim()).filter(Boolean) : [];

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const next = [...tags, trimmed].join(", ");
    onChange(next);
    setInput("");
  };

  const removeTag = (idx: number) => {
    const next = tags.filter((_, i) => i !== idx).join(", ");
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 min-h-[44px]">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
          >
            {tag}
            <button onClick={() => removeTag(i)} className="ml-0.5 hover:text-red-900">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <span className="text-xs text-slate-400 py-0.5">{placeholder ?? "Nenhuma tag adicionada"}</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Ex: "bolha", "queimadura", "reclamação"'
          className="h-9 text-sm"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
        />
        <Button type="button" size="sm" variant="outline" onClick={addTag} className="shrink-0">
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Config card wrapper
// ─────────────────────────────────────────────────────────────

function ConfigCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-800">{title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Number field with unit label
// ─────────────────────────────────────────────────────────────

function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  id: string;
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={min ?? 0}
          max={max ?? 9999}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 w-28 text-sm"
        />
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function AutomationConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AutomationConfig>({
    autoConfirmHours: 24,
    lateToleranceMin: 15,
    postServiceHours: 24,
    humanHandoffTags: "",
    confirmMsgTemplate: "Olá {name}! 👋 Passando para confirmar seu atendimento de amanhã às {time}. Podemos confirmar? ✅",
    lateMsgTemplate: "Oi {name}! 😊 Notamos que você ainda não chegou para o seu horário das {time}. Está tudo bem?",
    postServiceMsgTemplate: "Oi {name}! Esperamos que tenha gostado do atendimento! ✨ Como foi sua experiência?",
  });

  // Feature toggles (local only for UX — backed by real field in future)
  const [features, setFeatures] = useState({
    confirmationEnabled: true,
    noShowEnabled: true,
    postServiceEnabled: true,
    handoffEnabled: true,
    waitlistEnabled: true,
    broadcastEnabled: false,
  });

  useEffect(() => {
    fetch("/api/automations/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setConfig(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/automations/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      toast({ title: "Configurações salvas!", description: "As regras de automação foram atualizadas." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    }
    setSaving(false);
  };

  const toggle = (key: keyof typeof features) =>
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm animate-pulse">
          Carregando configurações…
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Parâmetros de Automação</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Configure as regras globais do seu robô SDR — funciona para qualquer tipo de negócio.
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2 shrink-0"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando…" : "Salvar Configurações"}
          </Button>
        </div>

        <Tabs defaultValue="confirmations">
          <TabsList className="bg-slate-100 border border-slate-200">
            <TabsTrigger value="confirmations" className="gap-1.5 text-xs sm:text-sm">
              <CalendarClock className="h-3.5 w-3.5" />
              Confirmações
            </TabsTrigger>
            <TabsTrigger value="noshow" className="gap-1.5 text-xs sm:text-sm">
              <UserX className="h-3.5 w-3.5" />
              Faltas e Atrasos
            </TabsTrigger>
            <TabsTrigger value="postservice" className="gap-1.5 text-xs sm:text-sm">
              <Handshake className="h-3.5 w-3.5" />
              Pós-Atendimento
            </TabsTrigger>
            <TabsTrigger value="handoff" className="gap-1.5 text-xs sm:text-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              Handoff Humano
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5 text-xs sm:text-sm">
              <Megaphone className="h-3.5 w-3.5" />
              Campanhas
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: Confirmações ──────────────────────────────── */}
          <TabsContent value="confirmations" className="mt-4 space-y-4">
            <ConfigCard
              icon={Bell}
              iconColor="text-violet-600"
              iconBg="bg-violet-50"
              title="Confirmação Automática"
              description="O robô envia uma mensagem pedindo ao cliente para confirmar ou cancelar o agendamento antes do horário marcado."
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">Ativar confirmação automática</p>
                  <p className="text-xs text-slate-400">O bot enviará mensagens de confirmação de forma autônoma.</p>
                </div>
                <Switch
                  checked={features.confirmationEnabled}
                  onCheckedChange={() => toggle("confirmationEnabled")}
                />
              </div>

              <div className={`space-y-4 transition-opacity ${features.confirmationEnabled ? "" : "opacity-40 pointer-events-none"}`}>
                <NumberField
                  id="autoConfirmHours"
                  label="Horas de antecedência para envio"
                  unit="horas antes"
                  value={config.autoConfirmHours}
                  onChange={(v) => setConfig({ ...config, autoConfirmHours: v })}
                  min={1}
                  max={72}
                  hint="Exemplo: 24h antes → a mensagem é enviada 1 dia antes do horário marcado."
                />

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Mensagem de confirmação</Label>
                  <Textarea
                    className="text-xs text-slate-700 h-24 resize-none bg-white border-2"
                    value={config.confirmMsgTemplate}
                    onChange={(e) => setConfig({ ...config, confirmMsgTemplate: e.target.value })}
                  />
                  <p className="text-[11px] text-slate-400">
                    Use {"{name}"} e {"{time}"} para inserir o nome e horário automaticamente.
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-violet-50 text-violet-700 rounded-lg px-3 py-2.5 text-xs">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Se o cliente responder <strong>SIM</strong>, o agendamento é mantido. Se responder <strong>NÃO</strong>ou não responder após {config.autoConfirmHours}h, a vaga é automaticamente liberada.
                  </span>
                </div>
              </div>
            </ConfigCard>

            <ConfigCard
              icon={RefreshCw}
              iconColor="text-sky-600"
              iconBg="bg-sky-50"
              title="Fila de Espera (Encaixe Automático)"
              description="Quando um cliente cancela, o sistema oferece a vaga automaticamente para quem está aguardando."
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">Ativar encaixe automático</p>
                  <p className="text-xs text-slate-400">Notifica leads na fila quando uma vaga for liberada.</p>
                </div>
                <Switch
                  checked={features.waitlistEnabled}
                  onCheckedChange={() => toggle("waitlistEnabled")}
                />
              </div>
              <div className={`space-y-2 transition-opacity ${features.waitlistEnabled ? "" : "opacity-40 pointer-events-none"}`}>
                <div className="flex items-center gap-2 bg-sky-50 text-sky-700 rounded-lg px-3 py-2.5 text-xs">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    O sistema avisará o primeiro cliente da fila: <em>"Surgiu uma vaga disponível para {"{data}"} às {"{hora}"}! Tem interesse?"</em>
                  </span>
                </div>
              </div>
            </ConfigCard>
          </TabsContent>

          {/* ── TAB: Faltas e Atrasos ──────────────────────────── */}
          <TabsContent value="noshow" className="mt-4 space-y-4">
            <ConfigCard
              icon={AlertTriangle}
              iconColor="text-amber-600"
              iconBg="bg-amber-50"
              title="Tolerância de Atraso"
              description="Configure quantos minutos o robô aguarda antes de enviar uma mensagem de alerta ao cliente que está atrasado."
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">Ativar alerta de atraso</p>
                  <p className="text-xs text-slate-400">Bot envia mensagem automática quando cliente ultrapassa o tempo de tolerância.</p>
                </div>
                <Switch
                  checked={features.noShowEnabled}
                  onCheckedChange={() => toggle("noShowEnabled")}
                />
              </div>

              <div className={`space-y-4 transition-opacity ${features.noShowEnabled ? "" : "opacity-40 pointer-events-none"}`}>
                <NumberField
                  id="lateToleranceMin"
                  label="Tempo de tolerância"
                  unit="minutos de atraso"
                  value={config.lateToleranceMin}
                  onChange={(v) => setConfig({ ...config, lateToleranceMin: v })}
                  min={5}
                  max={120}
                  hint="Após esse tempo, o bot pergunta automaticamente se o cliente ainda virá."
                />

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Mensagem de atraso</Label>
                  <Textarea
                    className="text-xs text-slate-700 h-20 resize-none bg-white border-2"
                    value={config.lateMsgTemplate}
                    onChange={(e) => setConfig({ ...config, lateMsgTemplate: e.target.value })}
                  />
                  <p className="text-[11px] text-slate-400">
                    Use {"{name}"} e {"{time}"} para inserir os dados dinâmicos.
                  </p>
                </div>
              </div>
            </ConfigCard>
          </TabsContent>

          {/* ── TAB: Pós-Atendimento ───────────────────────────── */}
          <TabsContent value="postservice" className="mt-4 space-y-4">
            <ConfigCard
              icon={Handshake}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
              title="Follow-up Pós-Atendimento"
              description="O robô envia uma mensagem após a conclusão do serviço para verificar a satisfação do cliente."
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">Ativar pós-atendimento automático</p>
                  <p className="text-xs text-slate-400">Envia uma mensagem de acompanhamento após o serviço concluído.</p>
                </div>
                <Switch
                  checked={features.postServiceEnabled}
                  onCheckedChange={() => toggle("postServiceEnabled")}
                />
              </div>

              <div className={`space-y-4 transition-opacity ${features.postServiceEnabled ? "" : "opacity-40 pointer-events-none"}`}>
                <NumberField
                  id="postServiceHours"
                  label="Enviar follow-up após"
                  unit="horas do atendimento"
                  value={config.postServiceHours}
                  onChange={(v) => setConfig({ ...config, postServiceHours: v })}
                  min={1}
                  max={168}
                  hint="Recomendamos entre 4h e 48h para o melhor índice de resposta."
                />

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Mensagem pós-atendimento</Label>
                  <Textarea
                    className="text-xs text-slate-700 h-24 resize-none bg-white border-2"
                    value={config.postServiceMsgTemplate}
                    onChange={(e) => setConfig({ ...config, postServiceMsgTemplate: e.target.value })}
                  />
                  <p className="text-[11px] text-slate-400">
                    Use {"{name}"} para personalizar com o nome da cliente.
                  </p>
                </div>
              </div>
            </ConfigCard>
          </TabsContent>

          {/* ── TAB: Handoff Humano ────────────────────────────── */}
          <TabsContent value="handoff" className="mt-4 space-y-4">
            <ConfigCard
              icon={ShieldCheck}
              iconColor="text-red-600"
              iconBg="bg-red-50"
              title="Transferência para Atendente Humano"
              description="Defina palavras-chave que, se detectadas na conversa, pausam o bot e alertam um atendente humano automaticamente."
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">Ativar detecção de urgência</p>
                  <p className="text-xs text-slate-400">O bot irá parar e chamar um humano quando detectar essas palavras.</p>
                </div>
                <Switch
                  checked={features.handoffEnabled}
                  onCheckedChange={() => toggle("handoffEnabled")}
                />
              </div>

              <div className={`space-y-4 transition-opacity ${features.handoffEnabled ? "" : "opacity-40 pointer-events-none"}`}>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Palavras-chave de emergência</Label>
                  <p className="text-xs text-slate-400">
                    Adicione as palavras ou expressões que indicam que o cliente precisa de atendimento humano urgente.
                  </p>
                  <TagInput
                    value={config.humanHandoffTags}
                    onChange={(v) => setConfig({ ...config, humanHandoffTags: v })}
                    placeholder="Adicione palavras de emergência..."
                  />
                </div>

                <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Quando detectar alguma dessas palavras, o bot enviará a mensagem:
                    <em className="block mt-1 font-medium">
                      "Entendo sua situação. Vou conectar você com nossa equipe agora mesmo! 🙏"
                    </em>
                    …e um alerta aparecerá no painel de Conversas para intervenção imediata.
                  </span>
                </div>
              </div>
            </ConfigCard>
          </TabsContent>

          {/* ── TAB: Campanhas ────────────────────────────────── */}
          <TabsContent value="campaigns" className="mt-4 space-y-4">
            <ConfigCard
              icon={Megaphone}
              iconColor="text-indigo-600"
              iconBg="bg-indigo-50"
              title="Disparo de Campanhas em Massa"
              description="Envie promoções e comunicados para todos os seus contatos ou segmentos específicos via WhatsApp."
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">Ativar módulo de campanhas</p>
                  <p className="text-xs text-slate-400">Habilita envios em massa controlados (anti-ban).</p>
                </div>
                <Switch
                  checked={features.broadcastEnabled}
                  onCheckedChange={() => toggle("broadcastEnabled")}
                />
              </div>

              <div className={`space-y-4 transition-opacity ${features.broadcastEnabled ? "" : "opacity-40 pointer-events-none"}`}>
                <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Texto da campanha</Label>
                    <Textarea
                      placeholder={`Olá {nome}! 🎉\nTemos uma promoção especial para você...\n\nResponda QUERO para garantir sua vaga!`}
                      className="h-28 text-sm resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">Público-alvo</Label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="all">Todos os contatos</option>
                        <option value="leads">Apenas leads ativos</option>
                        <option value="converted">Clientes convertidos</option>
                        <option value="lost">Leads perdidos (reengajamento)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">Limite de vouchers</Label>
                      <Input type="number" placeholder="Ex: 30" className="h-9 text-sm" />
                    </div>
                  </div>

                  <Button className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700">
                    <Send className="h-4 w-4" />
                    Pré-visualizar e Agendar Envio
                  </Button>
                </div>

                <div className="flex items-center gap-2 bg-amber-50 text-amber-700 rounded-lg px-3 py-2.5 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    O envio é feito de forma cadenciada (5–10 segundos entre mensagens) para evitar bloqueio do número pelo WhatsApp.
                  </span>
                </div>
              </div>
            </ConfigCard>
          </TabsContent>
        </Tabs>

        {/* Save footer */}
        <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-slate-200 -mx-4 px-4 py-3 flex items-center justify-between sm:-mx-8 sm:px-8 lg:-mx-8">
          <p className="text-xs text-slate-400">
            As configurações se aplicam a <strong>toda a conta</strong> e entram em vigor imediatamente.
          </p>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            size="sm"
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
