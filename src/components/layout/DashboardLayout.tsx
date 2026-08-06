import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Calendar,
  Zap,
  BarChart3,
  Settings,
  Bot,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  Menu,
  LogOut,
  User,
  Send,
  Building2,
  SlidersHorizontal,
  BookUser,
  Target,
  Smartphone,
  ShieldCheck,
  BookOpen,
  GraduationCap,
  MessageCircle,
  Clock,
  Sparkles,
  Package,
  CreditCard,
  FileText,
  Megaphone,
  Workflow,
  Inbox
} from "lucide-react";
import { notificationStore } from "@/lib/notifications";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { LogoIcon } from "@/components/Logo";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { VerifyEmailGate } from "@/components/billing/VerifyEmailGate";
import { SubscriptionGate } from "@/components/billing/SubscriptionGate";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  /** Módulo exigido (AccessProfiles): sem ele o item some do menu. */
  permission?: string;
  adminOnly?: boolean;
  feature?: string;
  /** Contador em laranja em vez de azul: fila parada, não novidade. */
  badgeAtencao?: boolean;
}

interface NavGroup {
  /** Título da seção. `null` = itens soltos no topo, sem cabeçalho. */
  title: string | null;
  items: NavItem[];
}

/**
 * Qual item do menu está ativo.
 *
 * Comparar por prefixo sozinho acendia dois itens ao mesmo tempo: em
 * /automations/builder ("Fluxos") o item /automations ("Lembretes") também
 * casava. Vence sempre a rota mais específica.
 */
