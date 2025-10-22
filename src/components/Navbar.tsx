import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import React from "react";

const Navbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-8">
        <div className="text-2xl font-bold text-primary">
          FinanceIA
        </div>
        <Button className="flex items-center gap-2" size="sm">
          <MessageCircle className="w-4 h-4" />
          Começar no WhatsApp
        </Button>
      </div>
    </header>
  );
};

export default Navbar;