"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LogOut, Settings, Crown } from "lucide-react";

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  companyName?: string | null;
  planName?: string | null;
  subscriptionStatus?: string | null;
  trialEndsAt?: Date | null;
}

interface DashboardHeaderProps {
  user: User;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/auth/signin" });
  };

  // Calcular dias restantes do trial
  const getDaysRemaining = () => {
    if (!user.trialEndsAt) return null;
    const now = new Date();
    const trialEnd = new Date(user.trialEndsAt);
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const daysRemaining = getDaysRemaining();
  const isTrialUser = user.subscriptionStatus === "trial";

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">AS</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">AutoSales</h1>
            </div>

            {/* User Info + Menu */}
            <div className="flex items-center space-x-4">
              {/* Plano */}
              <Badge variant={isTrialUser ? "warning" : "success"}>
                {user.planName || "Trial"}
                {isTrialUser && daysRemaining && ` (${daysRemaining}d)`}
              </Badge>

              {/* User Info */}
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">
                  {user.companyName || user.email}
                </p>
              </div>

              {/* Menu */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {}} // TODO: Abrir configurações
                  className="p-2"
                >
                  <Settings className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="p-2"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Trial Warning */}
      {isTrialUser && daysRemaining !== null && daysRemaining <= 3 && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-center">
              <Crown className="h-4 w-4 text-yellow-600 mr-2" />
              <span className="text-sm text-yellow-800">
                ⚠️ Seu trial expira em {daysRemaining} dias. Faça upgrade para
                continuar!
              </span>
              <Button
                size="sm"
                className="ml-4 bg-yellow-600 hover:bg-yellow-700"
                onClick={() => {}} // TODO: Ir para billing
              >
                Fazer Upgrade
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
