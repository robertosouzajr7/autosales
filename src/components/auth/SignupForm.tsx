"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import {
  User,
  Mail,
  Lock,
  Building,
  Phone,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export function SignupForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    phone: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError("Senhas não coincidem");
      return false;
    }

    if (formData.password.length < 6) {
      setError("Senha deve ter pelo menos 6 caracteres");
      return false;
    }

    if (!formData.name || !formData.email || !formData.password) {
      setError("Preencha todos os campos obrigatórios");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!validateForm()) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          companyName: formData.companyName,
          phone: formData.phone,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push(
            "/auth/signin?message=Conta criada com sucesso! Faça login para continuar."
          );
        }, 2000);
      } else {
        setError(data.error || "Erro ao criar conta");
      }
    } catch (error) {
      setError("Erro ao criar conta. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md p-8 bg-white shadow-xl text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Conta criada com sucesso!
          </h2>
          <p className="text-gray-600 mb-4">Redirecionando para o login...</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full animate-pulse w-full"></div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md p-8 bg-white shadow-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">AS</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Criar Conta</h1>
          <p className="text-gray-600 mt-2">
            Comece a automatizar suas vendas hoje mesmo
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            name="name"
            placeholder="João Silva"
            label="Nome completo *"
            value={formData.name}
            onChange={handleChange}
            leftIcon={User}
            required
          />

          <Input
            name="email"
            type="email"
            placeholder="seu@email.com"
            label="Email *"
            value={formData.email}
            onChange={handleChange}
            leftIcon={Mail}
            required
          />

          <Input
            name="companyName"
            placeholder="Sua Empresa Ltda"
            label="Nome da empresa"
            value={formData.companyName}
            onChange={handleChange}
            leftIcon={Building}
          />

          <Input
            name="phone"
            placeholder="(11) 99999-9999"
            label="WhatsApp"
            value={formData.phone}
            onChange={handleChange}
            leftIcon={Phone}
          />

          <Input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            label="Senha *"
            value={formData.password}
            onChange={handleChange}
            leftIcon={Lock}
            rightIcon={showPassword ? EyeOff : Eye}
            onRightIconClick={() => setShowPassword(!showPassword)}
            required
          />

          <Input
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="••••••••"
            label="Confirmar senha *"
            value={formData.confirmPassword}
            onChange={handleChange}
            leftIcon={Lock}
            rightIcon={showConfirmPassword ? EyeOff : Eye}
            onRightIconClick={() =>
              setShowConfirmPassword(!showConfirmPassword)
            }
            required
          />

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? "Criando conta..." : "Criar Conta Grátis"}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center mt-8 text-sm text-gray-600">
          Já tem uma conta?{" "}
          <a
            href="/auth/signin"
            className="text-blue-600 hover:underline font-medium"
          >
            Faça login
          </a>
        </p>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            ✨ Trial grátis inclui:
          </h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• 14 dias gratuitos</li>
            <li>• Até 100 contatos</li>
            <li>• Automação de cobrança</li>
            <li>• Suporte por WhatsApp</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
