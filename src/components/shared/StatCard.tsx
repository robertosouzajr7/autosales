import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Texto auxiliar abaixo do valor (ex.: "de 30 esta semana"). */
  hint?: string;
  /** Variação/tendência opcional (ex.: "+12%"). */
  trend?: { value: string; positive?: boolean };
  className?: string;
  onClick?: () => void;
}

/**
 * Cartão de métrica padrão — números legíveis, rótulo sóbrio, uma cor de
 * destaque só no ícone. Substitui os KPIs copy-paste de cada página.
 */
export function StatCard({ label, value, icon, hint, trend, className, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-border bg-card p-5 transition-shadow",
        onClick && "cursor-pointer hover:shadow-sm hover:border-primary/30",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && <div className="text-primary/80">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">{value}</span>
        {trend && (
          <span className={cn("text-xs font-semibold", trend.positive ? "text-primary" : "text-muted-foreground")}>
            {trend.value}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
