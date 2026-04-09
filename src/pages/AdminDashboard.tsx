import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, Building2, Package, TrendingUp, DollarSign, Activity, 
  Trash2, ToggleLeft, ToggleRight, CheckCircle2, AlertCircle, 
  Settings as SettingsIcon, BrainCircuit, Search, Plus, X,
  ShieldCheck, Layout, Globe, MessageSquare, Instagram, Linkedin, Youtube,
  Mail, Phone
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("general");
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [allSdrs, setAllSdrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isEditTenantModalOpen, setIsEditTenantModalOpen] = useState(false);

  const [newTenant, setNewTenant] = useState({ name: "", email: "", planId: "", adminName: "", adminPassword: "" });
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "AGENT" });

  const [newPlan, setNewPlan] = useState<any>({ 
    id: null,
    name: "", 
    priceMonthly: 0, 
    priceYearly: 0, 
    maxLeads: 1000, 
    maxSdrs: 2, 
    maxTokens: 50000,
    features: {
      aiEnabled: false, 
      webhookEnabled: false, 
      bulkMessaging: false, 
      calendar: false, 
      crmIntegration: false,
      maxAutomations: 3, 
      maxExecutions: 1000 
    }
  });

  // CMS State
  const [lpSettings, setLpSettings] = useState({
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

  useEffect(() => { fetchData(); }, []);

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
    } catch(e) {}

    setNewPlan({
      ...plan,
      features: featuresData
    });
    setIsPlanModalOpen(true);
  };

  const handleCreateOrUpdatePlan = async () => {
    try {
      const planPayload = {
        name: newPlan.name,
        priceMonthly: newPlan.priceMonthly,
        priceYearly: newPlan.priceYearly,
        maxLeads: newPlan.maxLeads,
        maxSdrs: newPlan.maxSdrs,
        maxTokens: newPlan.maxTokens,
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
    if (!newUser.name || !newUser.email || !newUser.password) return;
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

  const [searchTerm, setSearchTerm] = useState("");
  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.email.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 p-6 lg:p-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-12 rounded-[50px] shadow-3xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full" />
           <div className="space-y-2 relative z-10">
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                 SaaS <span className="text-emerald-500 italic">Central</span>
              </h1>
              <p className="text-white/30 font-bold uppercase tracking-widest text-[9px]">Painel de Controle do Fundador</p>
           </div>
           
           <div className="flex gap-4 relative z-10">
              <Button 
                onClick={() => { setSelectedTenant(null); setIsEditTenantModalOpen(true); }} 
                className="h-14 bg-emerald-500 hover:bg-emerald-600 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
              >
                <Plus className="w-5 h-5 mr-3" /> Novo Cliente
              </Button>
           </div>
        </div>

        <Tabs defaultValue="general" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="bg-slate-100 p-1 rounded-2xl h-16 w-full max-w-md mb-8 grid grid-cols-3">
            <TabsTrigger value="general" className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Clientes</TabsTrigger>
            <TabsTrigger value="plans" className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Planos</TabsTrigger>
            <TabsTrigger value="cms" className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Landing Page</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-10 animate-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <StatCard icon={<Building2 className="text-blue-500" />} label="Clientes SaaS" value={tenants.length} color="blue" />
               <StatCard icon={<TrendingUp className="text-emerald-500" />} label="MRR Estimado" value={`R$ ${tenants.reduce((acc, t) => acc + (t.plan?.priceMonthly || 0), 0)}`} color="emerald" />
               <StatCard icon={<Package className="text-purple-500" />} label="Planos Ativos" value={plans.length} color="purple" />
               <StatCard icon={<Activity className="text-orange-500" />} label="Status Infra" value="Online" color="orange" />
            </div>

            <Card className="border-none shadow-3xl rounded-[40px] overflow-hidden bg-white">
              <CardContent className="p-0">
                 <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight italic">Gestão de Empresas</h3>
                    <div className="relative">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       <input 
                         value={searchTerm}
                         onChange={e => setSearchTerm(e.target.value)}
                         placeholder="Buscar empresa..." 
                         className="h-12 pl-12 pr-6 border-none bg-slate-50 rounded-2xl w-64 text-xs font-bold focus:ring-2 ring-emerald-500/20" 
                       />
                    </div>
                 </div>
                 <div className="overflow-x-auto p-4">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="border-b border-slate-50">
                             <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa</th>
                             <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                             <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                          </tr>
                       </thead>
                       <tbody>
                          {filteredTenants.map(tenant => (
                             <tr key={tenant.id} className="border-b border-slate-50 hover:bg-slate-50/50 rounded-3xl group cursor-pointer" onClick={() => { setSelectedTenant(tenant); setIsEditTenantModalOpen(true); }}>
                                <td className="p-6">
                                   <div className="flex flex-col">
                                      <span className="font-extrabold text-slate-800">{tenant.name}</span>
                                      <span className="text-[10px] font-bold text-slate-400">{tenant.email}</span>
                                   </div>
                                </td>
                                <td className="p-6 text-center">
                                   <Badge className={`font-black text-[9px] uppercase tracking-tighter ${tenant.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'} border-none`}>
                                      {tenant.active !== false ? (tenant.subscriptionStatus || 'Ativo') : 'Inativo'}
                                   </Badge>
                                </td>
                                <td className="p-6 text-right">
                                   <div className="flex justify-end gap-2">
                                      <Button variant="ghost" size="icon" className="group-hover:text-emerald-500" onClick={(e) => { e.stopPropagation(); setSelectedTenant(tenant); setIsEditTenantModalOpen(true); }}>
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

          <TabsContent value="plans" className="animate-in slide-in-from-bottom-4">
            {/* Same Plans UI */}
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <Package className="w-8 h-8 text-emerald-500" /> Modelos de Planos
              </h3>
              <Button onClick={() => setIsPlanModalOpen(true)} className="h-14 bg-slate-900 hover:bg-black px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white shadow-xl transition-all">
                <Plus className="w-5 h-5 mr-3" /> Criar Novo Plano
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map(plan => (
                  <Card key={plan.id} className="border-none shadow-xl rounded-[40px] bg-white p-8 group hover:bg-slate-900 transition-all duration-500 cursor-pointer" onClick={() => handleEditPlan(plan)}>
                    <h4 className="text-2xl font-black text-slate-800 group-hover:text-white mb-2">{plan.name}</h4>
                    <p className="text-2xl font-black text-emerald-500 italic">R$ {plan.priceMonthly}</p>
                    <div className="mt-6 flex gap-2">
                       <Button variant="ghost" size="icon" className="group-hover:text-white" onClick={(e) => { e.stopPropagation(); handleEditPlan(plan); }}><SettingsIcon className="w-4 h-4" /></Button>
                       <Button variant="ghost" size="icon" className="group-hover:text-red-400" onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </Card>
                ))}
            </div>
          </TabsContent>
          <TabsContent value="cms">
              {/* LP Settings placeholder */}
          </TabsContent>
        </Tabs>
      </div>

      {/* MODAL NOVO CLIENTE */}
      <Dialog open={isEditTenantModalOpen && !selectedTenant} onOpenChange={(v) => { if(!v) setIsEditTenantModalOpen(false); }}>
        <DialogContent className="rounded-[50px] p-12 max-w-lg border-none shadow-3xl">
          <DialogHeader><DialogTitle className="text-3xl font-black">Novo <span className="text-emerald-500">Cliente</span></DialogTitle></DialogHeader>
          <div className="grid gap-6 py-4">
            <Input value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} placeholder="Nome da Empresa" className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
            <Input value={newTenant.email} onChange={e => setNewTenant({...newTenant, email: e.target.value})} placeholder="E-mail" className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
            <Input type="password" value={newTenant.adminPassword} onChange={e => setNewTenant({...newTenant, adminPassword: e.target.value})} placeholder="Senha" className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
            <Select onValueChange={v => setNewTenant({...newTenant, planId: v})}>
              <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold"><SelectValue placeholder="Plano..." /></SelectTrigger>
              <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={handleCreateTenant} className="w-full h-16 bg-slate-900 text-white font-black rounded-3xl">Criar Conta SaaS</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL GERENCIAR CLIENTE (DETALHADO) */}
      <Dialog open={isEditTenantModalOpen && !!selectedTenant} onOpenChange={setIsEditTenantModalOpen}>
        <DialogContent className="rounded-[50px] p-0 max-w-4xl border-none shadow-3xl bg-white overflow-hidden">
          {selectedTenant && (
            <div className="flex flex-col h-[80vh]">
               <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                  <h2 className="text-2xl font-black uppercase">Gerenciar <span className="text-emerald-400">{selectedTenant.name}</span></h2>
                  <Button variant="ghost" size="icon" onClick={() => setIsEditTenantModalOpen(false)} className="text-white hover:bg-white/10"><X className="w-6 h-6" /></Button>
               </div>
               <Tabs defaultValue="company" className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-8 bg-slate-50 border-b border-slate-100">
                    <TabsList className="bg-transparent h-14 p-0">
                      <TabsTrigger value="company" className="font-black text-[10px] uppercase">Empresa & Contato</TabsTrigger>
                      <TabsTrigger value="plan" className="font-black text-[10px] uppercase">Plano & Status</TabsTrigger>
                      <TabsTrigger value="users" className="font-black text-[10px] uppercase">Usuários</TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8">
                    <TabsContent value="company" className="space-y-4">
                       <Input value={selectedTenant.name} onChange={e => setSelectedTenant({...selectedTenant, name: e.target.value})} placeholder="Nome" className="h-12 border-none bg-slate-50 rounded-xl" />
                       <Input value={selectedTenant.email} onChange={e => setSelectedTenant({...selectedTenant, email: e.target.value})} placeholder="E-mail" className="h-12 border-none bg-slate-50 rounded-xl" />
                       <Input value={selectedTenant.cnpj || ""} onChange={e => setSelectedTenant({...selectedTenant, cnpj: e.target.value})} placeholder="CNPJ" className="h-12 border-none bg-slate-50 rounded-xl" />
                       <Input value={selectedTenant.phone || ""} onChange={e => setSelectedTenant({...selectedTenant, phone: e.target.value})} placeholder="Telefone" className="h-12 border-none bg-slate-50 rounded-xl" />
                       <Input value={selectedTenant.address || ""} onChange={e => setSelectedTenant({...selectedTenant, address: e.target.value})} placeholder="Endereço" className="h-12 border-none bg-slate-50 rounded-xl" />
                    </TabsContent>
                    <TabsContent value="plan" className="space-y-6">
                       <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                          <p className="font-bold uppercase text-[10px]">Status da Conta: {selectedTenant.active !== false ? 'ATIVA' : 'SUSPENSA'}</p>
                          <Button size="sm" onClick={() => setSelectedTenant({...selectedTenant, active: !selectedTenant.active})}>{selectedTenant.active !== false ? 'Suspender' : 'Ativar'}</Button>
                       </div>
                       <Select value={selectedTenant.planId} onValueChange={v => setSelectedTenant({...selectedTenant, planId: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-none bg-slate-50"><SelectValue placeholder="Mudar Plano" /></SelectTrigger>
                          <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                       </Select>
                       <Select value={selectedTenant.subscriptionStatus || "ACTIVE"} onValueChange={v => setSelectedTenant({...selectedTenant, subscriptionStatus: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-none bg-slate-50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACTIVE">Ativo</SelectItem>
                            <SelectItem value="PAST_DUE">Inadimplente</SelectItem>
                          </SelectContent>
                       </Select>
                    </TabsContent>
                    <TabsContent value="users" className="m-0 space-y-4">
                       <div className="flex justify-between items-center">
                          <h4 className="font-black text-[10px] uppercase text-slate-400 tracking-widest">Usuários com acesso à conta</h4>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 rounded-lg text-[9px] font-black uppercase tracking-widest border-2"
                            onClick={() => setIsAddUserModalOpen(true)}
                          >
                             Adicionar Usuário
                          </Button>
                       </div>
                       <div className="space-y-2">
                          {selectedTenant.users?.map((u: any) => (
                             <div key={u.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center font-black text-xs text-slate-400 uppercase">
                                      {u.name.charAt(0)}
                                   </div>
                                   <div>
                                      <p className="text-sm font-black text-slate-800">{u.name}</p>
                                      <p className="text-[10px] font-bold text-slate-400 italic">{u.email}</p>
                                   </div>
                                </div>
                                <div className="flex items-center gap-2">
                                   <Badge variant="outline" className="text-[9px] font-black uppercase border-slate-200">{u.role}</Badge>
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
                     <Button className="h-14 bg-emerald-500 text-white font-black rounded-2xl px-12" onClick={async () => {
                        const res = await fetch(`/api/admin/tenants/${selectedTenant.id}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(selectedTenant) });
                        if (res.ok) { toast({title:"✅ Sucesso!"}); setIsEditTenantModalOpen(false); fetchData(); }
                     }}>Salvar Alterações</Button>
                  </div>
               </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL PLANO (CREATE/EDIT) */}
      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="rounded-[50px] p-12 max-w-2xl border-none shadow-3xl">
          <DialogHeader><DialogTitle className="text-3xl font-black">Plano</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
             <Input value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} placeholder="Nome" className="h-12 bg-slate-50 border-none col-span-2 rounded-xl font-bold" />
             <Input type="number" value={newPlan.priceMonthly} onChange={e => setNewPlan({...newPlan, priceMonthly: parseFloat(e.target.value)})} placeholder="Preço" className="h-12 bg-slate-50 border-none rounded-xl font-bold" />
             <Input type="number" value={newPlan.maxTokens} onChange={e => setNewPlan({...newPlan, maxTokens: parseInt(e.target.value)})} placeholder="Tokens" className="h-12 bg-slate-50 border-none rounded-xl font-bold" />
             <div className="col-span-2 grid grid-cols-2 gap-2 mt-4">
                <FeatureToggle id="f-ai" label="IA" checked={newPlan.features.aiEnabled} onChange={v => setNewPlan({...newPlan, features: {...newPlan.features, aiEnabled: v}})} />
                <FeatureToggle id="f-bulk" label="Massa" checked={newPlan.features.bulkMessaging} onChange={v => setNewPlan({...newPlan, features: {...newPlan.features, bulkMessaging: v}})} />
             </div>
          </div>
          <DialogFooter><Button onClick={handleCreateOrUpdatePlan} className="w-full h-16 bg-emerald-500 font-black text-white rounded-2xl">Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL ADICIONAR USUÁRIO (ADMIN SIDE) */}
      <Dialog open={isAddUserModalOpen} onOpenChange={setIsAddUserModalOpen}>
        <DialogContent className="rounded-[40px] p-10 max-w-md border-none shadow-3xl bg-white">
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 italic">Novo <span className="text-emerald-500">Acesso</span></h2>
          <div className="space-y-4">
             <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Nome do Colaborador</Label>
                <Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="h-14 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-200" placeholder="Ex: João Silva" />
             </div>
             <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">E-mail</Label>
                <Input value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="h-14 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-200" placeholder="joao@empresa.com" />
             </div>
             <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Senha</Label>
                <Input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="h-14 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-200" placeholder="******" />
             </div>
             <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Permissão</Label>
                <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v})}>
                   <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold">
                      <SelectValue />
                   </SelectTrigger>
                   <SelectContent className="rounded-2xl border-none shadow-2xl">
                      <SelectItem value="AGENT">Vendedor / Agente</SelectItem>
                      <SelectItem value="ADMIN">Gerente / Admin</SelectItem>
                   </SelectContent>
                </Select>
             </div>
             <Button onClick={handleCreateUser} className="w-full h-16 bg-slate-900 hover:bg-black text-white font-black rounded-2xl uppercase tracking-widest mt-4 shadow-xl active:scale-95 transition-all">
                Liberar Acesso
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function FeatureToggle({ id, label, checked, onChange }: { id: string, label: string, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border">
       <Label htmlFor={id} className="text-[10px] font-bold uppercase">{label}</Label>
       <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(!!c)} />
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: any, label: string, value: any, color: string }) {
  return (
    <Card className="p-8 border-2 rounded-[40px] flex items-center gap-6">
       <div className="p-4 bg-slate-50 rounded-2xl">{icon}</div>
       <div><p className="text-[10px] font-black text-slate-400 uppercase">{label}</p><p className="text-2xl font-black tracking-tight">{value}</p></div>
    </Card>
  );
}
