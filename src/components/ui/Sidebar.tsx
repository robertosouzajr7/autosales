import React from "react";
import {
  LucideIcon,
  BarChart3,
  DollarSign,
  Bot,
  Users,
  Send,
  FileText,
  Settings,
  Zap,
} from "lucide-react";
import { User } from "../../types";

interface SidebarProps {
  user: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "cobranca", label: "Cobrança", icon: DollarSign },
  { id: "sdr", label: "SDR Virtual", icon: Bot },
  { id: "contacts", label: "Contatos", icon: Users },
  { id: "campaigns", label: "Campanhas", icon: Send },
  { id: "reports", label: "Relatórios", icon: FileText },
  { id: "settings", label: "Configurações", icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold">AutoSales</h1>
        </div>

        {/* Trial Banner */}
        {user.trial_days && user.trial_days > 0 && (
          <div className="mt-4 p-3 bg-yellow-500 bg-opacity-20 rounded-lg border border-yellow-400">
            <p className="text-yellow-100 text-sm font-medium">
              Trial: {user.trial_days} dias restantes
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        <div className="px-6 mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            MENU PRINCIPAL
          </h3>
        </div>

        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center px-6 py-3 text-left transition-colors ${
                activeTab === item.id
                  ? "bg-gray-800 border-r-2 border-blue-500 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-6 border-t border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user.name}
            </p>
            <p className="text-xs text-gray-400 truncate">Plano {user.plan}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
