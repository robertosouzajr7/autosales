import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Coins, Megaphone, Cpu, AlertTriangle } from "lucide-react";

/**
 * Recarga de valor livre.
 *
 * O cliente digita quanto quer e vê, antes de pagar, o que aquilo compra:
 * quantas mensagens de cada categoria no disparo, quantos tokens na IA. Todo
 * número exibido vem cotado do servidor — a tela não multiplica preço por
 * conta própria, senão o resumo e a cobrança acabam divergindo no dia em que
 * o admin mexer no câmbio.
 */

type Tipo = "DISPARO" | "TOKENS";

const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: number) => Number(v || 0).toLocaleString("pt-BR");

/** Sugestões só encurtam o caminho de quem não quer pensar num número. */
const ATALHOS: Record<Tipo, number[]> = {
  DISPARO: [50, 100, 250, 500],
  TOKENS: [1, 5, 10, 25], // em milhões
};

const CATEGORIAS = [
  { k: "MARKETING", r: "Marketing" },
  { k: "UTILITY", r: "Utilidade" },
  { k: "AUTHENTICATION", r: "Autenticação" },
];

function authHeaders() {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export function RechargeDialog({
  open, onOpenChange, tipo, onErro,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: Tipo;
  onErro?: (msg: string) => void;
}) {
  const eDisparo = tipo === "DISPARO";
  // Em disparo o cliente pensa em reais. Em IA ele pensa em tokens — e o
  // mínimo é declarado em tokens, então é por ali que a conversa começa.
  const [modo, setModo] = useState<"BRL" | "TOKENS">(eDisparo ? "BRL" : "TOKENS");
  const [valor, setValor] = useState("");
  const [cotacao, setCotacao] = useState<any>(null);
  const [cotando, setCotando] = useState(false);
  const [indo, setIndo] = useState(false);
  const pedido = useRef(0);

  useEffect(() => {
    if (!open) return;
    setModo(eDisparo ? "BRL" : "TOKENS");
    setValor("");
    setCotacao(null);
  }, [open, eDisparo]);

  const corpo = useMemo(() => {
    const n = Number(String(valor).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return null;
    if (eDisparo) return { tipo, valorBrl: n };
    // Em IA o campo de quantidade é em MILHÕES: digitar "1000000" para pedir
    // o mínimo é o tipo de atrito que faz o cliente desistir.
    return modo === "TOKENS" ? { tipo, tokens: n * 1_000_000 } : { tipo, valorBrl: n };
  }, [valor, modo, tipo, eDisparo]);

  // Cota a cada pausa na digitação. O contador descarta resposta atrasada:
  // sem isso, uma cotação lenta de um valor antigo sobrescreve a atual.
  useEffect(() => {
    if (!open) return;
    if (!corpo) { setCotacao(null); return; }
    const meu = ++pedido.current;
    setCotando(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/billing/recharge/quote", {
          method: "POST", headers: authHeaders(), body: JSON.stringify(corpo),
        });
        const d = await res.json();
        if (meu === pedido.current) setCotacao(res.ok ? d : { ok: false, motivo: d.error });
      } catch {
        if (meu === pedido.current) setCotacao({ ok: false, motivo: "Não foi possível calcular agora." });
      } finally {
        if (meu === pedido.current) setCotando(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [corpo, open]);

  const irParaCheckout = async () => {
    if (!corpo || !cotacao?.ok) return;
    setIndo(true);
    try {
      const res = await fetch("/api/billing/recharge/checkout", {
        method: "POST", headers: authHeaders(), body: JSON.stringify(corpo),
      });
      const d = await res.json();
      if (res.ok && d.checkoutUrl) window.location.href = d.checkoutUrl;
      else onErro?.(d.error || "Não foi possível iniciar a recarga.");
    } catch {
      onErro?.("Não foi possível iniciar a recarga.");
    }
    setIndo(false);
  };

  const unidade = eDisparo || modo === "BRL" ? "R$" : "milhões de tokens";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {eDisparo ? <Megaphone className="w-4 h-4 text-primary" /> : <Cpu className="w-4 h-4 text-primary" />}
            {eDisparo ? "Recarregar crédito de disparo" : "Recarregar créditos de IA"}
          </DialogTitle>
          <DialogDescription>
            {eDisparo
              ? "Escolha o valor. O crédito vale para qualquer categoria e não expira."
              : "Escolha quanto quer comprar. Os tokens não expiram e só são usados depois da franquia do plano."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Em IA dá para pensar pelos dois lados: "quero 5 milhões" ou
              "tenho R$ 200". Um cliente usa um, outro usa o outro. */}
          {!eDisparo && (
            <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs">
              {(["TOKENS", "BRL"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setModo(m); setValor(""); }}
                  className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                    modo === m ? "bg-background shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {m === "TOKENS" ? "Por quantidade" : "Por valor"}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="valor-recarga">
              {eDisparo || modo === "BRL" ? "Quanto deseja recarregar?" : "Quantos tokens deseja comprar?"}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                {unidade === "R$" ? "R$" : ""}
              </span>
              <Input
                id="valor-recarga"
                inputMode="decimal"
                autoFocus
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder={eDisparo || modo === "BRL" ? "100,00" : "1"}
                className={unidade === "R$" ? "pl-9 text-lg tabular-nums" : "text-lg tabular-nums pr-32"}
              />
              {unidade !== "R$" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  milhões de tokens
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {ATALHOS[tipo].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => { if (!eDisparo) setModo("TOKENS"); setValor(String(a)); }}
                  className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted transition"
                >
                  {eDisparo ? brl(a) : `${a}M`}
                </button>
              ))}
            </div>
          </div>

          {/* Resumo: é o que responde "vale a pena?" antes do cartão. */}
          <div className="rounded-xl border bg-muted/40 p-4 min-h-[128px]">
            {cotando ? (
              <div className="grid h-full place-items-center py-6 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : !cotacao ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Digite um valor para ver o resumo.
              </p>
            ) : !cotacao.ok ? (
              <div className="flex items-start gap-2 py-4 text-sm text-amber-700 dark:text-amber-500">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{cotacao.motivo}</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Total a pagar</span>
                  <span className="text-2xl font-bold tabular-nums">{brl(cotacao.valorBrl)}</span>
                </div>

                {eDisparo ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
                      {CATEGORIAS.map((c) => (
                        <div key={c.k}>
                          <p className="text-[11px] uppercase text-muted-foreground">{c.r}</p>
                          <p className="text-base font-bold tabular-nums">{num(cotacao.equivale?.[c.k] ?? 0)}</p>
                          <p className="text-[10px] text-muted-foreground">{brl(cotacao.precos?.[c.k] || 0)} cada</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center">
                      Disparos possíveis com esta recarga, por categoria — você escolhe na hora do envio.
                    </p>
                  </>
                ) : (
                  <div className="border-t pt-3 space-y-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Tokens creditados</span>
                      <span className="font-semibold tabular-nums">{num(cotacao.tokens)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                      <span>Preço por 1 milhão</span>
                      <span className="tabular-nums">{brl(cotacao.precoPor1MTokens)}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-baseline justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>Saldo depois da recarga</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {eDisparo ? brl(cotacao.saldoDepois) : `${num(cotacao.saldoDepois)} tokens`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={irParaCheckout}
            disabled={!cotacao?.ok || cotando || indo}
            className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2"
          >
            {indo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
            {cotacao?.ok ? `Pagar ${brl(cotacao.valorBrl)}` : "Ir para o pagamento"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            O saldo é creditado assim que o pagamento é confirmado.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
