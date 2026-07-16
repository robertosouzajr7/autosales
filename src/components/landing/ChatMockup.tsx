import { Check, Instagram, Calendar, Sparkles } from "lucide-react";

/**
 * Mockup fiel de uma conversa de venda no celular — mostra o agente de IA
 * atendendo, apresentando um produto com foto e agendando. Usa os tokens do
 * produto (azul + neutros). Puramente visual; sem dependências externas.
 */
export function ChatMockup({ dark = false }: { dark?: boolean }) {
  const frame = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const screen = dark ? "bg-slate-950" : "bg-[#EAF2FF]";
  const inBubble = dark ? "bg-slate-800 text-slate-100" : "bg-white text-slate-800";
  const outBubble = "bg-[#2563EB] text-white";

  return (
    <div className={`relative w-[300px] sm:w-[340px] rounded-[2.5rem] border-8 ${frame} shadow-[0_30px_60px_-15px_rgba(37,99,235,0.35)] overflow-hidden`}>
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-20" />

      {/* Header do chat */}
      <div className="bg-[#2563EB] text-white px-4 pt-8 pb-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-white/20 grid place-items-center font-bold text-sm">AV</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Sofia · Agente de IA</p>
          <p className="text-[10px] text-white/70 flex items-center gap-1">online agora</p>
        </div>
        <div className="h-6 w-6 rounded-full bg-white/15 grid place-items-center">
          <Instagram className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Corpo da conversa */}
      <div className={`${screen} px-3 py-4 space-y-2.5 h-[440px] overflow-hidden`}>
        {/* cliente */}
        <Bubble side="in" cls={inBubble}>Oi! Vi o clareamento de vocês, quanto fica? 😃</Bubble>

        {/* agente */}
        <Bubble side="out" cls={outBubble}>
          Oi! Que bom que chamou 💙 O clareamento a laser sai R$ 1.400 em 3 sessões. Posso te mostrar?
        </Bubble>

        {/* card de produto com "foto" */}
        <div className={`ml-auto w-[78%] rounded-2xl overflow-hidden shadow-sm ${dark ? "bg-slate-800" : "bg-white"}`}>
          <div className="h-24 bg-gradient-to-br from-[#2563EB] to-[#60A5FA] grid place-items-center relative">
            <Sparkles className="w-8 h-8 text-white/90" />
            <span className="absolute bottom-1.5 left-2 text-[9px] text-white/80 font-medium">clareamento-laser.jpg</span>
          </div>
          <div className="p-2.5">
            <p className={`text-xs font-semibold ${dark ? "text-slate-100" : "text-slate-800"}`}>Clareamento a Laser</p>
            <p className="text-xs font-bold text-[#2563EB]">R$ 1.400 · 3 sessões</p>
          </div>
        </div>

        {/* cliente */}
        <Bubble side="in" cls={inBubble}>Adorei! Consigo essa semana?</Bubble>

        {/* agente com slots */}
        <Bubble side="out" cls={outBubble}>
          Consigo sim! Tenho <b>quinta 10h</b> ou <b>sexta 15h30</b>. Qual fica melhor?
        </Bubble>

        {/* cliente */}
        <Bubble side="in" cls={inBubble}>Quinta 10h 🙌</Bubble>

        {/* confirmação de agendamento */}
        <div className="ml-auto w-[78%] rounded-2xl bg-emerald-500 text-white p-2.5 shadow-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 shrink-0" />
          <div>
            <p className="text-[11px] font-semibold leading-tight">Agendado ✓</p>
            <p className="text-[10px] text-white/85">Quinta, 10h · Google Calendar</p>
          </div>
        </div>
      </div>

      {/* Barra de digitação */}
      <div className={`${dark ? "bg-slate-900" : "bg-white"} px-3 py-2.5 flex items-center gap-2 border-t ${dark ? "border-slate-800" : "border-slate-100"}`}>
        <div className={`flex-1 h-8 rounded-full ${dark ? "bg-slate-800" : "bg-slate-100"} px-3 flex items-center text-[11px] ${dark ? "text-slate-500" : "text-slate-400"}`}>
          Mensagem…
        </div>
        <div className="h-8 w-8 rounded-full bg-[#2563EB] grid place-items-center text-white">
          <Check className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function Bubble({ side, cls, children }: { side: "in" | "out"; cls: string; children: React.ReactNode }) {
  return (
    <div className={`${side === "out" ? "ml-auto rounded-br-sm" : "mr-auto rounded-bl-sm"} w-fit max-w-[80%] ${cls} rounded-2xl px-3 py-2 text-[12px] leading-snug shadow-sm`}>
      {children}
    </div>
  );
}
