"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LogOut, User, Settings, Crown } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return; // Ainda carregando

    if (!session) {
      router.push("/auth/signin");
      return;
    }

    setIsLoading(false);
  }, [session, status, router]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/auth/signin" });
  };

  const getDaysRemaining = () => {
    if (!session?.user.trialEndsAt) return null;
    const now = new Date();
    const trialEnd = new Date(session.user.trialEndsAt);
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (isLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Redirecionando...
  }

  const daysRemaining = getDaysRemaining();
  const isTrialUser = session.user.subscriptionStatus === "trial";

  return (
    <div className="min-h-screen bg-gray-50">
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

            {/* User Info */}
            <div className="flex items-center space-x-4">
              {/* Plano atual */}
              <div className="flex items-center space-x-2">
                <Badge
                  variant={isTrialUser ? "warning" : "success"}
                  className="flex items-center gap-1"
                >
                  {isTrialUser && <Crown className="h-3 w-3" />}
                  {session.user.planName || "Trial"}
                </Badge>

                {isTrialUser && daysRemaining !== null && (
                  <span className="text-sm text-gray-600">
                    {daysRemaining} dias restantes
                  </span>
                )}
              </div>

              {/* User menu */}
              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {session.user.companyName || session.user.email}
                  </p>
                </div>

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
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Crown className="h-5 w-5 text-yellow-600 mr-2" />
                <span className="text-sm text-yellow-800">
                  Seu trial expira em {daysRemaining} dias. Upgrade agora para
                  continuar automatizando!
                </span>
              </div>
              <Button
                size="sm"
                className="bg-yellow-600 hover:bg-yellow-700"
                onClick={() => router.push("/configuracoes/billing")}
              >
                Fazer Upgrade
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
