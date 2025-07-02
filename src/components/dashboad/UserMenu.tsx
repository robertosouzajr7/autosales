"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { LogOut, Settings, User } from "lucide-react";

export function UserMenu() {
  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/auth/signin" });
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {}} // Abrir menu de configurações
        className="p-2"
      >
        <Settings className="h-4 w-4" />
      </Button>

      <Button variant="ghost" size="sm" onClick={handleSignOut} className="p-2">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
