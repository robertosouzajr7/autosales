import React from "react";
import { Card } from "../ui/Card";
import { Activity } from "../../types";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  Users,
  Calendar,
} from "lucide-react";

interface RecentActivityProps {
  activities: Activity[];
  loading?: boolean;
}

const getActivityIcon = (type: string) => {
  const icons = {
    cobranca: DollarSign,
    sdr: Users,
    meeting: Calendar,
    payment: CheckCircle,
    campaign: Clock,
  };
  return icons[type as keyof typeof icons] || Clock;
};

const getStatusColor = (status: string) => {
  const colors = {
    success: "text-green-600 bg-green-50",
    warning: "text-yellow-600 bg-yellow-50",
    error: "text-red-600 bg-red-50",
    info: "text-blue-600 bg-blue-50",
  };
  return colors[status as keyof typeof colors] || colors.info;
};

export const RecentActivity: React.FC<RecentActivityProps> = ({
  activities,
  loading,
}) => {
  if (loading) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Atividade Recente
        </h3>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Atividade Recente
      </h3>
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = getActivityIcon(activity.type);
          const statusColor = getStatusColor(activity.status);

          return (
            <div key={activity.id} className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${statusColor}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {activity.message}
                </p>
                <p className="text-xs text-gray-500">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
