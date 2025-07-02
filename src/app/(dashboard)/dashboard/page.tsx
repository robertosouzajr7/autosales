import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardContent } from "@/components/dashboad/DashboardContent";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  // Esta verificação é redundante pois o layout já faz, mas fica como fallback
  if (!session) {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Bem-vindo, {session.user.name}! 👋
        </h1>
        <p className="text-gray-600">Aqui está o resumo das suas automações</p>
      </div>

      <DashboardContent user={session.user} />
    </div>
  );
}
