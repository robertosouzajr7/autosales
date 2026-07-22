import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  CreditCard, Check, Loader2, Sparkles, CalendarClock, AlertTriangle,
  Bot, MessageSquare, Cpu, RefreshCw, Receipt,
} from "lucide-react";

function authHeaders() {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}
const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—");
const daysLeft = (d?: string | null) => {
  if (!d) return null;
  return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));
};

const STATUS: Record<string, { label: string; cls: string }> = {
  TRIAL: { label: "Em teste grátis", cls: "bg-blue-100 text-blue-700" },
  ACTIVE: { label: "Assinatura ativa", cls: "bg-emerald-100 text-emerald-700" },
  PAST_DUE: { label: "Pagamento pendente", cls: "bg-red-100 text-red-700" },
  CANCELED: { label: "Cancelada", cls: "bg-slate-200 text-slate-600" },
};
const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  PAID: { label: "Paga", cls: "bg-emerald-100 text-emerald-700" },
  PENDING: { label: "Pendente", cls: "bg-amber-100 text-amber-700" },
  OVERDUE: { label: "Vencida", cls: "bg-red-100 text-red-700" },
  CANCELED: { label: "Cancelada", cls: "bg-slate-200 text-slate-600" },
};

export default function Assinatura() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, pl] = await Promise.all([
        fetch("/api/billing/portal", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/billing/plans", { headers: authHeaders() }).then((r) => r.json()),
      ]);
      setData(p);
      setPlans(Array.isArray(pl) ? pl : []);
    } catch {
      toast({ title: "Erro ao carregar assinatura", variant: "destructive" });
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const t = data?.tenant;
  const plan = data?.plan;
  const status = t?.subscriptionStatus || "TRIAL";
  const hasSub = !!t?.stripeSubscriptionId;
  const canceling = !!t?.cancelAtPeriodEnd;

  const cancel = async () => {
    if (!confirm("Cancelar a assinatura? Você mantém o acesso até o fim do período já pago.")) return;
    setBusy(true);
    const res = await fetch("/api/billing/cancel", { method: "POST", headers: authHeaders() });
    setBusy(false);
    if (res.ok) { toast({ title: "Cancelamento agendado", description: "Acesso mantido até o fim do período." }); load(); }
    else { const d = await res.json(); toast({ title: "Erro", description: d.error, variant: "destructive" }); }
  };
  const resume = async () => {
    setBusy(true);
    const res = await fetch("/api/billing/resume", { method: "POST", headers: authHeaders() });
    setBusy(false);
    if (res.ok) { toast({ title: "Assinatura reativada" }); load(); }
    else { const d = await res.json(); toast({ title: "Erro", description: d.error, variant: "destructive" }); }
  };
  const payInvoice = async (invoiceId: string) => {
    const res = await fetch(`/api/billing/checkout/${invoiceId}`, { method: "POST", headers: authHeaders() });
    const d = await res.json();
    if (res.ok && d.checkoutUrl) window.location.href = d.checkoutUrl;
    else toast({ title: "Erro ao abrir pagamento", description: d.error, variant: "destructive" });
  };

  const usage = [
    { icon: Cpu, label: "Créditos de IA (tokens)", used: t?.usedTokens || 0, max: plan?.maxTokens || 0, on: plan?.enableTokens },
    { icon: MessageSquare, label: "Mensagens", used: t?.usedMessages || 0, max: plan?.maxMessages || 0, on: plan?.enableMessages },
    { icon: Bot, label: "Agentes de IA ativos", used: t?.activeSdrs || 0, max: plan?.maxSdrs || 0, on: plan?.enableSdr },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Assinatura"
          subtitle="Gerencie seu plano, pagamento e faturas."
          icon={<CreditCard className="w-5 h-5" />}
        />

        {loading ? (
          <div className="py-24 grid place-items-center text-muted-foreground"><Loader2 className="w-7 h-7 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            {/* Status + plano atual */}
            <Card className="p-6 rounded-2xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <Badge className={`${STATUS[status]?.cls} border-none font-semibold`}>{STATUS[status]?.label || status}</Badge>
                  <h2 className="text-2xl font-semibold tracking-tight">{plan?.name || "Sem plano"}</h2>
                  <p className="text-sm text-muted-foreground">
                    {plan ? `${brl(plan.priceMonthly)}/mês` : "—"}
                    {status === "TRIAL" && t?.trialEnd && ` · teste termina em ${daysLeft(t.trialEnd)} dia(s) (${fmtDate(t.trialEnd)})`}
                    {status === "ACTIVE" && t?.nextBillingDate && (canceling
                      ? ` · acesso até ${fmtDate(t.nextBillingDate)}`
                      : ` · próxima cobrança em ${fmtDate(t.nextBillingDate)}`)}
                  </p>
                </div>

                <div className="flex flex-col items-stretch gap-2 min-w-[200px]">
                  {(!hasSub || status === "TRIAL" || status === "PAST_DUE" || status === "CANCELED") && plan && (
                    <Button onClick={() => navigate(`/checkout?plan=${plan.id}`)} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2">
                      <Sparkles className="w-4 h-4" /> {status === "PAST_DUE" ? "Regularizar pagamento" : "Ativar assinatura"}
                    </Button>
                  )}
                  {hasSub && status === "ACTIVE" && !canceling && (
                    <Button variant="outline" onClick={cancel} disabled={busy} className="text-red-600 border-red-200 hover:bg-red-50 gap-2">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Cancelar assinatura
                    </Button>
                  )}
                  {hasSub && canceling && (
                    <Button onClick={resume} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Reativar renovação
                    </Button>
                  )}
                </div>
              </div>

              {canceling && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  <CalendarClock className="w-4 h-4 shrink-0" />
                  Renovação cancelada. Você mantém o acesso até {fmtDate(t?.nextBillingDate)}.
                </div>
              )}
              {status === "PAST_DUE" && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Seu último pagamento não foi concluído. Regularize para não perder o acesso.
                </div>
              )}
            </Card>

            {/* Uso do ciclo */}
            <Card className="p-6 rounded-2xl">
              <h3 className="text-sm font-semibold mb-4">Uso do ciclo atual</h3>
              <div className="grid sm:grid-cols-3 gap-5">
                {usage.map((u) => {
                  const pct = u.on && u.max ? Math.min(100, Math.round((u.used / u.max) * 100)) : 0;
                  return (
                    <div key={u.label} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <u.icon className="w-4 h-4 text-primary" />
                        <span className="text-muted-foreground">{u.label}</span>
                      </div>
                      {u.on ? (
                        <>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {u.used.toLocaleString("pt-BR")} de {u.max.toLocaleString("pt-BR")} ({pct}%)
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Não incluso neste plano</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Trocar de plano */}
            <div>
              <h3 className="text-sm font-semibold mb-3 px-1">Planos disponíveis</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((p) => {
                  const current = plan?.id === p.id;
                  return (
                    <Card key={p.id} className={`p-5 rounded-2xl flex flex-col ${current ? "ring-2 ring-primary" : ""}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{p.name}</span>
                        {current && <Badge className="bg-primary/10 text-primary border-none text-[11px]">Atual</Badge>}
                      </div>
                      <p className="text-2xl font-bold tracking-tight mt-1">{brl(p.priceMonthly)}<span className="text-xs font-medium text-muted-foreground">/mês</span></p>
                      <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground flex-1">
                        <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> {p.enableSdr ? `Até ${p.maxSdrs} agente(s) de IA` : "Sem agentes"}</li>
                        <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> {(p.maxTokens / 1000).toLocaleString("pt-BR")}k tokens/mês</li>
                        <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> {p.maxMessages.toLocaleString("pt-BR")} mensagens/mês</li>
                      </ul>
                      <Button
                        disabled={current}
                        onClick={() => navigate(`/checkout?plan=${p.id}`)}
                        className={`mt-4 w-full ${current ? "bg-muted text-muted-foreground" : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"}`}
                      >
                        {current ? "Plano atual" : "Escolher plano"}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Faturas */}
            <Card className="p-6 rounded-2xl">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Receipt className="w-4 h-4" /> Histórico de faturas</h3>
              {(!data?.invoices || data.invoices.length === 0) ? (
                <p className="text-sm text-muted-foreground py-4">Nenhuma fatura por aqui ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="py-2 font-medium">Data</th>
                        <th className="py-2 font-medium">Valor</th>
                        <th className="py-2 font-medium">Status</th>
                        <th className="py-2 font-medium text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.invoices.map((inv: any) => (
                        <tr key={inv.id} className="border-b border-border/60 last:border-0">
                          <td className="py-3">{fmtDate(inv.createdAt)}</td>
                          <td className="py-3 tabular-nums">{brl(inv.amount)}</td>
                          <td className="py-3"><Badge className={`${INVOICE_STATUS[inv.status]?.cls || ""} border-none text-[11px]`}>{INVOICE_STATUS[inv.status]?.label || inv.status}</Badge></td>
                          <td className="py-3 text-right">
                            {(inv.status === "PENDING" || inv.status === "OVERDUE") && (
                              <Button size="sm" variant="outline" onClick={() => payInvoice(inv.id)}>Pagar</Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
