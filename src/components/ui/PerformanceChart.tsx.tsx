import React from "react";
import { Card } from "../ui/Card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface ChartData {
  name: string;
  cobranca: number;
  sdr: number;
  meetings: number;
}

interface PerformanceChartProps {
  data: ChartData[];
  loading?: boolean;
  type?: "bar" | "line";
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  loading = false,
  type = "bar",
}) => {
  if (loading) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Performance Mensal
        </h3>
        <div className="h-80 bg-gray-100 rounded animate-pulse"></div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Performance Mensal
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        {type === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="cobranca" fill="#3B82F6" name="Cobranças" />
            <Bar dataKey="sdr" fill="#10B981" name="Leads SDR" />
            <Bar dataKey="meetings" fill="#F59E0B" name="Reuniões" />
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="cobranca"
              stroke="#3B82F6"
              name="Cobranças"
            />
            <Line
              type="monotone"
              dataKey="sdr"
              stroke="#10B981"
              name="Leads SDR"
            />
            <Line
              type="monotone"
              dataKey="meetings"
              stroke="#F59E0B"
              name="Reuniões"
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
};
