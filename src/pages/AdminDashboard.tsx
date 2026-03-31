import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, Building2, Package, TrendingUp, DollarSign, Activity, 
  Trash2, ToggleLeft, ToggleRight, CheckCircle2, AlertCircle, 
  Settings as SettingsIcon, BrainCircuit, Wallet, Search, Plus, X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminDashboard() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Modais
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  // Forms
  const [newTenant, setNewTenant] = useState({ name: "", email: "", planId: "" });
  const [newPlan, setNewPlan] = useState({ name: "", priceMonthly: 0, priceYearly: 0, maxLeads: 1000, maxSdrs: 2 });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, pRes] = await Promise.all([
        fetch("/api/admin/tenants"),
        fetch("/api/admin/plans")
      ]);
      const tData = await tRes.json();
      const pData = await pRes.json();
      setTenants(Array.isArray(tData) ? tData : []);
      setPlans(Array.isArray(pData) ? pData : []);
    } catch (e) {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    }
    setLoading(false);
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
        toast({ title: "Cliente criado com sucesso!" });
        setIsTenantModalOpen(false);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao criar cliente", variant: "destructive" }); }
  };

  const handleCreatePlan = async () => {
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlan)
      });
      if (res.ok) {
        toast({ title: "Plano criado com sucesso!" });
        setIsPlanModalOpen(false);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao criar plano", variant: "destructive" }); }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    await fetch(`/api/admin/tenants/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current })
    });
    fetchData();
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 p-10 max-w-screen-2xl mx-auto">
        
        {/* HEADER ADMIN */}
        <div className="flex items-center justify-between">
           <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                 <ShieldCheck className="w-10 h-10 text-emerald-500" />
                 SaaS <span className="text-emerald-500 italic">Central</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Painel de Controle do Proprietário da Plataforma</p>
           </div>
           
           <div className="flex gap-4">
              <Button onClick={() => setIsTenantModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 h-12 px-6 rounded-2xl font-black uppercase text-xs tracking-widest">
                <Plus className="w-4 h-4 mr-2" /> Novo Cliente
              </Button>
              <Button onClick={() => setIsPlanModalOpen(true)} variant="outline" className="h-12 px-6 rounded-2xl font-black uppercase text-xs tracking-widest border-2">
                <Package className="w-4 h-4 mr-2" /> Criar Plano
              </Button>
           </div>
        </div>

        {/* ESTATÍSTICAS GLOBAIS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <StatCard icon={<Building2 className="text-blue-500" />} label="Empresas Ativas" value={tenants.filter(t => t.active).length} color="blue" />
           <StatCard icon={<TrendingUp className="text-emerald-500" />} label="MRR Estimado" value={`R$ ${tenants.reduce((acc, t) => acc + (t.plan?.priceMonthly || 0), 0)}`} color="emerald" />
           <StatCard icon={<Package className="text-purple-500" />} label="Planos Ativos" value={plans.length} color="purple" />
           <StatCard icon={<Activity className="text-orange-500" />} label="Status Infra" value="Online" color="orange" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
           
           {/* TABELA DE TENANTS */}
           <Card className="lg:col-span-2 border-none shadow-2xl rounded-[40px] overflow-hidden bg-white">
              <CardContent className="p-0">
                 <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Gerenciamento de Clientes</h3>
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       <input placeholder="Buscar empresa..." className="h-10 pl-10 pr-4 border border-slate-200 rounded-xl bg-white w-64 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    </div>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                       <thead>
                          <tr className="border-b border-slate-50">
                             <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa</th>
                             <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plano</th>
                             <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                             <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                          </tr>
                       </thead>
                       <tbody>
                          {tenants.map(tenant => (
                             <tr key={tenant.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <td className="p-6">
                                   <div className="flex flex-col">
                                      <span className="font-extrabold text-slate-800">{tenant.name}</span>
                                      <span className="text-[10px] font-bold text-slate-400">{tenant.email}</span>
                                   </div>
                                </td>
                                <td className="p-6">
                                   <Badge className={`font-black text-[10px] bg-slate-100 text-slate-600 border-none`}>
                                      {tenant.plan?.name || "Sem Plano"}
                                   </Badge>
                                </td>
                                <td className="p-6 text-center">
                                   <Badge className={`font-black text-[9px] uppercase tracking-tighter ${tenant.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'} border-none`}>
                                      {tenant.active ? 'Ativo' : 'Inativo'}
                                   </Badge>
                                </td>
                                <td className="p-6 text-right">
                                   <div className="flex items-center justify-end gap-2">
                                      <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl" onClick={() => toggleStatus(tenant.id, tenant.active)}>
                                         {tenant.active ? <ToggleRight className="w-6 h-6 text-emerald-500" /> : <ToggleLeft className="w-6 h-6 text-slate-300" />}
                                      </Button>
                                   </div>
                                </td>
                             </tr>
                          ))}
                          {tenants.length === 0 && (
                            <tr><td colSpan={4} className="p-10 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhum cliente cadastrado</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </CardContent>
           </Card>

           {/* LISTA DE PLANOS (CRUD Requirement 2) */}
           <div className="flex flex-col gap-6">
             <Card className="border-none shadow-2xl rounded-[40px] bg-white overflow-hidden p-8">
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-500" /> Planos do Sistema
                </h3>
                <div className="space-y-4">
                  {plans.map(plan => (
                    <div key={plan.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group">
                      <div>
                        <p className="text-sm font-black text-slate-900">{plan.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">R$ {plan.priceMonthly}/mês · {plan.maxSdrs} SDRs</p>
                      </div>
                      <Button variant="ghost" size="icon" className="group-hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {plans.length === 0 && (
                    <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-3xl text-slate-300 text-xs font-bold uppercase">Nenhum plano ativo</div>
                  )}
                </div>
             </Card>

             <Card className="border-none shadow-2xl rounded-[40px] bg-slate-900 text-white overflow-hidden p-10 relative">
                <div className="space-y-6 relative z-10 text-center">
                  <BrainCircuit className="w-12 h-12 text-emerald-500 mx-auto" />
                  <div className="space-y-2">
                    <p className="text-xs font-black text-emerald-500 uppercase tracking-widest">SaaS Intelligence</p>
                    <p className="text-white/50 text-xs px-4">Gerencie as regras de negócio e limites de uso de todos os clientes em tempo real.</p>
                  </div>
                </div>
             </Card>
           </div>

        </div>
      </div>

      {/* MODAL NOVO CLIENTE */}
      <Dialog open={isTenantModalOpen} onOpenChange={setIsTenantModalOpen}>
        <DialogContent className="rounded-[40px] p-10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Adicionar Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label className="font-bold">Nome da Empresa</Label>
              <Input value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} className="rounded-xl h-12" placeholder="Ex: Alpha Corp" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">E-mail Administrativo</Label>
              <Input value={newTenant.email} onChange={e => setNewTenant({...newTenant, email: e.target.value})} className="rounded-xl h-12" placeholder="admin@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Plano de Assinatura</Label>
              <Select onValueChange={v => setNewTenant({...newTenant, planId: v})}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Selecione o plano..." />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} (R$ {p.priceMonthly})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateTenant} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl uppercase tracking-widest transition-all">Criar Conta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL NOVO PLANO */}
      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="rounded-[40px] p-10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Criar Novo Plano</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6 py-4">
            <div className="col-span-2 space-y-2">
              <Label className="font-bold">Nome do Plano</Label>
              <Input value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} className="rounded-xl h-12" placeholder="Ex: Premium" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Preço Mensal (R$)</Label>
              <Input type="number" value={newPlan.priceMonthly} onChange={e => setNewPlan({...newPlan, priceMonthly: parseFloat(e.target.value)})} className="rounded-xl h-12" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Preço Anual (R$)</Label>
              <Input type="number" value={newPlan.priceYearly} onChange={e => setNewPlan({...newPlan, priceYearly: parseFloat(e.target.value)})} className="rounded-xl h-12" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Limite de Leads</Label>
              <Input type="number" value={newPlan.maxLeads} onChange={e => setNewPlan({...newPlan, maxLeads: parseInt(e.target.value)})} className="rounded-xl h-12" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Máximo de SDRs</Label>
              <Input type="number" value={newPlan.maxSdrs} onChange={e => setNewPlan({...newPlan, maxSdrs: parseInt(e.target.value)})} className="rounded-xl h-12" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreatePlan} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl uppercase tracking-widest transition-all">Ativar Plano</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}

function StatCard({ icon, label, value, color }: { icon: any, label: string, value: any, color: string }) {
  const colors: any = {
    blue: "bg-blue-50 border-blue-100",
    emerald: "bg-emerald-50 border-emerald-100",
    purple: "bg-purple-50 border-purple-100",
    slate: "bg-slate-50 border-slate-100",
    orange: "bg-orange-50 border-orange-100"
  };
  return (
    <Card className={`p-8 border-2 shadow-sm rounded-[30px] flex items-center gap-6 ${colors[color]}`}>
       <div className="p-4 bg-white rounded-2xl shadow-sm">{icon}</div>
       <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
       </div>
    </Card>
  );
}

function ShieldCheck(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
}
