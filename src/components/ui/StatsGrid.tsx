import React from "react";
import {
  Users,
  MessageCircle,
  TrendingUp,
  Calendar,
  Target,
  Activity,
} from "lucide-react";
import { StatCard } from "../ui/StatCard";
import { Stats } from "../../types";

interface StatsGridProps {
  stats: Stats;
  loading?: boolean;
}

export const StatsGrid: React.FC<StatsGridProps> = ({
  stats,
  loading = false,
}) => {
  const statItems = [
    {
      icon: Users,
      title: "Total de Contatos",
      value: stats.total_contacts.toLocaleString(),
      change: 12.5,
      color: "blue" as const,
    },
    {
      icon: MessageCircle,
      title: "Mensagens Enviadas",
      value: stats.messages_sent.toLocaleString(),
      change: 8.2,
      color: "green" as const,
    },
    {
      icon: TrendingUp,
      title: "Taxa de Resposta",
      value: `${stats.response_rate}%`,
      change: 3.1,
      color: "purple" as const,
    },
    {
      icon: Calendar,
      title: "Reuniões Agendadas",
      value: stats.meetings_scheduled,
      change: 15.8,
      color: "orange" as const,
    },
    {
      icon: Target,
      title: "Campanhas Ativas",
      value: stats.active_campaigns,
      change: -2.3,
      color: "red" as const,
    },
    {
      icon: Activity,
      title: "Receita Mensal",
      value: `R$ ${stats.monthly_revenue.toLocaleString()}`,
      change: 22.1,
      color: "green" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {statItems.map((item, index) => (
        <StatCard
          key={index}
          icon={item.icon}
          title={item.title}
          value={item.value}
          change={item.change}
          color={item.color}
          loading={loading}
        />
      ))}
    </div>
  );
};
