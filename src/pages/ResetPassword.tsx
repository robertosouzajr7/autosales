import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < 8) {
      return toast({ title: "Senha muito curta", description: "Use ao menos 8 caracteres.", variant: "destructive" });
    }
    if (password !== confirm) {
      return toast({ title: "As senhas não conferem", variant: "destructive" });
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = await res.json();
      if (res.ok) {
        setDone(true);
        setTimeout(() => navigate("/login"), 2000);
      } else {
        toast({ title: "Erro", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 space-y-5">
        {done ? (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 grid place-items-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h1 className="text-lg font-semibold text-foreground text-center">Senha atualizada!</h1>
            <p className="text-sm text-muted-foreground text-center">Redirecionando para o login…</p>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Nova senha</h1>
              <p className="text-sm text-muted-foreground mt-1">Escolha uma senha de pelo menos 8 caracteres.</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nova senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Confirmar nova senha</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </div>
            <Button onClick={submit} disabled={loading || !password || !confirm} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar nova senha
            </Button>
            <Link to="/login" className="block text-sm text-muted-foreground hover:text-foreground text-center">
              Voltar para login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
