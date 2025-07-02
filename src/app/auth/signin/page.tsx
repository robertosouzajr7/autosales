import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Login - AutoSales",
  description: "Faça login na sua conta AutoSales",
};

export default async function SignInPage() {
  const session = await getServerSession(authOptions);

  // Se já estiver logado, redirecionar para dashboard
  if (session) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
