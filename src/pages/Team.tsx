import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Save, KeyRound, Power, Trash2, ShieldCheck, Info } from "lucide-react";

/**
 * Colaboradores: cadastro, perfil de acesso e quais áreas cada pessoa vê.
 *
 * Antes a equipe era uma tabela com nome, e-mail e um botão de excluir: não
 * dava para editar, desativar nem limitar o que a pessoa enxergava — um
 * atendente entrava na conta e via cobrança, automações e conexões.
 */

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const VAZIO = {
  id: "", name: "", email: "", password: "", role: "AGENT",
  jobTitle: "", permissions: [] as string[], queueIds: [] as string[], active: true,
};

export default function Team() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [catalogo, setCatalogo] = useState<{ profiles: any[]; modules: any[] }>({ profiles: [], modules: [] });
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...VAZIO });
  const [editando, setEditando] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const meuId = localStorage.getItem("userId") || "";

  const carregar = async () => {
    try {
      const [uRes, cRes, qRes] = await Promise.all([
        fetch("/api/users", { headers: auth() }),
        fetch("/api/users/access-catalog", { headers: auth() }),
        fetch("/api/queues", { headers: auth() }),
      ]);
      if (!uRes.ok) {
        const d = await uRes.json().catch(() => ({}));
        throw new Error(d.error || "Sem acesso à gestão de colaboradores.");
      }
      setUsers(await uRes.json());
      setCatalogo(cRes.ok ? await cRes.json() : { profiles: [], modules: [] });
      setQueues(qRes.ok ? await qRes.json() : []);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const perfil = (id: string) => catalogo.profiles.find((p) => p.id === id);

  const abrirNovo = () => {
    setEditando(null);
    const padrao = perfil("AGENT")?.modules || [];
    setForm({ ...VAZIO, permissions: padrao });
    setModalOpen(true);
  };

  const abrirEdicao = (u: any) => {
    setEditando(u);
    setForm({
      id: u.id, name: u.name || "", email: u.email || "", password: "",
      role: u.role, jobTitle: u.jobTitle || "",
      permissions: u.permissions || [],
      queueIds: (u.queues || []).map((q: any) => q.id),
      active: u.active !== false,
    });
    setModalOpen(true);
  };

  /** Trocar de perfil traz os módulos padrão daquela função. */
  const trocarPerfil = (role: string) => {
    setForm((f) => ({ ...f, role, permissions: perfil(role)?.modules || [] }));
  };

  const alternarModulo = (id: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(id)
        ? f.permissions.filter((m) => m !== id)
        : [...f.permissions, id],
    }));
  };

  const alternarFila = (id: string) => {
    setForm((f) => ({
      ...f,
      queueIds: f.queueIds.includes(id) ? f.queueIds.filter((q) => q !== id) : [...f.queueIds, id],
    }));
  };

  const salvar = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      return toast({ title: "Nome e e-mail são obrigatórios", variant: "destructive" });
    }
    if (!editando && form.password.length < 8) {
      return toast({ title: "A senha precisa de ao menos 8 caracteres", variant: "destructive" });
    }
    setSalvando(true);
    try {
      const corpo: any = {
        name: form.name, email: form.email, role: form.role,
        jobTitle: form.jobTitle, permissions: form.permissions, queueIds: form.queueIds,
      };
      const res = editando
        ? await fetch(`/api/users/${editando.id}`, {
            method: "PUT", headers: { ...auth(), "Content-Type": "application/json" },
            body: JSON.stringify({ ...corpo, active: form.active }),
          })
        : await fetch("/api/users", {
            method: "POST", headers: { ...auth(), "Content-Type": "application/json" },
            body: JSON.stringify({ ...corpo, password: form.password }),
          });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Não foi possível salvar.");
      toast({ title: editando ? "Colaborador atualizado" : "Colaborador cadastrado" });
      setModalOpen(false);
      carregar();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (u: any) => {
    const ativar = u.active === false;
    if (!ativar && !confirm(`Desativar o acesso de ${u.name}?\n\nEle não conseguirá entrar até ser reativado. O histórico de atendimento é preservado.`)) return;
    const res = await fetch(`/api/users/${u.id}/active`, {
      method: "POST", headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ active: ativar }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast({ title: ativar ? "Acesso reativado" : "Acesso desativado" }); carregar(); }
    else toast({ title: d.error || "Erro", variant: "destructive" });
  };

  const novaSenha = async (u: any) => {
    const senha = prompt(`Nova senha para ${u.name} (mínimo 8 caracteres):`);
    if (!senha) return;
    const res = await fetch(`/api/users/${u.id}/password`, {
      method: "POST", headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ password: senha }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) toast({ title: "Senha redefinida", description: "Passe a nova senha ao colaborador." });
    else toast({ title: d.error || "Erro", variant: "destructive" });
  };

  const remover = async (u: any) => {
    if (!confirm(`Excluir ${u.name} definitivamente?\n\nPrefira desativar: excluir apaga o vínculo com as filas.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE", headers: auth() });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast({ title: "Colaborador excluído" }); carregar(); }
    else toast({ title: d.error || "Erro", variant: "destructive" });
  };

  const grupos = [...new Set(catalogo.modules.map((m) => m.grupo))];

  return (
    <DashboardLayout>
      <PageHeader
        title="Colaboradores"
        subtitle="Quem tem acesso à conta, com qual perfil e o que cada um enxerga."
        actions={
          <Button onClick={abrirNovo} className="rounded-2xl font-bold bg-[#2563EB]">
            <Plus className="w-4 h-4 mr-2" /> Novo colaborador
          </Button>
        }
      />

      {loading ? (
        <div className="text-slate-400 p-10 text-center">Carregando…</div>
      ) : users.length === 0 ? (
        <Card><CardContent className="p-16 text-center">
          <Users className="w-10 h-10 mx-auto text-slate-300 mb-4" />
          <p className="font-bold text-slate-600">Nenhum colaborador ainda</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => (
            <Card key={u.id} className={u.active === false ? "opacity-60" : ""}>
              <CardContent className="p-5 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800">{u.name}</span>
                    <Badge className="bg-slate-100 text-slate-600 border-none font-bold text-[11px]">
                      {u.isAdmin && <ShieldCheck className="w-3 h-3 mr-1" />}
                      {u.profileLabel}
                    </Badge>
                    {u.active === false && (
                      <Badge className="bg-red-100 text-red-700 border-none font-bold text-[11px]">Desativado</Badge>
                    )}
                    {u.id === meuId && <span className="text-[11px] font-bold text-slate-400">(você)</span>}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {u.email}
                    {u.jobTitle ? ` · ${u.jobTitle}` : ""}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {u.permissions?.length || 0} área(s) liberada(s)
                    {u.queues?.length ? ` · filas: ${u.queues.map((q: any) => q.name).join(", ")}` : " · sem fila atribuída"}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => abrirEdicao(u)} className="rounded-xl" title="Editar">
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => novaSenha(u)} className="rounded-xl" title="Definir nova senha">
                    <KeyRound className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm" variant="ghost" onClick={() => alternarAtivo(u)} className="rounded-xl"
                    title={u.active === false ? "Reativar acesso" : "Desativar acesso"}
                  >
                    <Power className={`w-4 h-4 ${u.active === false ? "text-emerald-500" : "text-amber-500"}`} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remover(u)} className="rounded-xl text-red-500" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-bold">
              {editando ? `Editar ${editando.name}` : "Novo colaborador"}
            </DialogTitle>
            <DialogDescription>
              O perfil define o acesso padrão da função. Depois dá para liberar ou esconder áreas uma a uma.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="rounded-2xl bg-slate-50 border-none font-medium" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">Cargo (opcional)</Label>
                <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  placeholder="Ex.: Atendente do turno da manhã"
                  className="rounded-2xl bg-slate-50 border-none font-medium" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">E-mail (login)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="rounded-2xl bg-slate-50 border-none font-medium" />
              </div>
              {!editando && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">Senha inicial</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="mínimo 8 caracteres"
                    className="rounded-2xl bg-slate-50 border-none font-medium" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Perfil de acesso</Label>
              <Select value={form.role} onValueChange={trocarPerfil}>
                <SelectTrigger className="rounded-2xl bg-slate-50 border-none font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {catalogo.profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="font-bold">{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {perfil(form.role)?.hint && (
                <p className="text-[11px] text-slate-400 font-medium">{perfil(form.role).hint}</p>
              )}
            </div>

            {editando && (
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-bold text-slate-700">Acesso ativo</p>
                  <p className="text-[11px] text-slate-400">Desativado, o colaborador não consegue entrar na plataforma.</p>
                </div>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-xs font-bold text-slate-500">Áreas que este colaborador enxerga</Label>
              {grupos.map((grupo) => (
                <div key={grupo} className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-slate-400">{grupo}</p>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {catalogo.modules.filter((m) => m.grupo === grupo).map((m) => (
                      <label key={m.id}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-colors ${
                          form.permissions.includes(m.id) ? "bg-blue-50" : "bg-slate-50 hover:bg-slate-100"
                        }`}
                      >
                        <span className="text-xs font-medium text-slate-600">{m.label}</span>
                        <Switch checked={form.permissions.includes(m.id)} onCheckedChange={() => alternarModulo(m.id)} />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                O bloqueio vale também na API: esconder a área impede o acesso, não só o menu.
              </p>
            </div>

            {queues.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">Filas de atendimento</Label>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {queues.map((q) => (
                    <label key={q.id}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-colors ${
                        form.queueIds.includes(q.id) ? "bg-blue-50" : "bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-xs font-medium text-slate-600">{q.name}</span>
                      <Switch checked={form.queueIds.includes(q.id)} onCheckedChange={() => alternarFila(q.id)} />
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  O atendente vê no inbox as conversas das filas em que está cadastrado.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={salvar} disabled={salvando} className="rounded-2xl font-bold bg-[#2563EB]">
              <Save className="w-4 h-4 mr-2" /> {salvando ? "Salvando…" : "Salvar colaborador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
