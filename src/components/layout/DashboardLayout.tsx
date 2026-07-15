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
  Package
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

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  adminOnly?: boolean;
  feature?: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Conversas", icon: MessageSquare, href: "/conversations" },
  { label: "Funil de Clientes", icon: Users, href: "/crm" },
  { label: "Clientes", icon: BookUser, href: "/contacts" },
  { label: "Agendamentos", icon: Calendar, href: "/appointments", feature: "calendar" },
  { label: "Meu Negócio", icon: Building2, href: "/negocio" },
  { label: "Catálogo", icon: Package, href: "/catalogo" },
  { label: "Agente de IA", icon: Bot, href: "/sdrs" },
  { label: "Lembretes", icon: Zap, href: "/automations" },
  { label: "Conexões", icon: Smartphone, href: "/connections" },
  { label: "Configurações", icon: Settings, href: "/settings" },
  { label: "Admin SaaS", icon: ShieldCheck, href: "/admin", adminOnly: true },
];

interface SidebarNavProps {
  collapsed: boolean;
  onNavClick?: () => void;
}

function SidebarNav({ collapsed, onNavClick, features }: SidebarNavProps & { features: any }) {
  const location = useLocation();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map((item) => {
        const userRole = localStorage.getItem("userRole") || "OWNER";
        const isAdmin = userRole === "SUPERADMIN";
        
        if (item.adminOnly && !isAdmin) return null;
        if (item.feature && features && features[item.feature] === false) return null;

        const Icon = item.icon;
        const isActive =
          location.pathname === item.href ||
          (item.href !== "/dashboard" &&
           location.pathname.startsWith(item.href));

        const linkContent = (
          <Link
            to={item.href}
            onClick={onNavClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              "hover:bg-white/10 hover:text-white",
              isActive
                ? "bg-white/15 text-white shadow-sm"
                : "text-slate-400",
              collapsed && "justify-center px-2"
            )}
          >
            <Icon
              className={cn(
                "shrink-0 transition-colors duration-200",
                isActive ? "text-[#2563EB]" : "text-slate-400 group-hover:text-white",
                collapsed ? "h-5 w-5" : "h-4 w-4"
              )}
            />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && isActive && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
            )}
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
    </nav>
  );
}

interface SidebarContentProps {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavClick?: () => void;
  showCollapseButton?: boolean;
}

function SidebarContent({
  collapsed,
  onToggleCollapse,
  onNavClick,
  showCollapseButton = true,
  features,
  planName,
  planData,
  navigate
}: SidebarContentProps & { features: any, planName: string, planData: any, navigate: any }) {
  return (
    <div className="flex h-full flex-col bg-slate-900 font-sans">
      {/* Logo e Info da Conta */}
      <div
        className={cn(
          "flex flex-col justify-center border-b border-slate-700/60 px-4",
          collapsed ? "h-16 items-center" : "h-24 items-start gap-1.5"
        )}
      >
        <div className="flex items-center gap-2.5 w-full">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-white">
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
          <div className="w-full text-left truncate">
            <p className="text-sm font-medium text-slate-200 leading-tight truncate">
              {localStorage.getItem("companyName") || "Minha Empresa"}
            </p>
            <p className="text-xs text-slate-500 leading-tight mt-0.5">
              Plano {planName || "Básico"}
            </p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        <SidebarNav collapsed={collapsed} onNavClick={onNavClick} features={features} />
      </div>

      {/* PLAN STATUS IN SIDEBAR */}
      {!collapsed && (
        <div className="px-4 py-4 border-t border-slate-800">
          <div className="p-3.5 bg-slate-800/50 rounded-xl space-y-2.5">
            <div className="flex justify-between items-center">
              <p className="text-xs font-medium text-slate-400">Créditos de IA</p>
              <Badge className="bg-primary/15 text-primary border-none text-xs font-medium px-2">
                {planName || "Básico"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
               <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-700"
                    style={{ width: `${Math.min(100, (localStorage.getItem("usedTokens") ? parseInt(localStorage.getItem("usedTokens") || "0") : 0) / (planData.maxTokens || 1) * 100)}%` }}
                  />
               </div>
               <p className="text-xs font-medium text-slate-400 tabular-nums">
                 {Math.round((localStorage.getItem("usedTokens") ? parseInt(localStorage.getItem("usedTokens") || "0") : 0) / (planData.maxTokens || 1) * 100)}%
               </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom user section */}
      <div className="border-t border-slate-700/60 p-3">
          <div className={cn("flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-white/5", collapsed && "justify-center")}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full outline-none">
                  <Avatar className="h-8 w-8 shrink-0 border border-slate-700">
                    <AvatarFallback className="bg-primary text-xs font-semibold text-white">
                      {(localStorage.getItem("companyName")?.charAt(0) || "U").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium text-white">
                        {localStorage.getItem("companyName") || "Minha Empresa"}
                      </p>
                      <p className="truncate text-xs text-slate-500">Plano {planName}</p>
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
  const [planData, setPlanData] = useState<any>({ features: {}, name: "Básico", maxTokens: 1 });
  const location = useLocation();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const unreadCount = notifications.filter(n => !n.read).length;

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
          setPlanData({ features: data.planFeatures, name: data.plan?.name || "Básico", maxTokens: data.plan?.maxTokens || 1 });
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
    navItems.find(
      (item) =>
        location.pathname === item.href ||
        (item.href !== "/dashboard" && location.pathname.startsWith(item.href))
    )?.label ?? "Dashboard";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0F172A]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "relative hidden flex-col border-r border-slate-200 dark:border-slate-900/40 lg:flex",
          "transition-[width] duration-300 ease-in-out",
          collapsed ? "w-[68px]" : "w-[260px]"
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
        />
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <span className="hidden" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[260px] p-0 border-r border-slate-200 dark:border-slate-900/40">
          <SidebarContent
            collapsed={false}
            showCollapseButton={false}
            onNavClick={() => setMobileOpen(false)}
            features={planData.features}
            planName={planData.name}
            planData={planData}
            navigate={navigate}
          />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-11 shrink-0 items-center gap-4 border-b border-slate-200 dark:border-slate-900/40 bg-white dark:bg-[#1E293B] px-4 md:px-6">
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
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary text-xs font-semibold text-white">
                    {(localStorage.getItem("companyName")?.charAt(0) || "U").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[160px] truncate text-sm font-medium text-slate-700 dark:text-white md:block">
                  {localStorage.getItem("companyName") || "Minha Empresa"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl dark:bg-[#1E293B] dark:border-slate-900/40 dark:text-white">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold truncate">{localStorage.getItem("companyName") || "Minha Empresa"}</p>
                  <p className="text-xs text-muted-foreground dark:text-slate-400/40">Plano {planData.name || "Básico"}</p>
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

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
