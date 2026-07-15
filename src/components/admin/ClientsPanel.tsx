import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import {
  Plus, Search, Building2, Trash2, Loader2, Users as UsersIcon, Power,
} from "lucide-react";

const SUB_STATUS = [
  { value: "TRIAL", label: "Trial" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "PAST_DUE", label: "Inadimplente" },
  { value: "CANCELED", label: "Cancelado" },
];

function statusBadge(t: any) {
  if (t.active === false) return <Badge className="bg-rose-100 text-rose-700 border-none">Suspenso</Badge>;
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    TRIAL: "bg-blue-100 text-blue-700",
    PAST_DUE: "bg-amber-100 text-amber-800",
    CANCELED: "bg-slate-200 text-slate-600",
  };
  const label: Record<string, string> = { ACTIVE: "Ativo", TRIAL: "Trial", PAST_DUE: "Inadimplente", CANCELED: "Cancelado" };
  const s = t.subscriptionStatus || "TRIAL";
  return <Badge className={`${map[s] || "bg-slate-100"} border-none`}>{label[s] || s}</Badge>;
}

export function ClientsPanel({ plans }: { plans: any[] }) {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // create
  const [createOpen, setCreateOpen] = useState(false);
  const emptyNew = { name: "", email: "", phone: "", cnpj: "", address: "", planId: "", adminName: "", adminPassword: "" };
  const [newTenant, setNewTenant] = useState<any>(emptyNew);
  const [creating, setCreating] = useState(false);

  // edit
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // add user (colaborador)
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "AGENT" });
  const [addingUser, setAddingUser] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.get("/api/admin/tenants");
    if (res.ok && Array.isArray(res.data)) setTenants(res.data);
    else if (res.status === 401 || res.status === 403) toast({ title: "Sessão expirada ou sem permissão", variant: "destructive" });
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openEdit = async (id: string) => {
    const res = await adminApi.get(`/api/admin/tenants/${id}`);
    if (res.ok) {
      setEdit(res.data);
      setEditOpen(true);
    } else {
      toast({ title: "Erro ao carregar cliente", description: res.data?.error, variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!newTenant.name || !newTenant.email) {
      return toast({ title: "Nome e e-mail são obrigatórios", variant: "destructive" });
    }
    setCreating(true);
    const res = await adminApi.post("/api/admin/tenants", newTenant);
    setCreating(false);
    if (res.ok) {
      toast({ title: "Cliente criado", description: newTenant.adminName ? "Usuário OWNER também foi criado." : undefined });
      setCreateOpen(false);
      setNewTenant(emptyNew);
      load();
    } else {
      toast({ title: "Erro ao criar", description: res.data?.error, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!edit) return;
    setSaving(true);
    const res = await adminApi.put(`/api/admin/tenants/${edit.id}`, {
      name: edit.name,
      email: edit.email,
      phone: edit.phone,
      cnpj: edit.cnpj,
      address: edit.address,
      planId: edit.planId,
      active: edit.active,
      subscriptionStatus: edit.subscriptionStatus,
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Dados salvos" });
      setEditOpen(false);
      load();
    } else {
      toast({ title: "Erro ao salvar", description: res.data?.error, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir DEFINITIVAMENTE o cliente "${name}" e todos os dados dele?`)) return;
    const res = await adminApi.del(`/api/admin/tenants/${id}`);
    if (res.ok) {
      toast({ title: "Cliente excluído" });
      setEditOpen(false);
      load();
    } else {
      toast({ title: "Erro ao excluir", description: res.data?.error, variant: "destructive" });
    }
  };

  const handleAddUser = async () => {
    if (!edit || !newUser.name || !newUser.email || !newUser.password) {
      return toast({ title: "Preencha nome, e-mail e senha", variant: "destructive" });
    }
    setAddingUser(true);
    const res = await adminApi.post(`/api/admin/tenants/${edit.id}/users`, newUser);
    setAddingUser(false);
    if (res.ok) {
      toast({ title: "Colaborador adicionado" });
      setNewUser({ name: "", email: "", password: "", role: "AGENT" });
      const refreshed = await adminApi.get(`/api/admin/tenants/${edit.id}`);
      if (refreshed.ok) setEdit(refreshed.data);
    } else {
      toast({ title: "Erro ao adicionar", description: res.data?.error, variant: "destructive" });
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!edit || !confirm("Remover este colaborador?")) return;
    const res = await adminApi.del(`/api/admin/tenants/${edit.id}/users/${userId}`);
    if (res.ok) {
      const refreshed = await adminApi.get(`/api/admin/tenants/${edit.id}`);
      if (refreshed.ok) setEdit(refreshed.data);
    } else {
      toast({ title: "Erro ao remover", description: res.data?.error, variant: "destructive" });
    }
  };

  const filtered = tenants.filter(
    (t) =>
      t.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail…" className="pl-9" />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo cliente
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : (
        <Card className="rounded-2xl border-border overflow-hidden">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((t) => (
                <li key={t.id} className="px-5 py-4 flex items-center gap-4 hover:bg-muted/40 cursor-pointer" onClick={() => openEdit(t.id)}>
                  <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${t.active === false ? "bg-rose-100 text-rose-500" : "bg-primary/10 text-primary"}`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                  </div>
                  <div className="hidden md:block text-xs text-muted-foreground">
                    {t.plan?.name || "Sem plano"} · {t._count?.users ?? 0} usuário(s)
                  </div>
                  {statusBadge(t)}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* MODAL: NOVO CLIENTE */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nome da empresa *</Label>
                <Input value={newTenant.name} onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">E-mail *</Label>
                <Input type="email" value={newTenant.email} onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <Input value={newTenant.phone} onChange={(e) => setNewTenant({ ...newTenant, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">CNPJ/CPF</Label>
                <Input value={newTenant.cnpj} onChange={(e) => setNewTenant({ ...newTenant, cnpj: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Endereço</Label>
              <Input value={newTenant.address} onChange={(e) => setNewTenant({ ...newTenant, address: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Plano</Label>
              <Select value={newTenant.planId} onValueChange={(v) => setNewTenant({ ...newTenant, planId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar plano…" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — R$ {p.priceMonthly}/mês</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl bg-muted p-3 space-y-3">
              <p className="text-xs font-semibold text-foreground">Usuário administrador (opcional)</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input placeholder="Nome do responsável" value={newTenant.adminName} onChange={(e) => setNewTenant({ ...newTenant, adminName: e.target.value })} />
                <Input type="password" placeholder="Senha (mín. 8)" value={newTenant.adminPassword} onChange={(e) => setNewTenant({ ...newTenant, adminPassword: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">O login usará o e-mail da empresa acima.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />} Criar cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDITAR CLIENTE */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          {edit && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {edit.name} {statusBadge(edit)}
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="data" className="space-y-4">
                <TabsList className="grid grid-cols-3 rounded-xl bg-muted p-1">
                  <TabsTrigger value="data" className="rounded-lg text-xs">Dados</TabsTrigger>
                  <TabsTrigger value="subscription" className="rounded-lg text-xs">Assinatura</TabsTrigger>
                  <TabsTrigger value="users" className="rounded-lg text-xs">Colaboradores</TabsTrigger>
                </TabsList>

                <TabsContent value="data" className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <Input value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">E-mail</Label>
                      <Input value={edit.email || ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Telefone</Label>
                      <Input value={edit.phone || ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">CNPJ/CPF</Label>
                      <Input value={edit.cnpj || ""} onChange={(e) => setEdit({ ...edit, cnpj: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Endereço</Label>
                    <Input value={edit.address || ""} onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
                  </div>
                </TabsContent>

                <TabsContent value="subscription" className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Plano</Label>
                      <Select value={edit.planId || ""} onValueChange={(v) => setEdit({ ...edit, planId: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                        <SelectContent>
                          {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — R$ {p.priceMonthly}/mês</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Status da assinatura</Label>
                      <Select value={edit.subscriptionStatus || "TRIAL"} onValueChange={(v) => setEdit({ ...edit, subscriptionStatus: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SUB_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className={`rounded-xl p-4 flex items-center justify-between ${edit.active !== false ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"}`}>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Conta {edit.active !== false ? "ativa" : "suspensa"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {edit.active !== false ? "O cliente consegue usar a plataforma normalmente." : "Acesso bloqueado — o agente não responde e o painel exige regularização."}
                      </p>
                    </div>
                    <Button
                      variant={edit.active !== false ? "destructive" : "default"}
                      size="sm"
                      onClick={() => setEdit({ ...edit, active: edit.active === false })}
                      className="gap-2"
                    >
                      <Power className="w-4 h-4" />
                      {edit.active !== false ? "Suspender" : "Reativar"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">As mudanças só valem depois de clicar em "Salvar alterações".</p>
                </TabsContent>

                <TabsContent value="users" className="space-y-4">
                  <div className="rounded-xl border border-border divide-y divide-border">
                    {(edit.users || []).length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">Nenhum colaborador.</p>
                    ) : (
                      edit.users.map((u: any) => (
                        <div key={u.id} className="px-4 py-3 flex items-center gap-3">
                          <UsersIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                          <Badge className="bg-muted text-muted-foreground border-none text-xs">{u.role}</Badge>
                          <button onClick={() => handleRemoveUser(u.id)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded-xl bg-muted p-4 space-y-3">
                    <p className="text-xs font-semibold text-foreground">Adicionar colaborador</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Input placeholder="Nome" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                      <Input type="email" placeholder="E-mail" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                      <Input type="password" placeholder="Senha (mín. 8)" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                      <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OWNER">OWNER</SelectItem>
                          <SelectItem value="ADMIN">ADMIN</SelectItem>
                          <SelectItem value="AGENT">AGENT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" onClick={handleAddUser} disabled={addingUser} className="gap-2">
                      {addingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Adicionar
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 sm:mr-auto gap-2" onClick={() => handleDelete(edit.id, edit.name)}>
                  <Trash2 className="w-4 h-4" /> Excluir cliente
                </Button>
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar alterações
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
