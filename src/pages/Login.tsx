import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthShell, glass } from "@/components/auth/AuthShell";

const field =
  "h-14 pl-12 rounded-2xl bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-base font-medium focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 transition";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, twoFactorCode: twoFactorCode || undefined }),
      });
      const data = await res.json();

      // 2FA — servidor pediu o código e ainda não emitiu token.
      if (res.ok && data.twoFactorRequired) {
        setNeedsTwoFactor(true);
        setLoading(false);
        return;
      }

      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userRole", data.user.role);
        if (data.tenant) {
          localStorage.setItem("tenantId", data.tenant.id);
          localStorage.setItem("userPlan", data.tenant.planId);
        }
        if (data.user.role === "SUPERADMIN") navigate("/admin");
        else navigate("/dashboard");
      } else {
        toast({ title: "Erro no login", description: data.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro na conexão", description: "Não foi possível autenticar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold tracking-[-0.03em] text-balance">
            Bem-vindo de <span className="bg-gradient-to-r from-[#2563EB] via-[#7c5cff] to-[#22d3ee] bg-clip-text text-transparent">volta</span>.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Entre para gerenciar seus agentes, conversas e agendamentos.
          </p>
        </div>

        <div className={`${glass} p-8 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-black/20`}>
          <form onSubmit={handleLogin} className="space-y-6">
            {!needsTwoFactor && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">Seu e-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
                  </div>
                </div>
                <div className="text-right">
                  <Link to="/forgot-password" className="text-xs font-semibold text-[#2563EB] hover:underline">Esqueci minha senha</Link>
                </div>
              </div>
            )}

            {needsTwoFactor && (
              <div className="space-y-4">
                <div className={`rounded-2xl ${glass} p-4 flex items-start gap-3`}>
                  <div className="h-9 w-9 rounded-lg bg-[#2563EB] text-white grid place-items-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Verificação em 2 passos</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Abra seu app autenticador e digite o código de 6 dígitos.</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">Código do autenticador</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                    className="h-16 rounded-2xl bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-2xl tracking-[0.5em] font-bold text-center focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
                    autoFocus
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-14 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-2xl font-semibold text-base gap-2 shadow-[0_14px_34px_-8px_rgba(37,99,235,0.5)] border-none"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (needsTwoFactor ? "Confirmar" : "Entrar")}
              {!loading && <ArrowRight className="w-5 h-5" />}
            </Button>
          </form>
        </div>

        <div className="text-center space-y-3">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Não tem conta? <Link to="/register" className="text-[#2563EB] font-semibold hover:underline">Iniciar 7 dias grátis</Link>
          </p>
          <Link to="/" className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Voltar para a Home</Link>
        </div>
      </div>
    </AuthShell>
  );
}
