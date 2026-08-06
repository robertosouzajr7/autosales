import { Hammer } from "lucide-react";

/** Aba já no lugar, conteúdo na etapa seguinte. Melhor dizer do que dar erro. */
export function EmBreve({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex h-full flex-col bg-[#F2F2F7]">
      <header className="shrink-0 border-b border-[rgba(60,60,67,0.12)] bg-white/[0.86] px-5 pb-3.5 backdrop-blur-xl" style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}>
        <h2 className="text-[28px] font-bold tracking-[-0.04em] text-[#0F172A]">{titulo}</h2>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-[rgba(60,60,67,0.4)]">
          <Hammer className="h-6 w-6" />
        </span>
        <p className="text-[15px] leading-[1.55] text-[rgba(60,60,67,0.6)]">{texto}</p>
      </div>
    </div>
  );
}
