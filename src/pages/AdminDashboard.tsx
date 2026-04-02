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

  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  const [newTenant, setNewTenant] = useState({ name: "", email: "", planId: "" });
  const [newPlan, setNewPlan] = useState({ name: "", priceMonthly: 0, priceYearly: 0, maxLeads: 1000, maxSdrs: 2 });

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
        fetch("/api/sdrs"), // Pegando SDRs de qualquer tenant para o chat global (ou simplificado)
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

  const handleSaveLpSettings = async () => {
    try {
      const res = await fetch("/api/admin/landing-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lpSettings)
      });
      if (res.ok) {
        toast({ title: "✨ Landing Page Atualizada!" });
      }
    } catch (e) { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const handleCreateTenant = async () => {
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTenant)
      });
      if (res.ok) {
        toast({ title: "🚀 Cliente Criado!" });
        setIsTenantModalOpen(false);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro na criação", variant: "destructive" }); }
  };

  const handleCreatePlan = async () => {
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlan)
      });
      if (res.ok) {
        toast({ title: "💎 Plano Ativado!" });
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

  const togglePlanVisibility = (planId: string) => {
    const currentIds = lpSettings.visiblePlanIds ? lpSettings.visiblePlanIds.split(",") : [];
    let newIds;
    if (currentIds.includes(planId)) {
      newIds = currentIds.filter(id => id !== planId);
    } else {
      newIds = [...currentIds, planId];
    }
    setLpSettings({ ...lpSettings, visiblePlanIds: newIds.join(",") });
  };

  const [searchTerm, setSearchTerm] = useState("");
  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.email.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 p-6 lg:p-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
        
        {/* HEADER ADMIN PREMIUM */}
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
                onClick={() => setIsTenantModalOpen(true)} 
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
            {/* ESTATÍSTICAS */}
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
                             <tr key={tenant.id} className="border-b border-slate-50 hover:bg-slate-50/50 rounded-3xl group">
                                <td className="p-6">
                                   <div className="flex flex-col">
                                      <span className="font-extrabold text-slate-800">{tenant.name}</span>
                                      <span className="text-[10px] font-bold text-slate-400">{tenant.email}</span>
                                   </div>
                                </td>
                                <td className="p-6 text-center">
                                   <Badge className={`font-black text-[9px] uppercase tracking-tighter ${tenant.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'} border-none`}>
                                      {tenant.subscriptionStatus || 'Ativo'}
                                   </Badge>
                                </td>
                                <td className="p-6 text-right">
                                   <div className="flex justify-end gap-2">
                                      <Button variant="ghost" size="icon" className="hover:text-red-500" onClick={() => handleDeleteTenant(tenant.id)}>
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
                 <Card key={plan.id} className="border-none shadow-xl rounded-[40px] bg-white p-8 group hover:bg-slate-900 transition-all duration-500">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-4 bg-slate-100 rounded-2xl group-hover:bg-emerald-500 transition-colors">
                        <Package className="w-6 h-6 text-slate-600 group-hover:text-white" />
                      </div>
                      <Button variant="ghost" size="icon" className="group-hover:text-red-400 text-slate-300" onClick={() => handleDeletePlan(plan.id)}>
                         <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                    <h4 className="text-2xl font-black text-slate-800 group-hover:text-white mb-2 transition-colors">{plan.name}</h4>
                    <p className="text-3xl font-black text-emerald-500 mb-6 group-hover:text-emerald-400 transition-colors">R$ {plan.priceMonthly}<span className="text-xs text-slate-400 font-bold uppercase ml-1">/mês</span></p>
                    
                    <div className="space-y-3 mb-8">
                      <p className="text-xs font-bold text-slate-500 group-hover:text-slate-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {plan.maxSdrs} SDRs Ativos</p>
                      <p className="text-xs font-bold text-slate-500 group-hover:text-slate-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {plan.maxLeads} Leads/mês</p>
                    </div>
                 </Card>
               ))}
            </div>
          </TabsContent>

          <TabsContent value="cms" className="animate-in slide-in-from-bottom-4">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* CONFIGURAÇÕES VISUAIS E SOCIAIS */}
                <Card className="border-none shadow-3xl rounded-[40px] bg-white p-12">
                   <h3 className="text-2xl font-black text-slate-800 mb-10 flex items-center gap-3">
                     <Layout className="w-8 h-8 text-emerald-500" /> Identidade e Contatos
                   </h3>
                   
                   <div className="space-y-8">
                      <div className="grid grid-cols-2 gap-6">
                         <div className="col-span-2 space-y-2">
                            <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">URL do Logo</Label>
                            <Input value={lpSettings.logoUrl} onChange={e => setLpSettings({...lpSettings, logoUrl: e.target.value})} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" placeholder="https://..." />
                         </div>
                         <div className="space-y-2">
                            <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">WhatsApp Oficial</Label>
                            <div className="relative">
                               <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                               <Input value={lpSettings.contactWhatsApp} onChange={e => setLpSettings({...lpSettings, contactWhatsApp: e.target.value})} className="h-14 pl-12 rounded-2xl bg-slate-50 border-none font-bold" placeholder="55..." />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">E-mail de Suporte</Label>
                            <div className="relative">
                               <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                               <Input value={lpSettings.contactEmail} onChange={e => setLpSettings({...lpSettings, contactEmail: e.target.value})} className="h-14 pl-12 rounded-2xl bg-slate-50 border-none font-bold" placeholder="exemplo@..." />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Instagram</Label>
                            <div className="relative">
                               <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                               <Input value={lpSettings.contactInstagram} onChange={e => setLpSettings({...lpSettings, contactInstagram: e.target.value})} className="h-14 pl-12 rounded-2xl bg-slate-50 border-none font-bold" placeholder="@user" />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">LinkedIn</Label>
                            <div className="relative">
                               <Linkedin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                               <Input value={lpSettings.contactLinkedIn} onChange={e => setLpSettings({...lpSettings, contactLinkedIn: e.target.value})} className="h-14 pl-12 rounded-2xl bg-slate-50 border-none font-bold" placeholder="link" />
                            </div>
                         </div>
                      </div>

                      <div className="pt-6 border-t border-slate-50">
                         <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                           <BrainCircuit className="w-5 h-5 text-purple-500" /> Atendimento via Chat IA
                         </h4>
                         <div className="space-y-2">
                            <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Escolha o SDR da Landing Page</Label>
                            <Select value={lpSettings.selectedSdrId} onValueChange={v => setLpSettings({...lpSettings, selectedSdrId: v})}>
                               <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold">
                                  <SelectValue placeholder="Selecione um SDR..." />
                               </SelectTrigger>
                               <SelectContent className="rounded-2xl border-none shadow-2xl">
                                  {allSdrs.map(sdr => (
                                    <SelectItem key={sdr.id} value={sdr.id}>{sdr.name} ({sdr.role})</SelectItem>
                                  ))}
                               </SelectContent>
                            </Select>
                            <p className="text-[10px] text-slate-400 font-bold italic mt-2">Este SDR responderá todas as dúvidas dos visitantes no chat flutuante.</p>
                         </div>
                      </div>

                      <Button onClick={handleSaveLpSettings} className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20">Salvar Mudanças</Button>
                   </div>
                </Card>

                {/* VISIBILIDADE DE PLANOS */}
                <Card className="border-none shadow-3xl rounded-[40px] bg-white p-12">
                   <h3 className="text-2xl font-black text-slate-800 mb-10 flex items-center gap-3">
                     <Globe className="w-8 h-8 text-blue-500" /> Exposição de Planos
                   </h3>
                   <p className="text-xs font-bold text-slate-400 mb-8 uppercase tracking-widest">Marque os planos que deseja exibir na Landing Page:</p>
                   
                   <div className="space-y-4">
                      {plans.map(plan => {
                        const isVisible = lpSettings.visiblePlanIds?.split(",").includes(plan.id);
                        return (
                          <div key={plan.id} className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex items-center justify-between ${isVisible ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-50 bg-slate-50/30'}`} onClick={() => togglePlanVisibility(plan.id)}>
                             <div className="flex items-center gap-4">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isVisible ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                                   {isVisible && <CheckCircle2 className="w-4 h-4 text-white" />}
                                </div>
                                <div>
                                   <p className="text-sm font-black text-slate-800">{plan.name}</p>
                                   <p className="text-[10px] font-bold text-slate-400 italic">R$ {plan.priceMonthly}/mês</p>
                                </div>
                             </div>
                             <Badge variant="outline" className="font-bold border-slate-200">{isVisible ? 'VISÍVEL' : 'OCULTO'}</Badge>
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
      <Dialog open={isTenantModalOpen} onOpenChange={setIsTenantModalOpen}>
        <DialogContent className="rounded-[50px] p-12 max-w-lg border-none shadow-3xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-black uppercase tracking-tighter">Novo <span className="text-emerald-500">Cliente</span></DialogTitle>
          </DialogHeader>
          <div className="grid gap-8 py-4">
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Nome da Empresa</Label>
              <Input value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} className="h-16 rounded-2xl border-none bg-slate-50 font-bold px-8 shadow-inner" placeholder="Ex: Master Corp" />
            </div>
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">E-mail Administrativo</Label>
              <Input value={newTenant.email} onChange={e => setNewTenant({...newTenant, email: e.target.value})} className="h-16 rounded-2xl border-none bg-slate-50 font-bold px-8 shadow-inner" placeholder="admin@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Plano Atual</Label>
              <Select onValueChange={v => setNewTenant({...newTenant, planId: v})}>
                <SelectTrigger className="h-16 rounded-2xl border-none bg-slate-50 font-bold shadow-inner">
                  <SelectValue placeholder="Selecione o plano..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} (R$ {p.priceMonthly})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-8">
            <Button onClick={handleCreateTenant} className="w-full h-20 bg-slate-900 hover:bg-black text-white font-black rounded-3xl uppercase tracking-widest text-sm transition-all shadow-3xl active:scale-95">Criar Conta SaaS</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL NOVO PLANO */}
      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="rounded-[50px] p-12 max-w-xl border-none shadow-3xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-black uppercase tracking-tighter">Configurar <span className="text-emerald-500">Plano</span></DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-8 py-4">
            <div className="col-span-2 space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Nome do Plano</Label>
              <Input value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} className="h-16 rounded-2xl border-none bg-slate-50 font-bold px-8" placeholder="Ex: Premium Elite" />
            </div>
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Preço Mensal (R$)</Label>
              <Input type="number" value={newPlan.priceMonthly} onChange={e => setNewPlan({...newPlan, priceMonthly: parseFloat(e.target.value)})} className="h-16 rounded-2xl border-none bg-slate-50 font-bold px-8" />
            </div>
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Máximo SDRs</Label>
              <Input type="number" value={newPlan.maxSdrs} onChange={e => setNewPlan({...newPlan, maxSdrs: parseInt(e.target.value)})} className="h-16 rounded-2xl border-none bg-slate-50 font-bold px-8" />
            </div>
          </div>
          <DialogFooter className="mt-8">
            <Button onClick={handleCreatePlan} className="w-full h-20 bg-slate-900 hover:bg-black text-white font-black rounded-3xl uppercase tracking-widest text-sm transition-all shadow-3xl active:scale-95">Publicar Plano</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}

function StatCard({ icon, label, value, color }: { icon: any, label: string, value: any, color: string }) {
  const colors: any = {
    blue: "bg-blue-50 border-blue-100 hover:border-blue-300",
    emerald: "bg-emerald-50 border-emerald-100 hover:border-emerald-300",
    purple: "bg-purple-50 border-purple-100 hover:border-purple-300",
    orange: "bg-orange-50 border-orange-100 hover:border-orange-300"
  };
  return (
    <Card className={`p-10 border-2 shadow-sm rounded-[45px] flex items-center gap-8 transition-all duration-300 cursor-pointer ${colors[color]}`}>
       <div className="p-5 bg-white rounded-3xl shadow-xl">{icon}</div>
       <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 leading-none">{label}</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter italic">{value}</p>
       </div>
    </Card>
  );
}
