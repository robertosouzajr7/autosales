import {
  LayoutDashboard, MessageSquare, Users, Calendar, Bot, Package,
  Smartphone, Instagram, Globe, Search,
} from "lucide-react";

/**
 * Mockup fiel do painel numa moldura de navegador — mostra a central de
 * conversas multicanal + funil (Kanban). Reproduz o layout real do produto
 * (sidebar, paleta azul/slate). Puramente visual.
 */
export function DashboardMockup({ dark = false }: { dark?: boolean }) {
  const win = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const bar = dark ? "bg-slate-950" : "bg-slate-100";
  const side = dark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200";
  const canvas = dark ? "bg-slate-900" : "bg-slate-50";
  const card = dark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200";
  const text = dark ? "text-slate-200" : "text-slate-700";
  const muted = dark ? "text-slate-500" : "text-slate-400";

  const nav = [
    { icon: LayoutDashboard, label: "Dashboard" },
    { icon: MessageSquare, label: "Conversas", active: true },
    { icon: Users, label: "Funil de Clientes" },
    { icon: Calendar, label: "Agendamentos" },
    { icon: Package, label: "Catálogo" },
    { icon: Bot, label: "Agente de IA" },
  ];

  const chats = [
    { name: "Marina Costa", msg: "Quinta 10h 🙌", channel: Smartphone, unread: true },
    { name: "@lucas.fit", msg: "Manda o valor do plano?", channel: Instagram, unread: true },
    { name: "Visitante do site", msg: "Vocês atendem sábado?", channel: Globe },
    { name: "Roberto Alves", msg: "Perfeito, obrigado!", channel: Smartphone },
  ];

  const columns = [
    { title: "Novos", color: "bg-slate-400", cards: ["Marina Costa", "João P."] },
    { title: "Qualificando", color: "bg-blue-500", cards: ["@lucas.fit"] },
    { title: "Agendado", color: "bg-emerald-500", cards: ["Roberto Alves", "Ana M."] },
  ];

  return (
    <div className={`w-full rounded-2xl border ${win} shadow-[0_30px_60px_-20px_rgba(15,23,42,0.35)] overflow-hidden`}>
      {/* Barra do navegador */}
      <div className={`${bar} px-3 py-2 flex items-center gap-2`}>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className={`ml-2 flex-1 h-5 rounded-md ${dark ? "bg-slate-800" : "bg-white"} flex items-center px-2 text-[9px] ${muted}`}>
          app.agentesvirtuais.com/conversations
        </div>
      </div>

      <div className="flex h-[360px]">
        {/* Sidebar */}
        <div className={`hidden sm:flex w-40 shrink-0 flex-col border-r ${side} py-3`}>
          <div className="px-3 mb-3">
            <span className={`text-sm font-bold ${text}`}>Agentes <span className="text-[#2563EB]">Virtuais</span></span>
          </div>
          <div className="space-y-0.5 px-2">
            {nav.map((n) => {
              const Icon = n.icon;
              return (
                <div key={n.label} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium ${n.active ? "bg-[#2563EB] text-white" : `${muted}`}`}>
                  <Icon className="w-3.5 h-3.5" /> {n.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna de conversas */}
        <div className={`w-44 shrink-0 border-r ${side} ${canvas}`}>
          <div className={`px-3 py-2 border-b ${dark ? "border-slate-800" : "border-slate-200"} flex items-center gap-2`}>
            <Search className={`w-3 h-3 ${muted}`} />
            <span className={`text-[10px] ${muted}`}>Buscar conversa…</span>
          </div>
          {chats.map((c) => {
            const Ch = c.channel;
            return (
              <div key={c.name} className={`px-3 py-2 border-b ${dark ? "border-slate-800/60" : "border-slate-100"} flex items-center gap-2`}>
                <div className="relative">
                  <div className={`h-7 w-7 rounded-full ${dark ? "bg-slate-700" : "bg-slate-200"} grid place-items-center text-[9px] font-bold ${text}`}>
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#2563EB] grid place-items-center">
                    <Ch className="w-2 h-2 text-white" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] font-semibold ${text} truncate`}>{c.name}</p>
                  <p className={`text-[9px] ${muted} truncate`}>{c.msg}</p>
                </div>
                {c.unread && <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />}
              </div>
            );
          })}
        </div>

        {/* Kanban */}
        <div className={`flex-1 ${canvas} p-3`}>
          <p className={`text-[11px] font-semibold ${text} mb-2`}>Funil de Clientes</p>
          <div className="grid grid-cols-3 gap-2">
            {columns.map((col) => (
              <div key={col.title} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${col.color}`} />
                  <span className={`text-[9px] font-semibold ${muted} uppercase`}>{col.title}</span>
                </div>
                {col.cards.map((name) => (
                  <div key={name} className={`rounded-lg border ${card} p-1.5`}>
                    <p className={`text-[9px] font-medium ${text} truncate`}>{name}</p>
                    <div className={`mt-1 h-1 w-10 rounded-full ${dark ? "bg-slate-700" : "bg-slate-200"}`} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
