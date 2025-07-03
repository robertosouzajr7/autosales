"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LogOut, Settings, Crown, Upload } from "lucide-react";
import { useState } from "react";

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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      console.log("🚪 Iniciando logout...");

      // Fazer logout do NextAuth
      await signOut({
        redirect: false, // ✅ Não redirecionar automaticamente
        callbackUrl: "/auth/signin",
      });

      console.log("✅ Logout NextAuth concluído");

      // Limpar storage local (se houver)
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
      }

      // Aguardar um pouco e redirecionar manualmente
      setTimeout(() => {
        console.log("🔄 Redirecionando para login...");
        window.location.href = "/auth/signin";
      }, 500);
    } catch (error) {
      console.error("❌ Erro no logout:", error);
      setIsLoggingOut(false);

      // Fallback: redirecionar mesmo com erro
      window.location.href = "/auth/signin";
    }
  };

  const handleNavigation = (path: string) => {
    if (isLoggingOut) return; // Prevenir navegação durante logout
    window.location.href = path;
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
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 cursor-pointer"
          onClick={(e) => {
            // Apenas navegar se não clicou em botões
            if (e.target === e.currentTarget) {
              handleNavigation("/dashboard");
            }
          }}
        >
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
              {/* Botão Upload */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleNavigation("/upload")}
                className="hidden md:flex"
                disabled={isLoggingOut}
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>

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
                  onClick={() => handleNavigation("/configuracoes")}
                  className="p-2"
                  disabled={isLoggingOut}
                >
                  <Settings className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="p-2"
                  disabled={isLoggingOut}
                  loading={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
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
                onClick={() => handleNavigation("/configuracoes")}
                disabled={isLoggingOut}
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
