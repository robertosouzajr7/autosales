import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Sempre exibimos sucesso — não vazamos existência de conta.
      setSent(true);
    } catch {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 space-y-5">
        {!sent ? (
          <>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Esqueceu a senha?</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Informe seu e-mail e enviamos um link pra redefinir.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <Button onClick={submit} disabled={loading || !email} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Enviar link
            </Button>
            <Link
              to="/login"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar para login
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 grid place-items-center">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-lg font-semibold text-foreground text-center">Confira seu e-mail</h1>
            <p className="text-sm text-muted-foreground text-center">
              Se existe uma conta com <span className="font-medium text-foreground">{email}</span>,
              enviamos um link pra redefinir sua senha. Válido por 1 hora.
            </p>
            <Link to="/login" className="block">
              <Button variant="outline" className="w-full">Voltar para login</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
