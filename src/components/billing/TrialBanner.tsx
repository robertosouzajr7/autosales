import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X, AlertTriangle } from "lucide-react";

type Info = {
  subscriptionStatus?: string;
  trialEnd?: string | null;
  planId?: string | null;
  stripeSubscriptionId?: string | null;
};

function daysLeft(trialEnd?: string | null): number | null {
  if (!trialEnd) return null;
  const ms = new Date(trialEnd).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * Faixa fina no topo do painel avisando o fim do trial e levando ao checkout.
 * Some quando o tenant já tem assinatura ativa (stripeSubscriptionId) ou não
 * está em TRIAL. Dispensável por dia (sessionStorage).
 */
export function TrialBanner() {
  const navigate = useNavigate();
  const [info, setInfo] = useState<Info | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setInfo(d))
      .catch(() => {});
  }, []);

  if (!info || dismissed) return null;

  const isTrial = info.subscriptionStatus === "TRIAL";
  const isPastDue = info.subscriptionStatus === "PAST_DUE";
  const hasSub = !!info.stripeSubscriptionId;
  if ((!isTrial && !isPastDue) || (isTrial && hasSub)) return null;

  const dismissKey = `trial_banner_dismissed_${new Date().toISOString().slice(0, 10)}`;
  if (sessionStorage.getItem(dismissKey)) return null;

  const left = daysLeft(info.trialEnd);
  const goCheckout = () => navigate(info.planId ? `/checkout?plan=${info.planId}` : "/settings");

  const past = isPastDue;
  const label = past
    ? "Seu pagamento não foi concluído. Ative sua assinatura para não perder o acesso."
    : left === 0
    ? "Seu teste grátis termina hoje. Ative sua assinatura para continuar."
    : `Faltam ${left} ${left === 1 ? "dia" : "dias"} de teste grátis. Ative sua assinatura para não perder o acesso.`;

  return (
    <div
      className={`flex items-center gap-3 px-4 md:px-6 py-2.5 text-sm ${
        past
          ? "bg-red-50 text-red-800 border-b border-red-200"
          : "bg-gradient-to-r from-[#2563EB]/10 to-[#7c5cff]/10 text-slate-800 border-b border-[#2563EB]/15"
      }`}
    >
      <span className={`grid place-items-center h-7 w-7 rounded-lg shrink-0 ${past ? "bg-red-500/15 text-red-600" : "bg-[#2563EB]/15 text-[#2563EB]"}`}>
        {past ? <AlertTriangle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </span>
      <p className="flex-1 min-w-0 font-medium leading-snug">{label}</p>
      <button
        onClick={goCheckout}
        className={`shrink-0 h-8 px-4 rounded-lg font-semibold text-xs text-white transition-transform hover:scale-105 ${
          past ? "bg-red-600 hover:bg-red-700" : "bg-[#2563EB] hover:bg-[#1D4ED8]"
        }`}
      >
        {past ? "Regularizar" : "Ativar assinatura"}
      </button>
      <button
        onClick={() => {
          sessionStorage.setItem(dismissKey, "1");
          setDismissed(true);
        }}
        className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-700"
        aria-label="Dispensar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
