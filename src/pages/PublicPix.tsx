import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Check, QrCode, AlertTriangle } from "lucide-react";

/**
 * A página que abre pelo link do Pix.
 *
 * Existe porque nem todo cliente quer apontar a câmera ou colar um código
 * gigante no WhatsApp: alguns preferem abrir um link e resolver no navegador.
 * O conteúdo é o mesmo BR Code, só que numa tela.
 */
export default function PublicPix() {
  const { code } = useParams();
  const { toast } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [cobranca, setCobranca] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/pix/${code}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d?.error || "Não consegui carregar esta cobrança.");
        setCobranca(d);
      } catch (e: any) {
        setErro(e?.message || "Não consegui carregar esta cobrança.");
      }
      setCarregando(false);
    })();
  }, [code]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(cobranca.payload);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência o código continua na tela para
      // ser selecionado à mão — por isso o aviso, e não um erro.
      toast({ title: "Copie o código manualmente", description: "Seu navegador bloqueou a cópia automática." });
    }
  };

  const valor =
    cobranca?.amount != null
      ? Number(cobranca.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4 py-10">
      <div className="w-full max-w-[420px] rounded-[18px] border border-border bg-card p-6 shadow-card">
        {carregando ? (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-[13px]">Carregando…</p>
          </div>
        ) : erro ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
            <p className="text-[14px] font-medium text-foreground">{erro}</p>
            <p className="text-[12.5px] text-muted-foreground">
              Peça um novo link para quem está te atendendo.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-muted-foreground">
              <QrCode className="h-4 w-4" />
              <span className="text-[12.5px] font-semibold uppercase tracking-wide">Pagamento por Pix</span>
            </div>

            {cobranca.negocio && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Você está pagando para <span className="font-semibold text-foreground">{cobranca.negocio}</span>
              </p>
            )}
            {valor && <p className="mt-1 text-[30px] font-bold tracking-[-0.03em] text-foreground">{valor}</p>}
            {cobranca.description && (
              <p className="mt-0.5 text-[13px] text-muted-foreground">{cobranca.description}</p>
            )}
            {!valor && (
              <p className="mt-2 text-[13px] text-muted-foreground">
                O valor é digitado por você no aplicativo do banco.
              </p>
            )}

            {cobranca.status === "PAID" && (
              <p className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-[13px] font-medium text-emerald-900">
                Este pagamento já foi confirmado.
              </p>
            )}

            <div className="mt-5 flex justify-center rounded-xl border border-border-soft bg-white p-4">
              <img src={cobranca.qrCode} alt="QR Code do Pix" className="h-[220px] w-[220px]" />
            </div>

            <p className="mt-4 text-[12.5px] font-semibold text-foreground">Ou use o copia e cola</p>
            <p className="mt-1.5 max-h-[92px] overflow-y-auto break-all rounded-xl border border-border-soft bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {cobranca.payload}
            </p>
            <button
              onClick={copiar}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-[13.5px] font-semibold text-background transition-opacity hover:opacity-90"
            >
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiado ? "Código copiado" : "Copiar código"}
            </button>

            <p className="mt-4 text-center text-[12px] text-faint">
              Depois de pagar, mande o comprovante na conversa.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
