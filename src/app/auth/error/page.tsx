"use client";

import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AlertCircle, ArrowLeft } from "lucide-react";

const errorMessages = {
  OAuthAccountNotLinked: {
    title: "Conta não vinculada",
    description:
      "Você já tem uma conta com este email. Faça login com email e senha, ou use um email diferente para o Google.",
  },
  OAuthCallback: {
    title: "Erro de callback",
    description: "Ocorreu um erro durante a autenticação com o Google.",
  },
  default: {
    title: "Erro de autenticação",
    description: "Ocorreu um erro inesperado durante o login.",
  },
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "default";

  const errorInfo =
    errorMessages[error as keyof typeof errorMessages] || errorMessages.default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 py-12 px-4">
      <Card className="w-full max-w-md p-8 bg-white shadow-xl text-center">
        <div className="mb-6">
          <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {errorInfo.title}
          </h1>
          <p className="text-gray-600">{errorInfo.description}</p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => (window.location.href = "/auth/signin")}
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Login
          </Button>

          <Button
            variant="outline"
            onClick={() => (window.location.href = "/auth/signup")}
            className="w-full"
          >
            Criar Nova Conta
          </Button>
        </div>

        {error === "OAuthAccountNotLinked" && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Dica:</strong> Se você já tem uma conta, faça login com
              email e senha. Depois você pode vincular o Google nas
              configurações.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
