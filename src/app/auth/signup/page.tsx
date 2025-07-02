import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata = {
  title: "Cadastro - AutoSales",
  description: "Crie sua conta AutoSales gratuita",
};

export default async function SignUpPage() {
  const session = await getServerSession(authOptions);

  // Se já estiver logado, redirecionar para dashboard
  if (session) {
    redirect("/dashboard");
  }

  return <SignupForm />;
}
