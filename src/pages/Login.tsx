import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem("userRole", data.user.role);
        if (data.tenant) {
            localStorage.setItem("tenantId", data.tenant.id);
            localStorage.setItem("userPlan", data.tenant.planId);
        }
        
        if (data.user.role === "SUPERADMIN") navigate("/admin");
        else navigate("/crm");
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/20 -translate-x-1/2 -translate-y-1/2 blur-3xl opacity-30 rounded-full" />
      <div className="max-w-md w-full space-y-10 relative z-10">
        
        <div className="text-center space-y-3">
          <div className="inline-flex bg-primary p-3 rounded-2xl shadow-2xl shadow-primary/20 mb-4">
             <Target className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Bem-vindo de volta.</h1>
          <p className="text-slate-500 font-bold">Faça login para gerenciar seus SDRs e Leads.</p>
        </div>

        <Card className="border-none shadow-3xl bg-white p-10 rounded-[40px]">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Seu E-mail</Label>
                <div className="relative">
                   <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                   <Input 
                     type="email" 
                     placeholder="seu@email.com" 
                     value={email} 
                     onChange={e => setEmail(e.target.value)} 
                     className="h-16 pl-12 border-slate-100 rounded-2xl bg-slate-50 shadow-none text-lg font-bold focus:ring-primary/10 transition-all"
                   />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Senha</Label>
                <div className="relative">
                   <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                   <Input 
                     type="password" 
                     placeholder="••••••••" 
                     value={password} 
                     onChange={e => setPassword(e.target.value)} 
                     className="h-16 pl-12 border-slate-100 rounded-2xl bg-slate-50 shadow-none text-lg font-bold focus:ring-primary/10 transition-all"
                   />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full h-16 bg-slate-900 hover:bg-black rounded-2xl font-black text-xl shadow-2xl shadow-slate-200 gap-3" disabled={loading}>
               {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Entrar Painel SDR"}
               {!loading && <ArrowRight className="w-6 h-6 text-primary" />}
            </Button>
          </form>
        </Card>

        <div className="text-center space-y-4">
           <p className="text-sm font-bold text-slate-400 italic">Não tem conta? <Link to="/register" className="text-primary hover:underline">Iniciar 7 dias grátis</Link></p>
           <Link to="/" className="text-xs font-black text-slate-300 uppercase tracking-widest hover:text-slate-900 transition-colors">Voltar para Home</Link>
        </div>

      </div>
    </div>
  );
}
