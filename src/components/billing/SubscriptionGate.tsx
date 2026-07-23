import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogoMark } from "@/components/Logo";
import { Lock, Sparkles, LogOut, AlertTriangle } from "lucide-react";

type Info = {
  subscriptionStatus?: string;
  trialEnd?: string | null;
  planId?: string | null;
  stripeSubscriptionId?: string | null;
};

/**
 * Trava o painel quando o acesso expira: trial vencido, pagamento pendente
 * ou assinatura cancelada. Mostra uma tela cheia pedindo a assinatura.
 * Não bloqueia as telas onde o usuário resolve o pagamento (/assinatura,
 * /settings) nem a de checkout (que fica fora do painel).
 */
export function SubscriptionGate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, [location.pathname]);

  if (!info) return null;

  // Telas onde o pagamento é resolvido continuam acessíveis.
  if (["/assinatura", "/settings"].some((p) => location.pathname.startsWith(p))) return null;

  const status = info.subscriptionStatus;
  const trialExpired =
    status === "TRIAL" && !!info.trialEnd && new Date(info.trialEnd).getTime() < Date.now();
  const pastDue = status === "PAST_DUE";
  const canceled = status === "CANCELED";
  const blocked = trialExpired || pastDue || canceled;
  if (!blocked) return null;

  const goSubscribe = () => navigate(info.planId ? `/checkout?plan=${info.planId}` : "/assinatura");
  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const heading = pastDue
    ? "Pagamento não concluído"
    : canceled
    ? "Assinatura cancelada"
    : "Seu período de teste terminou";
  const body = pastDue
    ? "Não conseguimos renovar sua assinatura. Regularize o pagamento para voltar a usar o seu agente."
    : canceled
    ? "Sua assinatura foi encerrada. Reative para o seu agente voltar a atender."
    : "Os 7 dias de teste chegaram ao fim. Assine para o seu agente continuar atendendo, vendendo e agendando.";

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-slate-900/70 backdrop-blur-sm p-5">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-8 text-center space-y-5">
        <div className={`w-14 h-14 rounded-2xl grid place-items-center mx-auto ${pastDue ? "bg-red-500/10 text-red-600" : "bg-[#2563EB]/10 text-[#2563EB]"}`}>
          {pastDue ? <AlertTriangle className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
        </div>
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <LogoMark className="w-5 h-5 text-[#2563EB]" />
          <span className="text-sm font-semibold tracking-tight text-slate-600">Agentes Virtuais</span>
        </div>
        <h2 className="text-2xl font-bold tracking-[-0.02em] text-slate-900">{heading}</h2>
        <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
        <div className="space-y-2.5 pt-1">
          <button
            onClick={goSubscribe}
            className="w-full h-12 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4" /> {pastDue ? "Regularizar pagamento" : "Assinar agora"}
          </button>
          <button
            onClick={() => navigate("/assinatura")}
            className="w-full h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
          >
            Ver planos e faturas
          </button>
          <button
            onClick={logout}
            className="w-full h-10 text-sm text-slate-400 hover:text-slate-700 font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
