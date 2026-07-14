import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Clock, Stethoscope, UserRound, ShieldCheck, HelpCircle, Plus, Pencil, Trash2, Save, Loader2 } from "lucide-react";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function authHeaders() {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export default function MinhaClinica() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState<any>({ clinicAbout: "", clinicAddress: "", clinicPayment: "", clinicExtraInfo: "" });
  const [hours, setHours] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [insurances, setInsurances] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clinic", { headers: authHeaders() });
      const d = await res.json();
      setProfile(d.profile || {});
      // normaliza os 7 dias
      const byDay = new Map((d.businessHours || []).map((h: any) => [h.weekday, h]));
      setHours(WEEKDAYS.map((_, wd) => byDay.get(wd) || { weekday: wd, openTime: "", closeTime: "", isClosed: wd === 0 }));
      setProfessionals(d.professionals || []);
      setServices(d.services || []);
      setInsurances(d.insurances || []);
      setFaqs(d.faqs || []);
    } catch (e) {
      toast({ title: "Erro ao carregar dados da clínica", variant: "destructive" });
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await fetch("/api/clinic/profile", { method: "PUT", headers: authHeaders(), body: JSON.stringify(profile) });
      await fetch("/api/clinic/hours", { method: "PUT", headers: authHeaders(), body: JSON.stringify({ hours }) });
      toast({ title: "Informações salvas", description: "O agente já vai usar esses dados nas respostas." });
    } catch (e) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSavingProfile(false);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
        <PageHeader
          icon={<Building2 className="w-5 h-5" />}
          title="Minha Clínica"
          subtitle="Tudo que o assistente de IA precisa saber para responder seus pacientes com precisão."
        />

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        ) : (
          <Tabs defaultValue="info" className="space-y-6">
            <TabsList className="bg-muted p-1 rounded-xl inline-flex h-11 w-full md:w-auto overflow-x-auto scrollbar-thin">
              <TabsTrigger value="info" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"><Clock className="w-4 h-4 mr-2" />Informações</TabsTrigger>
              <TabsTrigger value="services" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"><Stethoscope className="w-4 h-4 mr-2" />Serviços</TabsTrigger>
              <TabsTrigger value="pros" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"><UserRound className="w-4 h-4 mr-2" />Profissionais</TabsTrigger>
              <TabsTrigger value="ins" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"><ShieldCheck className="w-4 h-4 mr-2" />Convênios</TabsTrigger>
              <TabsTrigger value="faq" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"><HelpCircle className="w-4 h-4 mr-2" />FAQ</TabsTrigger>
            </TabsList>

            {/* INFORMAÇÕES + HORÁRIOS */}
            <TabsContent value="info" className="space-y-6">
              <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Sobre a clínica</h2>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Apresentação</Label>
                  <Textarea rows={3} value={profile.clinicAbout || ""} onChange={e => setProfile({ ...profile, clinicAbout: e.target.value })} placeholder="Ex.: Clínica odontológica com 15 anos de atuação, especializada em..." />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Endereço</Label>
                    <Input value={profile.clinicAddress || ""} onChange={e => setProfile({ ...profile, clinicAddress: e.target.value })} placeholder="Rua, número, bairro, cidade" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Formas de pagamento</Label>
                    <Input value={profile.clinicPayment || ""} onChange={e => setProfile({ ...profile, clinicPayment: e.target.value })} placeholder="Dinheiro, Pix, cartão em até 6x" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Outras informações (estacionamento, acessibilidade, orientações)</Label>
                  <Textarea rows={2} value={profile.clinicExtraInfo || ""} onChange={e => setProfile({ ...profile, clinicExtraInfo: e.target.value })} />
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Horário de atendimento</h2>
                <div className="space-y-2">
                  {hours.map((h, i) => (
                    <div key={h.weekday} className="flex items-center gap-3">
                      <span className="w-20 text-sm text-foreground">{WEEKDAYS[h.weekday]}</span>
                      <Switch checked={!h.isClosed} onCheckedChange={v => { const n = [...hours]; n[i] = { ...h, isClosed: !v }; setHours(n); }} />
                      {h.isClosed ? (
                        <span className="text-sm text-muted-foreground">Fechado</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input type="time" className="w-28" value={h.openTime || ""} onChange={e => { const n = [...hours]; n[i] = { ...h, openTime: e.target.value }; setHours(n); }} />
                          <span className="text-muted-foreground text-sm">às</span>
                          <Input type="time" className="w-28" value={h.closeTime || ""} onChange={e => { const n = [...hours]; n[i] = { ...h, closeTime: e.target.value }; setHours(n); }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={savingProfile} className="gap-2">
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar informações
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="services">
              <CrudList
                endpoint="/api/clinic/services" items={services} reload={load}
                emptyIcon={<Stethoscope className="w-6 h-6" />} emptyTitle="Nenhum serviço cadastrado"
                emptyDesc="Cadastre procedimentos com preço e duração para o agente informar corretamente."
                addLabel="Novo serviço"
                fields={[
                  { key: "name", label: "Nome", required: true },
                  { key: "price", label: "Preço (R$)", type: "number", hint: "deixe vazio para 'sob consulta'" },
                  { key: "durationMin", label: "Duração (min)", type: "number" },
                  { key: "description", label: "Descrição", type: "textarea" },
                  { key: "prep", label: "Preparo necessário", type: "textarea" },
                ]}
                render={(s) => (
                  <>
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.price != null ? `R$ ${Number(s.price).toFixed(2)}` : "Sob consulta"}{s.durationMin ? ` · ${s.durationMin}min` : ""}</p>
                  </>
                )}
              />
            </TabsContent>

            <TabsContent value="pros">
              <CrudList
                endpoint="/api/clinic/professionals" items={professionals} reload={load}
                emptyIcon={<UserRound className="w-6 h-6" />} emptyTitle="Nenhum profissional cadastrado"
                emptyDesc="Adicione os profissionais para o agente informar quem atende cada especialidade."
                addLabel="Novo profissional"
                fields={[
                  { key: "name", label: "Nome", required: true },
                  { key: "specialty", label: "Especialidade" },
                  { key: "registration", label: "Registro (CRM/CRO)" },
                  { key: "bio", label: "Sobre / diferenciais", type: "textarea" },
                ]}
                render={(p) => (
                  <>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{[p.specialty, p.registration].filter(Boolean).join(" · ")}</p>
                  </>
                )}
              />
            </TabsContent>

            <TabsContent value="ins">
              <CrudList
                endpoint="/api/clinic/insurances" items={insurances} reload={load}
                emptyIcon={<ShieldCheck className="w-6 h-6" />} emptyTitle="Nenhum convênio cadastrado"
                emptyDesc="Liste os convênios aceitos para o agente responder sobre cobertura."
                addLabel="Novo convênio"
                fields={[
                  { key: "name", label: "Nome do convênio", required: true },
                  { key: "notes", label: "Observações (carência, cobertura)", type: "textarea" },
                ]}
                render={(x) => (
                  <>
                    <p className="text-sm font-medium text-foreground">{x.name}</p>
                    {x.notes && <p className="text-xs text-muted-foreground">{x.notes}</p>}
                  </>
                )}
              />
            </TabsContent>

            <TabsContent value="faq">
              <CrudList
                endpoint="/api/clinic/faqs" items={faqs} reload={load}
                emptyIcon={<HelpCircle className="w-6 h-6" />} emptyTitle="Nenhuma pergunta cadastrada"
                emptyDesc="Cadastre dúvidas comuns dos pacientes com a resposta oficial da clínica."
                addLabel="Nova pergunta"
                fields={[
                  { key: "question", label: "Pergunta", required: true },
                  { key: "answer", label: "Resposta", type: "textarea", required: true },
                ]}
                render={(f) => (
                  <>
                    <p className="text-sm font-medium text-foreground">{f.question}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{f.answer}</p>
                  </>
                )}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}

// ── Editor de lista genérico (add/edit/delete) ────────────────────
interface Field { key: string; label: string; type?: "text" | "number" | "textarea"; required?: boolean; hint?: string }
function CrudList({ endpoint, items, reload, fields, render, addLabel, emptyIcon, emptyTitle, emptyDesc }: {
  endpoint: string; items: any[]; reload: () => void; fields: Field[]; render: (item: any) => React.ReactNode;
  addLabel: string; emptyIcon: React.ReactNode; emptyTitle: string; emptyDesc: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setForm({}); setOpen(true); };
  const openEdit = (item: any) => { setEditing(item); setForm({ ...item }); setOpen(true); };

  const save = async () => {
    for (const f of fields) if (f.required && !form[f.key]) return toast({ title: `Preencha: ${f.label}`, variant: "destructive" });
    setSaving(true);
    try {
      const payload = { ...form };
      fields.forEach(f => { if (f.type === "number") payload[f.key] = payload[f.key] === "" || payload[f.key] == null ? null : Number(payload[f.key]); });
      const url = editing ? `${endpoint}/${editing.id}` : endpoint;
      await fetch(url, { method: editing ? "PUT" : "POST", headers: authHeaders(), body: JSON.stringify(payload) });
      setOpen(false); reload();
      toast({ title: editing ? "Atualizado" : "Adicionado" });
    } catch (e) { toast({ title: "Erro ao salvar", variant: "destructive" }); }
    setSaving(false);
  };

  const remove = async (item: any) => {
    if (!confirm("Remover este item?")) return;
    await fetch(`${endpoint}/${item.id}`, { method: "DELETE", headers: authHeaders() });
    reload();
  };

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{items.length} cadastrado(s)</h2>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1.5" /> {addLabel}</Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDesc} action={{ label: addLabel, onClick: openNew }} />
      ) : (
        <ul className="divide-y divide-border">
          {items.map(item => (
            <li key={item.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">{render(item)}</div>
              <button onClick={() => openEdit(item)} className="p-2 rounded-lg text-muted-foreground hover:bg-muted"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(item)} className="p-2 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar" : addLabel}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {fields.map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{f.label}{f.required ? " *" : ""}</Label>
                {f.type === "textarea" ? (
                  <Textarea rows={3} value={form[f.key] ?? ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                ) : (
                  <Input type={f.type === "number" ? "number" : "text"} value={form[f.key] ?? ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                )}
                {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
