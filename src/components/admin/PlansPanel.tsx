import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import { Plus, Pencil, Trash2, Loader2, Package } from "lucide-react";

const DEFAULT_PLAN = {
  id: null as string | null,
  name: "",
  priceMonthly: 0,
  priceYearly: 0,
  maxLeads: 500,
  maxSdrs: 1,
  maxUsers: 2,
  maxWhatsAppNumbers: 1,
  maxKnowledgeBaseChars: 50000,
  maxTokens: 100000,
  maxMessages: 1000,
  enableSdr: true,
  enableTokens: true,
  enableMessages: true,
  enableCalendar: true,
  enableAutomations: true,
  enableWebhooks: false,
  sdrUnitCost: 15.0,
  tokenUnitCost: 0.08,
  messageUnitCost: 0.05,
  active: true,
};

export function PlansPanel({ plans, reload }: { plans: any[]; reload: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(DEFAULT_PLAN);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setForm(DEFAULT_PLAN); setOpen(true); };
  const openEdit = (p: any) => {
    setForm({
      ...DEFAULT_PLAN,
      ...p,
      maxUsers: p.maxUsers ?? 2,
      maxWhatsAppNumbers: p.maxWhatsAppNumbers ?? 1,
      maxKnowledgeBaseChars: p.maxKnowledgeBaseChars ?? 50000,
      enableCalendar: p.enableCalendar ?? true,
      enableAutomations: p.enableAutomations ?? true,
      enableWebhooks: p.enableWebhooks ?? false,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast({ title: "Dê um nome ao plano", variant: "destructive" });
    setSaving(true);
    const payload = {
      name: form.name,
      priceMonthly: Number(form.priceMonthly),
      priceYearly: Number(form.priceYearly || form.priceMonthly * 10),
      maxLeads: Number(form.maxLeads),
      maxSdrs: Number(form.maxSdrs),
      maxUsers: Number(form.maxUsers),
      maxWhatsAppNumbers: Number(form.maxWhatsAppNumbers),
      maxKnowledgeBaseChars: Number(form.maxKnowledgeBaseChars),
      maxTokens: Number(form.maxTokens),
      maxMessages: Number(form.maxMessages),
      enableSdr: !!form.enableSdr,
      enableTokens: !!form.enableTokens,
      enableMessages: !!form.enableMessages,
      enableCalendar: !!form.enableCalendar,
      enableAutomations: !!form.enableAutomations,
      enableWebhooks: !!form.enableWebhooks,
      sdrUnitCost: Number(form.sdrUnitCost),
      tokenUnitCost: Number(form.tokenUnitCost),
      messageUnitCost: Number(form.messageUnitCost),
      active: form.active !== false,
    };
    const res = form.id
      ? await adminApi.put(`/api/admin/plans/${form.id}`, payload)
      : await adminApi.post("/api/admin/plans", payload);
    setSaving(false);
    if (res.ok) {
      toast({ title: form.id ? "Plano atualizado" : "Plano criado" });
      setOpen(false);
      reload();
    } else {
      toast({ title: "Erro ao salvar plano", description: res.data?.error, variant: "destructive" });
    }
  };

  const remove = async (p: any) => {
    if (!confirm(`Excluir o plano "${p.name}"? Clientes vinculados ficam sem plano.`)) return;
    const res = await adminApi.del(`/api/admin/plans/${p.id}`);
    if (res.ok) { toast({ title: "Plano excluído" }); reload(); }
    else toast({ title: "Erro ao excluir", description: res.data?.error, variant: "destructive" });
  };

  // Simulador de margem
  const simCost =
    (form.enableSdr ? (Number(form.maxSdrs) || 0) * (Number(form.sdrUnitCost) || 0) : 0) +
    (form.enableTokens ? ((Number(form.maxTokens) || 0) / 1000) * (Number(form.tokenUnitCost) || 0) : 0) +
    (form.enableMessages ? (Number(form.maxMessages) || 0) * (Number(form.messageUnitCost) || 0) : 0);
  const simPrice = Number(form.priceMonthly) || 0;
  const simProfit = simPrice - simCost;
  const simMargin = simPrice > 0 ? (simProfit / simPrice) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo plano</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="rounded-2xl border-border p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <p className="text-lg font-bold text-foreground">R$ {p.priceMonthly}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                </div>
              </div>
              {p.active === false && <Badge className="bg-slate-200 text-slate-600 border-none text-xs">Inativo</Badge>}
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>{p.maxSdrs} agente(s) · {(p.maxTokens / 1000).toLocaleString("pt-BR")}k tokens</li>
              <li>{p.maxMessages?.toLocaleString("pt-BR")} msgs · {p.maxLeads?.toLocaleString("pt-BR")} contatos</li>
              <li>{p.maxWhatsAppNumbers ?? 1} nº WhatsApp · {p.maxUsers ?? 2} usuários</li>
              <li>
                {[p.enableCalendar && "Calendar", p.enableAutomations && "Automações", p.enableWebhooks && "Webhooks"].filter(Boolean).join(" · ") || "Sem extras"}
              </li>
            </ul>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEdit(p)}>
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
              <button onClick={() => remove(p)} className="p-2 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? `Editar plano: ${form.name}` : "Novo plano"}</DialogTitle></DialogHeader>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Preço mensal (R$)</Label>
                  <Input type="number" value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Preço anual (R$)</Label>
                  <Input type="number" value={form.priceYearly} onChange={(e) => setForm({ ...form, priceYearly: e.target.value })} />
                </div>
              </div>

              <div className="rounded-xl bg-muted p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground uppercase">Módulos incluídos</p>
                {[
                  ["enableSdr", "Agentes de IA (SDR)"],
                  ["enableTokens", "Créditos de IA (tokens)"],
                  ["enableMessages", "Mensagens WhatsApp"],
                  ["enableCalendar", "Google Calendar"],
                  ["enableAutomations", "Automações / Lembretes"],
                  ["enableWebhooks", "Webhooks / API pública"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="text-xs text-foreground">{label}</Label>
                    <Switch checked={!!form[key]} onCheckedChange={(v) => setForm({ ...form, [key]: v })} />
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <Label className="text-xs text-foreground">Plano visível/ativo</Label>
                  <Switch checked={form.active !== false} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["maxSdrs", "Agentes de IA"],
                  ["maxTokens", "Tokens/mês"],
                  ["maxMessages", "Mensagens/mês"],
                  ["maxLeads", "Contatos"],
                  ["maxUsers", "Usuários"],
                  ["maxWhatsAppNumbers", "Nºs WhatsApp"],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input type="number" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  </div>
                ))}
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">Treino do agente (caracteres máx.)</Label>
                  <Input type="number" value={form.maxKnowledgeBaseChars} onChange={(e) => setForm({ ...form, maxKnowledgeBaseChars: e.target.value })} />
                </div>
              </div>

              <div className="rounded-xl bg-muted p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground uppercase">Custos unitários (margem)</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["sdrUnitCost", "R$/agente"],
                    ["tokenUnitCost", "R$/1k tok"],
                    ["messageUnitCost", "R$/msg"],
                  ].map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{label}</Label>
                      <Input type="number" step="0.01" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="h-8 text-xs" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-slate-900 text-white p-4">
                <p className="text-[10px] uppercase text-slate-400 font-semibold mb-2">Simulador de margem (uso máximo)</p>
                <div className="grid grid-cols-3 text-center gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Custo</p>
                    <p className="text-sm font-bold text-rose-300">R$ {simCost.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Lucro</p>
                    <p className={`text-sm font-bold ${simProfit >= 0 ? "text-emerald-300" : "text-rose-400"}`}>R$ {simProfit.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Margem</p>
                    <p className={`text-sm font-bold ${simMargin >= 50 ? "text-emerald-300" : simMargin >= 10 ? "text-amber-300" : "text-rose-400"}`}>{simMargin.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