function hrefAtivo(pathname: string, items: NavItem[]): string | null {
  const candidatos = items
    .map((i) => i.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`));
  if (!candidatos.length) return null;
  return candidatos.sort((a, b) => b.length - a.length)[0];
}

/**
 * Menu por categoria.
 *
 * Antes eram 17 itens numa lista corrida, sem hierarquia: achar "Conexões"
 * ou "Templates" virava caça ao tesouro. Cada seção agrupa o que se usa
 * junto, e `permission` casa com os módulos de AccessProfiles — quem não
 * tem o módulo não vê o item (a API recusa do mesmo jeito).
 */
const navGroups: NavGroup[] = [
  {
    title: "Painel",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", permission: "dashboard" },
      { label: "Relatórios", icon: BarChart3, href: "/analytics", permission: "analytics" },
    ],
  },
  {
    title: "Atendimento",
    items: [
      { label: "Conversas", icon: MessageSquare, href: "/conversations", permission: "conversations", badgeAtencao: true },
      { label: "Agendamentos", icon: Calendar, href: "/appointments", permission: "appointments", feature: "calendar" },
      { label: "Funil de clientes", icon: Target, href: "/crm", permission: "crm" },
      { label: "Clientes", icon: BookUser, href: "/contacts", permission: "contacts" },
    ],
  },
  {
    title: "Automação",
    items: [
      { label: "Agente de IA", icon: Bot, href: "/sdrs", permission: "agents" },
      { label: "Fluxos", icon: Workflow, href: "/automations/builder", permission: "flows" },
      { label: "Lembretes", icon: Clock, href: "/automations", permission: "reminders" },
    ],
  },
  {
    title: "Conteúdo",
    items: [
      { label: "Meu negócio", icon: Building2, href: "/negocio", permission: "business" },
      { label: "Catálogo", icon: Package, href: "/catalogo", permission: "catalog" },
      { label: "Templates", icon: FileText, href: "/templates", permission: "templates" },
      { label: "Disparos", icon: Megaphone, href: "/campanhas", permission: "campaigns" },
    ],
  },
  {
    title: "Configuração",
    items: [
      { label: "Conexões", icon: Smartphone, href: "/connections", permission: "connections" },
      { label: "Colaboradores", icon: Users, href: "/equipe", permission: "team" },
      { label: "Filas", icon: Inbox, href: "/filas", permission: "queues" },
      { label: "Assinatura", icon: CreditCard, href: "/assinatura", permission: "billing" },
      { label: "Configurações", icon: Settings, href: "/settings", permission: "settings" },
    ],
  },
  {
    title: "Ajuda",
    items: [
      { label: "Base de conhecimento", icon: BookOpen, href: "/ajuda" },
      { label: "Academy", icon: GraduationCap, href: "/academy" },
    ],
  },
  {
    title: "Plataforma",
    items: [{ label: "Admin SaaS", icon: ShieldCheck, href: "/admin", adminOnly: true }],
  },
];

const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

interface SidebarNavProps {
  collapsed: boolean;
  onNavClick?: () => void;
  /** Seções que o usuário fechou (guardadas entre sessões). */
  fechados?: string[];
  onToggleGroup?: (titulo: string) => void;
  /** Contadores por rota, ex.: { "/conversations": 3 }. */
  badges?: Record<string, number>;
}

function SidebarNav({
  collapsed, onNavClick, features, permissions, fechados = [], onToggleGroup, badges,
}: SidebarNavProps & { features: any; permissions: string[] | null }) {
  const location = useLocation();
  const ativo = hrefAtivo(location.pathname, navItems);
  const isSuperadmin = (localStorage.getItem("userRole") || "OWNER") === "SUPERADMIN";

  const visivel = (item: NavItem) => {
    if (item.adminOnly && !isSuperadmin) return false;
    if (item.feature && features && features[item.feature] === false) return false;
    // Módulo bloqueado para este colaborador: o item nem aparece.
    // (A API recusa do mesmo jeito — aqui é só não oferecer o caminho.)
    if (permissions && item.permission && !permissions.includes(item.permission)) return false;
    return true;
  };

  // Uma seção sem itens visíveis some inteira, cabeçalho junto.
  const grupos = navGroups
    .map((g) => ({ ...g, items: g.items.filter(visivel) }))
    .filter((g) => g.items.length > 0);

  return (
    <nav className="flex flex-col px-2.5">
      {grupos.map((grupo, i) => {
        // A seção da página aberta fica sempre visível, mesmo que o usuário
        // a tenha fechado antes: esconder onde ele está seria desorientador.
        const temAtivo = grupo.items.some((it) => it.href === ativo);
        const aberto = collapsed || !grupo.title || temAtivo || !fechados.includes(grupo.title);

        return (
        <div key={grupo.title ?? "topo"} className="flex flex-col gap-0.5">
          {grupo.title &&
            (collapsed ? (
              <div className="mx-auto my-2 h-px w-[22px] bg-white/10" />
            ) : (
              <button
                onClick={() => onToggleGroup?.(grupo.title!)}
                className="linha-unica group flex w-full items-center gap-1 rounded-lg px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#475569] transition-colors hover:text-slate-300"
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 shrink-0 transition-transform duration-200",
                    aberto && "rotate-90",
                    temAtivo && "opacity-40"
                  )}
                />
                <span className="truncate">{grupo.title}</span>
              </button>
            ))}
          {i === 0 && !grupo.title && <div className="h-1" />}

          {aberto && grupo.items.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === ativo;

            // Contador à direita. Amber quando é fila esperando por alguém —
            // um número laranja lê como "isto está parado", que é o ponto.
            const badge = badges?.[item.href];

            const linkContent = (
              <Link
                to={item.href}
                onClick={onNavClick}
                title={collapsed ? item.label : undefined}
                className={cn(
                  // 38px de altura e padding lateral de 11px, do handoff.
                  "linha-unica relative flex h-[38px] items-center gap-3 rounded-lg px-[11px] text-[13px] font-medium transition-colors duration-150",
                  "hover:bg-white/[0.06] hover:text-white",
                  isActive ? "bg-white/[0.09] text-white" : "text-[#94A3B8]",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors duration-150",
                    // Ícone ativo usa o azul de TEXTO, não o de ação: aqui ele
                    // está sobre fundo escuro.
                    isActive ? "text-accent-text" : "text-[#64748B]"
                  )}
                />
                {!collapsed && <span className="linha-unica-elipse flex-1">{item.label}</span>}
                {!collapsed && badge ? (
                  <span
                    className={cn(
                      "num grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full px-1 text-[10px] font-bold text-white",
                      item.badgeAtencao ? "bg-[#F59E0B]" : "bg-primary"
                    )}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
                {collapsed && badge ? (
                  <span
                    className={cn(
                      "absolute right-2 top-2 h-1.5 w-1.5 rounded-full",
                      item.badgeAtencao ? "bg-[#F59E0B]" : "bg-primary"
                    )}
                  />
                ) : null}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </div>
        );
      })}
    </nav>
  );
}

interface SidebarContentProps {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavClick?: () => void;
  showCollapseButton?: boolean;
}

// Formata tokens em unidades legíveis: 12.600.000 → "12,6M", 25.000 → "25k".
function fmtTokens(n: number): string {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

function SidebarContent({
  collapsed,
  onToggleCollapse,
  onNavClick,
  showCollapseButton = true,
  features,
  planName,
  planData,
  navigate,
  permissions,
  fechados,
  onToggleGroup,
  badges,
}: SidebarContentProps & {
  features: any; planName: string; planData: any; navigate: any;
  permissions: string[] | null; fechados: string[]; onToggleGroup: (t: string) => void;
  badges?: Record<string, number>;
}) {
  return (
    <div className="flex h-full flex-col font-sans bg-rail bg-rail-glow">
      {/* Marca — 64px, conforme o handoff. */}
      <div
        className={cn(
          "flex shrink-0 flex-col justify-center border-b border-white/[0.07] px-4",
          collapsed ? "h-16 items-center px-0" : "h-16 items-start gap-0.5"
        )}
      >
        <div className="flex items-center gap-2.5 w-full">
          {/* Recolhido, o próprio logo vira o botão de expandir: antes não
              havia caminho de volta e o menu ficava preso em ícones. */}
          {collapsed && showCollapseButton ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  className="group relative grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-gradient-to-br from-[#2563EB] to-[#7C5CFF] shadow-[0_8px_18px_-6px_rgba(37,99,235,0.7)] transition-transform hover:scale-105"
                  aria-label="Expandir menu"
                >
                  <LogoIcon className="h-[18px] w-[18px] text-white transition-opacity group-hover:opacity-0" />
                  <ChevronRight className="absolute h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">Expandir menu</TooltipContent>
            </Tooltip>
          ) : (
            /* Quadrado 30×30 em gradiente com sombra azul — o handoff é
               específico aqui, e é o que dá identidade ao canto superior. */
            <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#2563EB] to-[#7C5CFF] shadow-[0_8px_18px_-6px_rgba(37,99,235,0.7)]">
              <LogoIcon className="h-[18px] w-[18px] text-white" />
            </div>
          )}
          {!collapsed && (
            <span className="linha-unica-elipse text-[13.5px] font-bold tracking-tight text-white">
              Agentes <span className="text-accent-text">Virtuais</span>
            </span>
          )}
          {/* O controle de recolher vive só no rodapé, como o handoff define.
              Dois botões para a mesma ação na mesma barra é ruído. */}
        </div>
        {!collapsed && (
          <p className="linha-unica-elipse w-full text-left text-[11px] leading-tight text-slate-500">
            {localStorage.getItem("companyName") || "Minha Empresa"}
          </p>
        )}
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto pb-2 scrollbar-thin">
        <SidebarNav
          collapsed={collapsed}
          onNavClick={onNavClick}
          features={features}
          permissions={permissions}
          fechados={fechados}
          onToggleGroup={onToggleGroup}
          badges={badges}
        />
      </div>

      {/* Consumo de IA da conta — não faz sentido para o admin da plataforma. */}
      {!collapsed && localStorage.getItem("userRole") !== "SUPERADMIN" && (() => {
        const used = Number(planData?.usedTokens) || 0;
        const franchise = Number(planData?.maxTokens) || 0;
        const extra = Number(planData?.extraTokens) || 0;
        const total = franchise + extra;                 // franquia + recarga
        const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
        const near = pct >= 90;
        return (
          <div className="px-3 pb-3 pt-2">
            <div className="space-y-2 rounded-xl bg-white/[0.05] p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-slate-400">Créditos de IA</p>
                <Badge className="max-w-[110px] truncate bg-primary/15 px-2 text-[11px] font-medium text-primary border-none">
                  {planName || "Básico"}
                </Badge>
              </div>
              <div className="h-[5px] overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", near ? "bg-amber-400" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-slate-300 tabular-nums">
                  {fmtTokens(used)} <span className="text-slate-500">/ {total > 0 ? fmtTokens(total) : "—"}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  {total > 0 ? `${pct}% usado` : "sem franquia"}
                </p>
              </div>
              {extra > 0 && (
                <p className="text-[11px] text-emerald-400">+ {fmtTokens(extra)} de recarga</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Recolher: o handoff pede o rótulo junto do chevron. Um ícone sozinho
          num canto escuro não é descoberto por quem nunca clicou nele. */}
      {showCollapseButton && !collapsed && (
        <div className="shrink-0 px-3 pb-2">
          <button
            onClick={onToggleCollapse}
            className="linha-unica flex h-[34px] w-full items-center justify-center gap-2 rounded-lg text-[12px] font-medium text-[#94A3B8] transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            Recolher menu
          </button>
        </div>
      )}

      {/* Quem está logado (não a empresa — essa já aparece no topo). */}
      <div className="shrink-0 border-t border-white/[0.07] p-2">
          <div className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/5", collapsed && "justify-center")}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 w-full outline-none">
                  <Avatar className="h-[30px] w-[30px] shrink-0">
                    <AvatarFallback className="bg-primary text-[11px] font-semibold text-white">
                      {(localStorage.getItem("userName")?.charAt(0) || "U").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="min-w-0 flex-1 text-left">
                      <p className="linha-unica-elipse text-[12.5px] font-medium text-white">
                        {localStorage.getItem("userName") || "Minha conta"}
                      </p>
                      <p className="linha-unica-elipse text-[11px] text-[#64748B]">
                        {localStorage.getItem("userProfileLabel") || "Colaborador"}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={collapsed ? "right" : "top"} align="start" className="w-52 bg-slate-900 border-slate-800 text-white rounded-xl p-1.5 shadow-sm">
                 <DropdownMenuItem onClick={() => navigate("/settings")} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white/10 cursor-pointer text-sm">
                    <Settings className="w-4 h-4 text-slate-400" /> Configurações
                 </DropdownMenuItem>
                 <DropdownMenuSeparator className="bg-slate-800" />
                 <DropdownMenuItem
                   onClick={() => {
                     localStorage.clear();
                     navigate("/login");
                   }}
                   className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-red-500/10 text-red-400 cursor-pointer text-sm"
                 >
                    <LogOut className="w-4 h-4" /> Sair da conta
                 </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </div>
    </div>
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  // Menu recolhido e seções fechadas são preferência de quem usa: precisam
  // sobreviver ao recarregar a página, senão o ajuste se perde a cada clique.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("menuRecolhido") === "1");
  const [gruposFechados, setGruposFechados] = useState<string[]>(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem("menuSecoesFechadas") || "[]");
      return Array.isArray(salvo) ? salvo : [];
    } catch {
      return [];
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const alternarRecolhido = () => {
    setCollapsed((antes) => {
      localStorage.setItem("menuRecolhido", antes ? "0" : "1");
      return !antes;
    });
  };

  const alternarGrupo = (titulo: string) => {
    setGruposFechados((antes) => {
      const novo = antes.includes(titulo) ? antes.filter((t) => t !== titulo) : [...antes, titulo];
      localStorage.setItem("menuSecoesFechadas", JSON.stringify(novo));
      return novo;
    });
  };
  const [planData, setPlanData] = useState<any>({ features: {}, name: "Básico", maxTokens: 0, usedTokens: 0, extraTokens: 0 });
  // Módulos liberados para este colaborador. null = ainda carregando (não
  // esconde nada antes de saber, para o menu não "piscar").
  const [permissions, setPermissions] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/users/me", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (!me) return;
        setPermissions(Array.isArray(me.permissions) ? me.permissions : null);
        if (me.role) localStorage.setItem("userRole", me.role);
        if (me.id) localStorage.setItem("userId", me.id);
        if (me.name) localStorage.setItem("userName", me.name);
        if (me.profileLabel) localStorage.setItem("userProfileLabel", me.profileLabel);
      })
      .catch(() => {});
  }, []);
  const location = useLocation();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  // null = ainda não sabemos; a pílula só aparece quando há resposta, para o
  // header não piscar "desconectado" durante o carregamento.
  const [conexaoAtiva, setConexaoAtiva] = useState<boolean | null>(null);
  // Conversas paradas esperando gente: é o número do badge ao abrir o painel.
  const [esperando, setEsperando] = useState(0);
  const [busca, setBusca] = useState("");
  const campoBusca = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K foca a busca. Anunciar o atalho no campo e não implementá-lo
  // seria pior do que não anunciar.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        campoBusca.current?.focus();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);
  const unreadCount = notifications.filter(n => !n.read).length;

  // O painel ainda é sempre claro. Não é escolha de design: 1.227 utilitários
  // slate-* fixos ignoram o tema, então ligar o escuro aqui hoje entregaria
  // texto slate-900 sobre card branco no fundo escuro.
  //
  // O handoff pede um botão de tema no header. Ele entra junto com a migração
  // das telas para os tokens — enquanto isso, forçar claro é o comportamento
  // honesto, e não um bug.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) return;

    const eventSource = new EventSource(`/api/events?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message' && data.message.role === 'USER') {
          notificationStore.add({
            id: data.message.id || Date.now(),
            content: data.message.content,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: false,
            messageType: data.message.messageType
          });

          toast({
            title: "💬 Nova mensagem",
            description: data.message.messageType === 'AUDIO' 
              ? "🎙️ Áudio recebido" 
              : (data.message.content || "").slice(0, 60),
          });
        }
      } catch (e) {
        console.error("Erro no SSE de notificações:", e);
      }
    };

    return () => eventSource.close();
  }, [toast]);

  useEffect(() => {
    return notificationStore.subscribe((newNotifs) => {
      setNotifications([...newNotifs]);
    });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch("/api/settings", { headers })
      .then(res => res.json())
      .then(data => {
        if (data.planFeatures) {
          setPlanData({
            features: data.planFeatures,
            name: data.plan?.name || "Básico",
            maxTokens: data.plan?.maxTokens || 0,
            usedTokens: Number(data.usedTokens) || 0,
            extraTokens: Number(data.extraTokens) || 0,
          });
          localStorage.setItem("usedTokens", data.usedTokens || "0");
          localStorage.setItem("companyName", data.name || "Minha Empresa");
        }
      })
      .catch(console.error);

    // Status do canal para a pílula do header. Uma chamada por montagem do
    // shell, não por navegação — o layout não remonta ao trocar de rota.
    fetch("/api/whatsapp/accounts", { headers })
      .then((r) => {
        // A rota exige o módulo "connections". Quem não o tem recebe 403 — e
        // transformar isso em lista vazia faria o header afirmar "WhatsApp
        // desconectado" para um colaborador de atendimento, com o canal no ar.
        // Sem permissão de ver, o estado é desconhecido, não é negativo.
        if (!r.ok) return null;
        return r.json();
      })
      .then((contas) => {
        if (contas === null) return setConexaoAtiva(null);
        const lista = Array.isArray(contas) ? contas : [];
        const zap = lista.filter((c: any) => String(c.channel || "").toUpperCase() !== "INSTAGRAM");
        setConexaoAtiva(zap.some((c: any) => c.status === "CONNECTED" || c.connected === true || !!c.phoneId));
      })
      .catch(() => setConexaoAtiva(null));

    // Badge do menu. Também uma chamada por montagem do shell; a rota só
    // devolve dois números. Sem permissão de atendimento, fica em zero.
    fetch("/api/conversations/pending-count", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setEsperando(d.pending || 0); })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userPlan");
    navigate("/login");
  };

  // Contador da sidebar.
  //
  // Antes vinha só das notificações da sessão (SSE), o que deixava o badge
  // sempre vazio ao abrir o painel: nada tinha chegado ainda, e as conversas
  // já paradas na fila não apareciam. Agora a carga inicial vem do servidor,
  // por uma rota de contagem que não traz linha nenhuma, e o SSE apenas soma
  // por cima enquanto a aba fica aberta.
  const pendentes = Math.max(esperando, unreadCount);
  const badges = pendentes > 0 ? { "/conversations": pendentes } : undefined;

  const currentPage =
    navItems.find((item) => item.href === hrefAtivo(location.pathname, navItems))?.label ?? "Dashboard";

  return (
    // O Radix exige o provider como ancestral de qualquer Tooltip. Sem ele,
    // recolher o menu quebrava a página inteira — era por isso que não dava
    // para recolher a barra lateral.
    <TooltipProvider delayDuration={0}>
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0F172A]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "relative hidden flex-col lg:flex",
          // Larguras e curva vêm do handoff. A sidebar não tem borda: ela é
          // escura nos dois temas, então o próprio contraste já a separa.
          "transition-[width] duration-[220ms] ease-rail",
          collapsed ? "w-[68px]" : "w-[236px]"
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={alternarRecolhido}
          showCollapseButton={true}
          features={planData.features}
          planName={planData.name}
          planData={planData}
          navigate={navigate}
          permissions={permissions}
          fechados={gruposFechados}
          onToggleGroup={alternarGrupo}
          badges={badges}
        />
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <span className="hidden" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[244px] p-0 border-r border-slate-200 dark:border-slate-900/40">
          <SidebarContent
            collapsed={false}
            showCollapseButton={false}
            onNavClick={() => setMobileOpen(false)}
            features={planData.features}
            planName={planData.name}
            planData={planData}
            navigate={navigate}
            permissions={permissions}
            fechados={gruposFechados}
            onToggleGroup={alternarGrupo}
            badges={badges}
          />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        {/* 60px de altura e 24px de padding lateral, do handoff. */}
        <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/20"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Título da tela — 15,5px/600, do handoff. */}
          <h1 className="linha-unica-elipse min-w-0 text-[15.5px] font-semibold tracking-[-0.025em] text-foreground">
            {currentPage}
          </h1>

          {/* Busca. O atalho é anunciado no próprio campo: um ⌘K escondido não
              é atalho, é curiosidade.

              O rótulo promete só o que a busca entrega hoje — clientes. O
              handoff pede "cliente, conversa ou agendamento", mas conversa e
              agendamento ainda não têm busca por URL; prometer as três e
              entregar uma é pior do que prometer uma. O texto cresce quando as
              telas ganharem o parâmetro. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = busca.trim();
              if (q) navigate(`/contacts?q=${encodeURIComponent(q)}`);
            }}
            className="relative ml-4 hidden min-w-0 max-w-[340px] flex-1 md:block"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              ref={campoBusca}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente"
              aria-label="Buscar cliente"
              className="linha-unica h-9 rounded-[11px] border-border bg-surface-2 pl-9 pr-14 text-[13px] placeholder:text-faint"
            />
            <kbd className="num pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-faint">
              ⌘K
            </kbd>
          </form>

          <div className="ml-auto flex items-center gap-2">
            {/* Status do canal: o ponto pulsa porque o dado é de agora. */}
            {conexaoAtiva !== null && (
              <div
                className={cn(
                  "linha-unica hidden items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold lg:flex",
                  conexaoAtiva
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-500"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    conexaoAtiva ? "animate-pulseDot bg-emerald-500" : "bg-amber-500"
                  )}
                />
                {conexaoAtiva ? "WhatsApp conectado" : "WhatsApp desconectado"}
              </div>
            )}
          </div>

          {/* Notification bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/20 rounded-xl transition-all">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#2563EB] p-0 text-xs font-bold text-white animate-bounce border-2 border-white dark:border-[#1E293B]">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden rounded-2xl border border-border shadow-lg bg-card">
              <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
                {unreadCount > 0 && <span className="text-xs text-muted-foreground">{unreadCount} nova(s)</span>}
              </div>
              <ScrollArea className="max-h-[340px]">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-11 h-11 bg-muted rounded-xl flex items-center justify-center mx-auto">
                      <Bell className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Nenhuma notificação por aqui.</p>
                  </div>
                ) : (
                  <div className="p-1.5">
                    {notifications.map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        className="p-3 rounded-xl cursor-pointer flex items-start gap-3"
                        onClick={() => {
                          n.read = true;
                          navigate("/conversations");
                        }}
                      >
                        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                          <MessageCircle className="w-4.5 h-4.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <p className="text-sm font-medium text-foreground">Nova mensagem</p>
                            <span className="text-xs text-muted-foreground">{n.time}</span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
                            {n.content}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {notifications.length > 0 && (
                <div className="p-2 border-t border-border">
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground"
                    onClick={() => setNotifications([])}>
                    Limpar tudo
                  </Button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-2 hover:bg-slate-100 dark:hover:bg-slate-900/20"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary text-[11px] font-semibold text-white">
                    {(localStorage.getItem("userName")?.charAt(0) || "U").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[160px] truncate text-sm font-medium text-slate-700 dark:text-white md:block">
                  {localStorage.getItem("userName") || "Minha conta"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl dark:bg-[#1E293B] dark:border-slate-900/40 dark:text-white">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold truncate">{localStorage.getItem("userName") || "Minha conta"}</p>
                  <p className="text-xs text-muted-foreground dark:text-slate-400/40">
                    {localStorage.getItem("companyName") || "Minha Empresa"} · Plano {planData.name || "Básico"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="dark:bg-slate-900/45" />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex cursor-pointer items-center gap-2 dark:hover:bg-[#1E293B]">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="dark:bg-slate-900/45" />
              <DropdownMenuItem onClick={handleLogout} className="flex cursor-pointer items-center gap-2 text-red-600 focus:text-red-600 dark:hover:bg-red-500/10">
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* E-mail não confirmado: recursos travados na API */}
        <VerifyEmailGate />

        {/* Aviso de trial / pagamento pendente */}
        <TrialBanner />

        {/* Trava total quando o acesso expira */}
        <SubscriptionGate />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
    </TooltipProvider>
  );
}

export default DashboardLayout;
