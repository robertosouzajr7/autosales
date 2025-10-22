import { MadeWithDyad } from "@/components/made-with-dyad";
import Navbar from "@/components/Navbar";
import FeatureCard from "@/components/FeatureCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bell, DollarSign, LineChart, MessageCircle, Wallet } from "lucide-react";
import React from "react";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 md:py-32 text-center container max-w-4xl px-4">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            Seu Assistente Financeiro IA no <span className="text-green-600">WhatsApp</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            O FinanceIA transforma a maneira como você gerencia seu dinheiro. Cadastre transações, receba alertas e controle suas finanças, tudo por conversa.
          </p>
          <Button size="lg" className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all flex items-center gap-2">
            Comece Agora (Grátis)
            <ArrowRight className="w-5 h-5 ml-1" />
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Não precisa baixar app. Funciona 100% no WhatsApp.
          </p>
        </section>

        {/* Features Section */}
        <section className="py-16 md:py-24 bg-muted/40">
          <div className="container px-4 md:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Controle Total, Sem Esforço
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Quatro pilares para você dominar suas finanças pessoais.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard
                icon={Wallet}
                title="Controle de Finanças"
                description="Visualize seus gastos e receitas de forma clara e intuitiva. Saiba exatamente para onde seu dinheiro está indo."
              />
              <FeatureCard
                icon={DollarSign}
                title="Cadastro Rápido de Transações"
                description="Basta enviar uma mensagem de texto no WhatsApp para registrar qualquer despesa ou receita em segundos."
              />
              <FeatureCard
                icon={Bell}
                title="Alertas Inteligentes"
                description="Receba notificações sobre contas a pagar, limites de gastos e padrões incomuns detectados pela IA."
              />
              <FeatureCard
                icon={LineChart}
                title="Atualizações e Insights"
                description="Fique por dentro das tendências do mercado e receba dicas personalizadas para otimizar seu planejamento financeiro."
              />
            </div>
          </div>
        </section>
        
        {/* CTA Section (Optional, but good practice) */}
        <section className="py-16 md:py-24 text-center container px-4">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Pronto para Simplificar Sua Vida Financeira?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
                Junte-se a milhares de usuários que já estão no controle.
            </p>
            <Button size="xl" className="text-xl px-10 py-7 shadow-xl hover:shadow-2xl transition-all flex items-center mx-auto gap-2">
                <MessageCircle className="w-6 h-6" />
                Ativar FinanceIA no WhatsApp
            </Button>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container py-6 flex flex-col md:flex-row items-center justify-between text-sm text-muted-foreground px-4 md:px-8">
          <p>&copy; {new Date().getFullYear()} FinanceIA. Todos os direitos reservados.</p>
          <MadeWithDyad />
        </div>
      </footer>
    </div>
  );
};

export default Index;