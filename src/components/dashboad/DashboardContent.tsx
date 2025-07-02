"use client";

import { useState } from "react";
import AutoSalesDashboard from "./AutoSalesDashboard";

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  companyName?: string | null;
  planName?: string | null;
  subscriptionStatus?: string | null;
  trialEndsAt?: Date | null;
}

interface DashboardContentProps {
  user: User;
}

export function DashboardContent({ user }: DashboardContentProps) {
  const [activeModule, setActiveModule] = useState("dashboard");

  return (
    <div className="space-y-6">
      {/* Informações do usuário */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Informações da Conta</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Nome</p>
            <p className="font-medium">{user.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Empresa</p>
            <p className="font-medium">{user.companyName || "Não informada"}</p>
          </div>
        </div>
      </div>

      {/* Dashboard principal */}
      <AutoSalesDashboard />
    </div>
  );
}
