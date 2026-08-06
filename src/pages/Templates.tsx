import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Plus, RefreshCw, Copy, Trash2, Send, Save, AlertCircle, CheckCircle2, Clock, XCircle, Info, Eye,
} from "lucide-react";
import { TemplatePreview } from "@/components/templates/TemplatePreview";

/** Espelha os status da Meta; só APPROVED pode ser disparado. */
const STATUS = {
  DRAFT: { label: "Rascunho", cls: "bg-slate-100 text-slate-600", icon: FileText },
  PENDING: { label: "Em análise", cls: "bg-amber-100 text-amber-700", icon: Clock },
  APPROVED: { label: "Aprovado", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejeitado", cls: "bg-red-100 text-red-700", icon: XCircle },
  PAUSED: { label: "Pausado", cls: "bg-orange-100 text-orange-700", icon: AlertCircle },
} as const;

const CATEGORIES = [
  { id: "UTILITY", label: "Utilidade", hint: "Confirmações, lembretes, atualizações de pedido. Mais barato." },
  { id: "MARKETING", label: "Marketing", hint: "Promoções e novidades. Tarifa mais alta e sujeito a limite diário." },
  { id: "AUTHENTICATION", label: "Autenticação", hint: "Códigos de verificação." },
];

const EMPTY = {
  name: "", content: "", category: "UTILITY", language: "pt_BR",
  headerType: "", headerText: "", footerText: "", buttons: [] as any[], accountId: "",
  // headerHandle é o exemplo exigido pela Meta na aprovação (expira em ~24h);
  // mediaUrl é o arquivo que vai em cada disparo.
  headerHandle: "", mediaUrl: "", headerFileName: "",
};

export default function Templates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  // Template da lista aberto só para visualizar (inclusive os já aprovados,
  // que não podem mais ser editados).
  const [previewing, setPreviewing] = useState<any>(null);

  const token = () => localStorage.getItem("token");
  const auth = () => ({ Authorization: `Bearer ${token()}` });

  const load = async () => {
    try {
      const [tRes, cRes] = await Promise.all([
        fetch("/api/templates", { headers: auth() }),
        fetch("/api/whatsapp/accounts", { headers: auth() }),
      ]);
      setTemplates(tRes.ok ? await tRes.json() : []);
      const conns = cRes.ok ? await cRes.json() : [];
      // Template vive na WABA: só conexão oficial serve.
      setConnections(conns.filter((c: any) => c.mode === "CLOUD"));
    } catch {
      toast({ title: "Não foi possível carregar os templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/templates/sync", {
        method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: "{}",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: `Sincronizado: ${d.criados} novo(s), ${d.atualizados} atualizado(s)` });
      load();
    } catch (e: any) {
      toast({ title: e.message || "Falha ao sincronizar", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, accountId: connections[0]?.id || "" });
    setModalOpen(true);
  };

  const openEdit = (t: any) => {
    let btns: any[] = [];
    try { btns = t.buttons ? JSON.parse(t.buttons) : []; } catch { btns = []; }
    setEditing(t);
    setForm({
      name: t.name, content: t.content, category: t.category, language: t.language,
      headerType: t.headerType || "", headerText: t.headerText || "",
      footerText: t.footerText || "", buttons: btns, accountId: t.accountId || connections[0]?.id || "",
      headerHandle: "", mediaUrl: t.mediaUrl || "", headerFileName: "",
    });
    setModalOpen(true);
  };

  const save = async (submit: boolean) => {
    if (!form.name || !form.content) {
      return toast({ title: "Nome e corpo são obrigatórios", variant: "destructive" });
    }
    setSaving(true);
    try {
      const url = editing ? `/api/templates/${editing.id}` : "/api/templates";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, submit }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: submit ? "Enviado para aprovação da Meta" : "Rascunho salvo" });
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast({ title: e.message || "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (t: any) => {
    const res = await fetch(`/api/templates/${t.id}/duplicate`, { method: "POST", headers: auth() });
    if (res.ok) { toast({ title: "Cópia criada como rascunho" }); load(); }
    else toast({ title: "Erro ao duplicar", variant: "destructive" });
  };

  const remove = async (t: any) => {
    if (!confirm(`Remover o template "${t.name}"? Se já estiver na Meta, será removido lá também.`)) return;
    const res = await fetch(`/api/templates/${t.id}`, { method: "DELETE", headers: auth() });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast({ title: "Template removido" }); load(); }
    else toast({ title: d.error || "Erro ao remover", variant: "destructive" });
  };

  const [uploadingHeader, setUploadingHeader] = useState(false);

  const uploadHeader = async (file: File) => {
    setUploadingHeader(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (form.accountId) fd.append("accountId", form.accountId);
      const res = await fetch("/api/templates/header-media", { method: "POST", headers: auth(), body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setForm((f) => ({
        ...f, headerType: d.headerType, headerHandle: d.handle, mediaUrl: d.url, headerFileName: d.name || file.name,
      }));
      toast({ title: "Arquivo de exemplo enviado" });
    } catch (e: any) {
      toast({ title: e.message || "Falha ao enviar o arquivo", variant: "destructive" });
    } finally {
      setUploadingHeader(false);
    }
  };

  const setButton = (i: number, patch: any) => {
    const next = [...form.buttons];
    next[i] = { ...next[i], ...patch };
    setForm({ ...form, buttons: next });
  };

  const variableCount = (form.content.match(/\{\{\d+\}\}/g) || []).length;

  const porStatus = (s: string) => templates.filter((t) => t.status === s).length;
  const selecionado = previewing || templates[0] || null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1500px] px-4 pb-10 pt-5 sm:px-6">

        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Templates de mensagem</h1>
            <p className="mt-0.5 max-w-xl text-[13.5px] text-muted-foreground">
              Mensagens aprovadas pela Meta — necessárias para iniciar conversa fora da janela de 24h
              e para disparos em massa.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={sync} disabled={syncing} className="h-10 gap-2">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sincronizar com a Meta
            </Button>
            <Button onClick={openNew} className="h-10 gap-2"><Plus className="h-4 w-4" /> Novo template</Button>
          </div>
        </header>

        {connections.length === 0 && !loading && (
          <div className="mb-4 flex gap-3 rounded-[14px] border border-amber-200 bg-amber-50 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[13px] leading-relaxed text-amber-900">
              <strong className="font-semibold">Nenhuma conexão oficial configurada.</strong> Templates vivem na
              conta do WhatsApp Business (WABA), então é preciso ter a API oficial conectada em{" "}
              <a href="/connections" className="font-semibold underline">Conexões</a> antes de criar ou sincronizar.
            </p>
          </div>
        )}

        {/* KPIs */}
        <section className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTpl rotulo="Aprovados" valor={porStatus("APPROVED")} cor="text-emerald-600 dark:text-emerald-400" detalhe="prontos para disparar" />
          <KpiTpl rotulo="Em análise" valor={porStatus("PENDING")} cor="text-amber-600 dark:text-amber-500" detalhe="aguardando a Meta" />
          <KpiTpl rotulo="Reprovados" valor={porStatus("REJECTED")} cor="text-rose-600 dark:text-rose-400" detalhe="precisam ser refeitos" />
          <KpiTpl rotulo="Rascunhos" valor={porStatus("DRAFT")} cor="text-foreground" detalhe="ainda não enviados" />
        </section>

        {loading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : templates.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-[14px] border border-border bg-card px-6 py-20 text-center shadow-card">
            <FileText className="h-8 w-8 text-border-soft" />
            <div>
              <p className="text-[14px] font-semibold text-foreground">Nenhum template ainda</p>
              <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
                Crie um aqui ou traga os que já existem na sua conta da Meta com “Sincronizar”.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
            {/* Tabela */}
            <div className="min-w-0 overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-border bg-surface-2 px-4 py-2.5">
                    {["Template", "Categoria", "Status na Meta", "Variáveis"].map((h) => (
                      <span key={h} className="linha-unica text-[11px] font-semibold uppercase tracking-wide text-faint">{h}</span>
                    ))}
                  </div>
                  {templates.map((t) => {
                    const st = (STATUS as any)[t.status] || STATUS.DRAFT;
                    const ativo = selecionado?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setPreviewing(t)}
                        className={`grid cursor-pointer grid-cols-[2fr_1fr_1fr_1fr] items-center gap-3 border-b border-l-[3px] border-border-soft px-4 py-3 last:border-b-0 ${
                          ativo ? "border-l-[#2563EB] bg-accent-soft" : "border-l-transparent hover:bg-surface-2"
                        }`}
                      >
                        <div className="min-w-0">
                          {/* O nome vai em monoespaçado: é um identificador em
                              snake_case, não um título — e é assim que a Meta
                              o exibe do outro lado. */}
                          <p className="linha-unica-elipse font-mono text-[12.5px] font-semibold text-foreground">{t.name}</p>
                          <p className="linha-unica-elipse mt-0.5 text-[11.5px] text-muted-foreground">{t.content}</p>
                        </div>
                        <span className="linha-unica-elipse text-[12.5px] text-muted-foreground">
                          {CATEGORIES.find((c) => c.id === t.category)?.label || t.category}
                        </span>
                        <span className="linha-unica flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${
                            t.status === "APPROVED" ? "bg-emerald-500"
                            : t.status === "PENDING" ? "bg-amber-500"
                            : t.status === "REJECTED" ? "bg-rose-500" : "bg-slate-300"
                          }`} />
                          {st.label}
                        </span>
                        <span className="num text-[12.5px] text-muted-foreground">
                          {t.variableCount || 0}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Lateral: prévia + detalhes */}
            {selecionado && (
              <aside className="space-y-4 lg:sticky lg:top-[76px]">
                <section className="rounded-[14px] border border-border bg-card p-4 shadow-card">
                  <h2 className="mb-3 text-[14px] font-semibold text-foreground">Como chega no WhatsApp</h2>
                  <TemplatePreview template={selecionado} contactName="Marina" businessName="Sua empresa" />
                </section>

                <section className="rounded-[14px] border border-border bg-card p-4 shadow-card">
                  <h2 className="text-[14px] font-semibold text-foreground">Detalhes</h2>
                  <dl className="mt-3 space-y-2">
                    {[
                      ["Nome", selecionado.name],
                      ["Idioma", selecionado.language],
                      ["Categoria", CATEGORIES.find((c) => c.id === selecionado.category)?.label || selecionado.category],
                      ["Status", ((STATUS as any)[selecionado.status] || STATUS.DRAFT).label],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex items-baseline justify-between gap-3">
                        <dt className="shrink-0 text-[12px] text-muted-foreground">{k}</dt>
                        <dd className="linha-unica-elipse text-[12.5px] font-medium text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  {selecionado.status === "REJECTED" && selecionado.rejectedReason && (
                    <p className="mt-3 rounded-lg bg-rose-50 p-3 text-[12px] leading-relaxed text-rose-800">
                      <strong className="font-semibold">Motivo da reprovação:</strong> {selecionado.rejectedReason}
                    </p>
                  )}

                  {selecionado.variableCount > 0 && (
                    <p className="mt-3 rounded-lg bg-accent-soft p-3 text-[12px] leading-relaxed text-accent-text">
                      Este template tem <strong className="font-semibold">{selecionado.variableCount}</strong>{" "}
                      {selecionado.variableCount === 1 ? "variável" : "variáveis"}. No disparo, cada{" "}
                      <code className="rounded bg-card px-1 py-0.5 font-mono">{"{{n}}"}</code> é trocado pelo valor do contato.
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selecionado.status === "DRAFT" && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(selecionado)} className="gap-1.5">
                        <Save className="h-3.5 w-3.5" /> Editar
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => duplicate(selecionado)} className="gap-1.5">
                      <Copy className="h-3.5 w-3.5" /> Duplicar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => remove(selecionado)} className="gap-1.5 text-red-600 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" /> Remover
                    </Button>
                  </div>
                  {selecionado.status !== "DRAFT" && (
                    <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
                      Depois de enviado à Meta o template não pode mais ser editado — só duplicado.
                    </p>
                  )}
                </section>
              </aside>
            )}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-bold">{editing ? "Editar rascunho" : "Novo template"}</DialogTitle>
            <DialogDescription>
              Depois de enviado à Meta o template não pode mais ser editado — só duplicado. A análise costuma
              levar de alguns minutos a algumas horas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="confirmacao_agendamento"
                  className="rounded-2xl bg-slate-50 border-none font-medium"
                />
                <p className="text-[11px] text-slate-400">Vira minúsculo com underscore automaticamente.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="rounded-2xl bg-slate-50 border-none font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id} className="font-bold">{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400">{CATEGORIES.find((c) => c.id === form.category)?.hint}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">Cabeçalho (opcional)</Label>
                <Select value={form.headerType || "NONE"} onValueChange={(v) => setForm({ ...form, headerType: v === "NONE" ? "" : v })}>
                  <SelectTrigger className="rounded-2xl bg-slate-50 border-none font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE" className="font-bold">Sem cabeçalho</SelectItem>
                    <SelectItem value="TEXT" className="font-bold">Texto</SelectItem>
                    <SelectItem value="IMAGE" className="font-bold">Imagem</SelectItem>
                    <SelectItem value="VIDEO" className="font-bold">Vídeo</SelectItem>
                    <SelectItem value="DOCUMENT" className="font-bold">Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.headerType === "TEXT" && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">Texto do cabeçalho</Label>
                  <Input
                    value={form.headerText}
                    onChange={(e) => setForm({ ...form, headerText: e.target.value })}
                    className="rounded-2xl bg-slate-50 border-none font-medium"
                  />
                </div>
              )}
            </div>

            {form.headerType && form.headerType !== "TEXT" && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">Arquivo do cabeçalho</Label>
                <input
                  type="file" id="header-file" className="hidden"
                  accept={form.headerType === "IMAGE" ? "image/jpeg,image/png"
                    : form.headerType === "VIDEO" ? "video/mp4,video/3gpp" : "application/pdf"}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadHeader(f); e.target.value = ""; }}
                />
                {form.mediaUrl ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                    {form.headerType === "IMAGE" ? (
                      <img src={form.mediaUrl} alt="" className="w-16 h-16 rounded-xl object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-200 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-slate-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {form.headerFileName || "Arquivo enviado"}
                      </p>
                      <p className="text-[11px] text-emerald-600 font-medium">
                        {form.headerHandle ? "Pronto para submeter" : "Salvo — reenvie o arquivo para submeter à Meta"}
                      </p>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => document.getElementById("header-file")?.click()}
                      disabled={uploadingHeader}
                      className="rounded-xl text-xs font-bold shrink-0"
                    >
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById("header-file")?.click()}
                    disabled={uploadingHeader || connections.length === 0}
                    className="w-full rounded-2xl font-bold"
                  >
                    {uploadingHeader
                      ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Enviando…</>
                      : <><Plus className="w-4 h-4 mr-2" /> Escolher arquivo</>}
                  </Button>
                )}
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  A Meta valida o template com um arquivo de exemplo.
                  {form.headerType === "IMAGE" && " JPG ou PNG, até 5 MB."}
                  {form.headerType === "VIDEO" && " MP4, até 16 MB."}
                  {form.headerType === "DOCUMENT" && " PDF, até 100 MB."}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Corpo da mensagem</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder={"Olá {{1}}! Seu horário está confirmado para {{2}}."}
                className="min-h-[130px] rounded-2xl bg-slate-50 border-none font-medium leading-relaxed"
              />
              <p className="text-[11px] text-slate-400">
                Use <code className="bg-slate-100 px-1 rounded">{"{{1}}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{{2}}"}</code> para
                personalizar no envio. {variableCount > 0 && `Detectadas ${variableCount} variável(is).`}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Rodapé (opcional)</Label>
              <Input
                value={form.footerText}
                onChange={(e) => setForm({ ...form, footerText: e.target.value })}
                placeholder="Responda SAIR para não receber mais"
                className="rounded-2xl bg-slate-50 border-none font-medium"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-500">Botões (até 3)</Label>
                {form.buttons.length < 3 && (
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => setForm({ ...form, buttons: [...form.buttons, { type: "QUICK_REPLY", text: "" }] })}
                    className="rounded-xl text-xs font-bold text-[#2563EB]"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Adicionar
                  </Button>
                )}
              </div>
              {form.buttons.map((b, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={b.type} onValueChange={(v) => setButton(i, { type: v })}>
                    <SelectTrigger className="w-40 rounded-2xl bg-slate-50 border-none font-bold text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUICK_REPLY" className="font-bold">Resposta rápida</SelectItem>
                      <SelectItem value="URL" className="font-bold">Link</SelectItem>
                      <SelectItem value="PHONE_NUMBER" className="font-bold">Telefone</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={b.text || ""} onChange={(e) => setButton(i, { text: e.target.value })}
                    placeholder="Texto do botão" className="rounded-2xl bg-slate-50 border-none font-medium"
                  />
                  {b.type === "URL" && (
                    <Input value={b.url || ""} onChange={(e) => setButton(i, { url: e.target.value })}
                      placeholder="https://" className="rounded-2xl bg-slate-50 border-none font-medium" />
                  )}
                  {b.type === "PHONE_NUMBER" && (
                    <Input value={b.phone || ""} onChange={(e) => setButton(i, { phone: e.target.value })}
                      placeholder="+5571…" className="rounded-2xl bg-slate-50 border-none font-medium" />
                  )}
                  <Button size="sm" variant="ghost" className="rounded-xl text-red-500 shrink-0"
                    onClick={() => setForm({ ...form, buttons: form.buttons.filter((_, x) => x !== i) })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {connections.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">Conexão (WABA)</Label>
                <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
                  <SelectTrigger className="rounded-2xl bg-slate-50 border-none font-bold"><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>
                    {connections.map((c) => <SelectItem key={c.id} value={c.id} className="font-bold">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

            <div className="lg:border-l lg:pl-6">
              <div className="lg:sticky lg:top-0 space-y-3 py-2">
                <Label className="text-xs font-bold text-slate-500">Como o cliente vai ver</Label>
                <TemplatePreview
                  template={form}
                  businessName={connections.find((c) => c.id === form.accountId)?.name || "Sua empresa"}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => save(false)} disabled={saving} className="rounded-2xl font-bold">
              <Save className="w-4 h-4 mr-2" /> Salvar rascunho
            </Button>
            <Button onClick={() => save(true)} disabled={saving || connections.length === 0} className="rounded-2xl font-bold bg-[#2563EB]">
              <Send className="w-4 h-4 mr-2" /> Enviar para aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-bold">{previewing?.name}</DialogTitle>
            <DialogDescription>
              {previewing?.variableCount > 0
                ? `As ${previewing.variableCount} variável(is) são preenchidas no envio — aqui aparecem destacadas.`
                : "Este template não usa variáveis."}
            </DialogDescription>
          </DialogHeader>
          {previewing && <TemplatePreview template={previewing} className="py-2" />}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function KpiTpl({ rotulo, valor, cor, detalhe }: { rotulo: string; valor: number; cor: string; detalhe: string }) {
  return (
    <article className="rounded-[14px] border border-border bg-card p-4 shadow-card">
      <p className="linha-unica-elipse text-[12px] text-muted-foreground">{rotulo}</p>
      <p className={`num mt-1 text-[30px] font-bold leading-none tracking-[-0.04em] ${cor}`}>{valor}</p>
      <p className="mt-2 text-[11.5px] text-faint">{detalhe}</p>
    </article>
  );
}
