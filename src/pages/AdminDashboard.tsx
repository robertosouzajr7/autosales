import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminApi } from "@/lib/adminApi";
import { OverviewPanel } from "@/components/admin/OverviewPanel";
import { ClientsPanel } from "@/components/admin/ClientsPanel";
import { PlansPanel } from "@/components/admin/PlansPanel";
import { FinancePanel } from "@/components/admin/FinancePanel";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import {
  ShieldCheck, LayoutDashboard, Building2, Package, Wallet, Settings2,
} from "lucide-react";

/**
 * Portal de administração do SaaS (SUPERADMIN).
 * Dividido em painéis: Visão Geral (relatórios), Clientes, Planos,
 * Financeiro e Configurações (gateway + landing).
 */
export default function AdminDashboard() {
  const [plans, setPlans] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [sdrs, setSdrs] = useState<any[]>([]);

  const loadShared = async () => {
    const [pRes, tRes, sRes] = await Promise.all([
      adminApi.get("/api/admin/plans"),
      adminApi.get("/api/admin/tenants"),
      adminApi.get("/api/sdrs"),
    ]);
    if (pRes.ok && Array.isArray(pRes.data)) setPlans(pRes.data);
    if (tRes.ok && Array.isArray(tRes.data)) setTenants(tRes.data);
    if (sRes.ok && Array.isArray(sRes.data)) setSdrs(sRes.data);
  };

  useEffect(() => { loadShared(); }, []);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <PageHeader
          icon={<ShieldCheck className="w-5 h-5" />}
          title="Administração do SaaS"
          subtitle="Relatórios, clientes, planos, financeiro e configurações da plataforma."
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted p-1 rounded-xl inline-flex h-11 w-full md:w-auto overflow-x-auto scrollbar-thin">
            <TabsTrigger value="overview" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <LayoutDashboard className="w-4 h-4 mr-2" /> Visão geral
            </TabsTrigger>
            <TabsTrigger value="clients" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Building2 className="w-4 h-4 mr-2" /> Clientes
            </TabsTrigger>
            <TabsTrigger value="plans" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Package className="w-4 h-4 mr-2" /> Planos
            </TabsTrigger>
            <TabsTrigger value="finance" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Wallet className="w-4 h-4 mr-2" /> Financeiro
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Settings2 className="w-4 h-4 mr-2" /> Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewPanel /></TabsContent>
          <TabsContent value="clients"><ClientsPanel plans={plans} /></TabsContent>
          <TabsContent value="plans"><PlansPanel plans={plans} reload={loadShared} /></TabsContent>
          <TabsContent value="finance"><FinancePanel tenants={tenants} /></TabsContent>
          <TabsContent value="settings"><SettingsPanel sdrs={sdrs} plans={plans} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
