"use client";

import { useState } from "react";
import { AutoSalesDashboard } from "./AutoSalesDashboard";
import { Button } from "@/components/ui/Button";
import { Upload, Users, DollarSign } from "lucide-react";

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
  const handleNavigation = (path: string) => {
    window.location.href = path;
  };

  return (
    <div className="space-y-6">
      {/* Dashboard principal */}
      <AutoSalesDashboard />
    </div>
  );
}
