import { Globe, Instagram, Phone } from "lucide-react";

/** Iniciais do contato mais o selo do canal por onde ele fala. */

const CANAIS: Record<string, { cor: string; Icone: typeof Phone }> = {
  WHATSAPP: { cor: "#22A06B", Icone: Phone },
  INSTAGRAM: { cor: "#DB2777", Icone: Instagram },
  SITE: { cor: "#2563EB", Icone: Globe },
};

export function iniciais(nome: string) {
  const partes = String(nome || "").replace(/^@/, "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function Avatar({
  nome,
  canal,
  tamanho = 44,
  fundo = "#F2F2F7",
  cor = "rgba(60,60,67,0.6)",
}: {
  nome: string;
  canal?: string;
  tamanho?: number;
  fundo?: string;
  cor?: string;
}) {
  const c = CANAIS[String(canal || "").toUpperCase()] || CANAIS.WHATSAPP;
  const Icone = c.Icone;
  return (
    <div className="relative shrink-0">
      <span
        className="grid place-items-center rounded-full text-[14px] font-bold"
        style={{ width: tamanho, height: tamanho, background: fundo, color: cor }}
      >
        {iniciais(nome)}
      </span>
      <span
        className="absolute -bottom-0.5 -right-0.5 grid h-[17px] w-[17px] place-items-center rounded-full border-2 border-white"
        style={{ background: c.cor }}
      >
        <Icone className="h-[9px] w-[9px] text-white" strokeWidth={2.5} />
      </span>
    </div>
  );
}
