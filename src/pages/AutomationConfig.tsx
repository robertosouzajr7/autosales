import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Clock, Bell, UserX, Save, RefreshCw, ShieldCheck, CalendarClock, AlertTriangle,
  Handshake, X, Plus, Sliders, Video, CheckCircle2, GitBranch, Activity, Link2,
} from "lucide-react";

/**
 * Lembretes e rotinas do agendamento.
 *
 * Esta tela chamava a API sem o cabeçalho de autenticação: toda leitura vinha
 * 401 (a página mostrava os valores padrão como se fossem os salvos) e todo
 * salvamento falhava. Além disso os interruptores eram estado local — ligar ou
 * desligar não mudava nada no servidor.
 */

interface Config {
  id?: string;
  autoConfirmHours: number;
  lateToleranceMin: number;
  postServiceHours: number;
  meetLinkMinutes: number;
  humanHandoffTags: string;
  confirmMsgTemplate: string;
  lateMsgTemplate: string;
  postServiceMsgTemplate: string;
  bookedMsgTemplate: string;
  meetMsgTemplate: string;
  finalMsgTemplate: string;
  confirmTemplateId: string;
  remindersEnabled: boolean;
  bookedEnabled: boolean;
  confirmEnabled: boolean;
  meetLinkEnabled: boolean;
  finalEnabled: boolean;
  noShowEnabled: boolean;
  postServiceEnabled: boolean;
  pipelineAutoEnabled: boolean;
}

const PADRAO: Config = {
  autoConfirmHours: 24,
  lateToleranceMin: 15,
  postServiceHours: 24,
  meetLinkMinutes: 10,
  humanHandoffTags: "",
  confirmMsgTemplate: "Oi {name}! Passando para confirmar nosso compromisso de {date} às {time}. Podemos confirmar?",
  lateMsgTemplate: "Olá {name}, não conseguimos te encontrar no horário das {time}. Aconteceu algo? Se quiser remarcar, é só me chamar.",
  postServiceMsgTemplate: "Oi {name}! Como foi nosso atendimento? Seu retorno ajuda demais. ✨",
  bookedMsgTemplate:
    "Obrigado, {name}! 🙌 Seu agendamento está confirmado.\n\n📅 {date}\n🕒 {time}{link_block}\n\nPosso te ajudar com mais alguma coisa?",
  meetMsgTemplate: "Oi {name}! Sua reunião começa em {minutes} minutos.\n\nEntre por aqui: {link}",
  finalMsgTemplate: "{name}, sua reunião é agora! 🚀{link_block}",
  confirmTemplateId: "",
  remindersEnabled: true,
  bookedEnabled: true,
  confirmEnabled: true,
  meetLinkEnabled: true,
  finalEnabled: true,
  noShowEnabled: true,
  postServiceEnabled: true,
  pipelineAutoEnabled: true,
};

const KIND_LABEL: Record<string, string> = {
  BOOKED: "Confirmação do agendamento",
  CONFIRM: "Pedido de confirmação",
  MEET_LINK: "Link da reunião",
  FINAL: "Lembrete final",
  NOSHOW: "Falta (no-show)",
  POST_SERVICE: "Pós-atendimento",
};

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

function TagInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const tags = value ? value.split(",").map((t) => t.trim()).filter(Boolean) : [];

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onChange([...tags, trimmed].join(", "));
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 min-h-[44px]">
        {tags.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
            {tag}
            <button onClick={() => onChange(tags.filter((_, x) => x !== i).join(", "))} className="ml-0.5 hover:text-red-900">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-slate-400 py-0.5">{placeholder ?? "Nenhuma tag adicionada"}</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Ex: "reclamação", "urgente", "cancelar"'
          className="h-9 text-sm"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
        />
        <Button type="button" size="sm" variant="outline" onClick={addTag} className="shrink-0">
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}

