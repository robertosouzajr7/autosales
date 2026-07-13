import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, Building2, Package, TrendingUp, DollarSign, Activity, 
  Trash2, Settings as SettingsIcon, Search, Plus, X,
  Globe, Mail, Phone, Calendar as CalendarIcon, RefreshCw, Sparkles,
  Receipt, ArrowUpRight, ArrowDownRight, Edit2, Play
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxLeads: number;
  maxSdrs: number;
  maxTokens: number;
  maxMessages: number;
  maxProspects: number;
  maxResearch: number;
  enableSdr: boolean;
  enableTokens: boolean;
  enableProspects: boolean;
  enableResearch: boolean;
  enableMessages: boolean;
  sdrUnitCost: number;
  tokenUnitCost: number;
  prospectUnitCost: number;
  researchUnitCost: number;
  messageUnitCost: number;
  features: string;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  cnpj?: string;
  phone?: string;
  address?: string;
  active: boolean;
  subscriptionStatus?: string;
  planId?: string;
  plan?: Plan;
  users?: any[];
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("general");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [allSdrs, setAllSdrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isEditTenantModalOpen, setIsEditTenantModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  const [newTenant, setNewTenant] = useState({ name: "", email: "", planId: "", adminName: "", adminPassword: "" });
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "AGENT" });

  const defaultPlanState = {
    id: null,
    name: "", 
    priceMonthly: 0, 
    priceYearly: 0, 
    maxLeads: 1000, 
    maxSdrs: 2, 
    maxTokens: 100000,
    maxMessages: 1000,
    maxProspects: 100,
    maxResearch: 20,
    enableSdr: true,
    enableTokens: true,
    enableProspects: true,
    enableResearch: true,
    enableMessages: true,
    sdrUnitCost: 15.0,
    tokenUnitCost: 0.08,
    prospectUnitCost: 0.15,
    researchUnitCost: 1.00,
    messageUnitCost: 0.05,
    features: {
      aiEnabled: true, 
      webhookEnabled: false, 
      bulkMessaging: false, 
      calendar: false, 
      crmIntegration: false,
      maxAutomations: 3, 
      maxExecutions: 1000 
    }
  };

  const [newPlan, setNewPlan] = useState<any>(defaultPlanState);

  // Financial States
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [newTransaction, setNewTransaction] = useState({
    id: "",
    description: "",
    amount: 0,
    type: "EXPENSE",
    category: "Servidor",
    isRecurring: false,
    frequency: "MONTHLY",
    dueDate: "",
    paidAt: "",
    tenantId: "none"
  });
  const [isTriggeringBilling, setIsTriggeringBilling] = useState(false);

  // CMS State
  const [lpSettings, setLpSettings] = useState({
    id: "singleton",
    logoUrl: "",
    contactWhatsApp: "",
    contactEmail: "",
    contactInstagram: "",
    contactLinkedIn: "",
    contactYouTube: "",
    selectedSdrId: "",
    visiblePlanIds: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, pRes, sRes, lpRes] = await Promise.all([
        fetch("/api/admin/tenants"),
        fetch("/api/admin/plans"),
        fetch("/api/sdrs"),
        fetch("/api/admin/landing-settings")
      ]);
      const tData = await tRes.json();
      const pData = await pRes.json();
      const sData = await sRes.json();
      const lpData = await lpRes.json();

      setTenants(Array.isArray(tData) ? tData : []);
      setPlans(Array.isArray(pData) ? pData : []);
      setAllSdrs(Array.isArray(sData) ? sData : []);
      if (lpData) setLpSettings(lpData);
    } catch (e) {
      console.error("Admin fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialData = async () => {
    try {
      const [sumRes, txRes] = await Promise.all([
        fetch("/api/admin/financial/summary"),
        fetch("/api/admin/financial/transactions")
      ]);
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setFinancialSummary(sumData);
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(Array.isArray(txData) ? txData : []);
      }
    } catch (e) {
      console.error("Erro ao buscar dados financeiros:", e);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, []);

  useEffect(() => {
    if (activeTab === "financial") {
      fetchFinancialData();
    }
  }, [activeTab]);

  const handleCreateTenant = async () => {
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTenant)
      });
      if (res.ok) {
        toast({ title: "🚀 Cliente Criado!" });
        setIsEditTenantModalOpen(false);
        setNewTenant({ name: "", email: "", planId: "", adminName: "", adminPassword: "" });
        fetchData();
      }
    } catch (e) { toast({ title: "Erro na criação", variant: "destructive" }); }
  };

  const handleEditPlan = (plan: any) => {
    let featuresData = {
      aiEnabled: false, webhookEnabled: false, bulkMessaging: false, 
      calendar: false, crmIntegration: false, maxAutomations: 3, maxExecutions: 1000
    };
    try {
      if (plan.features) {
        const parsed = JSON.parse(plan.features);
        featuresData = { ...featuresData, ...parsed };
      }
    } catch(e) {
      console.error("Erro ao analisar features:", e);
    }

    setNewPlan({
      id: plan.id,
      name: plan.name,
      priceMonthly: plan.priceMonthly || 0,
      priceYearly: plan.priceYearly || 0,
      maxLeads: plan.maxLeads || 0,
      maxSdrs: plan.maxSdrs || 0,
      maxTokens: plan.maxTokens || 0,
      maxMessages: plan.maxMessages || 0,
      maxProspects: plan.maxProspects || 0,
      maxResearch: plan.maxResearch || 0,
      enableSdr: plan.enableSdr !== undefined ? plan.enableSdr : true,
      enableTokens: plan.enableTokens !== undefined ? plan.enableTokens : true,
      enableProspects: plan.enableProspects !== undefined ? plan.enableProspects : true,
      enableResearch: plan.enableResearch !== undefined ? plan.enableResearch : true,
      enableMessages: plan.enableMessages !== undefined ? plan.enableMessages : true,
      sdrUnitCost: plan.sdrUnitCost !== undefined ? plan.sdrUnitCost : 15.0,
      tokenUnitCost: plan.tokenUnitCost !== undefined ? plan.tokenUnitCost : 0.08,
      prospectUnitCost: plan.prospectUnitCost !== undefined ? plan.prospectUnitCost : 0.15,
      researchUnitCost: plan.researchUnitCost !== undefined ? plan.researchUnitCost : 1.00,
      messageUnitCost: plan.messageUnitCost !== undefined ? plan.messageUnitCost : 0.05,
      features: featuresData
    });
    setIsPlanModalOpen(true);
  };

  const handleCreateOrUpdatePlan = async () => {
    try {
      const planPayload = {
        name: newPlan.name,
        priceMonthly: Number(newPlan.priceMonthly),
        priceYearly: Number(newPlan.priceYearly || newPlan.priceMonthly * 10),
        maxLeads: Number(newPlan.maxLeads),
        maxSdrs: Number(newPlan.maxSdrs),
        maxTokens: Number(newPlan.maxTokens),
        maxMessages: Number(newPlan.maxMessages),
        maxProspects: Number(newPlan.maxProspects),
        maxResearch: Number(newPlan.maxResearch),
        enableSdr: Boolean(newPlan.enableSdr),
        enableTokens: Boolean(newPlan.enableTokens),
        enableProspects: Boolean(newPlan.enableProspects),
        enableResearch: Boolean(newPlan.enableResearch),
        enableMessages: Boolean(newPlan.enableMessages),
        sdrUnitCost: Number(newPlan.sdrUnitCost),
        tokenUnitCost: Number(newPlan.tokenUnitCost),
        prospectUnitCost: Number(newPlan.prospectUnitCost),
        researchUnitCost: Number(newPlan.researchUnitCost),
        messageUnitCost: Number(newPlan.messageUnitCost),
        features: JSON.stringify(newPlan.features)
      };

      const method = newPlan.id ? "PUT" : "POST";
      const url = newPlan.id ? `/api/admin/plans/${newPlan.id}` : "/api/admin/plans";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planPayload)
      });
      if (res.ok) {
        toast({ title: newPlan.id ? "💎 Plano Atualizado!" : "💎 Plano Ativado!" });
        setIsPlanModalOpen(false);
        setNewPlan(defaultPlanState);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro no plano", variant: "destructive" }); }
  };

  const handleDeleteTenant = async (id: string) => {
    if (!confirm("Excluir cliente permanentemente?")) return;
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "🗑️ Cliente Removido" });
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm("Excluir plano permanentemente?")) return;
    try {
      const res = await fetch(`/api/admin/plans/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "🗑️ Plano Removido" });
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password || !selectedTenant) return;
    try {
      const res = await fetch(`/api/admin/tenants/${selectedTenant.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        toast({ title: "👤 Usuário Adicionado!" });
        setIsAddUserModalOpen(false);
        setNewUser({ name: "", email: "", password: "", role: "AGENT" });
        fetchData();
        const updatedTenant = await (await fetch(`/api/admin/tenants/${selectedTenant.id}`)).json();
        setSelectedTenant(updatedTenant);
      }
    } catch (e) { toast({ title: "Erro ao criar usuário", variant: "destructive" }); }
  };

  const handleUpdateLp = async () => {
    try {
      const res = await fetch("/api/admin/landing-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lpSettings)
      });
      if (res.ok) {
        toast({ title: "🌐 Landing Page Atualizada!" });
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const handleCreateOrUpdateTransaction = async () => {
    try {
      const payload = {
        ...newTransaction,
        amount: Number(newTransaction.amount),
        dueDate: newTransaction.dueDate ? new Date(newTransaction.dueDate).toISOString() : null,
        paidAt: newTransaction.paidAt ? new Date(newTransaction.paidAt).toISOString() : null,
        tenantId: newTransaction.tenantId && newTransaction.tenantId !== "none" ? newTransaction.tenantId : null
      };

      const method = newTransaction.id ? "PUT" : "POST";
      const url = newTransaction.id ? `/api/admin/financial/transactions/${newTransaction.id}` : "/api/admin/financial/transactions";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast({ title: newTransaction.id ? "💰 Transação Atualizada!" : "💰 Transação Cadastrada!" });
        setIsTxModalOpen(false);
        setNewTransaction({
          id: "",
          description: "",
          amount: 0,
          type: "EXPENSE",
          category: "Servidor",
          isRecurring: false,
          frequency: "MONTHLY",
          dueDate: "",
          paidAt: "",
          tenantId: "none"
        });
        fetchFinancialData();
      }
    } catch (e) {
      toast({ title: "Erro na transação", variant: "destructive" });
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("Excluir transação permanentemente?")) return;
    try {
      const res = await fetch(`/api/admin/financial/transactions/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "🗑️ Transação Removida" });
        fetchFinancialData();
      }
    } catch (e) { toast({ title: "Erro ao excluir transação", variant: "destructive" }); }
  };

  const handleTriggerBilling = async () => {
    setIsTriggeringBilling(true);
    try {
      const res = await fetch("/api/admin/financial/trigger-billing", { method: "POST" });
      if (res.ok) {
        toast({ title: "⚡ Faturamento manual executado com sucesso!" });
        fetchFinancialData();
      } else {
        toast({ title: "Erro ao processar faturamento", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro na requisição", variant: "destructive" });
    } finally {
      setIsTriggeringBilling(false);
    }
  };

  // Operational profit simulator calculation
  const simSdrCost = newPlan.enableSdr ? (Number(newPlan.maxSdrs) || 0) * (Number(newPlan.sdrUnitCost) || 0) : 0;
  const simTokenCost = newPlan.enableTokens ? ((Number(newPlan.maxTokens) || 0) / 1000) * (Number(newPlan.tokenUnitCost) || 0) : 0;
  const simProspectCost = newPlan.enableProspects ? (Number(newPlan.maxProspects) || 0) * (Number(newPlan.prospectUnitCost) || 0) : 0;
  const simResearchCost = newPlan.enableResearch ? (Number(newPlan.maxResearch) || 0) * (Number(newPlan.researchUnitCost) || 0) : 0;
  const simMessageCost = newPlan.enableMessages ? (Number(newPlan.maxMessages) || 0) * (Number(newPlan.messageUnitCost) || 0) : 0;

  const simTotalCost = simSdrCost + simTokenCost + simProspectCost + simResearchCost + simMessageCost;
  const simPrice = Number(newPlan.priceMonthly) || 0;
  const simProfit = simPrice - simTotalCost;
  const simMargin = simPrice > 0 ? (simProfit / simPrice) * 100 : 0;

  const [searchTerm, setSearchTerm] = useState("");
  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.email.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 p-6 lg:p-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">Administração do SaaS</h1>
              <p className="text-sm text-muted-foreground">Clientes, planos e financeiro da plataforma.</p>
           </div>

           <div className="flex gap-3">
              {activeTab === "general" && (
                <Button 
                  onClick={() => { setSelectedTenant(null); setIsEditTenantModalOpen(true); }} 
                  
                >
                  <Plus className="w-5 h-5 mr-3" /> Novo Cliente
                </Button>
              )}
              {activeTab === "financial" && (
                <>
                  <Button 
                    onClick={handleTriggerBilling} 
                    disabled={isTriggeringBilling}
                    variant="outline"
                  >
                    <RefreshCw className={`w-5 h-5 mr-3 ${isTriggeringBilling ? 'animate-spin' : ''}`} /> 
                    {isTriggeringBilling ? "Executando..." : "Rodar Faturamento"}
                  </Button>
                  <Button 
                    onClick={() => {
                      setNewTransaction({
                        id: "",
                        description: "",
                        amount: 0,
                        type: "EXPENSE",
                        category: "Servidor",
                        isRecurring: false,
                        frequency: "MONTHLY",
                        dueDate: "",
                        paidAt: "",
                        tenantId: "none"
                      });
                      setIsTxModalOpen(true);
                    }} 
                    
                  >
                    <Plus className="w-5 h-5 mr-3" /> Nova Transação
                  </Button>
                </>
              )}
           </div>
        </div>

        {/* Tab Headers */}
        <Tabs defaultValue="general" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="bg-muted p-1 rounded-xl h-11 w-full max-w-xl mb-6 grid grid-cols-4">
            <TabsTrigger value="general" className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Clientes</TabsTrigger>
            <TabsTrigger value="plans" className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Planos</TabsTrigger>
            <TabsTrigger value="financial" className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Financeiro</TabsTrigger>
            <TabsTrigger value="cms" className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Landing Page</TabsTrigger>
          </TabsList>

          {/* TAB 1: CLIENTES */}
          <TabsContent value="general" className="space-y-10 animate-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <StatCard icon={<Building2 className="text-[#0D9488]" />} label="Clientes SaaS" value={tenants.length} />
               <StatCard icon={<TrendingUp className="text-emerald-500" />} label="MRR Estimado" value={`R$ ${tenants.reduce((acc, t) => acc + (t.plan?.priceMonthly || 0), 0).toFixed(2)}`} />
               <StatCard icon={<Package className="text-teal-500" />} label="Planos Ativos" value={plans.length} />
               <StatCard icon={<Activity className="text-orange-500" />} label="Status Infra" value="Online" />
            </div>

            <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
              <CardContent className="p-0">
                  <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                     <h3 className="text-xl font-semibold text-slate-800 tracking-tight">Gestão de Empresas</h3>
                     <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input 
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          placeholder="Buscar empresa..." 
                          className="h-10 pl-12 pr-6 border-none bg-slate-50 rounded-2xl w-64 text-xs font-bold focus:ring-2 ring-emerald-500/20" 
                        />
                     </div>
                  </div>
                  <div className="overflow-x-auto p-4">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="border-b border-slate-50">
                              <th className="p-6 text-xs font-semibold text-slate-400 ">Empresa</th>
                              <th className="p-6 text-xs font-semibold text-slate-400 ">Plano Contratado</th>
                              <th className="p-6 text-xs font-semibold text-slate-400 text-center">Status</th>
                              <th className="p-6 text-xs font-semibold text-slate-400 text-right">Ações</th>
                           </tr>
                        </thead>
                        <tbody>
                           {filteredTenants.map(tenant => (
                              <tr key={tenant.id} className="border-b border-slate-50 hover:bg-slate-50/50 rounded-2xl group cursor-pointer" onClick={() => { setSelectedTenant(tenant); setIsEditTenantModalOpen(true); }}>
                                 <td className="p-6">
                                    <div className="flex flex-col">
                                       <span className="font-extrabold text-slate-800">{tenant.name}</span>
                                       <span className="text-xs font-bold text-slate-400">{tenant.email}</span>
                                    </div>
                                 </td>
                                 <td className="p-6">
                                    <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 border-none font-bold">
                                       {tenant.plan?.name || "Sem Plano"}
                                    </Badge>
                                 </td>
                                 <td className="p-6 text-center">
                                    <Badge className={`font-semibold text-xs tracking-tight ${tenant.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'} border-none`}>
                                       {tenant.active !== false ? (tenant.subscriptionStatus || 'Ativo') : 'Suspenso'}
                                    </Badge>
                                 </td>
                                 <td className="p-6 text-right">
                                    <div className="flex justify-end gap-2">
                                       <Button variant="ghost" size="icon" className="group-hover:text-[#0D9488]" onClick={(e) => { e.stopPropagation(); setSelectedTenant(tenant); setIsEditTenantModalOpen(true); }}>
                                          <SettingsIcon className="w-4 h-4" />
                                       </Button>
                                       <Button variant="ghost" size="icon" className="hover:text-red-500" onClick={(e) => { e.stopPropagation(); handleDeleteTenant(tenant.id); }}>
                                          <Trash2 className="w-4 h-4" />
                                       </Button>
                                    </div>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: MODELOS DE PLANOS */}
          <TabsContent value="plans" className="animate-in slide-in-from-bottom-4 space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-semibold text-slate-800 flex items-center gap-3">
                <Package className="w-8 h-8 text-[#0D9488]" /> Configurações de Planos
              </h3>
              <Button 
                onClick={() => {
                  setNewPlan(defaultPlanState);
                  setIsPlanModalOpen(true);
                }} 
                className="h-10 bg-slate-900 hover:bg-black px-8 rounded-2xl font-semibold uppercase text-xs text-white shadow-sm transition-all"
              >
                <Plus className="w-5 h-5 mr-3" /> Criar Novo Plano
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map(plan => (
                  <Card key={plan.id} className="border-none shadow-sm rounded-2xl bg-white p-8 group hover:bg-slate-900 hover:shadow-sm transition-all duration-500 cursor-pointer flex flex-col justify-between h-[300px]" onClick={() => handleEditPlan(plan)}>
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="text-2xl font-semibold text-slate-800 group-hover:text-white mb-2">{plan.name}</h4>
                        <Badge className="bg-[#0D9488]/10 text-[#0D9488] font-bold border-none uppercase text-xs ">Ativo</Badge>
                      </div>
                      <p className="text-3xl font-semibold text-[#0D9488] mt-2">R$ {plan.priceMonthly.toFixed(2)}<span className="text-xs text-slate-400 group-hover:text-white/40">/mês</span></p>
                      
                      {/* Operational Margin Indicators */}
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500 group-hover:text-white/60">
                        <div>
                          <span className="block text-xs font-semibold uppercase text-slate-400">Tokens/IA</span>
                          <span className="font-bold text-slate-800 group-hover:text-white">{plan.enableTokens ? `${plan.maxTokens.toLocaleString()}` : "Desativado"}</span>
                        </div>
                        <div>
                          <span className="block text-xs font-semibold uppercase text-slate-400">SDRs</span>
                          <span className="font-bold text-slate-800 group-hover:text-white">{plan.enableSdr ? `${plan.maxSdrs} Ativos` : "Desativado"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 group-hover:border-white/10 flex justify-between items-center">
                       <span className="text-xs font-semibold text-emerald-600 group-hover:text-emerald-400">Clique para Editar</span>
                       <div className="flex gap-2">
                          <Button variant="ghost" size="icon" className="group-hover:text-white hover:bg-slate-100 group-hover:hover:bg-white/10" onClick={(e) => { e.stopPropagation(); handleEditPlan(plan); }}><SettingsIcon className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="group-hover:text-red-400 hover:bg-slate-100 group-hover:hover:bg-white/10" onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }}><Trash2 className="w-4 h-4" /></Button>
                       </div>
                    </div>
                  </Card>
                ))}
            </div>
          </TabsContent>

          {/* TAB 3: GERENCIADOR FINANCEIRO SAAS */}
          <TabsContent value="financial" className="space-y-10 animate-in slide-in-from-bottom-4">
            
            {/* Financial indicators */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
               <StatCard 
                 icon={<TrendingUp className="text-[#0D9488]" />} 
                 label="MRR Recorrente" 
                 value={`R$ ${(financialSummary?.mrr || 0).toFixed(2)}`} 
               />
               <StatCard 
                 icon={<ArrowUpRight className="text-emerald-500" />} 
                 label="Receita Caixa" 
                 value={`R$ ${(financialSummary?.totalRevenues || 0).toFixed(2)}`} 
               />
               <StatCard 
                 icon={<ArrowDownRight className="text-red-500" />} 
                 label="Despesa Caixa" 
                 value={`R$ ${(financialSummary?.totalExpenses || 0).toFixed(2)}`} 
               />
               <StatCard 
                 icon={<Activity className="text-teal-500" />} 
                 label="Custo Operacional Clientes" 
                 value={`R$ ${(financialSummary?.totalClientOperationalCosts || 0).toFixed(2)}`} 
               />
               <StatCard 
                 icon={<DollarSign className="text-indigo-600" />} 
                 label="Lucro Líquido" 
                 value={`R$ ${(financialSummary?.netProfit || 0).toFixed(2)}`} 
               />
            </div>

            {/* Split Screen: Clients Operational Cost & Transaction Log */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Screen: Client Operational Cost */}
              <Card className="lg:col-span-7 border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-semibold text-slate-800 uppercase">Custo Operacional de Clientes</CardTitle>
                    <p className="text-xs font-bold text-slate-400 mt-1">Cálculo dinâmico baseado no uso dos limites</p>
                  </div>
                  <Sparkles className="w-6 h-6 text-[#0D9488]" />
                </CardHeader>
                <CardContent className="p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="p-4 text-xs font-semibold text-slate-400 ">Empresa / Plano</th>
                          <th className="p-4 text-xs font-semibold text-slate-400 text-center">SDRs Act.</th>
                          <th className="p-4 text-xs font-semibold text-slate-400 text-center">Uso Tokens</th>
                          <th className="p-4 text-xs font-semibold text-slate-400 text-center">Buscas BDR</th>
                          <th className="p-4 text-xs font-semibold text-slate-400 text-right">Custo Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financialSummary?.clientCosts?.map((cc: any) => (
                          <tr key={cc.tenantId} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-extrabold text-slate-800">{cc.name}</span>
                                <span className="text-xs font-bold text-[#0D9488]">{cc.planName || "Sem Plano"} (R$ {(cc.planPrice || 0).toFixed(2)})</span>
                              </div>
                            </td>
                            <td className="p-4 text-center font-bold">{cc.usage?.sdrs ?? 0}</td>
                            <td className="p-4 text-center text-xs font-semibold text-slate-500">{((cc.usage?.tokens || 0) / 1000).toFixed(1)}k</td>
                            <td className="p-4 text-center text-xs font-semibold text-slate-500">{cc.usage?.prospects ?? 0}</td>
                            <td className="p-4 text-right font-semibold text-slate-900">
                              R$ {(cc.totalCost ?? 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        {(!financialSummary?.clientCosts || financialSummary.clientCosts.length === 0) && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400 font-bold uppercase text-xs">Nenhum cliente com consumo gerado</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Right Screen: Transaction Manager */}
              <Card className="lg:col-span-5 border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-semibold text-slate-800 uppercase">Livro de Caixa</CardTitle>
                    <p className="text-xs font-bold text-slate-400 mt-1">Lançamento de receitas e despesas manuais</p>
                  </div>
                  <Receipt className="w-6 h-6 text-slate-400" />
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {transactions.map(tx => (
                      <div key={tx.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${tx.type === 'REVENUE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                            {tx.type === 'REVENUE' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{tx.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className="bg-slate-200 text-slate-700 font-bold border-none text-xs ">{tx.category}</Badge>
                              {tx.isRecurring && <Badge className="bg-[#0D9488]/10 text-[#0D9488] font-bold border-none text-xs ">Recorrente</Badge>}
                              {tx.paidAt ? (
                                <span className="text-xs font-bold text-emerald-600">Pago em {new Date(tx.paidAt).toLocaleDateString()}</span>
                              ) : (
                                <span className="text-xs font-bold text-red-500">Pendente</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm ${tx.type === 'REVENUE' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {tx.type === 'REVENUE' ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                            onClick={() => handleDeleteTransaction(tx.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {transactions.length === 0 && (
                      <div className="p-8 text-center text-slate-400 font-bold uppercase text-xs">Nenhuma transação lançada</div>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>

          </TabsContent>

          {/* TAB 4: LANDING PAGE CMS */}
          <TabsContent value="cms" className="animate-in slide-in-from-bottom-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
                  <Card className="lg:col-span-2 border-none shadow-sm rounded-2xl bg-white p-10">
                      <h3 className="text-2xl font-semibold text-slate-800 mb-8 uppercase flex items-center gap-3">
                          <Globe className="w-8 h-8 text-[#0D9488]" /> Configurações Visuais
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                              <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">URL da Logotipo</Label>
                              <Input value={lpSettings.logoUrl} onChange={e => setLpSettings({...lpSettings, logoUrl: e.target.value})} className="h-10 rounded-2xl bg-slate-50 border-none font-bold" placeholder="https://..." />
                          </div>
                          <div className="space-y-2">
                              <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">SDR do Chat da Landing Page</Label>
                              <Select value={lpSettings.selectedSdrId} onValueChange={v => setLpSettings({...lpSettings, selectedSdrId: v})}>
                                  <SelectTrigger className="h-10 rounded-2xl bg-slate-50 border-none font-bold">
                                      <SelectValue placeholder="Selecione um SDR..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-2xl">
                                      {allSdrs.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.role})</SelectItem>)}
                                  </SelectContent>
                              </Select>
                          </div>
                      </div>

                      <h4 className="text-xl font-semibold text-slate-800 mt-12 mb-6 uppercase">Links de Contato</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                              <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">WhatsApp de Contato</Label>
                              <div className="relative">
                                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0D9488]" />
                                  <Input value={lpSettings.contactWhatsApp} onChange={e => setLpSettings({...lpSettings, contactWhatsApp: e.target.value})} className="h-10 pl-12 rounded-2xl bg-slate-50 border-none font-bold" placeholder="5511..." />
                              </div>
                          </div>
                          <div className="space-y-2">
                              <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">E-mail de Suporte</Label>
                              <div className="relative">
                                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                                  <Input value={lpSettings.contactEmail} onChange={e => setLpSettings({...lpSettings, contactEmail: e.target.value})} className="h-10 pl-12 rounded-2xl bg-slate-50 border-none font-bold" placeholder="suporte@..." />
                              </div>
                          </div>
                      </div>
                      
                      <Button onClick={handleUpdateLp} className="h-11 w-full mt-10 bg-slate-900 text-white font-semibold rounded-2xl shadow-sm hover:scale-[1.01] transition-all">
                          Salvar Configurações da Landing Page
                      </Button>
                  </Card>

                  <Card className="border-none shadow-sm rounded-2xl bg-slate-50 p-10">
                      <h3 className="text-xl font-semibold text-slate-800 mb-6 uppercase flex items-center gap-3">
                          <Plus className="w-6 h-6 text-teal-500" /> Visibilidade de Planos
                      </h3>
                      <p className="text-xs font-bold text-slate-400 mb-6">Escolha quais planos serão exibidos na Landing Page.</p>
                      
                      <div className="space-y-3">
                          {plans.map(p => {
                              const isVisible = lpSettings.visiblePlanIds?.split(",").includes(p.id);
                              return (
                                  <div key={p.id} className={`p-5 rounded-2xl flex items-center justify-between border-2 transition-all ${isVisible ? 'bg-white border-emerald-500 shadow-lg' : 'bg-slate-100 border-transparent opacity-60'}`}>
                                      <div className="flex flex-col">
                                          <span className="font-semibold text-slate-800">{p.name}</span>
                                          <span className="text-xs font-bold text-[#0D9488]">R$ {p.priceMonthly.toFixed(2)}/mês</span>
                                      </div>
                                      <Checkbox 
                                          checked={isVisible} 
                                          onCheckedChange={(checked) => {
                                              let ids = lpSettings.visiblePlanIds ? lpSettings.visiblePlanIds.split(",").filter(Boolean) : [];
                                              if (checked) {
                                                  if(!ids.includes(p.id)) ids.push(p.id);
                                              } else {
                                                  ids = ids.filter(id => id !== p.id);
                                              }
                                              setLpSettings({...lpSettings, visiblePlanIds: ids.join(",")});
                                          }}
                                      />
                                  </div>
                              );
                          })}
                      </div>
                  </Card>
              </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* MODAL NOVO CLIENTE */}
      <Dialog open={isEditTenantModalOpen && !selectedTenant} onOpenChange={(v) => { if(!v) setIsEditTenantModalOpen(false); }}>
        <DialogContent className="rounded-2xl p-12 max-w-lg border-none shadow-sm">
          <DialogHeader><DialogTitle className="text-3xl font-semibold">Novo <span className="text-[#0D9488]">Cliente</span></DialogTitle></DialogHeader>
          <div className="grid gap-6 py-4">
            <Input value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} placeholder="Nome da Empresa" className="h-10 rounded-2xl bg-slate-50 border-none font-bold" />
            <Input value={newTenant.email} onChange={e => setNewTenant({...newTenant, email: e.target.value})} placeholder="E-mail" className="h-10 rounded-2xl bg-slate-50 border-none font-bold" />
            <Input type="password" value={newTenant.adminPassword} onChange={e => setNewTenant({...newTenant, adminPassword: e.target.value})} placeholder="Senha" className="h-10 rounded-2xl bg-slate-50 border-none font-bold" />
            <Select onValueChange={v => setNewTenant({...newTenant, planId: v})}>
              <SelectTrigger className="h-10 rounded-2xl bg-slate-50 border-none font-bold"><SelectValue placeholder="Plano..." /></SelectTrigger>
              <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={handleCreateTenant} className="w-full h-11 bg-slate-900 text-white font-semibold rounded-2xl">Criar Conta SaaS</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL GERENCIAR CLIENTE (DETALHADO) */}
      <Dialog open={isEditTenantModalOpen && !!selectedTenant} onOpenChange={setIsEditTenantModalOpen}>
        <DialogContent className="rounded-2xl p-0 max-w-4xl border-none shadow-sm bg-white overflow-hidden">
          {selectedTenant && (
            <div className="flex flex-col h-[80vh]">
               <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                  <h2 className="text-2xl font-semibold uppercase">Gerenciar <span className="text-[#2DD4BF]">{selectedTenant.name}</span></h2>
                  <Button variant="ghost" size="icon" onClick={() => setIsEditTenantModalOpen(false)} className="text-white hover:bg-white/10"><X className="w-6 h-6" /></Button>
               </div>
               <Tabs defaultValue="company" className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-8 bg-slate-50 border-b border-slate-100">
                    <TabsList className="bg-transparent h-10 p-0">
                      <TabsTrigger value="company" className="font-semibold text-xs uppercase">Empresa & Contato</TabsTrigger>
                      <TabsTrigger value="plan" className="font-semibold text-xs uppercase">Plano & Status</TabsTrigger>
                      <TabsTrigger value="users" className="font-semibold text-xs uppercase">Usuários</TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8">
                    <TabsContent value="company" className="space-y-4">
                       <Input value={selectedTenant.name} onChange={e => setSelectedTenant({...selectedTenant, name: e.target.value})} placeholder="Nome" className="h-10 border-none bg-slate-50 rounded-xl" />
                       <Input value={selectedTenant.email} onChange={e => setSelectedTenant({...selectedTenant, email: e.target.value})} placeholder="E-mail" className="h-10 border-none bg-slate-50 rounded-xl" />
                       <Input value={selectedTenant.cnpj || ""} onChange={e => setSelectedTenant({...selectedTenant, cnpj: e.target.value})} placeholder="CNPJ" className="h-10 border-none bg-slate-50 rounded-xl" />
                       <Input value={selectedTenant.phone || ""} onChange={e => setSelectedTenant({...selectedTenant, phone: e.target.value})} placeholder="Telefone" className="h-10 border-none bg-slate-50 rounded-xl" />
                       <Input value={selectedTenant.address || ""} onChange={e => setSelectedTenant({...selectedTenant, address: e.target.value})} placeholder="Endereço" className="h-10 border-none bg-slate-50 rounded-xl" />
                    </TabsContent>
                    <TabsContent value="plan" className="space-y-6">
                       <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                          <p className="font-bold uppercase text-xs">Status da Conta: {selectedTenant.active !== false ? 'ATIVA' : 'SUSPENSA'}</p>
                          <Button size="sm" onClick={() => setSelectedTenant({...selectedTenant, active: !selectedTenant.active})}>{selectedTenant.active !== false ? 'Suspender' : 'Ativar'}</Button>
                       </div>
                       <Select value={selectedTenant.planId} onValueChange={v => setSelectedTenant({...selectedTenant, planId: v})}>
                          <SelectTrigger className="h-10 rounded-xl border-none bg-slate-50"><SelectValue placeholder="Mudar Plano" /></SelectTrigger>
                          <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                       </Select>
                       <Select value={selectedTenant.subscriptionStatus || "ACTIVE"} onValueChange={v => setSelectedTenant({...selectedTenant, subscriptionStatus: v})}>
                          <SelectTrigger className="h-10 rounded-xl border-none bg-slate-50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACTIVE">Ativo</SelectItem>
                            <SelectItem value="PAST_DUE">Inadimplente</SelectItem>
                          </SelectContent>
                       </Select>
                    </TabsContent>
                    <TabsContent value="users" className="m-0 space-y-4">
                       <div className="flex justify-between items-center">
                          <h4 className="font-semibold text-xs uppercase text-slate-400 ">Usuários com acesso à conta</h4>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 rounded-lg text-xs font-semibold border-2"
                            onClick={() => setIsAddUserModalOpen(true)}
                          >
                             Adicionar Usuário
                          </Button>
                       </div>
                       <div className="space-y-2">
                           {selectedTenant.users?.map((u: any) => (
                              <div key={u.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center font-semibold text-xs text-slate-400 uppercase">
                                       {u.name.charAt(0)}
                                    </div>
                                    <div>
                                       <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                                       <p className="text-xs font-bold text-slate-400">{u.email}</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs font-semibold uppercase border-slate-200">{u.role}</Badge>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-red-400 hover:text-red-600"
                                      onClick={() => {
                                         if (confirm("Remover este usuário?")) {
                                            fetch(`/api/admin/tenants/${selectedTenant.id}/users/${u.id}`, { method: "DELETE" })
                                            .then(r => r.ok && fetchData());
                                         }
                                      }}
                                    >
                                       <Trash2 className="w-4 h-4" />
                                    </Button>
                                 </div>
                              </div>
                           ))}
                       </div>
                    </TabsContent>
                  </div>
                  <div className="p-8 border-t flex justify-end gap-3">
                     <Button className="h-10 bg-[#0D9488] text-white font-semibold rounded-2xl px-12" onClick={async () => {
                        const res = await fetch(`/api/admin/tenants/${selectedTenant.id}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(selectedTenant) });
                        if (res.ok) { toast({title:"✅ Sucesso!"}); setIsEditTenantModalOpen(false); fetchData(); }
                     }}>Salvar Alterações</Button>
                  </div>
               </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL PLANO (CREATE/EDIT COM LIMITES E MARGENS) */}
      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="rounded-2xl p-10 max-w-4xl border-none shadow-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl font-semibold uppercase tracking-tight">
              Configurações do <span className="text-[#0D9488]">Plano</span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
             
             {/* Left Column: Plan basic & Resource Switches */}
             <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold uppercase text-slate-400 mb-3 ">Dados Básicos</h4>
                  <div className="space-y-4">
                     <div className="space-y-1">
                       <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Nome do Plano</Label>
                       <Input value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} placeholder="Ex: Basic, Pro..." className="h-10 bg-slate-50 border-none rounded-xl font-bold" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                         <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Mensalidade (R$)</Label>
                         <Input type="number" step="0.01" value={newPlan.priceMonthly} onChange={e => setNewPlan({...newPlan, priceMonthly: parseFloat(e.target.value) || 0})} className="h-10 bg-slate-50 border-none rounded-xl font-bold" />
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Anuidade (R$)</Label>
                         <Input type="number" step="0.01" value={newPlan.priceYearly} onChange={e => setNewPlan({...newPlan, priceYearly: parseFloat(e.target.value) || 0})} className="h-10 bg-slate-50 border-none rounded-xl font-bold" />
                       </div>
                     </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold uppercase text-slate-400 mb-3 ">Recursos Ativos</h4>
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <div className="flex items-center justify-between">
                       <Label className="text-xs font-bold text-slate-700">Ativar Robôs SDR</Label>
                       <Switch checked={newPlan.enableSdr} onCheckedChange={v => setNewPlan({...newPlan, enableSdr: v})} />
                     </div>
                     <div className="flex items-center justify-between border-t pt-3">
                       <Label className="text-xs font-bold text-slate-700">Tokens de IA / Créditos</Label>
                       <Switch checked={newPlan.enableTokens} onCheckedChange={v => setNewPlan({...newPlan, enableTokens: v})} />
                     </div>
                     <div className="flex items-center justify-between border-t pt-3">
                       <Label className="text-xs font-bold text-slate-700">Disparador de Mensagens</Label>
                       <Switch checked={newPlan.enableMessages} onCheckedChange={v => setNewPlan({...newPlan, enableMessages: v})} />
                     </div>
                     <div className="flex items-center justify-between border-t pt-3">
                       <Label className="text-xs font-bold text-slate-700">Busca BDR / Prospecção</Label>
                       <Switch checked={newPlan.enableProspects} onCheckedChange={v => setNewPlan({...newPlan, enableProspects: v})} />
                     </div>
                     <div className="flex items-center justify-between border-t pt-3">
                       <Label className="text-xs font-bold text-slate-700">Deep Research (IA Hunter)</Label>
                       <Switch checked={newPlan.enableResearch} onCheckedChange={v => setNewPlan({...newPlan, enableResearch: v})} />
                     </div>
                  </div>
                </div>
             </div>

             {/* Right Column: Limits, Unit Costs & Margin Simulator */}
             <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold uppercase text-slate-400 mb-3 ">Limites & Custos Unitários</h4>
                  <div className="grid grid-cols-2 gap-4 max-h-[320px] overflow-y-auto pr-1">
                     
                     {/* SDR */}
                     <div className="space-y-1 p-3 bg-slate-50 rounded-xl">
                       <Label className="text-xs font-semibold uppercase text-slate-400">Máx SDRs</Label>
                       <Input disabled={!newPlan.enableSdr} type="number" value={newPlan.maxSdrs} onChange={e => setNewPlan({...newPlan, maxSdrs: parseInt(e.target.value) || 0})} className="h-9 bg-white border-none rounded-lg font-bold" />
                       <span className="text-xs font-semibold text-slate-400 block mt-1">Custo/SDR: R$</span>
                       <Input type="number" step="0.01" value={newPlan.sdrUnitCost} onChange={e => setNewPlan({...newPlan, sdrUnitCost: parseFloat(e.target.value) || 0})} className="h-8 bg-white border-none rounded-lg text-xs" />
                     </div>

                     {/* Tokens */}
                     <div className="space-y-1 p-3 bg-slate-50 rounded-xl">
                       <Label className="text-xs font-semibold uppercase text-slate-400">Tokens/IA</Label>
                       <Input disabled={!newPlan.enableTokens} type="number" value={newPlan.maxTokens} onChange={e => setNewPlan({...newPlan, maxTokens: parseInt(e.target.value) || 0})} className="h-9 bg-white border-none rounded-lg font-bold" />
                       <span className="text-xs font-semibold text-slate-400 block mt-1">Custo/1k Tokens: R$</span>
                       <Input type="number" step="0.01" value={newPlan.tokenUnitCost} onChange={e => setNewPlan({...newPlan, tokenUnitCost: parseFloat(e.target.value) || 0})} className="h-8 bg-white border-none rounded-lg text-xs" />
                     </div>

                     {/* Messages */}
                     <div className="space-y-1 p-3 bg-slate-50 rounded-xl">
                       <Label className="text-xs font-semibold uppercase text-slate-400">Msg/mês</Label>
                       <Input disabled={!newPlan.enableMessages} type="number" value={newPlan.maxMessages} onChange={e => setNewPlan({...newPlan, maxMessages: parseInt(e.target.value) || 0})} className="h-9 bg-white border-none rounded-lg font-bold" />
                       <span className="text-xs font-semibold text-slate-400 block mt-1">Custo/Msg: R$</span>
                       <Input type="number" step="0.01" value={newPlan.messageUnitCost} onChange={e => setNewPlan({...newPlan, messageUnitCost: parseFloat(e.target.value) || 0})} className="h-8 bg-white border-none rounded-lg text-xs" />
                     </div>

                     {/* Prospects */}
                     <div className="space-y-1 p-3 bg-slate-50 rounded-xl">
                       <Label className="text-xs font-semibold uppercase text-slate-400">Buscas BDR</Label>
                       <Input disabled={!newPlan.enableProspects} type="number" value={newPlan.maxProspects} onChange={e => setNewPlan({...newPlan, maxProspects: parseInt(e.target.value) || 0})} className="h-9 bg-white border-none rounded-lg font-bold" />
                       <span className="text-xs font-semibold text-slate-400 block mt-1">Custo/BDR: R$</span>
                       <Input type="number" step="0.01" value={newPlan.prospectUnitCost} onChange={e => setNewPlan({...newPlan, prospectUnitCost: parseFloat(e.target.value) || 0})} className="h-8 bg-white border-none rounded-lg text-xs" />
                     </div>

                     {/* Research */}
                     <div className="space-y-1 p-3 bg-slate-50 rounded-xl col-span-2">
                       <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs font-semibold uppercase text-slate-400">Deep Research</Label>
                            <Input disabled={!newPlan.enableResearch} type="number" value={newPlan.maxResearch} onChange={e => setNewPlan({...newPlan, maxResearch: parseInt(e.target.value) || 0})} className="h-9 bg-white border-none rounded-lg font-bold" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-400 block mt-1">Custo/Pesquisa: R$</span>
                            <Input type="number" step="0.01" value={newPlan.researchUnitCost} onChange={e => setNewPlan({...newPlan, researchUnitCost: parseFloat(e.target.value) || 0})} className="h-8 bg-white border-none rounded-lg text-xs mt-1" />
                          </div>
                       </div>
                     </div>

                  </div>
                </div>

                {/* Profit Margin Calculator Panel */}
                <div className="p-5 bg-teal-950/90 text-white rounded-2xl space-y-3 shadow-sm">
                  <h4 className="text-xs font-semibold uppercase text-teal-300 ">Simulador de Margem de Lucro (Mensal)</h4>
                  <div className="grid grid-cols-3 gap-2 py-2 text-center">
                    <div className="border-r border-teal-800">
                      <span className="block text-xs uppercase text-teal-300">Custo Total</span>
                      <span className="text-base font-extrabold text-red-300">R$ {simTotalCost.toFixed(2)}</span>
                    </div>
                    <div className="border-r border-teal-800">
                      <span className="block text-xs uppercase text-teal-300">Margem R$</span>
                      <span className={`text-base font-extrabold ${simProfit >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>R$ {simProfit.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase text-teal-300">Margem %</span>
                      <span className={`text-base font-extrabold ${simMargin >= 50 ? 'text-emerald-300' : (simMargin >= 10 ? 'text-yellow-300' : 'text-red-400')}`}>
                        {simMargin.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
             </div>

          </div>

          <DialogFooter className="mt-4">
            <Button onClick={handleCreateOrUpdatePlan} className="w-full h-11 bg-[#0D9488] hover:bg-[#0F766E] font-semibold text-white rounded-2xl text-xs shadow-sm">
              Salvar Configurações do Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL TRANSACAO (CREATE/EDIT) */}
      <Dialog open={isTxModalOpen} onOpenChange={setIsTxModalOpen}>
        <DialogContent className="rounded-2xl p-10 max-w-lg border-none shadow-sm bg-white">
          <h2 className="text-2xl font-semibold tracking-tight mb-6">Lançamento <span className="text-[#0D9488]">Financeiro</span></h2>
          <div className="space-y-4">
             <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Descrição</Label>
                <Input value={newTransaction.description} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} className="h-10 rounded-xl bg-slate-50 border-none font-bold" placeholder="Ex: Servidor AWS, Campanha Ads..." />
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Valor (R$)</Label>
                  <Input type="number" step="0.01" value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: parseFloat(e.target.value) || 0})} className="h-10 rounded-xl bg-slate-50 border-none font-bold" />
               </div>
               <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Tipo</Label>
                  <Select value={newTransaction.type} onValueChange={v => setNewTransaction({...newTransaction, type: v})}>
                     <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none font-bold">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl">
                        <SelectItem value="REVENUE">Receita (Entrada)</SelectItem>
                        <SelectItem value="EXPENSE">Despesa (Saída)</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Categoria</Label>
                  <Input value={newTransaction.category} onChange={e => setNewTransaction({...newTransaction, category: e.target.value})} className="h-10 rounded-xl bg-slate-50 border-none font-bold" placeholder="Servidor, Infra, Suporte..." />
               </div>
               <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Vincular a Cliente (Opcional)</Label>
                  <Select value={newTransaction.tenantId} onValueChange={v => setNewTransaction({...newTransaction, tenantId: v})}>
                     <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none font-bold">
                        <SelectValue placeholder="Geral" />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl">
                        <SelectItem value="none">Geral / Sem Cliente</SelectItem>
                        {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                     </SelectContent>
                  </Select>
               </div>
             </div>

             <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700">Lançamento Recorrente</Label>
                  <Switch checked={newTransaction.isRecurring} onCheckedChange={v => setNewTransaction({...newTransaction, isRecurring: v})} />
                </div>
                {newTransaction.isRecurring && (
                  <div className="pt-2 border-t mt-2">
                    <Label className="text-xs font-semibold uppercase text-slate-400">Frequência</Label>
                    <Select value={newTransaction.frequency} onValueChange={v => setNewTransaction({...newTransaction, frequency: v})}>
                       <SelectTrigger className="h-10 rounded-lg bg-white border border-slate-200 font-bold mt-1">
                          <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                          <SelectItem value="MONTHLY">Mensal</SelectItem>
                          <SelectItem value="YEARLY">Anual</SelectItem>
                       </SelectContent>
                    </Select>
                  </div>
                )}
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Vencimento</Label>
                  <Input type="date" value={newTransaction.dueDate} onChange={e => setNewTransaction({...newTransaction, dueDate: e.target.value})} className="h-10 rounded-xl bg-slate-50 border-none font-bold" />
               </div>
               <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Data Pagamento (se pago)</Label>
                  <Input type="date" value={newTransaction.paidAt} onChange={e => setNewTransaction({...newTransaction, paidAt: e.target.value})} className="h-10 rounded-xl bg-slate-50 border-none font-bold" />
               </div>
             </div>

             <Button onClick={handleCreateOrUpdateTransaction} className="w-full h-11 bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold rounded-2xl mt-4 shadow-sm active:scale-95 transition-all">
                Salvar Lançamento
              </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL ADICIONAR USUÁRIO (ADMIN SIDE) */}
      <Dialog open={isAddUserModalOpen} onOpenChange={setIsAddUserModalOpen}>
        <DialogContent className="rounded-2xl p-10 max-w-md border-none shadow-sm bg-white">
          <h2 className="text-2xl font-semibold tracking-tight mb-6">Novo <span className="text-[#0D9488]">Acesso</span></h2>
          <div className="space-y-4">
             <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Nome do Colaborador</Label>
                <Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="h-10 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-200" placeholder="Ex: João Silva" />
             </div>
             <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">E-mail</Label>
                <Input value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="h-10 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-200" placeholder="joao@empresa.com" />
             </div>
             <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Senha</Label>
                <Input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="h-10 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-200" placeholder="******" />
             </div>
             <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase text-slate-400 pl-1">Permissão</Label>
                <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v})}>
                   <SelectTrigger className="h-10 rounded-2xl bg-slate-50 border-none font-bold">
                      <SelectValue />
                   </SelectTrigger>
                   <SelectContent className="rounded-2xl border-none shadow-sm">
                      <SelectItem value="AGENT">Vendedor / Agente</SelectItem>
                      <SelectItem value="ADMIN">Gerente / Admin</SelectItem>
                   </SelectContent>
                </Select>
             </div>
             <Button onClick={handleCreateUser} className="w-full h-11 bg-slate-900 hover:bg-black text-white font-semibold rounded-2xl mt-4 shadow-sm active:scale-95 transition-all">
                Liberar Acesso
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function StatCard({ icon, label, value }: { icon: any, label: string, value: any }) {
  return (
    <Card className="p-8 border-2 rounded-2xl flex items-center gap-6 bg-white border-slate-100 hover:shadow-sm hover:border-slate-200 transition-all duration-300">
       <div className="p-4 bg-slate-50 rounded-2xl">{icon}</div>
       <div>
         <p className="text-xs font-semibold text-slate-400 ">{label}</p>
         <p className="text-2xl font-semibold tracking-tight mt-1 text-slate-800">{value}</p>
       </div>
    </Card>
  );
}
