import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const { token } = useParams();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        {state === "loading" && (
          <>
            <Loader2 className="w-10 h-10 mx-auto text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Verificando seu e-mail…</p>
          </>
        )}
        {state === "ok" && (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 grid place-items-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Tudo certo!</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Link to="/dashboard">
              <Button className="w-full">Ir para o painel</Button>
            </Link>
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
