import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Megaphone, Plus, Play, Pause, Trash2, AlertTriangle, CheckCircle2, Clock, Users, Info, ArrowUpRight,
  BarChart3, Download, XCircle, ShieldCheck,
  CalendarClock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AudiencePicker } from "@/components/campaigns/AudiencePicker";
import { TemplatePreview } from "@/components/templates/TemplatePreview";

const brl = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Rascunho", cls: "bg-slate-100 text-slate-600" },
  RUNNING: { label: "Enviando", cls: "bg-blue-100 text-blue-700" },
  PAUSED: { label: "Pausada", cls: "bg-orange-100 text-orange-700" },
  COMPLETED: { label: "Concluída", cls: "bg-emerald-100 text-emerald-700" },
};

export default function Campaigns() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [quota, setQuota] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", templateId: "", accountId: "" });
  // Valores dos {{n}} do template. A Meta exige exatamente a quantidade
  // declarada — faltando um, o disparo falha com #132000 em cada contato.
  const [variables, setVariables] = useState<string[]>([]);
  // Seleção explícita de contatos; substitui o filtro por etapa do funil.
  const [leadIds, setLeadIds] = useState<string[]>([]);
  const [report, setReport] = useState<any>(null);
  // Qual campanha está com o seletor de data aberto, e para quando.
  const [agendando, setAgendando] = useState<{ id: string; quando: string } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewErro, setPreviewErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** `datetime-local` fala em hora local sem fuso; o servidor fala em ISO. */
