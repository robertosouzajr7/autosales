import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import { Plus, Pencil, Trash2, Loader2, Coins } from "lucide-react";

const DEFAULT_PACK = {
  id: null as string | null,
  name: "",
  tokens: 100000,
  price: 49.9,
  active: true,
};

/**
 * Pacotes de recarga de tokens — definidos pelo admin do SaaS. Os clientes
 * compram esses pacotes na página de Assinatura quando estouram a franquia
 * do plano; o saldo (extraTokens) carrega para os próximos ciclos.
 */
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function TokenPackagesPanel() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(DEFAULT_PACK);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [res, pr] = await Promise.all([
      adminApi.get("/api/admin/token-packages"),
      adminApi.get("/api/admin/token-pricing"),
    ]);
    if (res.ok && Array.isArray(res.data)) setPackages(res.data);
    if (pr.ok) setPricing(pr.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Custo real dos tokens do pacote no modelo global ativo (BRL).
  const costOf = (tokens: number) =>
    pricing ? (Number(tokens || 0) / 1_000_000) * pricing.activeModelCostBRLPer1M : 0;

  const openNew = () => {
    const markup = pricing?.tokenMarkup || 5;
    const suggested = Number((costOf(DEFAULT_PACK.tokens) * markup).toFixed(2)) || DEFAULT_PACK.price;
    setForm({ ...DEFAULT_PACK, price: suggested });
    setOpen(true);
  };
  const openEdit = (p: any) => { setForm({ ...DEFAULT_PACK, ...p }); setOpen(true); };

  const save = async () => {
    if (!form.name) return toast({ title: "Dê um nome ao pacote", variant: "destructive" });
    if (!Number(form.tokens) || !Number(form.price)) {
      return toast({ title: "Informe tokens e preço válidos", variant: "destructive" });
    }
    setSaving(true);
    const payload = {
      name: form.name,
      tokens: Number(form.tokens),
      price: Number(form.price),
      active: form.active !== false,
    };
    const res = form.id
      ? await adminApi.put(`/api/admin/token-packages/${form.id}`, payload)
      : await adminApi.post("/api/admin/token-packages", payload);
    setSaving(false);
    if (res.ok) {
      toast({ title: form.id ? "Pacote atualizado" : "Pacote criado" });
      setOpen(false);
      load();
    } else {
      toast({ title: "Erro ao salvar pacote", description: res.data?.error, variant: "destructive" });
    }
  };

  const remove = async (p: any) => {
    if (!confirm(`Excluir o pacote "${p.name}"?`)) return;
    const res = await adminApi.del(`/api/admin/token-packages/${p.id}`);
    if (res.ok) { toast({ title: "Pacote excluído" }); load(); }
    else toast({ title: "Erro ao excluir", description: res.data?.error, variant: "destructive" });
  };

  // Cálculo automático: custo real, preço sugerido (markup) e margem.
  const cost = costOf(Number(form.tokens));
  const markup = pricing?.tokenMarkup || 5;
  const suggestedPrice = Number((cost * markup).toFixed(2));
  const salePrice = Number(form.price) || 0;
  const margin = salePrice - cost;
  const marginPct = salePrice > 0 ? (margin / salePrice) * 100 : 0;
  const useSuggested = () => setForm({ ...form, price: suggestedPrice });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Pacotes de recarga que os clientes podem comprar ao esgotar a franquia do plano.
        </p>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo pacote</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando pacotes…</p>
      ) : packages.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border p-10 text-center">
          <Coins className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum pacote de tokens cadastrado ainda.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <Card key={p.id} className="rounded-2xl border-border p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="text-lg font-bold text-foreground">
                      R$ {Number(p.price).toFixed(2)}
                    </p>
                  </div>
                </div>
                {p.active === false && <Badge className="bg-slate-200 text-slate-600 border-none text-xs">Inativo</Badge>}
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>{Number(p.tokens).toLocaleString("pt-BR")} tokens</li>
                {pricing && (
                  <li>
                    custo {brl(costOf(Number(p.tokens)))} · margem{" "}
                    <span className={Number(p.price) - costOf(Number(p.tokens)) >= 0 ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                      {brl(Number(p.price) - costOf(Number(p.tokens)))}
                    </span>
                  </li>
                )}
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
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader><DialogTitle>{form.id ? `Editar pacote: ${form.name}` : "Novo pacote de tokens"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome do pacote</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Recarga Essencial" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tokens</Label>
                <Input type="number" value={form.tokens} onChange={(e) => setForm({ ...form, tokens: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Preço de venda (R$)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
            </div>

            {/* Cálculo automático a partir do custo real do modelo ativo */}
            <div className="rounded-xl bg-muted p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Custo real dos tokens
                  {pricing && <span className="ml-1 text-[11px]">({pricing.activeModel})</span>}
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums">{brl(cost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Preço sugerido (markup {markup}x)</span>
                <button type="button" onClick={useSuggested} className="text-sm font-semibold text-primary hover:underline tabular-nums">
                  {brl(suggestedPrice)} <span className="text-[11px] font-normal">· usar</span>
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2.5">
                <span className="text-xs text-muted-foreground">Sua margem</span>
                <span className={`text-sm font-bold tabular-nums ${margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {brl(margin)} <span className="text-[11px] font-medium">({marginPct.toFixed(0)}%)</span>
                </span>
              </div>
              {!pricing && <p className="text-[11px] text-amber-600">Não foi possível carregar a tabela de custos — verifique o modelo ativo em Configurações.</p>}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <Label className="text-xs text-foreground">Pacote visível/ativo</Label>
              <Switch checked={form.active !== false} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar pacote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
