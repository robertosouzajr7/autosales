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
} from "lucide-react";

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
  { label: "CRM / Leads", icon: Users, href: "/crm" },
  { label: "Contatos", icon: BookUser, href: "/contacts" },
  { label: "Agendamentos", icon: Calendar, href: "/appointments", feature: "calendar" },
  { label: "Prospecção", icon: Target, href: "/prospecting" },
  { label: "Time de SDRs", icon: Bot, href: "/sdrs" },
  { label: "Automações", icon: Zap, href: "/automations" },
  { label: "Disparos", icon: Send, href: "/disparos", feature: "bulkMessaging" },
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
          (item.href !== "/dashboard" && location.pathname.startsWith(item.href));

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
                isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-white",
                collapsed ? "h-5 w-5" : "h-4 w-4"
              )}
            />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && isActive && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
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
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-slate-700/60 px-4",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 shadow-lg shadow-emerald-500/30">
          <Bot className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-xl font-black tracking-tighter uppercase text-white">
            Vend<span className="text-emerald-500 italic">Ai</span>
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

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-2">
        <SidebarNav collapsed={collapsed} onNavClick={onNavClick} features={features} />
      </div>

      {/* PLAN STATUS IN SIDEBAR */}
      {!collapsed && (
        <div className="px-6 py-6 border-t border-slate-800">
          <div className="p-4 bg-slate-800/50 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">Plano Ativo</p>
              <Badge className="bg-emerald-500 text-slate-900 border-none text-[8px] font-black uppercase tracking-tighter leading-normal px-2">
                {planName || "Básico"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
               <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (localStorage.getItem("usedTokens") ? parseInt(localStorage.getItem("usedTokens") || "0") : 0) / (planData.maxTokens || 1) * 100)}%` }}
                  />
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase">
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
                    <AvatarFallback className="bg-emerald-600 text-[10px] font-black text-white uppercase">
                      {localStorage.getItem("userName")?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-xs font-black uppercase tracking-wider text-white">
                        {localStorage.getItem("companyName") || "Minha Empresa"}
                      </p>
                      <p className="truncate text-[9px] font-bold uppercase text-slate-500 tracking-widest">{planName}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={collapsed ? "right" : "top"} align="start" className="w-52 bg-slate-900 border-slate-800 text-white rounded-2xl p-2 shadow-2xl">
                 <DropdownMenuLabel className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-widest">Opções da Conta</DropdownMenuLabel>
                 <DropdownMenuSeparator className="bg-slate-800" />
                 <DropdownMenuItem onClick={() => navigate("/settings")} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 cursor-pointer text-xs font-bold uppercase">
                    <User className="w-4 h-4 text-emerald-400" /> Perfil & Empresa
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => navigate("/settings")} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 cursor-pointer text-xs font-bold uppercase">
                    <Settings className="w-4 h-4 text-emerald-400" /> Configurações
                 </DropdownMenuItem>
                 <DropdownMenuSeparator className="bg-slate-800" />
                 <DropdownMenuItem 
                   onClick={() => {
                     localStorage.clear();
                     navigate("/login");
                   }} 
                   className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-red-400 cursor-pointer text-xs font-bold uppercase"
                 >
                    <LogOut className="w-4 h-4" /> Sair da Conta
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

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch("/api/tenant/settings", { headers })
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
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "relative hidden flex-col border-r border-slate-200 lg:flex",
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
          {/* Trigger is handled via the header button */}
          <span className="hidden" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[260px] p-0">
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
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 md:px-6">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Page title / breadcrumb */}
          <div className="flex flex-1 items-center gap-2">
            <h1 className="text-base font-semibold text-slate-800 md:text-lg">
              {currentPage}
            </h1>
          </div>

          {/* Search */}
          <div className="relative hidden w-64 md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar..."
              className="h-9 bg-slate-50 pl-9 text-sm focus-visible:ring-emerald-500"
            />
          </div>

          {/* Notification bell */}
          <Button variant="ghost" size="icon" className="relative text-slate-500">
            <Bell className="h-5 w-5" />
            <Badge className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 p-0 text-[10px] font-bold text-white">
              3
            </Badge>
          </Button>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-2 hover:bg-slate-100"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-emerald-600 text-xs font-semibold text-white">
                    ME
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium text-slate-700 md:block">
                  Minha Empresa
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold">Minha Empresa</p>
                  <p className="text-xs text-muted-foreground">admin@empresa.com</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex cursor-pointer items-center gap-2">
                  <User className="h-4 w-4" />
                  Perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex cursor-pointer items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Empresa
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex cursor-pointer items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="flex cursor-pointer items-center gap-2 text-red-600 focus:text-red-600">
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