const paraCampoLocal = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  const load = async () => {
    try {
      const [cRes, tRes, connRes, qRes] = await Promise.all([
        fetch("/api/campaigns", { headers: auth() }),
        fetch("/api/templates", { headers: auth() }),
        fetch("/api/whatsapp/accounts", { headers: auth() }),
        fetch("/api/campaigns/quota", { headers: auth() }),
      ]);
      setCampaigns(cRes.ok ? await cRes.json() : []);
      const tpls = tRes.ok ? await tRes.json() : [];
      // Só template aprovado pode ser disparado.
      setTemplates(tpls.filter((t: any) => t.status === "APPROVED"));
      const conns = connRes.ok ? await connRes.json() : [];
      setConnections(conns.filter((c: any) => c.mode === "CLOUD"));
      setQuota(qRes.ok ? await qRes.json() : null);
    } catch {
      toast({ title: "Não foi possível carregar as campanhas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Enquanto houver campanha enviando, atualiza o progresso periodicamente.
  useEffect(() => {
    if (!campaigns.some((c) => c.status === "RUNNING")) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [campaigns]);

  const runPreview = async (patch: any = {}, ids: string[] = leadIds) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (!next.templateId) { setPreview(null); setPreviewErro(null); return; }
    setPreviewErro(null);
    try {
      const res = await fetch("/api/campaigns/preview", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: next.templateId, leadIds: ids.length ? ids : undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Erro engolido aqui deixava a tela presa em "calculando" sem pista.
        setPreview(null);
        setPreviewErro(d.error || `A projeção falhou (HTTP ${res.status}).`);
        return;
      }
      setPreview(d);
      // Ao trocar de template, redimensiona a lista de variáveis preservando
      // o que já foi digitado. {{1}} já vem com o nome do contato.
      if (patch.templateId) {
        const n = d.variableCount || 0;
        setVariables(Array.from({ length: n }, (_, i) => (i === 0 ? "{{nome}}" : "")));
      }
    } catch (e: any) {
      setPreview(null);
      setPreviewErro(e.message || "Não foi possível calcular a projeção.");
    }
  };

  const create = async () => {
    if (!form.name || !form.templateId) {
      return toast({ title: "Nome e template são obrigatórios", variant: "destructive" });
    }
    setBusy(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          templateId: form.templateId,
          leadIds,
          variables,
          accountId: form.accountId || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: "Campanha criada. Revise e dispare quando quiser." });
      setModalOpen(false);
      setForm({ name: "", templateId: "", accountId: "" });
      setVariables([]);
      setLeadIds([]);
      setPreview(null);
      load();
    } catch (e: any) {
      toast({ title: e.message || "Erro ao criar", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const act = async (c: any, action: "start" | "pause") => {
    if (action === "start" && !confirm(
      `Disparar "${c.name}" para ${c.recipientCount} contato(s)?\n\n` +
      `Custo estimado: ${brl(c.estimatedCost)}.\nO envio não pode ser desfeito.`
    )) return;
    const res = await fetch(`/api/campaigns/${c.id}/${action}`, { method: "POST", headers: auth() });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast({ title: action === "start" ? "Disparo iniciado" : "Campanha pausada" }); load(); }
    else toast({ title: d.error || "Erro", variant: "destructive" });
  };

  /** Marca, remarca ou desmarca a hora do disparo. */
  const agendar = async (c: any, quando: string | null) => {
    const res = await fetch(`/api/campaigns/${c.id}/schedule`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: quando }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast({ title: d.error || "Não foi possível agendar", variant: "destructive" });
    toast({ title: quando ? "Disparo agendado" : "Agendamento cancelado" });
    setAgendando(null);
    load();
  };

  const remove = async (c: any) => {
    if (!confirm(`Remover a campanha "${c.name}"?`)) return;
    const res = await fetch(`/api/campaigns/${c.id}`, { method: "DELETE", headers: auth() });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast({ title: "Campanha removida" }); load(); }
    else toast({ title: d.error || "Erro ao remover", variant: "destructive" });
  };

  const abrirRelatorio = async (c: any) => {
    try {
      const res = await fetch(`/api/campaigns/${c.id}/report`, { headers: auth() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setReport(d);
      setReportOpen(true);
    } catch (e: any) {
      toast({ title: e.message || "Não foi possível abrir o relatório", variant: "destructive" });
    }
  };

  const baixarCsv = async (id: string) => {
    const res = await fetch(`/api/campaigns/${id}/report?formato=csv`, { headers: auth() });
    if (!res.ok) return toast({ title: "Falha ao gerar o CSV", variant: "destructive" });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "relatorio-disparo.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const semFranquia = quota && quota.semDisparo;

  // A lista de /api/templates traz cabeçalho, rodapé e botões — o que a
  // prévia precisa para montar o balão inteiro.
  const templateSelecionado = templates.find((t) => t.id === form.templateId);

  // Por que o botão de criar está bloqueado. Botão desabilitado sem motivo
  // visível é o que mais confunde: aqui a razão aparece do lado dele.
  const motivoBloqueio = (() => {
    if (!form.name.trim()) return "Dê um nome à campanha.";
    if (!form.templateId) {
      return templates.length === 0
        ? "Você ainda não tem template aprovado pela Meta. Crie um em Templates."
        : "Escolha o template que será disparado.";
    }
    if (leadIds.length === 0) return "Selecione ao menos um contato.";
    if (previewErro) return previewErro;
    if (!preview) return "Calculando a projeção…";
    if (!preview.approved) return "Este template ainda não foi aprovado pela Meta.";
    if (preview.recipientCount === 0) {
      const p = preview.publico;
      if (!p) return "Nenhum contato elegível nesse público.";
      if (p.total === 0) return "Você ainda não tem contatos cadastrados.";
      if (p.naEtapa === 0) return `Nenhum contato nessa etapa do funil (${p.total} no total).`;
      if (p.semTelefone >= p.total) return `Nenhum dos ${p.total} contatos tem telefone cadastrado.`;
      return `Nenhum elegível: ${p.total} contato(s), ${p.semTelefone} sem telefone, ${p.optOut} em opt-out.`;
    }
    if (!preview.quota?.allowed) return preview.quota?.reason || "Crédito de disparo insuficiente.";
    // {{1}} pode ficar em branco (vira o nome do contato); as demais, não.
    const faltando = variables.findIndex((v, i) => i > 0 && !v.trim());
    if (faltando > 0) return `Preencha o valor de {{${faltando + 1}}}.`;
    return null;
  })();

  // Agendada ainda não saiu: pertence ao mesmo bloco do que está pronto para
  // disparar, só que com a hora à vista.
  const rascunhos = campaigns.filter((c) => ["DRAFT", "SCHEDULED"].includes(c.status));
  const anteriores = campaigns.filter((c) => c.status !== "DRAFT");

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6">

        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Disparos em massa</h1>
            <p className="mt-0.5 max-w-lg text-[13.5px] text-muted-foreground">
              Envio de templates aprovados pela API oficial do WhatsApp.
            </p>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            disabled={semFranquia}
            title={semFranquia ? "Seu plano não inclui disparos em massa." : undefined}
            className="h-10 gap-2"
          >
            <Plus className="h-4 w-4" /> Nova campanha
          </Button>
        </header>

        {/* Crédito do ciclo */}
        {quota && (
          <section className="mb-4 rounded-[14px] border border-border bg-card p-5 shadow-card">
            {semFranquia ? (
              <div className="flex flex-wrap items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="min-w-[220px] flex-1">
                  <p className="text-[14px] font-semibold text-foreground">Seu plano não inclui disparos em massa</p>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    Faça upgrade para liberar o envio de campanhas pela API oficial.
                  </p>
                </div>
                <Button size="sm" onClick={() => navigate("/assinatura")} className="gap-1.5">
                  Ver planos <ArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-faint">
                    Crédito de disparo do ciclo
                  </span>
                  <span className={`num text-[14px] font-bold ${quota.baixo ? "text-amber-600" : "text-foreground"}`}>
                    {brl(quota.saldo)} <span className="font-medium text-faint">de {brl(quota.total)}</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full transition-[width] ${quota.baixo ? "bg-amber-500" : "bg-primary"}`}
                    style={{ width: `${Math.min(quota.percentualUsado || 0, 100)}%` }}
                  />
                </div>

                {quota.cobraPorMensagem ? (
                  <>
                    {/* Saldo em dinheiro só vira decisão com a equivalência ao lado. */}
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {[["MARKETING", "Marketing"], ["UTILITY", "Utilidade"], ["AUTHENTICATION", "Autenticação"]].map(([k, r]) => (
                        <div key={k} className="rounded-xl bg-surface-2 px-3 py-2.5 text-center">
                          <p className="text-[11px] uppercase tracking-wide text-faint">{r}</p>
                          <p className="num mt-0.5 text-[18px] font-bold tabular-nums text-foreground">
                            {(quota.equivale?.[k] ?? 0).toLocaleString("pt-BR")}
                          </p>
                          <p className="num text-[11px] text-faint">{brl(quota.precos?.[k] || 0)} cada</p>
                        </div>
                      ))}
                    </div>
                    {quota.baixo && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                        <span className="flex-1 text-[12.5px] text-amber-900">
                          {quota.esgotado
                            ? "Crédito esgotado — as campanhas ficam bloqueadas até a renovação ou uma recarga."
                            : "Resta menos de 20% do crédito. Vale recarregar antes da próxima campanha."}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => navigate("/assinatura")} className="h-8 bg-card text-[12px]">
                          Recarregar
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-3 text-[12.5px] text-muted-foreground">
                    Seu plano dispara por QR Code: <strong className="font-semibold">sem cobrança por mensagem</strong>.
                    O crédito não é debitado neste canal.
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {templates.length === 0 && !loading && !semFranquia && (
          <div className="mb-4 flex gap-3 rounded-[14px] border border-amber-200 bg-amber-50 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[13px] leading-relaxed text-amber-900">
              <strong className="font-semibold">Nenhum template aprovado.</strong> Só é possível disparar
              mensagens que a Meta já aprovou. Crie e envie um para aprovação em{" "}
              <a href="/templates" className="font-semibold underline">Templates</a>.
            </p>
          </div>
        )}

        {/* Rascunhos: o que está pronto para sair */}
        {rascunhos.map((c) => (
          <section key={c.id} className="mb-4 rounded-[14px] border border-accent-text/30 bg-accent-soft p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-text">
                  {c.status === "SCHEDULED" ? "Agendado" : "Rascunho"}
                </p>
                <h2 className="mt-1 text-[17px] font-bold text-foreground">{c.name}</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  Template <span className="font-mono">{c.template?.name}</span> · {c.recipientCount || 0} contatos no público
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" onClick={() => remove(c)} className="h-9 bg-card text-[12.5px]">Descartar</Button>
                {c.status === "SCHEDULED" ? (
                  <Button
                    variant="outline"
                    onClick={() => agendar(c, null)}
                    className="h-9 gap-1.5 bg-card text-[12.5px]"
                  >
                    <CalendarClock className="h-3.5 w-3.5" /> Cancelar agendamento
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setAgendando({
                        id: c.id,
                        // Uma hora à frente: agendar para daqui a instantes é
                        // quase sempre engano, e o servidor recusa o passado.
                        quando: paraCampoLocal(new Date(Date.now() + 60 * 60 * 1000)),
                      })
                    }
                    className="h-9 gap-1.5 bg-card text-[12.5px]"
                  >
                    <CalendarClock className="h-3.5 w-3.5" /> Agendar
                  </Button>
                )}
                <Button onClick={() => act(c, "start")} className="h-9 gap-1.5 text-[12.5px]">
                  <Play className="h-3.5 w-3.5" /> Disparar agora
                </Button>
              </div>
            </div>

            {c.status === "SCHEDULED" && c.scheduledAt && (
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-card px-3 py-2 text-[12.5px] font-medium text-foreground">
                <CalendarClock className="h-3.5 w-3.5 text-accent-text" />
                Sai automaticamente em{" "}
                {new Date(c.scheduledAt).toLocaleString("pt-BR", {
                  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            )}

            {agendando?.id === c.id && (
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-card p-3">
                <div className="min-w-[200px] flex-1 space-y-1">
                  <label className="text-[11.5px] font-semibold text-muted-foreground">Disparar em</label>
                  <Input
                    type="datetime-local"
                    value={agendando.quando}
                    onChange={(e) => setAgendando({ id: c.id, quando: e.target.value })}
                    className="h-9 text-[13px]"
                  />
                </div>
                <Button variant="outline" className="h-9 text-[12.5px]" onClick={() => setAgendando(null)}>
                  Cancelar
                </Button>
                <Button
                  className="h-9 gap-1.5 text-[12.5px]"
                  onClick={() => agendar(c, new Date(agendando.quando).toISOString())}
                >
                  <CalendarClock className="h-3.5 w-3.5" /> Confirmar
                </Button>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { r: "Contatos", v: (c.recipientCount || 0).toLocaleString("pt-BR") },
                { r: "Custo estimado", v: brl(c.estimatedCost) },
                { r: "Template", v: (c.template?.category || "").toLowerCase() === "marketing" ? "Marketing" : "Utilidade" },
                { r: "Criada em", v: new Date(c.createdAt).toLocaleDateString("pt-BR") },
              ].map((p) => (
                <div key={p.r} className="rounded-xl bg-card px-3 py-2.5">
                  <p className="text-[11px] text-faint">{p.r}</p>
                  <p className="num mt-0.5 linha-unica-elipse text-[15px] font-bold text-foreground">{p.v}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : campaigns.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-[14px] border border-border bg-card px-6 py-20 text-center shadow-card">
            <Megaphone className="h-8 w-8 text-border-soft" />
            <div>
              <p className="text-[14px] font-semibold text-foreground">Nenhuma campanha ainda</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Crie uma para disparar um template para a sua base.</p>
            </div>
          </div>
        ) : anteriores.length > 0 && (
          <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-[14px] font-semibold text-foreground">Campanhas anteriores</h2>
            </header>
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 border-b border-border bg-surface-2 px-4 py-2.5">
                  {["Campanha", "Status", "Contatos", "Enviadas", "Falhas", "Custo"].map((h) => (
                    <span key={h} className="linha-unica text-[11px] font-semibold uppercase tracking-wide text-faint">{h}</span>
                  ))}
                </div>
                {anteriores.map((c) => {
                  const st = STATUS[c.status] || STATUS.DRAFT;
                  const total = c.recipientCount || 0;
                  const feitos = (c.sentCount || 0) + (c.errorCount || 0);
                  return (
                    <div key={c.id} className="border-b border-border-soft px-4 py-3 last:border-0 hover:bg-surface-2">
                      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] items-center gap-3">
                        <div className="min-w-0">
                          <p className="linha-unica-elipse text-[13px] font-semibold text-foreground">{c.name}</p>
                          <p className="linha-unica-elipse font-mono text-[11px] text-faint">{c.template?.name}</p>
                        </div>
                        <span className={`linha-unica w-fit rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                        <span className="num text-[12.5px] text-muted-foreground">{total.toLocaleString("pt-BR")}</span>
                        <span className="num text-[12.5px] font-semibold text-accent-text">
                          {(c.sentCount || 0).toLocaleString("pt-BR")}
                        </span>
                        <span className={`num text-[12.5px] ${c.errorCount > 0 ? "font-semibold text-rose-600" : "text-faint"}`}>
                          {c.errorCount || 0}
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="num text-[12.5px] text-muted-foreground">{brl(c.estimatedCost)}</span>
                          <span className="flex shrink-0 gap-1">
                            {c.status === "RUNNING" && (
                              <button onClick={() => act(c, "pause")} title="Pausar"
                                className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-card hover:text-foreground">
                                <Pause className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {c.status === "PAUSED" && (
                              <button onClick={() => act(c, "start")} title="Retomar"
                                className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-card hover:text-accent-text">
                                <Play className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button onClick={() => abrirRelatorio(c)} title="Relatório"
                              className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-card hover:text-accent-text">
                              <BarChart3 className="h-3.5 w-3.5" />
                            </button>
                            {c.status !== "RUNNING" && (
                              <button onClick={() => remove(c)} title="Remover"
                                className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </span>
                        </span>
                      </div>
                      {c.status === "RUNNING" && total > 0 && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(feitos / total) * 100}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* LGPD — quem pediu para não receber não recebe, e isso é visível. */}
        <section className="mt-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-amber-200 bg-amber-50 p-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="min-w-[240px] flex-1 text-[12.5px] leading-relaxed text-amber-900">
            <strong className="font-semibold">Contatos que pediram para parar ficam de fora de todo disparo.</strong>{" "}
            A exclusão é automática e não depende de o público estar certo — nenhuma campanha alcança quem
            se descadastrou.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/contacts")} className="bg-card text-[12px]">
            Ver contatos
          </Button>
        </section>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-bold">Nova campanha</DialogTitle>
            <DialogDescription>
              A projeção de custo aparece conforme você escolhe o template e o público.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Nome da campanha</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Promoção de julho" className="rounded-2xl bg-slate-50 border-none font-medium" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Template aprovado</Label>
              <Select value={form.templateId} onValueChange={(v) => runPreview({ templateId: v })}>
                <SelectTrigger className="rounded-2xl bg-slate-50 border-none font-bold">
                  <SelectValue placeholder="Escolha um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="font-bold">
                      {t.name} · {t.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {variables.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
                <Label className="text-xs font-bold text-slate-500">
                  Variáveis do template ({variables.length})
                </Label>
                <p className="text-xs text-slate-500 font-medium">
                  Use <code className="font-bold">{"{{nome}}"}</code> para inserir o nome de cada contato.
                </p>
                {variables.map((v, i) => (
                  <Input
                    key={i}
                    value={v}
                    onChange={(e) => {
                      const next = [...variables];
                      next[i] = e.target.value;
                      setVariables(next);
                    }}
                    placeholder={`Valor de {{${i + 1}}}`}
                    className="rounded-2xl bg-white border-none font-medium"
                  />
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Contatos que vão receber</Label>
              <AudiencePicker
                value={leadIds}
                onChange={(ids) => { setLeadIds(ids); runPreview({}, ids); }}
              />
            </div>

            {connections.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">Número remetente</Label>
                <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
                  <SelectTrigger className="rounded-2xl bg-slate-50 border-none font-bold">
                    <SelectValue placeholder="Primeira conexão disponível" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="font-bold">{c.name} · {c.phone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {preview && (
              <div className={`rounded-2xl p-4 space-y-2 ${preview.canSend ? "bg-slate-50" : "bg-amber-50"}`}>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Destinatários</span>
                  <span className="font-bold text-slate-800">{preview.recipientCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">
                    Custo por mensagem ({preview.estimate.category.toLowerCase()})
                  </span>
                  <span className="font-bold text-slate-800">{brl(preview.estimate.unitPriceBrl)}</span>
                </div>
                <div className="flex justify-between text-base border-t pt-2">
                  <span className="text-slate-600 font-bold">Total estimado</span>
                  <span className="font-bold text-[#2563EB]">{brl(preview.estimate.priceBrl)}</span>
                </div>

                {/* Quanto sobra depois — decidir "mando ou não" exige saber o
                    que fica no caixa, não só o que sai. */}
                {preview.quota?.cobraPorMensagem && preview.quota?.total > 0 && (
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-slate-500">Saldo depois deste envio</span>
                    <span className="font-bold text-slate-700">
                      {brl(Math.max(0, (preview.quota.saldo || 0) - (preview.estimate.priceBrl || 0)))}
                      <span className="font-medium text-slate-400"> de {brl(preview.quota.saldo || 0)}</span>
                    </span>
                  </div>
                )}
                {preview.canSend && preview.quota?.fatiaDoSaldo >= 0.5 && (
                  <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Este envio consome {Math.round(preview.quota.fatiaDoSaldo * 100)}% do seu crédito de disparo.
                  </p>
                )}
                {!preview.canSend && (
                  <p className="text-xs text-amber-800 font-medium flex items-start gap-1.5 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {!preview.approved
                      ? "Template ainda não aprovado pela Meta."
                      : preview.recipientCount === 0
                      ? "Nenhum destinatário elegível nesse público."
                      : preview.quota?.reason}
                  </p>
                )}
              </div>
            )}
          </div>

            <div className="lg:border-l lg:pl-6">
              <div className="lg:sticky lg:top-0 space-y-3 py-2">
                <Label className="text-xs font-bold text-slate-500">Como o contato vai receber</Label>
                {templateSelecionado ? (
                  <TemplatePreview
                    template={templateSelecionado}
                    variables={variables}
                    contactName={preview?.amostra?.name || "Maria"}
                    businessName={
                      connections.find((c) => c.id === form.accountId)?.name || connections[0]?.name || "Sua empresa"
                    }
                  />
                ) : (
                  <p className="text-xs text-slate-400 font-medium">
                    Escolha o template para ver a mensagem como ela chega no WhatsApp.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row sm:items-center gap-2">
            {motivoBloqueio && (
              <p className="text-xs text-amber-700 font-medium flex items-start gap-1.5 flex-1 text-left">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {motivoBloqueio}
              </p>
            )}
            <Button
              onClick={create}
              disabled={busy || !!motivoBloqueio}
              className="rounded-2xl font-bold bg-[#2563EB] shrink-0"
            >
              <Clock className="w-4 h-4 mr-2" /> Criar campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
