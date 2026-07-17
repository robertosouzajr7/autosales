import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Marca "Ápice" — monograma A/V que também lê como uma seta para cima.
 * Path único com contra-forma vazada (fill-rule evenodd): funciona em qualquer
 * fundo, em cor sólida (herda currentColor) ou em gradiente.
 */
// Triângulo/pico externo com um entalhe em V profundo (vazado por evenodd) —
// lê como um A/seta com abertura marcada, não como um "A" com travessão.
const APEX_PATH = "M32 6 L58 56 L6 56 Z M32 30 L45.5 56 L18.5 56 Z";

export function LogoMark({ className, gradient = false }: { className?: string; gradient?: boolean }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} fill={gradient ? `url(#${id})` : "currentColor"} aria-hidden="true">
      {gradient && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2563EB" />
            <stop offset="1" stopColor="#7C5CFF" />
          </linearGradient>
        </defs>
      )}
      <path fillRule="evenodd" clipRule="evenodd" d={APEX_PATH} />
    </svg>
  );
}

/** Ícone de app / favicon: quadrado com gradiente + marca branca vazada. */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid place-items-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C5CFF] shadow-lg shadow-[#2563EB]/30",
        className
      )}
    >
      <LogoMark className="w-[58%] h-[58%] text-white" />
    </span>
  );
}

/**
 * Lockup horizontal: marca + wordmark "Agentes Virtuais".
 * `variant="icon"` usa o quadrado com gradiente; `"mark"` (padrão) usa a marca
 * em azul, sem caixa.
 */
export function Logo({
  className,
  wordmarkClassName,
  markClassName,
  variant = "mark",
  showWordmark = true,
}: {
  className?: string;
  wordmarkClassName?: string;
  markClassName?: string;
  variant?: "mark" | "icon";
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {variant === "icon" ? (
        <LogoIcon className={cn("w-8 h-8", markClassName)} />
      ) : (
        <LogoMark className={cn("w-7 h-7 text-[#2563EB]", markClassName)} />
      )}
      {showWordmark && (
        <span className={cn("text-lg font-bold tracking-tight", wordmarkClassName)}>
          Agentes <span className="text-[#2563EB]">Virtuais</span>
        </span>
      )}
    </span>
  );
}
