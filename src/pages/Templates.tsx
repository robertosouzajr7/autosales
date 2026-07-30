import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

  return (
    <DashboardLayout>
      <PageContainer>
      <PageHeader
        title="Templates de mensagem"
        subtitle="Mensagens aprovadas pela Meta — necessárias para iniciar conversa fora da janela de 24h e para disparos em massa."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={sync} disabled={syncing} className="rounded-2xl font-bold">
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              Sincronizar com a Meta
            </Button>
            <Button onClick={openNew} className="rounded-2xl font-bold bg-[#2563EB]">
              <Plus className="w-4 h-4 mr-2" /> Novo template
            </Button>
          </div>
        }
      />

      {connections.length === 0 && !loading && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60">
          <CardContent className="p-5 flex gap-3 items-start">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <strong>Nenhuma conexão oficial configurada.</strong> Templates vivem na conta do WhatsApp Business
              (WABA), então é preciso ter a API oficial conectada em <a href="/connections" className="underline font-bold">Conexões</a> antes
              de criar ou sincronizar.
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-slate-400 p-10 text-center">Carregando…</div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="p-16 text-center">
          <FileText className="w-10 h-10 mx-auto text-slate-300 mb-4" />
          <p className="font-bold text-slate-600">Nenhum template ainda</p>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Crie um aqui ou traga os que já existem na sua conta da Meta usando "Sincronizar".
          </p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => {
            const st = (STATUS as any)[t.status] || STATUS.DRAFT;
            const Icon = st.icon;
            return (
              <Card key={t.id} className="hover:shadow-sm transition">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 truncate">{t.name}</span>
                        <Badge className={`${st.cls} border-none font-bold text-[11px]`}>
                          <Icon className="w-3 h-3 mr-1" />{st.label}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-bold">
                          {CATEGORIES.find((c) => c.id === t.category)?.label || t.category}
                        </Badge>
                        <span className="text-[11px] text-slate-400 font-medium">{t.language}</span>
                        {t.variableCount > 0 && (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {t.variableCount} variável(is)
                          </span>
                        )}
                      </div>
                      {t.headerText && <p className="text-xs font-bold text-slate-500 mt-2">{t.headerText}</p>}
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap">{t.content}</p>
                      {t.footerText && <p className="text-[11px] text-slate-400 mt-1">{t.footerText}</p>}
                      {t.status === "REJECTED" && t.rejectedReason && (
                        <p className="text-xs text-red-600 mt-2 font-medium">Motivo: {t.rejectedReason}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setPreviewing(t)} className="rounded-xl" title="Ver no WhatsApp">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {t.status === "DRAFT" && (
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="rounded-xl" title="Editar">
                          <Save className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => duplicate(t)} className="rounded-xl" title="Duplicar">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(t)} className="rounded-xl text-red-500" title="Remover">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
      </PageContainer>
    </DashboardLayout>
  );
}
