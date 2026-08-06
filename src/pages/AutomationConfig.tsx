import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Clock, Bell, UserX, Save, RefreshCw, ShieldCheck, CalendarClock, AlertTriangle,
  Handshake, X, Plus, Sliders, Video, CheckCircle2, GitBranch, Activity,
  CalendarOff,
} from "lucide-react";
import { PeriodosDeAusencia } from "@/components/automations/PeriodosDeAusencia";

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
  const [aba, setAba] = useState("regua");

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

  // As cinco abas do handoff. Cada regra carrega a mensagem literal que sai
  // para o cliente: quem liga um lembrete precisa ver o texto antes, não
  // depois de alguém receber.
  const ABAS = [
    { id: "regua", rotulo: "Régua do agendamento", Icone: CalendarClock },
    { id: "faltas", rotulo: "Faltas e pós-atendimento", Icone: UserX },
    { id: "funil", rotulo: "Funil", Icone: GitBranch },
    { id: "handoff", rotulo: "Handoff humano", Icone: Handshake },
    { id: "ausencia", rotulo: "Ausência", Icone: CalendarOff },
    { id: "status", rotulo: "Status", Icone: Activity },
  ];

  const REGRAS: Record<string, any[]> = {
    regua: [
      {
        Icone: CheckCircle2, cor: "text-emerald-600", fundo: "bg-emerald-50",
        titulo: "Confirmação do agendamento", quando: "Assim que o horário é marcado",
        desc: "Agradece, resume data e hora e manda o link da reunião quando existe.",
        campo: "bookedEnabled", texto: "bookedMsgTemplate",
      },
      {
        Icone: Bell, cor: "text-blue-600", fundo: "bg-blue-50",
        titulo: "Pedido de confirmação", quando: `${config.autoConfirmHours}h antes`,
        desc: "Pergunta se o cliente confirma. Quem não responde vira “risco de falta” na agenda.",
        campo: "confirmEnabled", texto: "confirmMsgTemplate",
        numero: { campo: "autoConfirmHours", rotulo: "Horas antes" },
      },
      {
        Icone: Video, cor: "text-violet-600", fundo: "bg-violet-50",
        titulo: "Link da reunião", quando: `${config.meetLinkMinutes} min antes`,
        desc: "Envia o link do Meet pouco antes da hora, para ninguém procurar no histórico.",
        campo: "meetLinkEnabled", texto: "meetMsgTemplate",
        numero: { campo: "meetLinkMinutes", rotulo: "Minutos antes" },
      },
      {
        Icone: Clock, cor: "text-amber-600", fundo: "bg-amber-50",
        titulo: "Lembrete final", quando: "Na hora marcada",
        desc: "Avisa que é agora.",
        campo: "finalEnabled", texto: "finalMsgTemplate",
      },
    ],
    faltas: [
      {
        Icone: UserX, cor: "text-rose-600", fundo: "bg-rose-50",
        titulo: "Falta (no-show)", quando: `${config.lateToleranceMin} min de tolerância`,
        desc: "Se ninguém confirmou presença depois da tolerância, pergunta o que houve e oferece remarcar.",
        campo: "noShowEnabled", texto: "lateMsgTemplate",
        numero: { campo: "lateToleranceMin", rotulo: "Minutos de tolerância" },
      },
      {
        Icone: ShieldCheck, cor: "text-emerald-600", fundo: "bg-emerald-50",
        titulo: "Pós-atendimento", quando: `${config.postServiceHours}h depois`,
        desc: "Pergunta como foi. É a pesquisa de satisfação, sem formulário.",
        campo: "postServiceEnabled", texto: "postServiceMsgTemplate",
        numero: { campo: "postServiceHours", rotulo: "Horas depois" },
      },
    ],
  };

  const totalRegras = [
    config.bookedEnabled, config.confirmEnabled, config.meetLinkEnabled,
    config.finalEnabled, config.noShowEnabled, config.postServiceEnabled,
  ].filter(Boolean).length;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1500px] px-4 pb-10 pt-5 sm:px-6">

        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Lembretes e rotinas</h1>
            <p className="mt-0.5 max-w-lg text-[13.5px] text-muted-foreground">
              A régua completa do agendamento: confirmação, lembrete antes da hora, link da reunião,
              aviso final e o que fazer quando alguém falta.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => navigate("/automations/builder")} className="h-10 gap-2">
              <Sliders className="h-4 w-4" /> Fluxos avançados
            </Button>
            <Button onClick={handleSave} disabled={saving} className="h-10 gap-2">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </header>

        {!config.remindersEnabled && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="flex-1 text-[13px] text-amber-900">
              A régua está desligada por completo — nenhum aviso automático sai enquanto isso,
              mesmo com as regras abaixo ligadas.
            </p>
            <Button size="sm" onClick={() => set("remindersEnabled", true)} className="bg-amber-600 hover:bg-amber-700">
              Ligar a régua
            </Button>
          </div>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          {/* ───── Card principal ───── */}
          <div className="min-w-0 rounded-[14px] border border-border bg-card shadow-card">
            <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
              {ABAS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id)}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-colors ${
                    aba === a.id ? "bg-accent-soft text-accent-text" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <a.Icone className="h-3.5 w-3.5" /> {a.rotulo}
                </button>
              ))}
            </nav>

            <div className="space-y-3 p-5">
              {aba === "ausencia" && <PeriodosDeAusencia />}

              {(aba === "regua" || aba === "faltas") && REGRAS[aba].map((r) => (
                <article key={r.campo} className="rounded-xl border border-border-soft p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${r.fundo}`}>
                      <r.Icone className={`h-4 w-4 ${r.cor}`} />
                    </span>
                    <div className="min-w-[180px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-foreground">{r.titulo}</h3>
                        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {r.quando}
                        </span>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{r.desc}</p>
                    </div>
                    <Switch
                      checked={!!config[r.campo as keyof Config]}
                      onCheckedChange={(v) => set(r.campo as keyof Config, v as any)}
                      aria-label={r.titulo}
                    />
                  </div>

                  {/* A mensagem literal, editável: é o que o cliente recebe. */}
                  <div className="mt-3 rounded-lg bg-surface-2 p-3">
                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                      Mensagem enviada
                    </Label>
                    <Textarea
                      value={String(config[r.texto as keyof Config] ?? "")}
                      onChange={(e) => set(r.texto as keyof Config, e.target.value as any)}
                      rows={4}
                      className="mt-1.5 resize-none border-border-soft bg-background text-[13px]"
                    />
                    <p className="mt-1.5 text-[11px] text-faint">
                      {"{name}"} vira o nome · {"{date}"} a data · {"{time}"} a hora · {"{link_block}"} o link do Meet
                      (some sozinho quando não há).
                    </p>
                  </div>

                  {r.numero && (
                    <div className="mt-3 flex items-center gap-3">
                      <Label className="text-[12px] font-medium text-muted-foreground">{r.numero.rotulo}</Label>
                      <Input
                        type="number" min="0"
                        value={Number(config[r.numero.campo as keyof Config] ?? 0)}
                        onChange={(e) => set(r.numero.campo as keyof Config, Number(e.target.value) as any)}
                        className="h-9 w-24"
                      />
                    </div>
                  )}
                </article>
              ))}

              {aba === "funil" && (
                <article className="rounded-xl border border-border-soft p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-50">
                      <GitBranch className="h-4 w-4 text-violet-600" />
                    </span>
                    <div className="min-w-[180px] flex-1">
                      <h3 className="text-[14px] font-semibold text-foreground">Mover o contato no funil sozinho</h3>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                        Quando o agendamento é marcado, confirmado ou o cliente falta, o card anda de etapa
                        sem ninguém arrastar.
                      </p>
                    </div>
                    <Switch checked={config.pipelineAutoEnabled} onCheckedChange={(v) => set("pipelineAutoEnabled", v)} />
                  </div>
                  <p className="mt-3 rounded-lg bg-surface-2 p-3 text-[12.5px] text-muted-foreground">
                    As etapas de destino são casadas pelo nome do que já existe no seu funil. Renomeou uma
                    etapa? Confira em <button onClick={() => navigate("/crm")} className="font-semibold text-accent-text hover:underline">Funil de clientes</button>.
                  </p>
                </article>
              )}

              {aba === "handoff" && (
                <article className="rounded-xl border border-border-soft p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50">
                      <Handshake className="h-4 w-4 text-blue-600" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-foreground">Palavras que chamam um humano</h3>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                        Ao ouvir qualquer uma delas, o agente para de responder e joga a conversa na fila
                        de atendimento.
                      </p>
                      <div className="mt-3">
                        <TagInput
                          value={config.humanHandoffTags}
                          onChange={(v) => set("humanHandoffTags", v)}
                          placeholder="ex.: reclamação"
                        />
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {aba === "status" && (
                <div className="space-y-3">
                  {(status?.falhas || []).length === 0 && (status?.proximos || []).length === 0 ? (
                    <div className="grid place-items-center gap-2 py-12 text-center">
                      <Activity className="h-7 w-7 text-border-soft" />
                      <p className="text-[13px] text-muted-foreground">Nenhum lembrete na fila nem falha nos últimos 7 dias.</p>
                    </div>
                  ) : (
                    <>
                      {(status?.falhas || []).length > 0 && (
                        <section>
                          <h3 className="mb-2 text-[13px] font-semibold text-foreground">Falhas dos últimos 7 dias</h3>
                          <div className="space-y-2">
                            {status.falhas.map((f: any) => (
                              <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
                                <div className="min-w-[160px] flex-1">
                                  <p className="text-[13px] font-semibold text-red-900">
                                    {KIND_LABEL[f.kind] || f.kind} · {f.appointment?.lead?.name || "Contato"}
                                  </p>
                                  <p className="mt-0.5 text-[12px] leading-relaxed text-red-700">
                                    {f.error || "Falha sem motivo registrado."}
                                  </p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => retry(f.id)} className="bg-card">
                                  Reenviar
                                </Button>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                      {(status?.proximos || []).length > 0 && (
                        <section>
                          <h3 className="mb-2 mt-4 text-[13px] font-semibold text-foreground">Na fila</h3>
                          <div className="divide-y divide-border-soft rounded-xl border border-border-soft">
                            {status.proximos.map((p: any) => (
                              <div key={p.id} className="flex items-center gap-3 px-3.5 py-2.5">
                                <span className="num shrink-0 text-[12.5px] font-semibold text-accent-text">{quando(p.runAt)}</span>
                                <span className="linha-unica-elipse min-w-0 flex-1 text-[12.5px] text-foreground">
                                  {KIND_LABEL[p.kind] || p.kind}
                                </span>
                                <span className="linha-unica-elipse shrink-0 text-[12px] text-faint">
                                  {p.appointment?.lead?.name || "Contato"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ───── Lateral ───── */}
          <div className="space-y-4">
            <section className="rounded-[14px] border border-border bg-card shadow-card">
              <header className="border-b border-border px-4 py-3">
                <h2 className="text-[14px] font-semibold text-foreground">Próximos envios</h2>
              </header>
              {(status?.proximos || []).length === 0 ? (
                <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">Nada na fila agora.</p>
              ) : (
                <ul className="divide-y divide-border-soft">
                  {status.proximos.slice(0, 6).map((p: any) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="num shrink-0 text-[12px] font-semibold text-accent-text">{quando(p.runAt)}</span>
                      <span className="linha-unica-elipse min-w-0 flex-1 text-[12.5px] text-foreground">
                        {KIND_LABEL[p.kind] || p.kind}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-[14px] border border-border bg-card shadow-card">
              <header className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-[14px] font-semibold text-foreground">Falhas recentes</h2>
                {(status?.falhas || []).length > 0 && (
                  <span className="num rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                    {status.falhas.length}
                  </span>
                )}
              </header>
              {(status?.falhas || []).length === 0 ? (
                <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">Nenhuma falha em 7 dias.</p>
              ) : (
                <ul className="divide-y divide-border-soft">
                  {status.falhas.slice(0, 4).map((f: any) => (
                    <li key={f.id} className="px-4 py-3">
                      <p className="linha-unica-elipse text-[12.5px] font-semibold text-foreground">
                        {f.appointment?.lead?.name || "Contato"}
                      </p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-red-600">
                        {f.error || "Falha sem motivo registrado."}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-[14px] border border-border bg-card p-4 shadow-card">
              <h2 className="text-[14px] font-semibold text-foreground">Impacto na semana</h2>
              <div className="mt-4 space-y-3">
                {[
                  { r: "Lembretes enviados", v: status?.enviadosNaSemana || 0, cor: "bg-[#2563EB]" },
                  { r: "Na fila", v: (status?.proximos || []).length, cor: "bg-emerald-500" },
                  { r: "Falharam", v: (status?.falhas || []).length, cor: "bg-red-500" },
                ].map((b) => {
                  const teto = Math.max(
                    status?.enviadosNaSemana || 0,
                    (status?.proximos || []).length,
                    (status?.falhas || []).length,
                    1
                  );
                  return (
                    <div key={b.r}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12.5px] text-muted-foreground">{b.r}</span>
                        <span className="num text-[13px] font-bold text-foreground">{b.v}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className={`h-full rounded-full ${b.cor}`} style={{ width: `${(b.v / teto) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
                {totalRegras} de 6 regras ligadas.
                {!config.remindersEnabled && " A régua geral está desligada — nada sai."}
              </p>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
