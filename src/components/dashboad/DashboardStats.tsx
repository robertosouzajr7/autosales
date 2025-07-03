"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Users, MessageSquare, TrendingUp, DollarSign } from "lucide-react";

interface Stats {
  total: number;
  pending: number;
  sent: number;
  paid: number;
  totalValue: number;
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch("/api/contacts?limit=1");
        if (response.ok) {
          const data = await response.json();
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      }
    };

    loadStats();
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      title: "Contatos Ativos",
      value: stats.total.toString(),
      change: `${stats.pending} pendentes`,
      changeType: "neutral" as const,
      icon: Users,
    },
    {
      title: "Mensagens Enviadas",
      value: stats.sent.toString(),
      change: `${stats.paid} pagos`,
      changeType: "positive" as const,
      icon: MessageSquare,
    },
    {
      title: "Taxa de Conversão",
      value:
        stats.total > 0
          ? `${Math.round((stats.paid / stats.total) * 100)}%`
          : "0%",
      change: `${stats.paid}/${stats.total}`,
      changeType: "positive" as const,
      icon: TrendingUp,
    },
    {
      title: "Valor Total",
      value: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
      }).format(stats.totalValue),
      change: `${stats.total} contatos`,
      changeType: "neutral" as const,
      icon: DollarSign,
    },
  ];

  return (
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
  );
}
