import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users, Plus, Search, Upload, Download, Trash2, Pencil, Eye,
  MoreHorizontal, Phone, Mail, Tag, X, MessageSquare, Calendar,
  Filter, RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  source?: string;
  tags?: string;
  notes?: string;
  createdAt: string;
  conversations?: { id: string; botActive: boolean }[];
  appointments?: { id: string; title: string; date: string }[];
}

const STATUS_OPTIONS = ["NEW", "QUALIFYING", "APPOINTMENT", "CONVERTED", "LOST"];
const SOURCE_OPTIONS = ["WhatsApp", "Instagram", "Facebook", "Site", "Indicação", "Outro"];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NEW: { label: "Novo", color: "bg-slate-100 text-slate-700 border-slate-200" },
  QUALIFYING: { label: "Qualificando", color: "bg-blue-100 text-blue-700 border-blue-200" },
  APPOINTMENT: { label: "Agendado", color: "bg-violet-100 text-violet-700 border-violet-200" },
  CONVERTED: { label: "Convertido", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  LOST: { label: "Perdido", color: "bg-red-100 text-red-700 border-red-200" },
};

// ─── Tag Input ────────────────────────────────────────────────
function TagChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [input, setInput] = useState("");
  const tags = value ? value.split(",").map(t => t.trim()).filter(Boolean) : [];
  const add = () => { if (!input.trim()) return; onChange([...tags, input.trim()].join(", ")); setInput(""); };
  const remove = (i: number) => onChange(tags.filter((_, idx) => idx !== i).join(", "));
  return (
    <div className="space-y-2">
      <div className="min-h-[40px] flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2">
        {tags.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {t}<button onClick={() => remove(i)}><X className="h-2.5 w-2.5" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Adicionar tag..." className="h-8 text-xs"
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())} />
        <Button type="button" size="sm" variant="outline" onClick={add} className="text-xs h-8">+ Tag</Button>
      </div>
    </div>
  );
}

