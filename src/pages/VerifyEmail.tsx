import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, MailCheck, RefreshCw } from "lucide-react";

/**
 * Confirmação de e-mail — dois estados na mesma tela.
 *
 * Com token na URL, confirma. Sem token (`?aguardando=`), é a tela de
 * espera logo depois do cadastro: o painel só libera depois disso, e sem
 * uma tela dizendo isso o cliente ficava batendo em 403 sem entender.
 */
export default function VerifyEmail() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const aguardando = params.get("aguardando");
  const [state, setState] = useState<"loading" | "ok" | "error" | "aguardando">(
    token ? "loading" : "aguardando"
  );
  const [message, setMessage] = useState("");
  const [reenviando, setReenviando] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const d = await res.json();
        if (res.ok) {
          setState("ok");
          setMessage(d.message || "E-mail confirmado com sucesso.");
        } else {
          setState("error");
          setMessage(d.error || "Não foi possível confirmar.");
        }
      } catch {
        setState("error");
        setMessage("Erro de conexão. Tente novamente.");
      }
    })();
  }, [token]);

  const reenviar = async () => {
    setReenviando(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: aguardando }),
      });
      const d = await res.json();
      toast(
        res.ok
          ? { title: "Link reenviado", description: `Confira a caixa de ${aguardando}.` }
          : { title: "Não consegui reenviar", description: d.error, variant: "destructive" }
      );
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
    setReenviando(false);
  };

  /** Depois de confirmar, retoma de onde parou: checkout ou onboarding. */
  const continuar = () => {
    const plano = sessionStorage.getItem("planoPendente");
    sessionStorage.removeItem("planoPendente");
    navigate(plano ? `/checkout?plan=${plano}` : "/onboarding");
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        {state === "loading" && (
          <>
            <Loader2 className="w-10 h-10 mx-auto text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Verificando seu e-mail…</p>
          </>
        )}

        {state === "aguardando" && (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 grid place-items-center">
              <MailCheck className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Confirme seu e-mail</h1>
            <p className="text-sm text-muted-foreground">
              Enviamos um link para <strong className="text-foreground">{aguardando || "o seu e-mail"}</strong>.
              Clique nele para liberar o painel — é também por esse endereço que você recupera a senha
              e recebe os avisos de cobrança.
            </p>
            <div className="space-y-2 pt-2">
              <Button onClick={reenviar} disabled={reenviando} variant="outline" className="w-full gap-2">
                {reenviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Reenviar link
              </Button>
              <Button onClick={() => navigate("/dashboard")} variant="ghost" className="w-full text-muted-foreground">
                Entrar e confirmar depois
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Não achou? Olhe no spam ou promoções.
            </p>
          </>
        )}

        {state === "ok" && (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 grid place-items-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Tudo certo!</h1>
            <p className="text-sm text-muted-foreground">{message} Seu painel está liberado.</p>
            <Button onClick={continuar} className="w-full">Continuar</Button>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 grid place-items-center">
              <XCircle className="w-6 h-6 text-rose-600" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Não deu certo</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Link to="/login">
              <Button variant="outline" className="w-full">Ir para o login</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
