import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Logo } from "@/components/Logo";
import { Loader2, ShieldCheck, ArrowLeft, CalendarClock, XCircle } from "lucide-react";

/**
 * Checkout transparente (Stripe Embedded Checkout) em modo assinatura.
 * Coleta o cartão na própria página, aplica 7 dias de trial e deixa o Stripe
 * cobrar automaticamente ao fim do período. O cartão nunca toca nosso backend.
 */
export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const planId = params.get("plan");

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.remove("dark"); // checkout sempre claro
    const token = localStorage.getItem("token");
    if (!token) {
      navigate(`/login`);
      return;
    }
    if (!planId) {
      setError("Nenhum plano selecionado.");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/billing/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ planId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Não foi possível iniciar o checkout.");
        if (!data.publishableKey) throw new Error("Pagamento não configurado. Fale com o suporte.");
        setStripePromise(loadStripe(data.publishableKey));
        setClientSecret(data.clientSecret);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [planId, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="h-16 px-5 lg:px-10 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <Link to="/"><Logo wordmarkClassName="text-base" /></Link>
        <button onClick={() => navigate(-1)} className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-10 grid lg:grid-cols-[1fr_1.4fr] gap-10 items-start">
        {/* Resumo / confiança */}
        <div className="space-y-6 lg:sticky lg:top-24">
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.03em]">Ative seu plano</h1>
            <p className="text-slate-500 mt-2">Seus 7 dias grátis começam agora. A cobrança só acontece depois — e você cancela quando quiser.</p>
          </div>
          <div className="space-y-3">
            {[
              { icon: CalendarClock, t: "7 dias grátis", d: "A primeira cobrança ocorre só ao fim do período de teste." },
              { icon: ShieldCheck, t: "Pagamento seguro", d: "Processado pelo Stripe. Seus dados de cartão não passam pela nossa plataforma." },
              { icon: XCircle, t: "Cancele quando quiser", d: "Sem fidelidade. Cancele em um clique direto no painel." },
            ].map((f) => (
              <div key={f.t} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="h-9 w-9 rounded-xl bg-[#2563EB]/10 text-[#2563EB] grid place-items-center shrink-0"><f.icon className="w-4.5 h-4.5" /></div>
                <div>
                  <p className="text-sm font-semibold">{f.t}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Checkout embutido */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xl shadow-slate-200/50 min-h-[420px]">
          {error ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 grid place-items-center mx-auto"><XCircle className="w-6 h-6" /></div>
              <p className="text-sm font-medium text-slate-700 max-w-xs mx-auto">{error}</p>
              <Link to="/#pricing" className="inline-block text-sm font-semibold text-[#2563EB] hover:underline">Ver planos</Link>
            </div>
          ) : clientSecret && stripePromise ? (
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <div className="py-24 grid place-items-center text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-sm mt-3">Preparando o checkout seguro…</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