// ─── Contact Form Dialog ───────────────────────────────────────
function ContactDialog({
  open, onClose, initial, onSaved,
}: {
  open: boolean; onClose: () => void; initial?: Contact | null; onSaved: (c: Contact) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", source: "WhatsApp", status: "NEW", tags: "", notes: "",
  });

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || "", phone: initial.phone || "", email: initial.email || "",
        source: initial.source || "WhatsApp", status: initial.status || "NEW",
        tags: initial.tags || "", notes: initial.notes || "",
      });
    } else {
      setForm({ name: "", phone: "", email: "", source: "WhatsApp", status: "NEW", tags: "", notes: "" });
    }
  }, [initial, open]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name || !form.phone) return toast({ title: "Nome e Telefone são obrigatórios", variant: "destructive" });
    setSaving(true);
    try {
      const url = initial ? `/api/contacts/${initial.id}` : "/api/contacts";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error("Erro ao salvar");
      const saved = await res.json();
      onSaved(saved);
      toast({ title: initial ? "Contato atualizado!" : "Contato criado!" });
      onClose();
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Contato" : "Novo Contato"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Nome *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="João Silva" /></div>
            <div className="space-y-1"><Label>Telefone *</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="5511999999999" /></div>
          </div>
          <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="joao@email.com" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Origem</Label>
              <Select value={form.source} onValueChange={v => set("source", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Tags</Label><TagChips value={form.tags} onChange={v => set("tags", v)} /></div>
          <div className="space-y-1"><Label>Notas Internas</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Anotações sobre o contato..." className="h-24 resize-none text-sm" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contact Detail Sheet ──────────────────────────────────────
function ContactDetail({ contact, onClose, onEdit }: { contact: Contact | null; onClose: () => void; onEdit: () => void }) {
  if (!contact) return null;
  const cfg = STATUS_CONFIG[contact.status];
  const tags = contact.tags ? contact.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
  return (
    <Dialog open={!!contact} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10"><AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">{contact.name.substring(0,2).toUpperCase()}</AvatarFallback></Avatar>
            <div>
              <p className="font-bold text-slate-900">{contact.name}</p>
              <Badge className={`text-[10px] border ${cfg?.color}`}>{cfg?.label}</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-slate-600"><Phone className="h-3.5 w-3.5 text-slate-400" />{contact.phone}</div>
            {contact.email && <div className="flex items-center gap-2 text-slate-600"><Mail className="h-3.5 w-3.5 text-slate-400" />{contact.email}</div>}
          </div>
          {contact.source && <div className="text-xs text-slate-500">Origem: <span className="font-medium text-slate-700">{contact.source}</span></div>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"><Tag className="h-2.5 w-2.5"/>{t}</span>)}
            </div>
          )}
          {contact.notes && <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">{contact.notes}</div>}
          {(contact.conversations?.length ?? 0) > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversas</p>
              <div className="flex items-center gap-2 text-sm"><MessageSquare className="h-4 w-4 text-slate-400" />{contact.conversations?.length} conversa(s)</div>
            </div>
          )}
          {(contact.appointments?.length ?? 0) > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Agendamentos</p>
              {contact.appointments?.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400" />{a.title} — {new Date(a.date).toLocaleDateString("pt-BR")}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={onEdit} className="gap-2"><Pencil className="h-3.5 w-3.5" />Editar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Import Modal ──────────────────────────────────────────────
function ImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const { toast } = useToast();
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);

  const doImport = async () => {
    setImporting(true);
    try {
      const lines = csv.trim().split("\n").filter(Boolean);
      const contacts = lines.map(line => {
        const [name, phone, email, source, tags] = line.split(",").map(s => s.trim());
        return { name, phone, email, source, tags };
      }).filter(c => c.name && c.phone);
      const res = await fetch("/api/contacts/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacts }) });
      const data = await res.json();
      toast({ title: `Importação concluída!`, description: `${data.created} de ${data.total} contatos criados.` });
      onImported();
      onClose();
    } catch { toast({ title: "Erro na importação", variant: "destructive" }); }
    setImporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Importar Contatos via CSV</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Cole abaixo uma linha por contato no formato: <code className="bg-slate-100 px-1 rounded">nome, telefone, email, origem, tags</code></p>
          <Textarea value={csv} onChange={e => setCsv(e.target.value)} placeholder={"João Silva, 5511999999999, joao@email.com, WhatsApp, cliente vip\nMaria Costa, 5511888888888, , Instagram, lead frio"} className="h-36 font-mono text-xs resize-none" />
          <p className="text-[11px] text-slate-400">Contatos com telefone já existente serão ignorados (sem duplicados).</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={doImport} disabled={importing || !csv.trim()} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            {importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export default function Contacts() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterSource !== "all") params.set("source", filterSource);
    try {
      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) setContacts(data);
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, filterStatus, filterSource]);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este contato e todos os seus dados?")) return;
    try {
      await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      setContacts(p => p.filter(c => c.id !== id));
      toast({ title: "Contato excluído." });
    } catch { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Excluir ${selected.size} contato(s)? Esta ação não pode ser desfeita.`)) return;
    for (const id of selected) {
      await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    }
    setContacts(p => p.filter(c => !selected.has(c.id)));
    setSelected(new Set());
    toast({ title: `${selected.size} contato(s) excluídos.` });
  };

  const handleExport = () => {
    const a = document.createElement("a");
    a.href = "/api/contacts/export";
    a.download = "contatos.json";
    a.click();
  };

  const openNew = () => { setEditContact(null); setDialogOpen(true); };
  const openEdit = (c: Contact) => { setEditContact(c); setDetailContact(null); setDialogOpen(true); };

  const onSaved = (c: Contact) => {
    setContacts(p => {
      const idx = p.findIndex(x => x.id === c.id);
      if (idx >= 0) { const next = [...p]; next[idx] = c; return next; }
      return [c, ...p];
    });
  };

  const toggleSelect = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size === contacts.length ? new Set() : new Set(contacts.map(c => c.id)));

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-20">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contatos</h1>
            <p className="text-sm text-slate-500 mt-0.5">Gerencie toda a sua base de contatos e leads — CDP unificado.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selected.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Excluir ({selected.size})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Importar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
            <Button size="sm" onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Novo Contato
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {STATUS_OPTIONS.map(s => {
            const count = contacts.filter(c => c.status === s).length;
            const cfg = STATUS_CONFIG[s];
            return (
              <Card key={s} className={`border cursor-pointer ${filterStatus === s ? "ring-2 ring-emerald-500" : ""}`} onClick={() => setFilterStatus(p => p === s ? "all" : s)}>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{count}</p>
                  <Badge className={`text-[10px] border ${cfg.color} mt-1`}>{cfg.label}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, telefone ou e-mail..." className="pl-9 h-9" />
          </div>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[160px] h-9"><Filter className="h-3.5 w-3.5 mr-2 text-slate-400" /><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              {SOURCE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={load} className="h-9 w-9 text-slate-400 hover:text-slate-700"><RefreshCw className="h-4 w-4" /></Button>
        </div>

        {/* Table */}
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-10"><input type="checkbox" checked={selected.size === contacts.length && contacts.length > 0} onChange={toggleAll} className="rounded" /></TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Cadastrado</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-400">Carregando...</TableCell></TableRow>
                  ) : contacts.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Users className="h-8 w-8" />
                        <p className="font-medium">Nenhum contato encontrado</p>
                        <Button size="sm" onClick={openNew} className="mt-2 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-3.5 w-3.5 mr-1" />Adicionar primeiro contato</Button>
                      </div>
                    </TableCell></TableRow>
                  ) : contacts.map(c => {
                    const cfg = STATUS_CONFIG[c.status];
                    const tags = c.tags ? c.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
                    return (
                      <TableRow key={c.id} className="hover:bg-slate-50">
                        <TableCell><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded" /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-bold">{c.name.substring(0,2).toUpperCase()}</AvatarFallback></Avatar>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                              {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{c.phone}</TableCell>
                        <TableCell><Badge className={`text-[10px] border ${cfg?.color}`}>{cfg?.label}</Badge></TableCell>
                        <TableCell className="text-xs text-slate-500">{c.source || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {tags.slice(0,2).map((t, i) => <span key={i} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{t}</span>)}
                            {tags.length > 2 && <span className="text-[10px] text-slate-400">+{tags.length - 2}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailContact(c)} className="gap-2"><Eye className="h-3.5 w-3.5" />Ver detalhes</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2"><Pencil className="h-3.5 w-3.5" />Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(c.id)} className="gap-2 text-red-600 focus:text-red-600"><Trash2 className="h-3.5 w-3.5" />Excluir</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {contacts.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                {selected.size > 0 ? `${selected.size} selecionado(s) de ${contacts.length}` : `${contacts.length} contato(s) total`}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ContactDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editContact} onSaved={onSaved} />
      <ContactDetail contact={detailContact} onClose={() => setDetailContact(null)} onEdit={() => { openEdit(detailContact!); }} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />
    </DashboardLayout>
  );
}
