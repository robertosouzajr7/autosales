"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  BarChart3,
  Users,
  MessageSquare,
  Calendar,
  Settings,
  Upload,
  TrendingUp,
  DollarSign,
  Phone,
  Mail,
  Clock,
  Target,
  FileText,
  Zap,
  Bot,
  PieChart,
  Activity,
  AlertCircle,
} from "lucide-react";
import { ContactsList } from "../contacts/ContactsList";
import { DashboardStats } from "./DashboardStats";
import CobrancaModule from "../modules/CobrancaCompleto";

// Interfaces
interface MetricCard {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: any;
}

interface ActivityItem {
  id: string;
  type: "message" | "contact" | "campaign" | "lead";
  title: string;
  description: string;
  time: string;
  status: "success" | "pending" | "error";
}

export function AutoSalesDashboard() {
  const [activeModule, setActiveModule] = useState("dashboard");

  // Dados simulados
  const metrics: MetricCard[] = [
    {
      title: "Contatos Ativos",
      value: "0",
      change: "+0%",
      changeType: "neutral",
      icon: Users,
    },
    {
      title: "Mensagens Enviadas",
      value: "0",
      change: "0 hoje",
      changeType: "neutral",
      icon: MessageSquare,
    },
    {
      title: "Taxa de Resposta",
      value: "0%",
      change: "0% média",
      changeType: "neutral",
      icon: TrendingUp,
    },
    {
      title: "Receita Recuperada",
      value: "R$ 0",
      change: "+R$ 0",
      changeType: "neutral",
      icon: DollarSign,
    },
  ];

  const recentActivity: ActivityItem[] = [
    {
      id: "1",
      type: "contact",
      title: "Sistema pronto para uso",
      description: "Faça upload da primeira planilha para começar",
      time: "Agora",
      status: "pending",
    },
  ];

  // Função para navegar
  const handleNavigation = (path: string) => {
    window.location.href = path;
  };

  const renderDashboardOverview = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Visão geral das suas automações</p>
        </div>
        <Button
          onClick={() => handleNavigation("/upload")}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Upload className="h-4 w-4 mr-2" />
          Importar Contatos
        </Button>
      </div>
      {/* Usar componente com dados reais */}
      <DashboardStats />

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {metric.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {metric.value}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-full ${
                    metric.changeType === "positive"
                      ? "bg-green-100"
                      : metric.changeType === "negative"
                      ? "bg-red-100"
                      : "bg-gray-100"
                  }`}
                >
                  <Icon
                    className={`h-6 w-6 ${
                      metric.changeType === "positive"
                        ? "text-green-600"
                        : metric.changeType === "negative"
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  />
                </div>
              </div>
              <p
                className={`text-sm mt-2 ${
                  metric.changeType === "positive"
                    ? "text-green-600"
                    : metric.changeType === "negative"
                    ? "text-red-600"
                    : "text-gray-500"
                }`}
              >
                {metric.change}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <div
            onClick={() => handleNavigation("/upload")}
            className="flex items-center space-x-4"
          >
            <div className="p-3 bg-blue-100 rounded-lg">
              <Upload className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Importar Contatos</h3>
              <p className="text-sm text-gray-600">
                Upload de planilha CSV/Excel
              </p>
            </div>
          </div>
        </Card>

        <Card
          className="p-6 hover:shadow-lg transition-shadow cursor-pointer opacity-50"
          onClick={() => alert("Em breve: Sistema de cobrança!")}
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                Cobrança Automática
              </h3>
              <p className="text-sm text-gray-600">
                Automatizar cobranças via WhatsApp
              </p>
              <Badge variant="warning" className="mt-1">
                Em breve
              </Badge>
            </div>
          </div>
        </Card>

        <Card
          className="p-6 hover:shadow-lg transition-shadow cursor-pointer opacity-50"
          onClick={() => alert("Em breve: SDR Virtual!")}
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Bot className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">SDR Virtual</h3>
              <p className="text-sm text-gray-600">
                Qualificação automática de leads
              </p>
              <Badge variant="warning" className="mt-1">
                Em breve
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Primeira vez usando */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start space-x-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Zap className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">
              Começando com o AutoSales
            </h3>
            <p className="text-blue-800 mt-1">
              Para começar a automatizar suas vendas e cobranças:
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <span className="text-blue-800">
                  Importe seus contatos via planilha
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <span className="text-gray-600">
                  Configure templates de mensagem (em breve)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <span className="text-gray-600">
                  Inicie automação de cobrança (em breve)
                </span>
              </div>
            </div>
            <Button
              className="mt-4"
              onClick={() => handleNavigation("/upload")}
            >
              <Upload className="h-4 w-4 mr-2" />
              Começar Agora
            </Button>
          </div>
        </div>
      </Card>

      {/* Atividade recente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            Atividade Recente
          </h3>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div
                  className={`p-2 rounded-full ${
                    activity.status === "success"
                      ? "bg-green-100"
                      : activity.status === "error"
                      ? "bg-red-100"
                      : "bg-yellow-100"
                  }`}
                >
                  {activity.type === "contact" && (
                    <Users className="h-4 w-4 text-blue-600" />
                  )}
                  {activity.type === "message" && (
                    <MessageSquare className="h-4 w-4 text-green-600" />
                  )}
                  {activity.type === "campaign" && (
                    <Target className="h-4 w-4 text-purple-600" />
                  )}
                  {activity.type === "lead" && (
                    <TrendingUp className="h-4 w-4 text-orange-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{activity.title}</p>
                  <p className="text-sm text-gray-600">
                    {activity.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Links Úteis</h3>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleNavigation("/upload")}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar Planilha de Contatos
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start opacity-50"
              onClick={() => alert("Em desenvolvimento!")}
              disabled
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Configurar Templates (Em breve)
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start opacity-50"
              onClick={() => alert("Em desenvolvimento!")}
              disabled
            >
              <Phone className="h-4 w-4 mr-2" />
              Conectar WhatsApp (Em breve)
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start opacity-50"
              onClick={() => alert("Em desenvolvimento!")}
              disabled
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Ver Relatórios (Em breve)
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderModule = () => {
    switch (activeModule) {
      case "dashboard":
        return renderDashboardOverview();
      case "cobranca":
        return <CobrancaModule />;
      case "sdr":
        return (
          <div className="text-center py-12">
            <Bot className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              SDR Virtual
            </h2>
            <p className="text-gray-600 mb-4">
              Qualificação automática de leads em desenvolvimento
            </p>
            <Badge variant="warning">Próxima funcionalidade</Badge>
          </div>
        );
      case "contatos":
        return <ContactsList />; // Renderiza a lista de contatos
      case "campanhas":
        return (
          <div className="text-center py-12">
            <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Campanhas
            </h2>
            <p className="text-gray-600 mb-4">
              Crie e gerencie campanhas de marketing
            </p>
            <Badge variant="warning">Em desenvolvimento</Badge>
          </div>
        );
      case "relatorios":
        return (
          <div className="text-center py-12">
            <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Relatórios
            </h2>
            <p className="text-gray-600 mb-4">
              Analytics e métricas de performance
            </p>
            <Badge variant="warning">Em desenvolvimento</Badge>
          </div>
        );
      case "configuracoes":
        return (
          <div className="text-center py-12">
            <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Configurações
            </h2>
            <p className="text-gray-600 mb-4">
              Configure sua conta e integrações
            </p>
            <Badge variant="warning">Em desenvolvimento</Badge>
          </div>
        );
      default:
        return renderDashboardOverview();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">AS</span>
            </div>
            <span className="font-bold text-xl text-gray-900">AutoSales</span>
          </div>
        </div>

        <nav className="mt-6">
          {[
            { id: "dashboard", label: "Dashboard", icon: BarChart3 },
            { id: "cobranca", label: "Cobrança", icon: DollarSign },
            { id: "sdr", label: "SDR Virtual", icon: Bot },
            { id: "contatos", label: "Contatos", icon: Users },
            { id: "campanhas", label: "Campanhas", icon: Target },
            { id: "relatorios", label: "Relatórios", icon: PieChart },
            { id: "configuracoes", label: "Configurações", icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-50 transition-colors ${
                  activeModule === item.id
                    ? "bg-blue-50 border-r-2 border-blue-600 text-blue-600"
                    : "text-gray-700"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
                {["sdr", "campanhas", "relatorios", "configuracoes"].includes(
                  item.id
                ) && (
                  <Badge variant="warning" className="ml-auto text-xs">
                    Em breve
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* Upload rápido */}
        <div className="p-6 mt-8 border-t">
          <Button
            className="w-full"
            onClick={() => handleNavigation("/upload")}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Rápido
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">{renderModule()}</div>
      </div>
    </div>
  );
}
