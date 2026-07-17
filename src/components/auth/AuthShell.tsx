import { Link } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/useTheme";
import { Logo } from "@/components/Logo";

const glass =
  "bg-white/70 dark:bg-white/[0.05] backdrop-blur-xl border border-slate-200/70 dark:border-white/10";

/**
 * Moldura das telas de autenticação/onboarding no estilo "Liquid Editorial":
 * fundo com aurora animada, superfícies de vidro, tema claro/escuro e toggle.
 * `wide` deixa o conteúdo mais largo (ex.: cadastro em 2 colunas).
 */
export function AuthShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const { isDark, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-white dark:bg-[#05070F] text-slate-900 dark:text-slate-100 font-sans relative overflow-hidden flex items-center justify-center px-5 py-20">
      <style>{`
        @keyframes drift{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(46px,36px) scale(1.1)}66%{transform:translate(-38px,22px) scale(.94)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .an-drift{animation:drift 24s ease-in-out infinite}
        .an-up{animation:fadeUp .5s cubic-bezier(.22,1,.36,1) both}
        @media (prefers-reduced-motion: reduce){.an-drift,.an-up{animation:none!important}}
      `}</style>

      {/* Aurora */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="an-drift absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full blur-[150px] bg-[#2563EB]/15 dark:bg-[#3b6cff]/25" />
        <div className="an-drift absolute -bottom-40 -right-24 w-[520px] h-[520px] rounded-full blur-[150px] bg-[#a855f7]/10 dark:bg-[#a855f7]/20" style={{ animationDelay: "-8s" }} />
        <div className="an-drift absolute top-1/3 left-1/2 w-[420px] h-[420px] rounded-full blur-[150px] bg-[#22d3ee]/10 dark:bg-[#22d3ee]/15" style={{ animationDelay: "-14s" }} />
      </div>

      {/* Barra superior: logo + toggle */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 lg:px-10 h-16 z-20">
        <Link to="/">
          <Logo wordmarkClassName="text-base" />
        </Link>
        <button
          onClick={toggle}
          className={`p-2.5 rounded-xl ${glass} hover:scale-105 transition-transform`}
          title={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
          aria-label="Alternar tema"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>

      <div className={`relative z-10 w-full ${wide ? "max-w-4xl" : "max-w-md"} an-up`}>{children}</div>
    </div>
  );
}

export { glass };