function ConfigCard({
  icon: Icon, iconColor, iconBg, title, description, enabled, onToggle, children,
}: {
  icon: React.ElementType; iconColor: string; iconBg: string; title: string; description: string;
  enabled?: boolean; onToggle?: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold text-slate-800">{title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          </div>
          {onToggle && <Switch checked={!!enabled} onCheckedChange={onToggle} className="mt-1 shrink-0" />}
        </div>
      </CardHeader>
      {children && (
        <CardContent className={`pt-0 transition-opacity ${onToggle && !enabled ? "opacity-40 pointer-events-none" : ""}`}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}

function NumberField({
  id, label, unit, value, onChange, min, max, hint,
}: {
  id: string; label: string; unit: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={id} type="number" min={min ?? 0} max={max ?? 9999} value={value}
          onChange={(e) => onChange(Number(e.target.value))} className="h-9 w-28 text-sm" />
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function MsgField({ label, value, onChange, hint, rows = 4 }: {
  label: string; value: string; onChange: (v: string) => void; hint: string; rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)}
        className="text-xs text-slate-700 resize-none bg-white border-2" style={{ height: rows * 26 }} />
      <p className="text-xs text-slate-400">{hint}</p>
    </div>
  );
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AutomationConfig() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Config>(PADRAO);
  const [templates, setTemplates] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));

  const carregarStatus = async () => {
    try {
      const r = await fetch("/api/automations/reminders", { headers: auth() });
      setStatus(r.ok ? await r.json() : null);
    } catch { setStatus(null); }
  };

  useEffect(() => {
    (async () => {
      try {
        const [cRes, tRes] = await Promise.all([
          fetch("/api/automations/config", { headers: auth() }),
          fetch("/api/templates", { headers: auth() }),
        ]);
        if (cRes.ok) {
          const d = await cRes.json();
          // Campos nulos no banco continuam com o texto padrão da tela.
          setConfig({
            ...PADRAO,
            ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null && v !== undefined)),
          } as Config);
        } else {
          const d = await cRes.json().catch(() => ({}));
          toast({ title: d.error || "Não foi possível carregar as configurações", variant: "destructive" });
        }
        const tpls = tRes.ok ? await tRes.json() : [];
        setTemplates(tpls.filter((t: any) => t.status === "APPROVED"));
      } finally {
        setLoading(false);
      }
      carregarStatus();
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/automations/config", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Falha ao salvar");
      toast({ title: "Configurações salvas", description: "A régua já vale para os agendamentos futuros." });
      carregarStatus();
    } catch (e: any) {
      toast({ title: e.message || "Não foi possível salvar", variant: "destructive" });
    }
    setSaving(false);
  };

  const retry = async (id: string) => {
    const res = await fetch(`/api/automations/reminders/${id}/retry`, { method: "POST", headers: auth() });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast({ title: "Lembrete recolocado na fila" }); carregarStatus(); }
    else toast({ title: d.error || "Erro ao reenviar", variant: "destructive" });
  };

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
      <PageContainer>
      <div className="space-y-6 pb-20">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Lembretes e rotinas</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              A régua completa do agendamento: confirmação, lembrete 24h antes, link da reunião e aviso final.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => navigate("/automations/builder")} className="text-muted-foreground gap-1.5">
              <Sliders className="h-4 w-4" /> Fluxos avançados
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>

        {!config.remindersEnabled && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            A régua de lembretes está desligada — nenhum aviso automático sai enquanto isso.
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => set("remindersEnabled", true)}>
              Ligar
            </Button>
          </div>
        )}

        <Tabs defaultValue="regua">
          <TabsList className="bg-slate-100 border border-slate-200 flex-wrap h-auto">
            <TabsTrigger value="regua" className="gap-1.5 text-xs sm:text-sm"><CalendarClock className="h-3.5 w-3.5" /> Régua do agendamento</TabsTrigger>
            <TabsTrigger value="pos" className="gap-1.5 text-xs sm:text-sm"><UserX className="h-3.5 w-3.5" /> Faltas e pós-atendimento</TabsTrigger>
            <TabsTrigger value="funil" className="gap-1.5 text-xs sm:text-sm"><GitBranch className="h-3.5 w-3.5" /> Funil</TabsTrigger>
            <TabsTrigger value="handoff" className="gap-1.5 text-xs sm:text-sm"><ShieldCheck className="h-3.5 w-3.5" /> Handoff humano</TabsTrigger>
            <TabsTrigger value="status" className="gap-1.5 text-xs sm:text-sm"><Activity className="h-3.5 w-3.5" /> Status</TabsTrigger>
          </TabsList>

          {/* ── Régua do agendamento ───────────────────────────── */}
          <TabsContent value="regua" className="mt-4 space-y-4">
            <ConfigCard
              icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50"
              title="1. Assim que o cliente agenda"
              description="Agradece, manda o resumo do agendamento e oferece o botão de encerrar o atendimento."
              enabled={config.bookedEnabled} onToggle={(v) => set("bookedEnabled", v)}
            >
              <MsgField
                label="Mensagem de confirmação do agendamento"
                value={config.bookedMsgTemplate}
                onChange={(v) => set("bookedMsgTemplate", v)}
                hint="{name}, {date}, {time}, {title} e {link_block} (linha do link da reunião, quando existir)."
                rows={5}
              />
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Vai com os botões “Tenho uma dúvida” e “Encerrar atendimento”.
              </p>
            </ConfigCard>

            <ConfigCard
              icon={Bell} iconColor="text-blue-600" iconBg="bg-blue-50"
              title="2. Antes do compromisso — pedido de confirmação"
              description="Pergunta se está confirmado, com botões de confirmar e remarcar."
              enabled={config.confirmEnabled} onToggle={(v) => set("confirmEnabled", v)}
            >
              <div className="space-y-4">
                <NumberField
                  id="autoConfirmHours" label="Antecedência" unit="horas antes"
                  value={config.autoConfirmHours} onChange={(v) => set("autoConfirmHours", v)}
                  min={1} max={168} hint="24h é o padrão. Agendamentos marcados com menos antecedência pulam este aviso."
                />
                <MsgField
                  label="Mensagem" value={config.confirmMsgTemplate}
                  onChange={(v) => set("confirmMsgTemplate", v)} hint="{name}, {date}, {time}." rows={3}
                />
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Template para janela fechada</Label>
                  <Select value={config.confirmTemplateId || "NONE"} onValueChange={(v) => set("confirmTemplateId", v === "NONE" ? "" : v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Escolha um template aprovado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Nenhum</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name} · {t.variableCount || 0} variável(is)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-400">
                    Se o cliente não fala com você há mais de 24h, o WhatsApp só aceita template aprovado.
                    Sem um template escolhido aqui, esse lembrete falha — e o motivo aparece na aba Status.
                    {templates.length === 0 && (
                      <> Você ainda não tem template aprovado: <a href="/templates" className="underline font-semibold">crie um</a>.</>
                    )}
                  </p>
                </div>
              </div>
            </ConfigCard>

            <ConfigCard
              icon={Video} iconColor="text-indigo-600" iconBg="bg-indigo-50"
              title="3. Pouco antes — link da reunião"
              description="Envia o link do Google Meet no WhatsApp e no e-mail do contato."
              enabled={config.meetLinkEnabled} onToggle={(v) => set("meetLinkEnabled", v)}
            >
              <div className="space-y-4">
                <NumberField
                  id="meetLinkMinutes" label="Antecedência" unit="minutos antes"
                  value={config.meetLinkMinutes} onChange={(v) => set("meetLinkMinutes", v)}
                  min={1} max={120} hint="O link do Meet é criado junto com o evento no Google Calendar."
                />
                <MsgField
                  label="Mensagem" value={config.meetMsgTemplate}
                  onChange={(v) => set("meetMsgTemplate", v)} hint="{name}, {minutes}, {link}, {date}, {time}." rows={3}
                />
                <p className="flex items-start gap-2 rounded-lg bg-indigo-50 px-3 py-2.5 text-xs text-indigo-800">
                  <Link2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Sem o Google Calendar conectado não existe link de Meet, e este lembrete é pulado.
                  Conecte em <a href="/connections" className="underline font-semibold">Conexões</a>.
                </p>
              </div>
            </ConfigCard>

            <ConfigCard
              icon={Clock} iconColor="text-orange-600" iconBg="bg-orange-50"
              title="4. Na hora — lembrete final"
              description="“Sua reunião é agora”, com o link junto."
              enabled={config.finalEnabled} onToggle={(v) => set("finalEnabled", v)}
            >
              <MsgField
                label="Mensagem" value={config.finalMsgTemplate}
                onChange={(v) => set("finalMsgTemplate", v)} hint="{name}, {link}, {link_block}, {time}." rows={3}
              />
            </ConfigCard>
          </TabsContent>

          {/* ── Faltas e pós-atendimento ───────────────────────── */}
          <TabsContent value="pos" className="mt-4 space-y-4">
            <ConfigCard
              icon={AlertTriangle} iconColor="text-amber-600" iconBg="bg-amber-50"
              title="Falta (no-show)"
              description="Depois da tolerância, pergunta o que aconteceu e oferece remarcar."
              enabled={config.noShowEnabled} onToggle={(v) => set("noShowEnabled", v)}
            >
              <div className="space-y-4">
                <NumberField
                  id="lateToleranceMin" label="Tolerância" unit="minutos após o horário"
                  value={config.lateToleranceMin} onChange={(v) => set("lateToleranceMin", v)}
                  min={5} max={240} hint="Quem confirmou presença pelo botão não recebe este aviso."
                />
                <MsgField label="Mensagem" value={config.lateMsgTemplate}
                  onChange={(v) => set("lateMsgTemplate", v)} hint="{name}, {time}, {date}." rows={3} />
              </div>
            </ConfigCard>

            <ConfigCard
              icon={Handshake} iconColor="text-[#2563EB]" iconBg="bg-blue-50"
              title="Pós-atendimento"
              description="Pesquisa de satisfação depois do atendimento concluído."
              enabled={config.postServiceEnabled} onToggle={(v) => set("postServiceEnabled", v)}
            >
              <div className="space-y-4">
                <NumberField
                  id="postServiceHours" label="Enviar depois de" unit="horas do atendimento"
                  value={config.postServiceHours} onChange={(v) => set("postServiceHours", v)}
                  min={1} max={168} hint="Só sai para agendamento marcado como concluído."
                />
                <MsgField label="Mensagem" value={config.postServiceMsgTemplate}
                  onChange={(v) => set("postServiceMsgTemplate", v)} hint="{name}, {date}." rows={3} />
              </div>
            </ConfigCard>
          </TabsContent>

          {/* ── Funil ──────────────────────────────────────────── */}
          <TabsContent value="funil" className="mt-4 space-y-4">
            <ConfigCard
              icon={GitBranch} iconColor="text-violet-600" iconBg="bg-violet-50"
              title="Movimentação automática no funil"
              description="Cada evento do atendimento empurra o contato para a etapa correspondente."
              enabled={config.pipelineAutoEnabled} onToggle={(v) => set("pipelineAutoEnabled", v)}
            >
              <div className="space-y-2 text-sm">
                {[
                  ["Agendou", "Agendado"],
                  ["Confirmou presença", "Confirmado / Agendado"],
                  ["Atendimento concluído", "Atendido / Ganho"],
                  ["Faltou", "No-show / Perdido"],
                  ["Cancelou ou pediu para remarcar", "Contato / Qualificando"],
                ].map(([evento, etapa]) => (
                  <div key={evento} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-600">{evento}</span>
                    <Badge variant="outline" className="font-semibold text-xs">{etapa}</Badge>
                  </div>
                ))}
                <p className="text-xs text-slate-400 pt-1">
                  A etapa é encontrada pelo nome no seu funil. Se nenhuma casar, o contato fica onde está —
                  renomeie as etapas em <a href="/crm" className="underline font-semibold">CRM</a> para ativar o encaixe.
                </p>
              </div>
            </ConfigCard>
          </TabsContent>

          {/* ── Handoff ────────────────────────────────────────── */}
          <TabsContent value="handoff" className="mt-4 space-y-4">
            <ConfigCard
              icon={ShieldCheck} iconColor="text-red-600" iconBg="bg-red-50"
              title="Transferência para atendente humano"
              description="Palavras que, ao aparecerem na conversa, pausam o bot e chamam um humano."
            >
              <div className="space-y-4">
                <TagInput value={config.humanHandoffTags} onChange={(v) => set("humanHandoffTags", v)}
                  placeholder="Adicione palavras de emergência…" />
                <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Ao detectar uma dessas palavras o bot avisa que vai chamar a equipe e a conversa aparece
                  destacada no painel de Conversas.
                </p>
              </div>
            </ConfigCard>
          </TabsContent>

          {/* ── Status ─────────────────────────────────────────── */}
          <TabsContent value="status" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {status ? `${status.enviadosNaSemana} lembrete(s) enviados nos últimos 7 dias.` : "Sem dados ainda."}
              </p>
              <Button variant="outline" size="sm" onClick={carregarStatus} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Atualizar
              </Button>
            </div>

            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-800">Próximos envios</CardTitle>
                <CardDescription className="text-xs">O que está na fila, na ordem em que vai sair.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {!status?.proximos?.length ? (
                  <p className="text-sm text-slate-400 py-6 text-center">Nenhum lembrete programado.</p>
                ) : status.proximos.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <Badge variant="outline" className="text-[11px] font-bold shrink-0">{KIND_LABEL[r.kind] || r.kind}</Badge>
                    <span className="truncate text-slate-600">{r.appointment?.lead?.name || "Contato"}</span>
                    <span className="ml-auto text-xs text-slate-400 shrink-0">{quando(r.runAt)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-800">Falhas recentes</CardTitle>
                <CardDescription className="text-xs">Cada linha traz o motivo — e dá para reenviar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {!status?.falhas?.length ? (
                  <p className="text-sm text-slate-400 py-6 text-center">Nenhuma falha nos últimos 7 dias. 🎉</p>
                ) : status.falhas.map((r: any) => (
                  <div key={r.id} className="rounded-lg bg-red-50 px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px] font-bold shrink-0">{KIND_LABEL[r.kind] || r.kind}</Badge>
                      <span className="truncate text-slate-700">{r.appointment?.lead?.name || "Contato"}</span>
                      <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs font-bold" onClick={() => retry(r.id)}>
                        Tentar de novo
                      </Button>
                    </div>
                    <p className="text-xs text-red-700 mt-1">{r.error || "Sem detalhe do erro."}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-slate-200 -mx-4 px-4 py-3 flex items-center justify-between sm:-mx-8 sm:px-8">
          <p className="text-xs text-slate-400">
            Vale para <strong>toda a conta</strong>. Mudanças de horário recalculam a régua dos agendamentos futuros.
          </p>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1D4ED8] gap-2" size="sm">
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
      </PageContainer>
    </DashboardLayout>
  );
}
