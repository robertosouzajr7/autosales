import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Receipt, Plus, Loader2, Upload, Check, X, AlertTriangle, FileText, ExternalLink, CircleDollarSign,
} from "lucide-react";

const STATUS = {
  PENDING: { rotulo: "Aguardando pagamento", classe: "border-amber-300 bg-[#FEF3C7] text-amber-900" },
  PAID: { rotulo: "Pago", classe: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  CANCELED: { rotulo: "Cancelada", classe: "border-border bg-surface-2 text-muted-foreground" },
};

const VEREDITO = {
  APPROVED: { rotulo: "Comprovante confere", Icone: Check, classe: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  REJECTED: { rotulo: "Comprovante recusado", Icone: X, classe: "border-red-300 bg-red-50 text-red-900" },
  REVIEW: { rotulo: "Precisa de conferência", Icone: AlertTriangle, classe: "border-amber-300 bg-[#FEF3C7] text-amber-900" },
};

const MEIOS = [
  { value: "PIX", label: "Pix" },
  { value: "CARD", label: "Cartão" },
  { value: "CASH", label: "Dinheiro" },
  { value: "TRANSFER", label: "Transferência" },
  { value: "OTHER", label: "Outro" },
];

function authHeaders() {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

const dinheiro = (v: any) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Vendas() {
  const { toast } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [vendas, setVendas] = useState<any[]>([]);
  const [resumo, setResumo] = useState<any>({ pago: 0, pendente: 0, pagas: 0, pendentes: 0 });
  const [filtro, setFiltro] = useState("TODAS");
  const [aberta, setAberta] = useState<any>(null);
  const [nova, setNova] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const q = filtro === "TODAS" ? "" : `?status=${filtro}`;
      const res = await fetch(`/api/sales${q}`, { headers: authHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Não consegui carregar as vendas.");
      setVendas(d.vendas || []);
      setResumo(d.resumo || {});
    } catch (e: any) {
      toast({ title: "Erro ao carregar vendas", description: e?.message, variant: "destructive" });
    }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, [filtro]);

  const salvarNova = async () => {
    setSalvando(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(nova),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Não consegui registrar a venda.");
      setNova(null);
      toast({ title: "Venda registrada" });
      carregar();
    } catch (e: any) {
      toast({ title: "Erro ao registrar", description: e?.message, variant: "destructive" });
    }
    setSalvando(false);
  };

  const mudarStatus = async (venda: any, status: string) => {
    try {
      const res = await fetch(`/api/sales/${venda.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Não consegui atualizar a venda.");
      if (aberta?.id === venda.id) setAberta(d);
      carregar();
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e?.message, variant: "destructive" });
    }
  };

  const enviarComprovante = async (venda: any, arquivo: File) => {
    setEnviandoComprovante(true);
    try {
      const corpo = new FormData();
      corpo.append("file", arquivo);
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/sales/${venda.id}/receipt`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: corpo,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Não consegui conferir o comprovante.");
      setAberta(d.venda);
      const v = VEREDITO[d.comprovante.status as keyof typeof VEREDITO];
      toast({
        title: v?.rotulo || "Comprovante conferido",
        description: (d.comprovante.motivos || []).map((m: any) => m.texto).join(" "),
      });
      carregar();
    } catch (e: any) {
      toast({ title: "Erro no comprovante", description: e?.message, variant: "destructive" });
    }
    setEnviandoComprovante(false);
  };

  const decidirComprovante = async (comprovante: any, status: string) => {
    try {
      await fetch(`/api/sales/receipts/${comprovante.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      toast({ title: status === "APPROVED" ? "Comprovante aprovado" : "Comprovante recusado" });
      setAberta(null);
      carregar();
    } catch (e: any) {
      toast({ title: "Erro ao decidir", description: e?.message, variant: "destructive" });
    }
  };

  const filtros = useMemo(
    () => [
      { id: "TODAS", rotulo: "Todas" },
      { id: "PENDING", rotulo: "Aguardando" },
      { id: "PAID", rotulo: "Pagas" },
      { id: "CANCELED", rotulo: "Canceladas" },
    ],
    []
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1240px] px-4 pb-10 pt-5 sm:px-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Vendas</h1>
            <p className="mt-0.5 max-w-lg text-[13.5px] text-muted-foreground">
              O que foi fechado no atendimento, com o comprovante conferido antes de virar pagamento.
            </p>
          </div>
          <Button onClick={() => setNova({ amount: "", title: "", paymentMethod: "PIX" })} className="h-10 gap-2">
            <Plus className="h-4 w-4" /> Registrar venda
          </Button>
        </header>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[14px] border border-border bg-card p-4 shadow-card">
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">Recebido</p>
            <p className="mt-1 text-[24px] font-bold tracking-[-0.03em] text-foreground">{dinheiro(resumo.pago)}</p>
            <p className="text-[12.5px] text-faint">{resumo.pagas || 0} venda(s) paga(s)</p>
          </div>
          <div className="rounded-[14px] border border-border bg-card p-4 shadow-card">
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">Aguardando</p>
            <p className="mt-1 text-[24px] font-bold tracking-[-0.03em] text-foreground">{dinheiro(resumo.pendente)}</p>
            <p className="text-[12.5px] text-faint">{resumo.pendentes || 0} venda(s) pendente(s)</p>
          </div>
        </div>

        <nav className="mb-4 flex gap-1 overflow-x-auto rounded-[14px] border border-border bg-card p-2 shadow-card">
          {filtros.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`h-9 shrink-0 rounded-lg px-3.5 text-[12.5px] font-semibold transition-colors ${
                filtro === f.id ? "bg-accent-soft text-accent-text" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.rotulo}
            </button>
          ))}
        </nav>

        {carregando ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[72px] w-full rounded-[14px]" />)}
          </div>
        ) : vendas.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="Nenhuma venda por aqui"
            description="O agente registra as vendas que fecha na conversa. Você também pode registrar uma na mão."
          />
        ) : (
          <div className="space-y-2">
            {vendas.map((v) => {
              const s = STATUS[v.status as keyof typeof STATUS] || STATUS.PENDING;
              const ultimo = v.receipts?.[0];
              return (
                <button
                  key={v.id}
                  onClick={() => setAberta(v)}
                  className="flex w-full items-center gap-3 rounded-[14px] border border-border bg-card p-4 text-left shadow-card transition-colors hover:bg-surface-2"
                >
                  <CircleDollarSign className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-foreground">
                      {v.title || "Venda"}
                      {v.lead?.name ? <span className="font-normal text-muted-foreground"> · {v.lead.name}</span> : null}
                    </p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString("pt-BR")}
                      {v.source === "AGENT" ? " · registrada pelo agente" : ""}
                      {ultimo ? ` · ${VEREDITO[ultimo.status as keyof typeof VEREDITO]?.rotulo}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold ${s.classe}`}>
                    {s.rotulo}
                  </span>
                  <span className="shrink-0 text-[15px] font-bold tracking-[-0.02em] text-foreground">
                    {dinheiro(v.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detalhe da venda */}
      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{aberta?.title || "Venda"}</DialogTitle>
          </DialogHeader>
          {aberta && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border-soft bg-surface-2 p-3">
                <div>
                  <p className="text-[12.5px] text-muted-foreground">
                    {aberta.lead?.name || "Sem contato vinculado"}
                  </p>
                  <p className="text-[20px] font-bold tracking-[-0.02em] text-foreground">{dinheiro(aberta.amount)}</p>
                </div>
                <span className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold ${
                  (STATUS[aberta.status as keyof typeof STATUS] || STATUS.PENDING).classe
                }`}>
                  {(STATUS[aberta.status as keyof typeof STATUS] || STATUS.PENDING).rotulo}
                </span>
              </div>

              {aberta.items?.length > 0 && (
                <ul className="space-y-1">
                  {aberta.items.map((i: any) => (
                    <li key={i.id} className="flex justify-between text-[13px]">
                      <span className="text-foreground">{i.quantity}× {i.name}</span>
                      <span className="text-muted-foreground">{dinheiro(i.unitPrice * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div>
                <p className="text-[13px] font-semibold text-foreground">Comprovantes</p>
                {aberta.receipts?.length ? (
                  <ul className="mt-2 space-y-2">
                    {aberta.receipts.map((r: any) => {
                      const v = VEREDITO[r.status as keyof typeof VEREDITO] || VEREDITO.REVIEW;
                      return (
                        <li key={r.id} className={`rounded-xl border p-3 ${v.classe}`}>
                          <div className="flex items-center gap-2">
                            <v.Icone className="h-4 w-4 shrink-0" />
                            <span className="flex-1 text-[13px] font-semibold">{v.rotulo}</span>
                            <a
                              href={r.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 rounded-lg border border-current/30 px-2 py-1 text-[11.5px] font-semibold"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                          <ul className="mt-1.5 space-y-0.5">
                            {(r.motivos || []).map((m: any, idx: number) => (
                              <li key={idx} className="text-[12.5px]">{m.texto}</li>
                            ))}
                          </ul>
                          <p className="mt-1.5 text-[11.5px] opacity-80">
                            {r.amount != null ? `Valor lido: ${dinheiro(r.amount)}` : "Valor não lido"}
                            {r.paidAt ? ` · ${new Date(r.paidAt).toLocaleString("pt-BR")}` : ""}
                            {r.scheduled ? " · Pix agendado" : ""}
                          </p>
                          {r.status !== "APPROVED" && (
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => decidirComprovante(r, "APPROVED")}
                                className="rounded-lg border border-current/30 px-2.5 py-1 text-[12px] font-semibold"
                              >
                                Aceitar assim mesmo
                              </button>
                              {r.status !== "REJECTED" && (
                                <button
                                  onClick={() => decidirComprovante(r, "REJECTED")}
                                  className="rounded-lg border border-current/30 px-2.5 py-1 text-[12px] font-semibold"
                                >
                                  Recusar
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-1.5 flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-[12.5px] text-muted-foreground">
                    <FileText className="h-4 w-4" /> Nenhum comprovante conferido ainda.
                  </p>
                )}

                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[12.5px] font-semibold text-foreground hover:bg-surface-2">
                  {enviandoComprovante ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {enviandoComprovante ? "Conferindo…" : "Enviar comprovante"}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf"
                    className="hidden"
                    disabled={enviandoComprovante}
                    onChange={(e) => {
                      const arquivo = e.target.files?.[0];
                      e.target.value = "";
                      if (arquivo) enviarComprovante(aberta, arquivo);
                    }}
                  />
                </label>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {aberta?.status !== "PAID" && (
              <Button variant="outline" onClick={() => mudarStatus(aberta, "PAID")}>Marcar como paga</Button>
            )}
            {aberta?.status !== "CANCELED" && (
              <Button variant="outline" onClick={() => mudarStatus(aberta, "CANCELED")}>Cancelar venda</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova venda */}
      <Dialog open={!!nova} onOpenChange={(o) => !o && setNova(null)}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader><DialogTitle>Registrar venda</DialogTitle></DialogHeader>
          {nova && (
            <div className="space-y-3">
              <div>
                <Label className="text-[12.5px]">Do que é a venda</Label>
                <Input
                  className="mt-1 h-10"
                  value={nova.title}
                  onChange={(e) => setNova({ ...nova, title: e.target.value })}
                  placeholder="Ex.: Pedido 240"
                />
              </div>
              <div>
                <Label className="text-[12.5px]">Valor (R$)</Label>
                <Input
                  className="mt-1 h-10"
                  type="number"
                  step="0.01"
                  value={nova.amount}
                  onChange={(e) => setNova({ ...nova, amount: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[12.5px]">Forma de pagamento</Label>
                <Select value={nova.paymentMethod} onValueChange={(v) => setNova({ ...nova, paymentMethod: v })}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEIOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[12.5px]">Observações</Label>
                <Textarea
                  className="mt-1"
                  value={nova.notes || ""}
                  onChange={(e) => setNova({ ...nova, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={salvarNova} disabled={salvando || !Number(nova?.amount)} className="gap-2">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
