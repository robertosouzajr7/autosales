import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Megaphone, Plus, Play, Pause, Trash2, AlertTriangle, CheckCircle2, Clock, Users, Info, ArrowUpRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const [stages, setStages] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [quota, setQuota] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", templateId: "", stageId: "", accountId: "" });
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  const load = async () => {
    try {
      const [cRes, tRes, sRes, connRes, qRes] = await Promise.all([
        fetch("/api/campaigns", { headers: auth() }),
        fetch("/api/templates", { headers: auth() }),
        fetch("/api/pipeline-stages", { headers: auth() }),
        fetch("/api/whatsapp/accounts", { headers: auth() }),
        fetch("/api/campaigns/quota", { headers: auth() }),
      ]);
      setCampaigns(cRes.ok ? await cRes.json() : []);
      const tpls = tRes.ok ? await tRes.json() : [];
      // Só template aprovado pode ser disparado.
      setTemplates(tpls.filter((t: any) => t.status === "APPROVED"));
      setStages(sRes.ok ? await sRes.json() : []);
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

  const runPreview = async (patch: any = {}) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (!next.templateId) return setPreview(null);
    try {
      const res = await fetch("/api/campaigns/preview", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: next.templateId, stageId: next.stageId || undefined }),
      });
      setPreview(res.ok ? await res.json() : null);
    } catch { setPreview(null); }
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
          stageId: form.stageId || undefined,
          accountId: form.accountId || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: "Campanha criada. Revise e dispare quando quiser." });
      setModalOpen(false);
      setForm({ name: "", templateId: "", stageId: "", accountId: "" });
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

  const remove = async (c: any) => {
    if (!confirm(`Remover a campanha "${c.name}"?`)) return;
    const res = await fetch(`/api/campaigns/${c.id}`, { method: "DELETE", headers: auth() });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast({ title: "Campanha removida" }); load(); }
    else toast({ title: d.error || "Erro ao remover", variant: "destructive" });
  };

  const semFranquia = quota && quota.limit <= 0;

  return (
    <DashboardLayout>
      <PageHeader
        title="Disparos em massa"
        description="Envio de templates aprovados pela API oficial do WhatsApp."
        action={
          <Button onClick={() => setModalOpen(true)} disabled={semFranquia} className="rounded-2xl font-bold bg-[#2563EB]">
            <Plus className="w-4 h-4 mr-2" /> Nova campanha
          </Button>
        }
      />

      {quota && (
        <Card className="mb-6">
          <CardContent className="p-5">
            {semFranquia ? (
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-slate-700 text-sm">Seu plano não inclui disparos em massa</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Faça upgrade para liberar o envio de campanhas pela API oficial.
                  </p>
                </div>
                <Button size="sm" onClick={() => navigate("/assinatura")} className="rounded-2xl font-bold bg-[#2563EB]">
                  Ver planos <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Franquia de disparos do ciclo</span>
                  <span className="text-sm font-bold text-slate-700">
                    {quota.used.toLocaleString("pt-BR")} / {quota.limit.toLocaleString("pt-BR")}
                  </span>
                </div>
                <Progress value={Math.min(100, (quota.used / quota.limit) * 100)} className="h-2" />
                <p className="text-xs text-slate-400 mt-2">
                  Restam <strong>{quota.remaining.toLocaleString("pt-BR")}</strong> disparos. Ao esgotar, novos envios
                  ficam bloqueados até a renovação.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {templates.length === 0 && !loading && !semFranquia && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60">
          <CardContent className="p-5 flex gap-3 items-start">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 flex-1">
              <strong>Nenhum template aprovado.</strong> Só é possível disparar mensagens que a Meta já aprovou.
              Crie e envie um para aprovação em <a href="/templates" className="underline font-bold">Templates</a>.
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-slate-400 p-10 text-center">Carregando…</div>
      ) : campaigns.length === 0 ? (
        <Card><CardContent className="p-16 text-center">
          <Megaphone className="w-10 h-10 mx-auto text-slate-300 mb-4" />
          <p className="font-bold text-slate-600">Nenhuma campanha ainda</p>
          <p className="text-sm text-slate-400 mt-1">Crie uma campanha para disparar um template para sua base.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => {
            const st = STATUS[c.status] || STATUS.DRAFT;
            const total = c.recipientCount || 0;
            const done = (c.sentCount || 0) + (c.errorCount || 0);
            return (
              <Card key={c.id}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800">{c.name}</span>
                        <Badge className={`${st.cls} border-none font-bold text-[11px]`}>{st.label}</Badge>
                        <span className="text-[11px] text-slate-400 font-medium">
                          template: {c.template?.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium flex-wrap">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {total} contato(s)</span>
                        <span>Custo estimado: <strong>{brl(c.estimatedCost)}</strong></span>
                        {c.status !== "DRAFT" && (
                          <>
                            <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" /> {c.sentCount || 0} enviada(s)
                            </span>
                            {c.errorCount > 0 && (
                              <span className="text-red-500">{c.errorCount} falha(s)</span>
                            )}
                          </>
                        )}
                      </div>
                      {c.status === "RUNNING" && total > 0 && (
                        <Progress value={(done / total) * 100} className="h-1.5 mt-3" />
                      )}
                      {c.errorLog && c.status === "COMPLETED" && (
                        <details className="mt-2">
                          <summary className="text-xs text-red-500 cursor-pointer font-medium">Ver erros</summary>
                          <pre className="text-[11px] text-slate-500 mt-1 whitespace-pre-wrap max-h-32 overflow-y-auto bg-slate-50 p-2 rounded-xl">
                            {c.errorLog}
                          </pre>
                        </details>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {(c.status === "DRAFT" || c.status === "PAUSED") && (
                        <Button size="sm" onClick={() => act(c, "start")} className="rounded-2xl font-bold bg-[#2563EB]">
                          <Play className="w-3.5 h-3.5 mr-1" /> Disparar
                        </Button>
                      )}
                      {c.status === "RUNNING" && (
                        <Button size="sm" variant="outline" onClick={() => act(c, "pause")} className="rounded-2xl font-bold">
                          <Pause className="w-3.5 h-3.5 mr-1" /> Pausar
                        </Button>
                      )}
                      {c.status !== "RUNNING" && (
                        <Button size="sm" variant="ghost" onClick={() => remove(c)} className="rounded-xl text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-bold">Nova campanha</DialogTitle>
            <DialogDescription>
              A projeção de custo aparece conforme você escolhe o template e o público.
            </DialogDescription>
          </DialogHeader>

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

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Público</Label>
              <Select value={form.stageId || "ALL"} onValueChange={(v) => runPreview({ stageId: v === "ALL" ? "" : v })}>
                <SelectTrigger className="rounded-2xl bg-slate-50 border-none font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="font-bold">Todos os contatos</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="font-bold">Etapa: {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">Contatos que pediram descadastro são excluídos automaticamente.</p>
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

          <DialogFooter>
            <Button onClick={create} disabled={busy || !preview?.canSend} className="rounded-2xl font-bold bg-[#2563EB]">
              <Clock className="w-4 h-4 mr-2" /> Criar campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
