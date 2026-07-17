import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { CheckCircle2, ArrowRight } from "lucide-react";

/**
 * Página de retorno do Stripe Embedded Checkout (return_url). A ativação real
 * da assinatura é feita pelo webhook; aqui apenas confirmamos e seguimos para
 * o onboarding (que redireciona ao painel se o negócio já estiver configurado).
 */
export default function CheckoutReturn() {
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    const t = setTimeout(() => navigate("/onboarding"), 3500);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans grid place-items-center px-5">
      <div className="max-w-md w-full text-center space-y-6">
        <Link to="/" className="inline-flex"><Logo /></Link>
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-xl shadow-slate-200/50 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 grid place-items-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">Tudo certo! 🎉</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Seu período de teste de 7 dias começou. Você só será cobrado ao fim do período — e pode cancelar quando quiser.
            Vamos configurar seu agente agora.
          </p>
          <button
            onClick={() => navigate("/onboarding")}
            className="w-full h-12 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            Continuar <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
