import { useState, useEffect } from "react";
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
  MessageCircle,
  Clock,
  Sparkles,
  Package,
  CreditCard,
  FileText,
  Megaphone,
  Workflow
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
import { SubscriptionGate } from "@/components/billing/SubscriptionGate";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  /** Módulo exigido (AccessProfiles): sem ele o item some do menu. */
  permission?: string;
  adminOnly?: boolean;
  feature?: string;
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
    title: null,
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", permission: "dashboard" },
      { label: "Relatórios", icon: BarChart3, href: "/analytics", permission: "analytics" },
    ],
  },
  {
    title: "Atendimento",
    items: [
      { label: "Conversas", icon: MessageSquare, href: "/conversations", permission: "conversations" },
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
      { label: "Assinatura", icon: CreditCard, href: "/assinatura", permission: "billing" },
      { label: "Configurações", icon: Settings, href: "/settings", permission: "settings" },
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
}

function SidebarNav({ collapsed, onNavClick, features, permissions }: SidebarNavProps & { features: any; permissions: string[] | null }) {
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
      {grupos.map((grupo, i) => (
        <div key={grupo.title ?? "topo"} className="flex flex-col gap-0.5">
          {grupo.title &&
            (collapsed ? (
              <div className="mx-auto my-2 h-px w-6 bg-slate-700/60" />
            ) : (
              <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {grupo.title}
              </p>
            ))}
          {i === 0 && !grupo.title && <div className="h-1" />}

          {grupo.items.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === ativo;

            const linkContent = (
              <Link
                to={item.href}
                onClick={onNavClick}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
                  "hover:bg-white/[0.06] hover:text-white",
                  isActive ? "bg-white/[0.08] text-white" : "text-slate-400",
                  collapsed && "justify-center px-2"
                )}
              >
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors duration-150",
                    isActive ? "text-primary" : "text-slate-500"
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
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
      ))}
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
  permissions
}: SidebarContentProps & { features: any, planName: string, planData: any, navigate: any, permissions: string[] | null }) {
  return (
    <div className="flex h-full flex-col font-sans bg-slate-900 bg-[radial-gradient(130%_55%_at_0%_0%,rgba(37,99,235,0.24),transparent_58%)]">
      {/* Logo e Info da Conta */}
      <div
        className={cn(
          "flex flex-col justify-center border-b border-slate-700/60 px-4",
          collapsed ? "h-14 items-center" : "h-16 items-start gap-0.5"
        )}
      >
        <div className="flex items-center gap-2.5 w-full">
          <LogoIcon className="w-7 h-7 shrink-0" />
          {!collapsed && (
            <span className="truncate whitespace-nowrap text-[15px] font-bold tracking-tight text-white">
              Agentes <span className="text-primary">Virtuais</span>
            </span>
          )}
          {!collapsed && showCollapseButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="ml-auto h-7 w-7 text-slate-400 hover:bg-slate-700 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        {!collapsed && (
          <p className="w-full truncate text-left text-xs text-slate-500 leading-tight">
            {localStorage.getItem("companyName") || "Minha Empresa"}
          </p>
        )}
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto pb-2 scrollbar-thin">
        <SidebarNav collapsed={collapsed} onNavClick={onNavClick} features={features} permissions={permissions} />
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
            <div className="rounded-xl bg-slate-800/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-slate-400">Créditos de IA</p>
                <Badge className="max-w-[110px] truncate bg-primary/15 px-2 text-[11px] font-medium text-primary border-none">
                  {planName || "Básico"}
                </Badge>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-slate-700">
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

      {/* Quem está logado (não a empresa — essa já aparece no topo). */}
      <div className="border-t border-slate-700/60 p-2">
          <div className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/5", collapsed && "justify-center")}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 w-full outline-none">
                  <Avatar className="h-7 w-7 shrink-0 border border-slate-700">
                    <AvatarFallback className="bg-primary text-[11px] font-semibold text-white">
                      {(localStorage.getItem("userName")?.charAt(0) || "U").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[13px] font-medium text-white">
                        {localStorage.getItem("userName") || "Minha conta"}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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
  const unreadCount = notifications.filter(n => !n.read).length;

  // O painel é sempre claro (algumas telas têm cores fixas que quebrariam no
  // escuro). O tema escuro fica restrito à landing/login/onboarding.
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
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userPlan");
    navigate("/login");
  };

  const currentPage =
    navItems.find((item) => item.href === hrefAtivo(location.pathname, navItems))?.label ?? "Dashboard";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0F172A]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "relative hidden flex-col border-r border-slate-200 dark:border-slate-900/40 lg:flex",
          "transition-[width] duration-300 ease-in-out",
          collapsed ? "w-[64px]" : "w-[244px]"
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
          showCollapseButton={true}
          features={planData.features}
          planName={planData.name}
          planData={planData}
          navigate={navigate}
          permissions={permissions}
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
          />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white/80 backdrop-blur-xl px-4 md:px-6">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/20"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Page title */}
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white truncate">
              {currentPage}
            </h1>
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
  );
}

export default DashboardLayout;
