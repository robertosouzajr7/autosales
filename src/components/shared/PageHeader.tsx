import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Ações à direita (ex.: botão primário). */
  actions?: ReactNode;
  /** Ícone opcional à esquerda do título. */
  icon?: ReactNode;
}

/**
 * Cabeçalho de página padrão do app — um só padrão para todas as telas.
 * Título sóbrio (sem itálico/uppercase gigante), ação primária à direita.
 */
export function PageHeader({ title, subtitle, actions, icon }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
