import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, Search, MoreVertical, UserPlus, MessageSquare, Download, Upload,
  Save, Trash2, Edit3, X, Merge, Instagram, Globe,
} from "lucide-react";
import { DuplicatesDialog } from "@/components/contacts/DuplicatesDialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CANAL: Record<string, { label: string; cls: string; Icon: any }> = {
  WHATSAPP: { label: "WhatsApp", cls: "text-emerald-600", Icon: MessageSquare },
  INSTAGRAM: { label: "Instagram", cls: "text-pink-600", Icon: Instagram },
  SITE: { label: "Site", cls: "text-blue-600", Icon: Globe },
};
const canal = (c?: string) => CANAL[(c || "WHATSAPP").toUpperCase()] || CANAL.WHATSAPP;

/** "agora", "12 min", "3h", "5d" — quando foi a última conversa. */
function desde(iso?: string) {
  if (!iso) return "—";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d` : `${Math.floor(d / 30)} mês`;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  status?: string;
  tags?: string | null;
  notes?: string | null;
  source?: string | null;
  isToEnrich?: boolean;
  extractedData?: string | null;
  website?: string | null;
  socialLinks?: string | null;
  extraPhones?: string | null;
  extraEmails?: string | null;
  createdAt?: string;
  channel?: string;
  igUsername?: string | null;
  stage?: { id: string; name: string; color?: string | null } | null;
  conversations?: { lastMessageAt?: string | null }[];
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Lead | null>(null);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "", tags: "", notes: "", status: "NEW" });
  // A busca do header manda o termo por ?q= — assim o atalho do topo leva a
  // um resultado, em vez de só trocar de página.
  const [searchTerm, setSearchTerm] = useState(
    () => new URLSearchParams(window.location.search).get("q") || ""
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importPreview, setImportPreview] = useState<{name: string, phone: string, email?: string}[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDuplicatesOpen, setIsDuplicatesOpen] = useState(false);
  const [filtro, setFiltro] = useState("ALL");
  // Contagem de duplicados e quem tem agendamento: os dois alimentam a barra
  // de ferramentas e não vêm em /leads.
  const [duplicados, setDuplicados] = useState(0);
  const [agendados, setAgendados] = useState<string[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } : { "Content-Type": "application/json" };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [res, dupRes, apptRes] = await Promise.all([
        fetch("/api/leads", { headers: getHeaders() }),
        fetch("/api/contacts/duplicates", { headers: getHeaders() }),
        fetch("/api/appointments", { headers: getHeaders() }),
      ]);
      if (!res.ok) throw new Error("Falha ao buscar");
      const data = await res.json();
      setContacts(Array.isArray(data) ? data : []);

      // Sem permissão para essas rotas o filtro some, em vez de a página
      // inteira falhar por causa de um contador.
      const dup = dupRes.ok ? await dupRes.json().catch(() => null) : null;
      setDuplicados(Array.isArray(dup) ? dup.length : Array.isArray(dup?.grupos) ? dup.grupos.length : 0);
      const appts = apptRes.ok ? await apptRes.json().catch(() => null) : null;
      setAgendados(
        Array.isArray(appts)
          ? appts.filter((a: any) => a.status !== "CANCELLED").map((a: any) => a.leadId)
          : []
      );
    } catch (e) { toast({ title: "Erro na base", variant: "destructive" }); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateContact = async () => {
    if (!newContact.name || !newContact.phone) return toast({ title: "Dados incompletos", variant: "destructive" });
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(newContact)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // O contato pode já existir com o telefone escrito de outro jeito —
        // aí o cadastro atualiza em vez de criar uma segunda ficha.
        toast(
          data.duplicado
            ? { title: "Este contato já existia", description: "Atualizamos a ficha que já estava na base, sem duplicar." }
            : { title: "Contato salvo com sucesso!" }
        );
        setIsAddModalOpen(false);
        setNewContact({ name: "", phone: "", email: "", tags: "", notes: "", status: "NEW" });
        fetchData();
      } else {
        toast({ title: "Erro ao salvar", variant: "destructive" });
      }
    } catch (e) { toast({ title: "Falha na conexão", variant: "destructive" }); }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este contato?")) return;
    try {
      const res = await fetch(`/api/leads/${id}`, { 
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        toast({ title: "🗑️ Contato removido." });
        setSelectedContact(null);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const handleUpdateContact = async () => {
    if (!selectedContact) return;
    try {
      const res = await fetch(`/api/leads/${selectedContact.id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(selectedContact)
      });
      if (res.ok) {
        toast({ title: "✏️ Dados atualizados!" });
        setSelectedContact(null);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const handleExport = () => {
    window.open("/api/contacts/export", "_blank");
    toast({ title: "📥 Exportação Iniciada" });
  };

  const handleImportClick = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: any) => {
      const text = event.target.result;
      const lines = text.split("\n");
      const result: any[] = [];
      
      // Simples CSV Parser (Assume Nome, Telefone, Email)
      lines.forEach((line: string, idx: number) => {
        if (idx === 0 || !line.trim()) return; // Pula header ou linhas vazias
        const parts = line.split(/[,;]/);
        if (parts.length >= 2) {
          result.push({
            name: parts[0].trim(),
            phone: parts[1].trim().replace(/\D/g, ""), // Limpa fones
            email: parts[2]?.trim() || ""
          });
        }
      });
      
      setImportPreview(result);
      setIsImportModalOpen(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/contacts/import-bulk", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ 
          contacts: importPreview,
          startInactive: true // Nova flag de segurança
        })
      });
      
      if (res.ok) {
        toast({ title: "✅ Importação concluída!", description: `${importPreview.length} contatos adicionados com a IA desativada por segurança.` });
        setIsImportModalOpen(false);
        setImportPreview([]);
        fetchData();
      }
    } catch (e) {
      toast({ title: "Erro ao importar", variant: "destructive" });
    }
    setLoading(false);
  };

  /** Marca ou desmarca exatamente o que está visível — não a base inteira. */
  const handleSelectAll = () => {
    const visiveis = filtrados.map((c) => c.id);
    const todosJaMarcados = visiveis.length > 0 && visiveis.every((id) => selectedIds.has(id));
    setSelectedIds(todosJaMarcados ? new Set() : new Set(visiveis));
  };

  const toggleSelect = (id: string, e: any) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkEnrich = async () => {
    if (!confirm(`🚀 Iniciar investigação profunda (BDR) para ${selectedIds.size} contatos selecionados?`)) return;
    try {
      const res = await fetch("/api/leads/bulk-enrich", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      if (res.ok) {
        toast({ 
          title: "🚀 Investigação Iniciada!", 
          description: "O robô BDR começou a caçar dados profundos sobre os decisores." 
        });
        setSelectedIds(new Set());
        fetchData();
      }
    } catch (e) { toast({ title: "Erro no enriquecimento", variant: "destructive" }); }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Excluir ${selectedIds.size} contatos selecionados?`)) return;
    try {
      const res = await fetch("/api/contacts/bulk-delete", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      if (res.ok) {
        toast({ title: "🗑️ Deleção em massa concluída" });
        setSelectedIds(new Set());
        fetchData();
      }
    } catch (e) { toast({ title: "Erro na deleção", variant: "destructive" }); }
  };

  const comAgendamento = new Set(agendados);

  const filtrados = contacts.filter((c) => {
    if (filtro === "WHATSAPP" && (c.channel || "WHATSAPP").toUpperCase() !== "WHATSAPP") return false;
    if (filtro === "INSTAGRAM" && (c.channel || "").toUpperCase() !== "INSTAGRAM") return false;
    if (filtro === "AGENDADO" && !comAgendamento.has(c.id)) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      if (!`${c.name || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const todosMarcados = filtrados.length > 0 && filtrados.every((c) => selectedIds.has(c.id));

  const CHIPS = [
    { id: "ALL", rotulo: "Todos" },
    { id: "WHATSAPP", rotulo: "WhatsApp" },
    { id: "INSTAGRAM", rotulo: "Instagram" },
    { id: "AGENDADO", rotulo: "Com agendamento" },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1500px] px-4 pb-10 pt-5 sm:px-6">

        {/* Cabeçalho */}
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Clientes</h1>
            <p className="mt-0.5 max-w-md text-[13.5px] text-muted-foreground">
              <span className="num">{contacts.length.toLocaleString("pt-BR")}</span>{" "}
              {contacts.length === 1 ? "contato" : "contatos"} · o mesmo cliente em canais diferentes vira uma ficha só.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <input type="file" id="csv-import" accept=".csv,text/csv" className="hidden" onChange={handleImportClick} />
            <Button variant="outline" onClick={() => document.getElementById("csv-import")?.click()} className="h-10 gap-2">
              <Upload className="h-4 w-4" /> Importar CSV
            </Button>
            <Button variant="outline" onClick={handleExport} className="h-10 gap-2" title="Exportar CSV">
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button variant="outline" onClick={() => setIsDuplicatesOpen(true)} className="h-10 gap-2">
              <Merge className="h-4 w-4" /> Ver duplicados
              {/* O número em laranja: é uma pendência, não um enfeite. */}
              {duplicados > 0 && <span className="num font-bold text-amber-600">· {duplicados}</span>}
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)} className="h-10 gap-2">
              <UserPlus className="h-4 w-4" /> Novo cliente
            </Button>
          </div>
        </header>

        {/* Barra de ferramentas */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-border bg-card px-3 py-2.5 shadow-card">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Escreva o nome para filtrar…"
              className="h-9 w-[240px] rounded-lg border-border-soft bg-surface-2 pl-9 text-[13px]"
            />
          </div>
          {CHIPS.map((c) => (
            <button
              key={c.id}
              onClick={() => setFiltro(c.id)}
              className={`h-9 rounded-lg border px-3 text-[12.5px] font-semibold transition-colors ${
                filtro === c.id
                  ? "border-accent-text/30 bg-accent-soft text-accent-text"
                  : "border-border-soft bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.rotulo}
            </button>
          ))}
          <span className="num ml-auto text-[12px] text-faint">
            Mostrando {filtrados.length.toLocaleString("pt-BR")} de {contacts.length.toLocaleString("pt-BR")}
          </span>
        </div>

        {/* Ações em massa: só aparecem quando há seleção. */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-accent-text/30 bg-accent-soft px-4 py-2.5">
            <span className="num text-[13px] font-semibold text-accent-text">
              {selectedIds.size} {selectedIds.size === 1 ? "selecionado" : "selecionados"}
            </span>
            <Button variant="outline" size="sm" onClick={handleBulkEnrich} className="ml-auto h-8 gap-1.5 bg-card text-[12px]">
              <Search className="h-3.5 w-3.5" /> Enriquecer dados
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkDelete} className="h-8 gap-1.5 bg-card text-[12px] text-red-600 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="h-8 text-[12px]">
              Limpar
            </Button>
          </div>
        )}

        {/* Tabela */}
        <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[34px_2fr_1.4fr_1.2fr_1.3fr_1fr_40px] items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5">
                <input
                  type="checkbox" checked={todosMarcados} onChange={handleSelectAll}
                  aria-label="Selecionar todos" className="h-3.5 w-3.5 cursor-pointer accent-[#2563EB]"
                />
                {["Cliente", "Telefone", "Canal", "Etapa", "Última conversa"].map((t) => (
                  <span key={t} className="linha-unica text-[11px] font-semibold uppercase tracking-wide text-faint">{t}</span>
                ))}
                <span />
              </div>

              {loading ? (
                <div className="space-y-2 p-4">
                  {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
                </div>
              ) : filtrados.length === 0 ? (
                <div className="grid place-items-center gap-2 px-6 py-16 text-center">
                  <Users className="h-8 w-8 text-border-soft" />
                  <p className="text-[13px] text-muted-foreground">
                    {searchTerm.trim() || filtro !== "ALL"
                      ? "Nenhum cliente com esse filtro."
                      : "Nenhum cliente cadastrado ainda."}
                  </p>
                </div>
              ) : (
                filtrados.map((c) => {
                  const m = canal(c.channel);
                  const conv = c.conversations?.[0];
                  const etapa = c.stage;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedContact(c)}
                      className="grid cursor-pointer grid-cols-[34px_2fr_1.4fr_1.2fr_1.3fr_1fr_40px] items-center gap-3 border-b border-border-soft px-4 py-2.5 last:border-0 hover:bg-surface-2"
                    >
                      <input
                        type="checkbox" checked={selectedIds.has(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => toggleSelect(c.id, e)}
                        aria-label={`Selecionar ${c.name}`}
                        className="h-3.5 w-3.5 cursor-pointer accent-[#2563EB]"
                      />

                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-accent-soft text-[10px] font-semibold text-accent-text">
                            {(c.name || "?").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="linha-unica-elipse text-[13px] font-semibold text-foreground">{c.name}</p>
                          <p className="linha-unica-elipse text-[11.5px] text-faint">{c.email || c.igUsername || "—"}</p>
                        </div>
                      </div>

                      <span className="num linha-unica-elipse text-[12.5px] text-muted-foreground">{c.phone || "—"}</span>

                      <span className="linha-unica flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                        <m.Icon className={`h-3.5 w-3.5 shrink-0 ${m.cls}`} /> {m.label}
                      </span>

                      <span className="linha-unica-elipse flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                        {etapa ? (
                          <>
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: etapa.color || "#2563EB" }} />
                            {etapa.name}
                          </>
                        ) : (
                          <span className="text-faint">Sem etapa</span>
                        )}
                      </span>

                      <span className="num linha-unica text-[12px] text-faint">
                        {conv?.lastMessageAt ? desde(conv.lastMessageAt) : "—"}
                      </span>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-card hover:text-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                          <DropdownMenuItem
                            className="cursor-pointer rounded-lg text-[12px] font-medium"
                            onClick={(e) => { e.stopPropagation(); navigate("/conversations"); }}
                          >
                            <MessageSquare className="mr-2 h-4 w-4 text-accent-text" /> Abrir conversa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer rounded-lg text-[12px] font-medium"
                            onClick={(e) => { e.stopPropagation(); setSelectedContact(c); }}
                          >
                            <Edit3 className="mr-2 h-4 w-4 text-accent-text" /> Editar ficha
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer rounded-lg text-[12px] font-medium text-red-600 focus:text-red-600"
                            onClick={(e) => { e.stopPropagation(); handleDeleteContact(c.id); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL NOVO CONTATO */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl p-10 overflow-hidden border-none shadow-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
              <div className="bg-[#2563EB] p-2 rounded-xl"><UserPlus className="text-white w-5 h-5" /></div> Novo Contato
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-8 py-4">
             <div className="space-y-2">
                <Label className="font-semibold text-xs text-slate-400 pl-1">Nome de Exibição</Label>
                <Input value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} className="h-10 border-2 border-slate-50 rounded-2xl font-bold bg-slate-50/30" placeholder="Ex: Ana Maria" />
             </div>
             <div className="space-y-2">
                <Label className="font-semibold text-xs text-slate-400 pl-1">Celular / WhatsApp</Label>
                <Input value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} className="h-10 border-2 border-slate-50 rounded-2xl font-bold bg-slate-50/30" placeholder="55119..." />
             </div>
             <div className="col-span-2 space-y-2">
                <Label className="font-semibold text-xs text-slate-400 pl-1">E-mail de Contato</Label>
                <Input value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} className="h-10 border-2 border-slate-50 rounded-2xl font-bold bg-slate-50/30" placeholder="cliente@email.com" />
             </div>
             <div className="col-span-2 space-y-2">
                <Label className="font-semibold text-xs text-slate-400 pl-1">Tags (Separadas por vírgula)</Label>
                <Input value={newContact.tags} onChange={e => setNewContact({...newContact, tags: e.target.value})} className="h-10 border-2 border-slate-50 rounded-2xl font-bold bg-slate-50/30" placeholder="vip, interessado, automacao" />
             </div>
             <div className="col-span-2 space-y-2">
                <Label className="font-semibold text-xs text-slate-400 pl-1">Notas do Agente (Internal Only)</Label>
                <textarea 
                  value={newContact.notes} 
                  onChange={e => setNewContact({...newContact, notes: e.target.value})}
                  className="w-full min-h-[120px] p-4 border-2 border-slate-50 rounded-2xl font-medium bg-slate-50/30 focus:ring-2 ring-emerald-500/20 outline-none transition-all"
                  placeholder="Adicione observações sobre este lead..."
                />
             </div>
          </div>
          <DialogFooter>
             <Button onClick={handleCreateContact} className="w-full h-11 bg-slate-900 hover:bg-black text-white font-semibold rounded-2xl text-sm transition-all shadow-sm">
               Criar Contato
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALHES COMPLETO (EDITAR / APAGAR) */}
      <Dialog open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-sm rounded-2xl">
           <div className="bg-slate-900 p-12 text-white relative">
              <Button onClick={() => setSelectedContact(null)} variant="ghost" className="absolute top-8 right-8 text-white/50 hover:text-white"><X className="w-6 h-6" /></Button>
              <div className="flex items-center gap-6">
                 <Avatar className="h-24 w-24 border-4 border-white/10">
                    <AvatarFallback className="bg-[#2563EB] text-white font-semibold text-3xl">
                       {selectedContact?.name?.substring(0,2).toUpperCase()}
                    </AvatarFallback>
                 </Avatar>
                 <div className="space-y-1">
                    <h2 className="text-4xl font-semibold leading-none tracking-tight">{selectedContact?.name}</h2>
                    <Badge className="bg-[#2563EB] text-white border-none font-semibold text-xs uppercase py-1 px-4">{selectedContact?.status || "Novo Lead"}</Badge>
                 </div>
              </div>
           </div>

           <div className="p-12 space-y-8 bg-white">
              {/* DOSSIÊ BDR (DEEP RESEARCH RESULTS) */}
              {selectedContact?.extractedData && (
                <div className="bg-slate-50 rounded-2xl p-8 border-2 border-emerald-500/10 animate-in fade-in zoom-in">
                   <div className="flex items-center gap-3 mb-6">
                      <div className="bg-[#2563EB] p-2 rounded-xl text-white"><Search className="w-4 h-4" /></div>
                      <h3 className="font-semibold text-xs text-slate-900">Dossiê BDR (Inteligência)</h3>
                   </div>
                   
                   {(() => {
                      try {
                        const data = JSON.parse(selectedContact.extractedData);
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             {data.decisionMaker && (
                               <div className="space-y-1">
                                  <p className="text-xs font-semibold text-slate-400 ">Decisor Encontrado</p>
                                  <p className="font-bold text-slate-800">{data.decisionMaker.name} ({data.decisionMaker.role})</p>
                                  {data.decisionMaker.linkedIn && <a href={data.decisionMaker.linkedIn} target="_blank" className="text-xs text-[#2563EB] font-bold hover:underline">Perfil LinkedIn</a>}
                               </div>
                             )}
                             {data.companyInfo?.socialProfiles?.length > 0 && (
                               <div className="space-y-1">
                                  <p className="text-xs font-semibold text-slate-400 ">Canais Digitais</p>
                                  <div className="flex flex-wrap gap-2">
                                     {data.companyInfo.socialProfiles.map((s: string, i: number) => (
                                       <a key={i} href={s} target="_blank" className="bg-white p-1 px-3 rounded-lg border text-xs font-bold text-slate-500 hover:text-[#2563EB] truncate max-w-[150px]">{s}</a>
                                     ))}
                                  </div>
                               </div>
                             )}
                             {data.strategicInsights && (
                               <div className="col-span-2 bg-white/50 p-4 rounded-2xl border border-dashed border-slate-200">
                                  <p className="text-xs font-semibold text-slate-400 mb-2">Visão Estratégica</p>
                                  <p className="text-xs text-slate-600 leading-relaxed">"{data.strategicInsights}"</p>
                               </div>
                             )}
                          </div>
                        );
                      } catch (e) { return null; }
                   })()}
                </div>
              )}

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Label className="font-semibold text-xs text-slate-400 pl-1">Nome de Exibição</Label>
                    <Input value={selectedContact?.name} onChange={e => setSelectedContact({...selectedContact, name: e.target.value})} className="h-10 border-2 border-slate-50 rounded-2xl font-bold" />
                 </div>
                 <div className="space-y-2">
                    <Label className="font-semibold text-xs text-slate-400 pl-1">Celular / WhatsApp</Label>
                    <Input value={selectedContact?.phone} onChange={e => setSelectedContact({...selectedContact, phone: e.target.value})} className="h-10 border-2 border-slate-50 rounded-2xl font-bold" />
                 </div>
                  <div className="col-span-2 space-y-2">
                     <Label className="font-semibold text-xs text-slate-400 pl-1">E-mail de Contato</Label>
                     <Input value={selectedContact?.email || ""} onChange={e => setSelectedContact({...selectedContact, email: e.target.value})} className="h-10 border-2 border-slate-50 rounded-2xl font-bold" placeholder="cliente@email.com" />
                  </div>
                  <div className="col-span-2 space-y-2">
                     <Label className="font-semibold text-xs text-slate-400 pl-1">Tags (Separadas por vírgula)</Label>
                     <Input value={selectedContact?.tags || ""} onChange={e => setSelectedContact({...selectedContact, tags: e.target.value})} className="h-10 border-2 border-slate-50 rounded-2xl font-bold" placeholder="vip, interessado, automacao" />
                  </div>
                 <div className="col-span-2 space-y-2">
                    <Label className="font-semibold text-xs text-slate-400 pl-1">Notas do Agente (Internal Only)</Label>
                    <textarea 
                      value={selectedContact?.notes || ""} 
                      onChange={e => setSelectedContact({...selectedContact, notes: e.target.value})}
                      className="w-full min-h-[120px] p-4 border-2 border-slate-50 rounded-2xl font-medium bg-slate-50/30 focus:ring-2 ring-emerald-500/20 outline-none transition-all"
                      placeholder="Adicione observações sobre este lead..."
                    />
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                 <Button onClick={handleUpdateContact} className="flex-[3] h-11 bg-slate-900 hover:bg-black text-white font-semibold rounded-2xl shadow-sm transition-all">
                    <Save className="w-5 h-5 mr-3 text-[#2563EB]" /> Salvar Alterações
                 </Button>
                 <Button onClick={() => handleDeleteContact(selectedContact.id)} variant="outline" className="flex-1 h-11 border-2 border-red-50 text-red-500 hover:bg-red-50 hover:text-red-600 font-semibold rounded-2xl transition-all">
                    <Trash2 className="w-5 h-5" />
                 </Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE IMPORTAÇÃO (PREVIEW) */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-none shadow-sm rounded-2xl">
           <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Revisar Importação</h2>
                <p className="text-slate-400 text-xs font-bold mt-1">
                  Encontramos {importPreview.length} contatos no seu arquivo
                </p>
              </div>
              <div className="bg-[#2563EB]/10 border border-[#2563EB]/20 p-4 rounded-2xl">
                 <p className="text-xs font-semibold text-[#2DD4BF] ">Proteção Ativa</p>
                 <p className="text-xs text-white/60 font-medium">IA iniciará desativada</p>
              </div>
           </div>

           <div className="p-8 space-y-6 bg-white">
              <ScrollArea className="h-[350px] pr-4">
                 <div className="space-y-2">
                    {importPreview.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                         <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-500">
                               {i + 1}
                            </div>
                            <div>
                               <p className="text-sm font-semibold text-slate-800 uppercase">{p.name}</p>
                               <p className="text-xs font-bold text-slate-400">{p.phone}</p>
                            </div>
                         </div>
                         <Badge variant="outline" className="text-xs font-semibold border-slate-200 text-slate-400 uppercase">Pendente</Badge>
                      </div>
                    ))}
                 </div>
              </ScrollArea>

              <div className="flex gap-4 pt-4">
                 <Button 
                   variant="ghost" 
                   onClick={() => setIsImportModalOpen(false)}
                   className="flex-1 h-16 font-semibold uppercase text-xs text-slate-400 hover:text-slate-900"
                 >
                    Cancelar
                 </Button>
                 <Button 
                   onClick={confirmImport} 
                   className="flex-[2] h-11 bg-slate-900 hover:bg-black text-white font-semibold rounded-2xl shadow-sm transition-all"
                 >
                    <Save className="w-5 h-5 mr-3 text-[#2563EB]" /> Confirmar e Salvar
                 </Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>
      <DuplicatesDialog open={isDuplicatesOpen} onOpenChange={setIsDuplicatesOpen} onMerged={fetchData} />

    </DashboardLayout>
  );
}

function ContactItem({ icon, value }: { icon: any, value: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-600">
       <div className="text-[#2563EB]">{icon}</div>
       <span className="text-xs font-bold truncate">{value}</span>
    </div>
  );
}
