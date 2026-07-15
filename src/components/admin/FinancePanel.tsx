import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared/StatCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import {
  Plus, Trash2, Loader2, Play, TrendingUp, TrendingDown, Wallet, Receipt,
} from "lucide-react";

function fmtBRL(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const EMPTY_TX = {
  id: "",
  description: "",
  amount: 0,
  type: "EXPENSE",
  category: "Servidor",
  isRecurring: false,
  frequency: "MONTHLY",
  dueDate: "",
  paidAt: "",
  tenantId: "none",
};

export function FinancePanel({ tenants }: { tenants: any[] }) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [txOpen, setTxOpen] = useState(false);
  const [tx, setTx] = useState<any>(EMPTY_TX);
  const [savingTx, setSavingTx] = useState(false);
  const [billingRunning, setBillingRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [sumRes, txRes] = await Promise.all([
      adminApi.get("/api/admin/financial/summary"),
      adminApi.get("/api/admin/financial/transactions"),
    ]);
    if (sumRes.ok) setSummary(sumRes.data);
    if (txRes.ok && Array.isArray(txRes.data)) setTransactions(txRes.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveTx = async () => {
    if (!tx.description || !tx.amount) return toast({ title: "Descrição e valor são obrigatórios", variant: "destructive" });
    setSavingTx(true);
    const payload = {
      ...tx,
      amount: Number(tx.amount),
      dueDate: tx.dueDate ? new Date(tx.dueDate).toISOString() : null,
      paidAt: tx.paidAt ? new Date(tx.paidAt).toISOString() : null,
      tenantId: tx.tenantId && tx.tenantId !== "none" ? tx.tenantId : null,
    };
    const res = tx.id
      ? await adminApi.put(`/api/admin/financial/transactions/${tx.id}`, payload)
      : await adminApi.post("/api/admin/financial/transactions", payload);
    setSavingTx(false);
    if (res.ok) {
      toast({ title: tx.id ? "Transação atualizada" : "Transação registrada" });
      setTxOpen(false);
      setTx(EMPTY_TX);
      load();
    } else {
      toast({ title: "Erro na transação", description: res.data?.error, variant: "destructive" });
    }
  };

  const removeTx = async (id: string) => {
    if (!confirm("Excluir transação?")) return;
    const res = await adminApi.del(`/api/admin/financial/transactions/${id}`);
    if (res.ok) load();
    else toast({ title: "Erro ao excluir", variant: "destructive" });
  };

  const triggerBilling = async () => {
    if (!confirm("Rodar o faturamento mensal agora? Faturas serão geradas para os tenants com ciclo vencido.")) return;
    setBillingRunning(true);
    const res = await adminApi.post("/api/admin/financial/trigger-billing");
    setBillingRunning(false);
    if (res.ok) { toast({ title: "Faturamento executado" }); load(); }
    else toast({ title: "Erro no faturamento", description: res.data?.error, variant: "destructive" });
  };

  if (loading) {
    return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="MRR" value={fmtBRL(summary?.mrr)} icon={<TrendingUp className="w-5 h-5" />} hint="receita recorrente" />
        <StatCard label="Receitas" value={fmtBRL(summary?.totalRevenues)} icon={<Receipt className="w-5 h-5" />} hint="entradas registradas" />
        <StatCard label="Despesas" value={fmtBRL(summary?.totalExpenses)} icon={<TrendingDown className="w-5 h-5" />} hint="saídas + custos operacionais" />
        <StatCard label="Lucro líquido" value={fmtBRL(summary?.netProfit)} icon={<Wallet className="w-5 h-5" />} hint="receitas − despesas − custos" />
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={triggerBilling} disabled={billingRunning} className="gap-2">
          {billingRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Rodar faturamento agora
        </Button>
        <Button onClick={() => { setTx(EMPTY_TX); setTxOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nova transação
        </Button>
      </div>

      <Card className="rounded-2xl border-border overflow-hidden">
        <header className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Transações</h3>
        </header>
        {transactions.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma transação registrada.</p>
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((t) => (
              <li key={t.id} className="px-5 py-3 flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${t.type === "REVENUE" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                  {t.type === "REVENUE" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{t.category}{t.isRecurring ? " · recorrente" : ""}</p>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${t.type === "REVENUE" ? "text-emerald-600" : "text-rose-600"}`}>
                  {t.type === "REVENUE" ? "+" : "−"}{fmtBRL(t.amount)}
                </span>
                <button onClick={() => removeTx(t.id)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Custos por cliente */}
      {summary?.clientCosts?.length > 0 && (
        <Card className="rounded-2xl border-border overflow-hidden">
          <header className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Custo operacional por cliente</h3>
          </header>
          <ul className="divide-y divide-border">
            {summary.clientCosts.map((c: any) => (
              <li key={c.tenantId} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.planName} · {(c.usage?.tokens / 1000 || 0).toFixed(0)}k tokens · {c.usage?.messages || 0} msgs
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">{fmtBRL(c.totalCost)}</p>
                  <p className="text-xs text-muted-foreground">plano: {fmtBRL(c.planPrice)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* MODAL TX */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader><DialogTitle>{tx.id ? "Editar transação" : "Nova transação"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Input value={tx.description} onChange={(e) => setTx({ ...tx, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                <Input type="number" step="0.01" value={tx.amount} onChange={(e) => setTx({ ...tx, amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={tx.type} onValueChange={(v) => setTx({ ...tx, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REVENUE">Receita</SelectItem>
                    <SelectItem value="EXPENSE">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Input value={tx.category} onChange={(e) => setTx({ ...tx, category: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cliente (opcional)</Label>
                <Select value={tx.tenantId} onValueChange={(v) => setTx({ ...tx, tenantId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Vencimento</Label>
                <Input type="date" value={tx.dueDate} onChange={(e) => setTx({ ...tx, dueDate: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Pago em</Label>
                <Input type="date" value={tx.paidAt} onChange={(e) => setTx({ ...tx, paidAt: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxOpen(false)}>Cancelar</Button>
            <Button onClick={saveTx} disabled={savingTx} className="gap-2">
              {savingTx && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
