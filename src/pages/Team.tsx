import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Save, KeyRound, Power, Trash2, ShieldCheck, Info, MoreVertical, Check, X } from "lucide-react";

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

  // Cor do perfil: proprietário e administrador se distinguem à primeira
  // vista porque são os que mexem em cobrança e em acesso.
  const CORES: Record<string, string> = {
    OWNER: "bg-accent-soft text-accent-text",
    ADMIN: "bg-violet-100 text-violet-700",
  };
  const corPerfil = (id: string) => CORES[id] || "bg-surface-2 text-muted-foreground";

  const perfis = catalogo.profiles || [];
  const modulos = catalogo.modules || [];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1240px] px-4 pb-10 pt-5 sm:px-6">

        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Colaboradores</h1>
            <p className="mt-0.5 max-w-lg text-[13.5px] text-muted-foreground">
              Quem tem acesso à conta, com qual perfil e o que cada um enxerga.
            </p>
          </div>
          <Button onClick={abrirNovo} className="h-10 gap-2"><Plus className="h-4 w-4" /> Novo colaborador</Button>
        </header>

        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : users.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-[14px] border border-border bg-card px-6 py-20 text-center shadow-card">
            <Users className="h-8 w-8 text-border-soft" />
            <p className="text-[14px] font-semibold text-foreground">Nenhum colaborador ainda</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[2fr_1.2fr_1fr_1.1fr_40px] gap-3 border-b border-border bg-surface-2 px-4 py-2.5">
                  {["Pessoa", "Perfil", "Estado", "Filas", ""].map((h, i) => (
                    <span key={i} className="linha-unica text-[11px] font-semibold uppercase tracking-wide text-faint">{h}</span>
                  ))}
                </div>
                {users.map((u) => (
                  <div
                    key={u.id}
                    className={`grid grid-cols-[2fr_1.2fr_1fr_1.1fr_40px] items-center gap-3 border-b border-border-soft px-4 py-3 last:border-0 hover:bg-surface-2 ${
                      u.active === false ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-bold text-accent-text">
                        {(u.name || "?").substring(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="linha-unica-elipse text-[13px] font-semibold text-foreground">
                          {u.name}
                          {u.id === meuId && <span className="ml-1.5 font-normal text-faint">(você)</span>}
                        </p>
                        <p className="linha-unica-elipse text-[11.5px] text-faint">{u.email}</p>
                      </div>
                    </div>

                    <span className={`linha-unica flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${corPerfil(u.role)}`}>
                      {u.isAdmin && <ShieldCheck className="h-3 w-3" />}
                      {u.profileLabel}
                    </span>

                    <span className="linha-unica flex items-center gap-1.5 text-[12.5px]">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${
                        u.active === false ? "bg-rose-500" : u.emailVerified === false ? "bg-amber-500" : "bg-emerald-500"
                      }`} />
                      <span className={u.active === false ? "text-rose-600" : u.emailVerified === false ? "text-amber-700" : "text-muted-foreground"}>
                        {u.active === false ? "Desativado" : u.emailVerified === false ? "Convite pendente" : "Ativo"}
                      </span>
                    </span>

                    <span className="linha-unica-elipse text-[12.5px] text-muted-foreground">
                      {u.queues?.length ? u.queues.map((q: any) => q.name).join(", ") : <span className="text-faint">Sem fila</span>}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-card hover:text-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
                        <DropdownMenuItem className="cursor-pointer rounded-lg text-[12px] font-medium" onClick={() => abrirEdicao(u)}>
                          <Save className="mr-2 h-4 w-4 text-accent-text" /> Editar acesso
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer rounded-lg text-[12px] font-medium" onClick={() => novaSenha(u)}>
                          <KeyRound className="mr-2 h-4 w-4 text-accent-text" /> Definir nova senha
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer rounded-lg text-[12px] font-medium" onClick={() => alternarAtivo(u)}>
                          <Power className={`mr-2 h-4 w-4 ${u.active === false ? "text-emerald-600" : "text-amber-600"}`} />
                          {u.active === false ? "Reativar acesso" : "Desativar acesso"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer rounded-lg text-[12px] font-medium text-red-600 focus:text-red-600"
                          onClick={() => remover(u)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Matriz de permissões: o que cada perfil enxerga, lado a lado. */}
        {!loading && perfis.length > 0 && modulos.length > 0 && (
          <section className="mt-4 overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
            <header className="border-b border-border px-5 py-3.5">
              <h2 className="text-[14px] font-semibold text-foreground">O que cada perfil enxerga</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                É o padrão da função. Ao editar uma pessoa dá para liberar ou esconder áreas uma a uma.
              </p>
            </header>
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div
                  className="grid gap-3 border-b border-border bg-surface-2 px-5 py-2.5"
                  style={{ gridTemplateColumns: `1.6fr repeat(${perfis.length}, 1fr)` }}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">Área</span>
                  {perfis.map((p: any) => (
                    <span key={p.id} className="linha-unica text-center text-[11px] font-semibold uppercase tracking-wide text-faint">
                      {p.label}
                    </span>
                  ))}
                </div>
                {modulos.map((m: any) => (
                  <div
                    key={m.id}
                    className="grid items-center gap-3 border-b border-border-soft px-5 py-2.5 last:border-0"
                    style={{ gridTemplateColumns: `1.6fr repeat(${perfis.length}, 1fr)` }}
                  >
                    <span className="linha-unica-elipse text-[12.5px] text-foreground">{m.label}</span>
                    {perfis.map((p: any) => {
                      const tem = (p.modules || []).includes(m.id);
                      return (
                        <span key={p.id} className="grid place-items-center">
                          {tem
                            ? <Check className="h-4 w-4 text-[#15803D]" strokeWidth={3} />
                            : <X className="h-4 w-4 text-[#CBD5E1]" strokeWidth={3} />}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

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
