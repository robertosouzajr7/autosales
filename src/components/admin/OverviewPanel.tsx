import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared/StatCard";
import { adminApi } from "@/lib/adminApi";
import { DollarSign, Building2, Receipt, TimerReset, Flame } from "lucide-react";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Ativos", cls: "bg-emerald-100 text-emerald-700" },
  TRIAL: { label: "Em trial", cls: "bg-blue-100 text-blue-700" },
  PAST_DUE: { label: "Inadimplentes", cls: "bg-amber-100 text-amber-800" },
  CANCELED: { label: "Cancelados", cls: "bg-slate-200 text-slate-600" },
  SUSPENDED: { label: "Suspensos", cls: "bg-rose-100 text-rose-700" },
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtMonth(key: string) {
  const [y, m] = key.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[parseInt(m) - 1]}/${y.slice(2)}`;
}

export function OverviewPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await adminApi.get("/api/admin/reports");
      if (res.ok) setData(res.data);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!data) return <p className="text-sm text-muted-foreground">Não foi possível carregar os relatórios.</p>;

  const maxSignups = Math.max(1, ...data.months.map((m: any) => m.signups));
  const maxRevenue = Math.max(1, ...data.months.map((m: any) => m.revenue));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="MRR" value={fmtBRL(data.mrr)} icon={<DollarSign className="w-5 h-5" />} hint="assinaturas ativas" />
        <StatCard label="Clientes" value={data.totalTenants} icon={<Building2 className="w-5 h-5" />} hint="contas na plataforma" />
        <StatCard label="Receita paga (total)" value={fmtBRL(data.totalPaidRevenue)} icon={<Receipt className="w-5 h-5" />} hint="faturas quitadas" />
        <StatCard label="Trials expirando" value={data.expiringTrials.length} icon={<TimerReset className="w-5 h-5" />} hint="próximos 7 dias" />
      </div>

      {/* Status + gráfico de meses */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Clientes por status</h3>
          <ul className="space-y-2">
            {Object.entries(data.byStatus).map(([status, count]) => {
              const meta = STATUS_LABEL[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
              return (
                <li key={status} className="flex items-center justify-between">
                  <Badge className={`${meta.cls} border-none`}>{meta.label}</Badge>
                  <span className="text-sm font-semibold text-foreground tabular-nums">{count as number}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="rounded-2xl border-border p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">Últimos 6 meses</h3>
          <div className="grid grid-cols-6 gap-3 items-end h-40">
            {data.months.map((m: any) => (
              <div key={m.month} className="flex flex-col items-center gap-1 h-full justify-end">
                <div className="w-full flex gap-1 items-end justify-center flex-1">
                  <div
                    className="w-3 rounded-t bg-primary/70"
                    style={{ height: `${(m.signups / maxSignups) * 100}%`, minHeight: m.signups ? 6 : 2 }}
                    title={`${m.signups} cadastros`}
                  />
                  <div
                    className="w-3 rounded-t bg-emerald-500/70"
                    style={{ height: `${(m.revenue / maxRevenue) * 100}%`, minHeight: m.revenue ? 6 : 2 }}
                    title={fmtBRL(m.revenue)}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{fmtMonth(m.month)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary/70" /> Cadastros</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500/70" /> Receita paga</span>
          </div>
        </Card>
      </div>

      {/* Trials expirando + top consumo */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border-border">
          <header className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TimerReset className="w-4 h-4 text-amber-500" /> Trials expirando (7 dias)
            </h3>
          </header>
          {data.expiringTrials.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Nenhum trial expirando em breve.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.expiringTrials.map((t: any) => (
                <li key={t.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.plan || "sem plano"}</p>
                  </div>
                  <span className="text-xs text-amber-700 font-medium">
                    até {new Date(t.trialEnd).toLocaleDateString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="rounded-2xl border-border">
          <header className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" /> Maiores consumidores de IA
            </h3>
          </header>
          {data.topUsage.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Sem consumo registrado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.topUsage.map((t: any) => (
                <li key={t.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.plan || "sem plano"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground tabular-nums">{(t.usedTokens / 1000).toFixed(0)}k tokens</p>
                    <p className="text-xs text-muted-foreground">{t.usedMessages} msgs</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
