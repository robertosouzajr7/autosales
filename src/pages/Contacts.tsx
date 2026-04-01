import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, Search, Filter, 
  MoreVertical, UserPlus, Phone, 
  Mail, MessageSquare, Download,
  Tag, ChevronRight, Star, Heart, Save,
  LayoutGrid, List, Info, Trash2, Edit3, X, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  status?: string;
  tags?: string | null;
  notes?: string | null;
  source?: string | null;
  createdAt?: string;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Lead | null>(null);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      setContacts(Array.isArray(data) ? data : []);
    } catch (e) { toast({ title: "Erro na base", variant: "destructive" }); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateContact = async () => {
    if (!newContact.name || !newContact.phone) return toast({ title: "Dados incompletos", variant: "destructive" });
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContact)
      });
      if (res.ok) {
        toast({ title: "🏢 Contato salvo com sucesso!" });
        setIsAddModalOpen(false);
        setNewContact({ name: "", phone: "", email: "" });
        fetchData();
      }
    } catch (e) { toast({ title: "Falha na conexão", variant: "destructive" }); }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este contato?")) return;
    try {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
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
        headers: { "Content-Type": "application/json" },
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
    window.location.href = "/api/contacts/export";
    toast({ title: "📥 Exportação Iniciada", description: "Seu arquivo JSON está sendo baixado." });
  };

  const handleImport = async () => {
    const data = prompt("Cole aqui o JSON de contatos (Array de objetos {name, phone, email}):");
    if (!data) return;
    try {
      const contactsToImport = JSON.parse(data);
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: contactsToImport })
      });
      if (res.ok) {
        const result = await res.json();
        toast({ title: "📤 Importação Concluída", description: `${result.created} contatos adicionados.` });
        fetchData();
      }
    } catch (e) { toast({ title: "Erro no formato JSON", variant: "destructive" }); }
  };

  const toggleSelect = (id: string, e: any) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Excluir ${selectedIds.size} contatos selecionados?`)) return;
    try {
      for (const id of Array.from(selectedIds)) {
        await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      }
      toast({ title: "🗑️ Deleção em massa concluída" });
      setSelectedIds(new Set());
      fetchData();
    } catch (e) { toast({ title: "Erro em algumas deleções", variant: "destructive" }); }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-[1500px] mx-auto animate-in fade-in duration-700">
        
        {/* HEADER CONTATOS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                 Base de <span className="text-emerald-500 italic">Contatos</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Gerenciamento Premium de Pipeline</p>
           </div>
           
           <div className="flex gap-4">
               <div className="flex gap-2">
                 <Button variant="outline" size="icon" onClick={handleExport} className="h-12 w-12 rounded-2xl border-2"><Download className="w-4 h-4" /></Button>
                 <Button variant="outline" size="icon" onClick={handleImport} className="h-12 w-12 rounded-2xl border-2"><UserPlus className="w-4 h-4" /></Button>
                 {selectedIds.size > 0 && (
                   <Button variant="destructive" size="icon" onClick={handleBulkDelete} className="h-12 w-12 rounded-2xl animate-in zoom-in"><Trash2 className="w-4 h-4" /></Button>
                 )}
               </div>
               <Tabs defaultValue="grid" className="w-[120px] h-12" onValueChange={(v) => setViewMode(v as any)}>
                  <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-2xl h-12">
                     <TabsTrigger value="grid" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"><LayoutGrid className="w-4 h-4" /></TabsTrigger>
                     <TabsTrigger value="list" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"><List className="w-4 h-4" /></TabsTrigger>
                  </TabsList>
               </Tabs>
               <Button 
                 onClick={() => setIsAddModalOpen(true)}
                 className="h-12 bg-slate-900 hover:bg-slate-800 px-8 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-2xl"
               >
                  <UserPlus className="w-4 h-4 mr-2" /> Novo Contato
               </Button>
            </div>
        </div>

        {/* BUSCA RAPIDA */}
        <Card className="border-none shadow-2xl rounded-[35px] bg-white p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <Input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Escreva o nome para filtrar..." 
                className="h-14 pl-12 w-full border-none bg-slate-50 text-slate-900 rounded-2xl focus:ring-emerald-500/30 font-bold text-xs" 
              />
            </div>
           <Badge className="h-14 px-8 rounded-2xl bg-emerald-50 text-emerald-600 border-none flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
             {contacts.length} Entradas na Base
           </Badge>
        </Card>

        {/* GRID OU LISTA */}
        <div className={`grid gap-6 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
           {contacts
             .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm))
             .map(contact => (
              <Card 
                key={contact.id} 
                onClick={() => setSelectedContact(contact)}
                className={`border-none shadow-xl rounded-[40px] bg-white overflow-hidden hover:scale-[1.01] transition-all duration-500 group cursor-pointer relative ${
                  viewMode === "list" ? "flex flex-row items-center p-4 h-24" : "flex flex-col"
                }`}
              >
                <div 
                  onClick={(e) => toggleSelect(contact.id, e)}
                  className={`absolute top-6 left-6 w-6 h-6 rounded-full border-2 z-10 transition-all flex items-center justify-center ${
                    selectedIds.has(contact.id) ? 'bg-emerald-500 border-emerald-500' : 'bg-white/50 border-slate-200 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {selectedIds.has(contact.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <CardContent className={`p-0 ${viewMode === "list" ? "flex items-center gap-6 w-full" : "w-full"}`}>
                   {/* Avatar e Infos Principais */}
                   <div className={`p-8 space-y-6 ${viewMode === "list" ? "p-0 flex items-center gap-6 flex-1" : ""}`}>
                      <div className="flex items-center gap-4">
                         <Avatar className={`${viewMode === "list" ? "h-12 w-12" : "h-16 w-16"}`}>
                            <AvatarFallback className="bg-slate-900 text-white font-black text-lg">
                               {contact.name.substring(0,2).toUpperCase()}
                            </AvatarFallback>
                         </Avatar>
                         <div className="flex-1 min-w-0">
                            <p className="font-black text-lg text-slate-900 leading-tight truncate">{contact.name}</p>
                             <Badge className={`${
                                contact.status === 'CONVERTED' ? 'bg-emerald-100 text-emerald-600' : 
                                contact.status === 'APPOINTMENT' ? 'bg-purple-100 text-purple-600' : 
                                contact.status === 'QUALIFYING' ? 'bg-orange-100 text-orange-600' : 
                                contact.status === 'INTERESTED' ? 'bg-emerald-100 text-emerald-600' : 
                                contact.status === 'NEW' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                             } border-none font-bold text-[8px] uppercase tracking-tighter mt-1`}>
                                {contact.status || "Ativo"}
                             </Badge>
                         </div>
                      </div>

                      {viewMode === "grid" && (
                        <div className="space-y-4 pt-4 border-t border-slate-50">
                           <ContactItem icon={<Phone className="w-4 h-4" />} value={contact.phone} />
                           <ContactItem icon={<Mail className="w-4 h-4" />} value={contact.email || "E-mail não informado"} />
                        </div>
                      )}
                   </div>

                   {/* Ações (Apenas no Grid ou final da Lista) */}
                   {viewMode === "grid" ? (
                     <div className="bg-slate-50 p-6 flex justify-between items-center group-hover:bg-emerald-50 transition-colors">
                        <Button variant="ghost" className="text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-emerald-600">Ver Perfil</Button>
                        <div className="flex gap-2">
                           <Button 
                              onClick={(e) => { e.stopPropagation(); navigate(`/conversations?phone=${contact.phone}`); }}
                              size="icon" 
                              className="w-10 h-10 bg-slate-900 hover:bg-slate-800 rounded-xl shadow-lg"
                           >
                              <MessageSquare className="w-4 h-4 text-white" />
                           </Button>
                           <Button 
                              onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${contact.phone}`; }}
                              size="icon" 
                              className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20"
                           >
                              <Phone className="w-4 h-4 text-white" />
                           </Button>
                        </div>
                     </div>
                   ) : (
                     <div className="flex items-center gap-8 pr-10">
                        <div className="hidden lg:flex flex-col text-right">
                           <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">WhatsApp</p>
                           <p className="text-xs font-bold text-slate-600">{contact.phone}</p>
                        </div>
                        <div className="flex gap-2">
                           <Button onClick={(e) => { e.stopPropagation(); navigate(`/conversations?phone=${contact.phone}`); }} size="icon" className="w-10 h-10 bg-slate-900 rounded-xl"><MessageSquare className="w-4 h-4 text-white" /></Button>
                           <Button onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${contact.phone}`; }} size="icon" className="w-10 h-10 bg-emerald-500 rounded-xl"><Phone className="w-4 h-4 text-white" /></Button>
                        </div>
                     </div>
                   )}
                </CardContent>
             </Card>
           ))}
        </div>
      </div>

      {/* MODAL NOVO CONTATO */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="rounded-[40px] p-10 max-w-lg border-none shadow-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <div className="bg-emerald-500 p-2 rounded-xl"><UserPlus className="text-white w-5 h-5" /></div> Novo Contato
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
               <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Nome Completo</Label>
               <Input value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} className="h-14 rounded-2xl border-2 border-slate-50 font-bold bg-slate-50/30" placeholder="Ex: Ana Maria" />
            </div>
            <div className="space-y-2">
               <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">WhatsApp Oficial</Label>
               <Input value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} className="h-14 rounded-2xl border-2 border-slate-50 font-bold bg-slate-50/30" placeholder="55119..." />
            </div>
          </div>
          <DialogFooter>
             <Button onClick={handleCreateContact} className="w-full h-16 bg-slate-900 hover:bg-black text-white font-black rounded-2xl uppercase tracking-widest text-sm transition-all shadow-2xl">
               Criar Contato
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALHES COMPLETO (EDITAR / APAGAR) */}
      <Dialog open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-3xl rounded-[40px]">
           <div className="bg-slate-900 p-12 text-white relative">
              <Button onClick={() => setSelectedContact(null)} variant="ghost" className="absolute top-8 right-8 text-white/50 hover:text-white"><X className="w-6 h-6" /></Button>
              <div className="flex items-center gap-6">
                 <Avatar className="h-24 w-24 border-4 border-white/10">
                    <AvatarFallback className="bg-emerald-500 text-white font-black text-3xl">
                       {selectedContact?.name?.substring(0,2).toUpperCase()}
                    </AvatarFallback>
                 </Avatar>
                 <div className="space-y-1">
                    <h2 className="text-4xl font-black leading-none uppercase tracking-tighter">{selectedContact?.name}</h2>
                    <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] tracking-widest uppercase py-1 px-4">{selectedContact?.status || "Novo Lead"}</Badge>
                 </div>
              </div>
           </div>

           <div className="p-12 space-y-8 bg-white">
              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Nome de Exibição</Label>
                    <Input value={selectedContact?.name} onChange={e => setSelectedContact({...selectedContact, name: e.target.value})} className="h-14 border-2 border-slate-50 rounded-2xl font-bold" />
                 </div>
                 <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Celular / WhatsApp</Label>
                    <Input value={selectedContact?.phone} onChange={e => setSelectedContact({...selectedContact, phone: e.target.value})} className="h-14 border-2 border-slate-50 rounded-2xl font-bold" />
                 </div>
                  <div className="col-span-2 space-y-2">
                     <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">E-mail de Contato</Label>
                     <Input value={selectedContact?.email || ""} onChange={e => setSelectedContact({...selectedContact, email: e.target.value})} className="h-14 border-2 border-slate-50 rounded-2xl font-bold" placeholder="cliente@email.com" />
                  </div>
                  <div className="col-span-2 space-y-2">
                     <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Tags (Separadas por vírgula)</Label>
                     <Input value={selectedContact?.tags || ""} onChange={e => setSelectedContact({...selectedContact, tags: e.target.value})} className="h-14 border-2 border-slate-50 rounded-2xl font-bold" placeholder="vip, interessado, automacao" />
                  </div>
                 <div className="col-span-2 space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Notas do Agente (Internal Only)</Label>
                    <textarea 
                      value={selectedContact?.notes || ""} 
                      onChange={e => setSelectedContact({...selectedContact, notes: e.target.value})}
                      className="w-full min-h-[120px] p-4 border-2 border-slate-50 rounded-2xl font-medium bg-slate-50/30 focus:ring-2 ring-emerald-500/20 outline-none transition-all"
                      placeholder="Adicione observações sobre este lead..."
                    />
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                 <Button onClick={handleUpdateContact} className="flex-[3] h-16 bg-slate-900 hover:bg-black text-white font-black rounded-2xl uppercase tracking-widest shadow-2xl transition-all">
                    <Save className="w-5 h-5 mr-3 text-emerald-500" /> Salvar Alterações
                 </Button>
                 <Button onClick={() => handleDeleteContact(selectedContact.id)} variant="outline" className="flex-1 h-16 border-2 border-red-50 text-red-500 hover:bg-red-50 hover:text-red-600 font-black rounded-2xl uppercase tracking-widest transition-all">
                    <Trash2 className="w-5 h-5" />
                 </Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function ContactItem({ icon, value }: { icon: any, value: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-600">
       <div className="text-emerald-500">{icon}</div>
       <span className="text-xs font-bold truncate">{value}</span>
    </div>
  );
}
