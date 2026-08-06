import { useState } from "react";
import { Button } from "@/components/ui/button";

export type Visitante = { name: string; email: string; phone: string };

/**
 * Quem é a pessoa do outro lado, antes da primeira mensagem.
 *
 * Sem isso a conversa do site chegava ao painel como "Visitante do site", sem
 * um jeito de responder depois que ele fecha a aba — e é justamente do chat
 * público que vem o contato que ninguém conhece ainda.
 *
 * Fica no lugar do campo de mensagem, e some assim que os dados são
 * informados: perguntar de novo a cada visita seria pedágio.
 */
export function IdentificacaoVisitante({
  onPronto,
  tema = "claro",
}: {
  onPronto: (v: Visitante) => void;
  tema?: "claro" | "escuro";
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const escuro = tema === "escuro";
  const campo = `h-10 w-full rounded-xl px-3 text-[13px] outline-none transition ${
    escuro
      ? "bg-white/10 text-white placeholder:text-white/40 focus:ring-2 focus:ring-[#2563EB]/50"
      : "bg-[#F1F5F9] text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#2563EB]/30"
  }`;

  const enviar = () => {
    if (!nome.trim()) return setErro("Como podemos te chamar?");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErro("Confira o e-mail.");
    // 10 dígitos (fixo com DDD) ou 11 (celular com DDD).
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.length < 10 || digitos.length > 13) return setErro("Informe o telefone com DDD.");

    setErro(null);
    onPronto({ name: nome.trim(), email: email.trim(), phone: digitos });
  };

  return (
    <div className={`space-y-2 border-t p-3 ${escuro ? "border-white/10" : "border-[#E9EEF5]"}`}>
      <p className={`text-[12px] leading-snug ${escuro ? "text-white/60" : "text-slate-500"}`}>
        Antes de começar, com quem estamos falando?
      </p>
      <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
      <input
        className={campo}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        inputMode="email"
        placeholder="Seu melhor e-mail"
      />
      <input
        className={campo}
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
        inputMode="tel"
        placeholder="WhatsApp com DDD"
        onKeyDown={(e) => e.key === "Enter" && enviar()}
      />
      {erro && <p className="text-[11.5px] font-medium text-rose-500">{erro}</p>}
      <Button onClick={enviar} className="h-10 w-full rounded-xl bg-[#2563EB] text-[13px] font-semibold hover:bg-[#1D4ED8]">
        Começar a conversa
      </Button>
      <p className={`text-[10.5px] leading-snug ${escuro ? "text-white/40" : "text-slate-400"}`}>
        Usamos seus dados apenas para responder e falar com você sobre o atendimento.
      </p>
    </div>
  );
}
