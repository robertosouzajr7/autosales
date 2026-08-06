import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Inbox, Plus, Pencil, Save, Trash2, Users, Star, Info } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Filas de atendimento: por onde a conversa espera até alguém assumir.
 *
 * O modelo e as rotas já existiam — a IA transfere para a fila padrão e o
 * inbox filtra por fila —, mas não havia por onde criar uma. Sem fila
 * cadastrada, a lista de filas no cadastro do colaborador nem aparecia, e
 * tudo caía num balaio único.
 */

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

// Cores que se distinguem no selo da conversa, não uma paleta livre: fila é
// para bater o olho e saber de quem é.
const CORES = ["#2563EB", "#7C3AED", "#22A06B", "#F59E0B", "#E11D48", "#0891B2"];

const VAZIA = { id: "", name: "", description: "", color: CORES[0], userIds: [] as string[], active: true, isDefault: false };

export default function Filas() {
  const { toast } = useToast();
  const [filas, setFilas] = useState<any[]>([]);
  const [pessoas, setPessoas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...VAZIA });
  const [editando, setEditando] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const [fRes, pRes] = await Promise.all([
        fetch("/api/queues", { headers: auth() }),
        fetch("/api/attendance/agents", { headers: auth() }),
      ]);
      if (!fRes.ok) {
        const d = await fRes.json().catch(() => ({}));
        throw new Error(d.error || "Sem acesso às filas de atendimento.");
      }
      setFilas(await fRes.json());
      setPessoas(pRes.ok ? await pRes.json() : []);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const abrirNova = () => {
    setEditando(null);
    setForm({ ...VAZIA, color: CORES[filas.length % CORES.length] });
    setModalOpen(true);
  };

  const abrirEdicao = (f: any) => {
    setEditando(f);
    setForm({
      id: f.id, name: f.name, description: f.description || "", color: f.color || CORES[0],
      userIds: (f.membros || []).map((m: any) => m.id), active: f.active !== false, isDefault: !!f.isDefault,
    });
    setModalOpen(true);
  };

  const alternarPessoa = (id: string) =>
    setForm((f) => ({
      ...f,
      userIds: f.userIds.includes(id) ? f.userIds.filter((u) => u !== id) : [...f.userIds, id],
    }));

  const salvar = async () => {
    if (!form.name.trim()) return toast({ title: "Dê um nome à fila.", variant: "destructive" });
    setSalvando(true);
    const corpo = {
      name: form.name, description: form.description, color: form.color,
      userIds: form.userIds, active: form.active, isDefault: form.isDefault,
    };
    const res = await fetch(editando ? `/api/queues/${editando.id}` : "/api/queues", {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify(corpo),
    });
    const d = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) return toast({ title: d.error || "Não foi possível salvar.", variant: "destructive" });
    toast({ title: editando ? "Fila atualizada" : "Fila criada" });
    setModalOpen(false);
    carregar();
  };

  const remover = async (f: any) => {
    if (!confirm(`Remover a fila "${f.name}"?\n\nOs colaboradores continuam na conta; só o vínculo com esta fila é desfeito.`)) return;
    const res = await fetch(`/api/queues/${f.id}`, { method: "DELETE", headers: auth() });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast({ title: d.error || "Não foi possível remover.", variant: "destructive" });
    toast({ title: "Fila removida" });
    carregar();
  };

  const aguardandoTotal = filas.reduce((s, f) => s + (f.aguardando || 0), 0);
  const semAtendente = filas.filter((f) => f.active !== false && !(f.membros || []).length);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1240px] px-4 pb-10 pt-5 sm:px-6">

        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Filas de atendimento</h1>
            <p className="mt-0.5 max-w-lg text-[13.5px] text-muted-foreground">
              Para onde a conversa vai quando sai da IA, e quem atende cada uma.
            </p>
          </div>
          <Button onClick={abrirNova} className="h-10 gap-2"><Plus className="h-4 w-4" /> Nova fila</Button>
        </header>

        {!loading && filas.length > 0 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Resumo rotulo="Filas ativas" valor={filas.filter((f) => f.active !== false).length} />
            <Resumo rotulo="Esperando agora" valor={aguardandoTotal} alerta={aguardandoTotal > 0} />
            <Resumo rotulo="Sem ninguém para atender" valor={semAtendente.length} alerta={semAtendente.length > 0} />
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
        ) : filas.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-[14px] border border-border bg-card px-6 py-20 text-center shadow-card">
            <Inbox className="h-8 w-8 text-border-soft" />
            <div>
              <p className="text-[14px] font-semibold text-foreground">Nenhuma fila cadastrada</p>
              <p className="mx-auto mt-1 max-w-md text-[12.5px] text-muted-foreground">
                Sem fila, tudo que a IA transfere cai num balaio só. Crie uma por frente de
                atendimento — Recepção, Financeiro, Pós-venda — e diga quem atende cada uma.
              </p>
            </div>
            <Button onClick={abrirNova} className="mt-1 h-10 gap-2"><Plus className="h-4 w-4" /> Criar a primeira fila</Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filas.map((f) => (
              <div
                key={f.id}
                className={`flex flex-wrap items-center gap-4 rounded-[14px] border border-border bg-card px-4 py-3.5 shadow-card ${
                  f.active === false ? "opacity-60" : ""
                }`}
              >
                <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: f.color || CORES[0] }} />

                <div className="min-w-[180px] flex-1">
                  <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
                    {f.name}
                    {f.isDefault && (
                      <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent-text">
                        <Star className="h-2.5 w-2.5 fill-current" /> padrão
                      </span>
                    )}
                    {f.active === false && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-faint">inativa</span>
                    )}
                  </p>
                  <p className="linha-unica-elipse text-[12px] text-muted-foreground">
                    {f.description || "Sem descrição"}
                  </p>
                </div>

                <div className="min-w-[200px] flex-1">
                  {(f.membros || []).length ? (
                    <div className="flex flex-wrap gap-1">
                      {f.membros.map((m: any) => (
                        <span key={m.id} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-muted-foreground">
                          {m.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[12px] font-medium text-amber-700">
                      <Info className="h-3.5 w-3.5" /> ninguém atende esta fila
                    </span>
                  )}
                </div>

                <div className="w-[110px] text-right">
                  <p className={`text-[18px] font-bold tabular-nums ${f.aguardando ? "text-amber-600" : "text-faint"}`}>
                    {f.aguardando || 0}
                  </p>
                  <p className="text-[10.5px] uppercase tracking-wide text-faint">esperando</p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => abrirEdicao(f)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-foreground"
                    title="Editar fila"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remover(f)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-rose-50 hover:text-rose-600"
                    title="Remover fila"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {filas.length > 0 && (
          <p className="mt-4 text-[12px] text-muted-foreground">
            Um colaborador pode atender mais de uma fila. O vínculo também pode ser feito pelo{" "}
            <Link to="/equipe" className="font-medium text-accent-text hover:underline">cadastro do colaborador</Link>.
          </p>
        )}
      </div>

      {/* ── CADASTRO / EDIÇÃO ────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? `Editar ${editando.name}` : "Nova fila"}</DialogTitle>
            <DialogDescription>
              A conversa entra na fila quando sai da IA e espera até alguém da fila assumir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Recepção"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Descrição</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="O que cai nesta fila. Ajuda quem vai transferir a escolher certo."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Cor</Label>
              <div className="flex gap-2">
                {CORES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-7 w-7 rounded-full transition-transform ${form.color === c ? "scale-110 ring-2 ring-offset-2 ring-foreground/30" : ""}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Quem atende
              </Label>
              {pessoas.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted-foreground">
                  Nenhum colaborador cadastrado ainda.
                </p>
              ) : (
                <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  {pessoas.map((p) => (
                    <label
                      key={p.id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors ${
                        form.userIds.includes(p.id) ? "bg-accent-soft" : "bg-surface-2 hover:bg-border-soft"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="linha-unica-elipse block text-[13px] font-medium text-foreground">{p.name}</span>
                        <span className="linha-unica-elipse block text-[11px] text-faint">{p.email}</span>
                      </span>
                      <Switch checked={form.userIds.includes(p.id)} onCheckedChange={() => alternarPessoa(p.id)} />
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-faint">Cada pessoa pode atender quantas filas precisar.</p>
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-[13px] font-medium text-foreground">Fila padrão</span>
                  <span className="block text-[11px] text-faint">É para cá que a IA transfere quando não sabe a fila certa.</span>
                </span>
                <Switch checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-[13px] font-medium text-foreground">Ativa</span>
                  <span className="block text-[11px] text-faint">Fila inativa não recebe conversa nova.</span>
                </span>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando} className="gap-2">
              <Save className="h-4 w-4" /> {salvando ? "Salvando…" : "Salvar fila"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Resumo({ rotulo, valor, alerta = false }: { rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className="rounded-[14px] border border-border bg-card px-4 py-3 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{rotulo}</p>
      <p className={`mt-0.5 text-[24px] font-bold tabular-nums ${alerta ? "text-amber-600" : "text-foreground"}`}>{valor}</p>
    </div>
  );
}
