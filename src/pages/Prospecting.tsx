import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, MapPin, Target, Loader2, CheckCircle2, Globe, Phone, Mail, Plus, Zap, ChevronRight, MessageSquare, Star,
  LayoutGrid, List, Layers, Info, CheckSquare, Square, Download
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DiscoveredLead {
  id: string;
  name: string;
  phone: string;
  displayPhone: string;
  email: string | null;
  website: string | null;
  address: string;
  category: string;
  rating: number;
  reviews: number;
  imported: boolean;
}

export default function Prospecting() {
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<DiscoveredLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list" | "gradient">("grid");
  const [selectedLead, setSelectedLead] = useState<DiscoveredLead | null>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!niche || !location) {
      toast({ title: "Preencha os campos", description: "O que buscar e onde?", variant: "destructive" });
      return;
    }
    setSearching(true);
    setResults([]);
    setSelectedIds(new Set());
    try {
      const res = await fetch("/api/prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, location })
      });
      const data = await res.json();
      setResults(data);
      if (data.length > 0) toast({ title: "🏢 Leads Capturados!", description: `${data.length} negócios prontos para importação.` });
    } catch (e) { toast({ title: "Erro na prospecção", variant: "destructive" }); }
    setSearching(false);
  };

  const importLead = async (lead: DiscoveredLead) => {
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          source: "PROSPECÇÃO AUTOMÁTICA",
          tags: `LEADS POTENCIAIS, ${lead.category.toUpperCase()}`,
          notes: `Endereço: ${lead.address}\nSite: ${lead.website}\nAvaliação: ${lead.rating}`,
          status: "NEW"
        })
      });
      if (res.ok) {
        setResults(prev => prev.map(r => r.id === lead.id ? { ...r, imported: true } : r));
        return true;
      }
    } catch (e) { return false; }
    return false;
  };

  const handleImportSelected = async () => {
    const toImport = results.filter(r => selectedIds.has(r.id) && !r.imported);
    if (toImport.length === 0) return;
    
    setImporting(true);
    let successCount = 0;
    for (const lead of toImport) {
      const ok = await importLead(lead);
      if (ok) successCount++;
    }
    setImporting(false);
    toast({ title: "✅ Importação Concluída", description: `${successCount} novos leads enviados para o CRM.` });
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === results.filter(r => !r.imported).length) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set(results.filter(r => !r.imported).map(r => r.id));
      setSelectedIds(newSelected);
    }
  };

  const toggleSelectLead = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const isWhatsApp = (phone: string) => {
    // In Brazil, mobile numbers have 13 digits (55 + DD + 9XXXXXXXX)
    const clean = phone.replace(/\D/g, '');
    return clean.length >= 12 && clean.includes('9');
  };

  const renderCard = (lead: DiscoveredLead & { hasWhatsApp?: boolean }) => {
    const hasWA = lead.hasWhatsApp;
    const isSelected = selectedIds.has(lead.id);

    // --- MODO LISTA ---
    if (viewMode === "list") {
      return (
        <Card key={lead.id} className={`border-none shadow-sm transition-all bg-white group overflow-hidden ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
           <CardContent className="p-4 flex items-center gap-4">
              <Checkbox checked={isSelected || lead.imported} disabled={lead.imported} onCheckedChange={() => toggleSelectLead(lead.id)} className="h-5 w-5 rounded-md" />
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0" onClick={() => setSelectedLead(lead)}>
                 <Building2 className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0" onClick={() => setSelectedLead(lead)}>
                 <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 truncate">{lead.name}</h3>
                    {hasWA && <Badge className="bg-emerald-100 text-emerald-600 border-none px-2 py-0 h-4 text-[9px] font-bold">WhatsApp</Badge>}
                 </div>
                 <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500 font-medium">
                    <a href={`https://wa.me/${lead.phone}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-emerald-600"><Phone className="w-2.5 h-2.5" /> {lead.displayPhone}</a>
                    <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> {lead.email}</span>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="text-right hidden md:block">
                    <div className="flex items-center justify-end text-yellow-500 text-xs font-bold"><Star className="w-3 h-3 fill-yellow-500 mr-.5" /> {lead.rating}</div>
                 </div>
                 {lead.imported ? 
                    <Badge className="bg-emerald-500 text-white border-none">Importado</Badge> : 
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelectedLead(lead)}><Info className="w-4 h-4" /></Button>
                 }
              </div>
           </CardContent>
        </Card>
      );
    }

    // --- MODO GRID / GRADIENTE (UNIFIED CARD STYLE) ---
    return (
      <Card key={lead.id} className={`relative overflow-hidden cursor-pointer transition-all hover:shadow-2xl group border-2 ${isSelected ? 'border-primary ring-2 ring-primary/20' : lead.imported ? 'border-emerald-100' : 'border-slate-100'}`} onClick={() => setSelectedLead(lead)}>
         {/* Checkbox para seleção rápida */}
         {!lead.imported && (
           <div className="absolute top-4 left-4 z-10" onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectLead(lead.id)} className="h-6 w-6 bg-white/80 border-slate-300" />
           </div>
         )}

         <CardContent className="p-6 flex flex-col h-full gap-5">
            <div className="flex justify-between items-start gap-4">
               <h3 className="font-extrabold text-slate-800 group-hover:text-primary transition-colors leading-tight truncate pl-8">{lead.name}</h3>
               {lead.imported && <Badge className="bg-emerald-500 text-white shrink-0">CRM Ativo</Badge>}
            </div>
            
            <div className="space-y-3">
               <div className={`flex items-center justify-between gap-2 text-sm font-extrabold p-3 rounded-2xl ${hasWA ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                  <div className="flex items-center gap-2">
                     <Phone className={`w-4 h-4 ${hasWA ? 'text-emerald-500' : 'text-slate-300'}`} /> 
                     <span>{lead.displayPhone}</span>
                  </div>
                  {hasWA ? (
                    <a href={`https://wa.me/${lead.phone}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                       <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 border-none cursor-pointer">CHAT</Badge>
                    </a>
                  ) : (
                    <span className="text-[9px] font-black opacity-30 tracking-tighter uppercase shrink-0">Sem Whats</span>
                  )}
               </div>
               {lead.email && (
                 <div className="flex items-center gap-2 text-[12px] font-bold text-blue-600 bg-blue-50 p-2.5 rounded-xl truncate">
                    <Mail className="w-4 h-4 text-blue-400" /> <span className="truncate">{lead.email}</span>
                 </div>
               )}
            </div>

            <div className="mt-auto flex items-center justify-between text-xs font-bold text-slate-400 pt-4 border-t border-slate-50">
               <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" /> {lead.rating}</span>
               <span className="truncate max-w-[150px]">{lead.address.split(',')[0]}</span>
            </div>
         </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-screen-xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
           <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
                 <div className="bg-primary p-2 rounded-2xl shadow-xl shadow-primary/20"><Target className="w-8 h-8 text-white" /></div>
                 Prospector <span className="text-primary">Pro</span>
              </h1>
              <p className="text-slate-500 font-semibold">Mineração de escala com identificação automática de WhatsApp.</p>
           </div>
           
           <div className="flex items-center gap-3">
              <Tabs defaultValue="grid" className="w-[180px]" onValueChange={(v) => setViewMode(v as any)}>
                 <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl">
                    <TabsTrigger value="grid" className="rounded-lg"><LayoutGrid className="w-4 h-4" /></TabsTrigger>
                    <TabsTrigger value="list" className="rounded-lg"><List className="w-4 h-4" /></TabsTrigger>
                 </TabsList>
              </Tabs>
              {results.length > 0 && (
                <div className="flex items-center gap-2">
                   <Button variant="outline" className="font-bold border-slate-200" onClick={toggleSelectAll}>
                      {selectedIds.size === results.filter(r => !r.imported).length ? "Deselecionar" : "Selecionar Todos"}
                   </Button>
                   <Button className="bg-emerald-600 hover:bg-emerald-700 font-black shadow-lg shadow-emerald-200 gap-2 h-10 px-6" disabled={selectedIds.size === 0 || importing} onClick={handleImportSelected}>
                      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Importar ({selectedIds.size})
                   </Button>
                </div>
              )}
           </div>
        </div>

        <Card className="border-none shadow-3xl bg-gradient-to-br from-white to-slate-50/50 rounded-[40px] overflow-hidden">
          <CardContent className="p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end relative z-10">
              <div className="md:col-span-5 space-y-4">
                <Label className="text-[11px] font-black text-primary uppercase tracking-[0.2em] pl-1">O que você busca?</Label>
                <Input placeholder="Ex: Farmácias, Escolas, Marcenarias" value={niche} onChange={e => setNiche(e.target.value)} className="h-16 border-slate-200 text-xl font-bold rounded-3xl shadow-sm focus:ring-primary/20 transition-all" />
              </div>
              <div className="md:col-span-4 space-y-4">
                <Label className="text-[11px] font-black text-primary uppercase tracking-[0.2em] pl-1">Onde minerar?</Label>
                <div className="relative">
                   <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-6 h-6" />
                   <Input placeholder="Salvador, BA" value={location} onChange={e => setLocation(e.target.value)} className="h-16 pl-12 border-slate-200 text-xl font-bold rounded-3xl shadow-sm focus:ring-primary/20 transition-all" />
                </div>
              </div>
              <div className="md:col-span-3">
                 <Button onClick={handleSearch} className="w-full h-16 gap-4 bg-slate-900 hover:bg-black shadow-2xl text-xl font-black rounded-3xl transition-all active:scale-95" disabled={searching}>
                   {searching ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
                   {searching ? "Capturando..." : "Mapear"}
                 </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <div className="flex items-center gap-4 py-2">
             <div className="bg-primary/5 text-primary font-black px-4 py-2 rounded-xl text-sm border-2 border-primary/10">
               {results.length} Leads Identificados
             </div>
             <div className="h-px flex-1 bg-slate-100" />
          </div>
        )}

        <div className={`grid gap-6 ${viewMode === "list" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
          {searching ? (
            <div className="col-span-full py-48 flex flex-col items-center justify-center gap-8 bg-slate-50/50 rounded-[40px] border-4 border-dashed border-slate-200">
               <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                  <div className="w-24 h-24 bg-primary text-white rounded-[35px] flex items-center justify-center shadow-2xl relative z-10 rotate-12">
                     <Target className="w-12 h-12" />
                  </div>
               </div>
               <div className="text-center space-y-2">
                  <p className="text-3xl font-black text-slate-800 tracking-tight">Escaneando o Maps...</p>
                  <p className="text-slate-400 font-bold max-w-sm mx-auto">Nossa inteligência está extraindo telefones e conferindo disponibilidade do WhatsApp em tempo real.</p>
               </div>
            </div>
          ) : results.map((lead) => renderCard(lead))}
        </div>
      </div>

      {/* MODAL DE DETALHES COMPLETO */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-3xl rounded-[40px]">
          <div className="bg-emerald-600 p-12 text-white relative">
            <h2 className="text-4xl font-black mb-2 leading-none uppercase tracking-tighter">{selectedLead?.name}</h2>
            <div className="flex items-center gap-4 text-emerald-100 text-xs font-black uppercase tracking-widest leading-loose">
               <MapPin className="w-4 h-4" /> {location}
               {(selectedLead as any)?.hasWhatsApp && <Badge className="bg-white text-emerald-600 border-none ml-4 font-black">WHATSAPP ATIVO</Badge>}
            </div>
          </div>
          <div className="p-10 space-y-8 bg-white">
             <div className="grid grid-cols-1 gap-6">
                <div className="p-6 bg-slate-50 rounded-[30px] flex items-center justify-between group transition-all hover:bg-emerald-50">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">WhatsApp / Fone</p>
                      <p className="text-2xl font-black text-slate-900">{selectedLead?.displayPhone}</p>
                   </div>
                   <Button className="w-14 h-14 rounded-2xl bg-emerald-500 shadow-xl shadow-emerald-200" onClick={() => window.open(`https://wa.me/${selectedLead?.phone}`)}><Phone className="w-6 h-6 text-white" /></Button>
                </div>
                {selectedLead?.email && (
                  <div className="p-6 bg-slate-50 rounded-[30px] flex items-center justify-between group transition-all hover:bg-blue-50">
                     <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">E-mail Corporativo</p>
                        <p className="text-lg font-black text-blue-600 truncate max-w-[200px]">{selectedLead?.email}</p>
                     </div>
                     <Button className="w-14 h-14 rounded-2xl bg-blue-500 shadow-xl shadow-blue-200" onClick={() => window.open(`mailto:${selectedLead?.email}`)}><Mail className="w-6 h-6 text-white" /></Button>
                  </div>
                )}
             </div>
             <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 flex items-center gap-4">
                <div className="text-center shrink-0">
                   <p className="text-3xl font-black text-yellow-500 leading-none">{selectedLead?.rating}</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Google Rating</p>
                </div>
                <div className="h-10 w-px bg-slate-200" />
                <p className="text-xs font-bold text-slate-500 leading-relaxed italic">"{selectedLead?.address}"</p>
             </div>
          </div>
          <DialogFooter className="p-10 bg-slate-50 flex gap-4">
            <Button variant="ghost" className="flex-1 font-black h-16 rounded-3xl" onClick={() => setSelectedLead(null)}>VOLTAR</Button>
            {!selectedLead?.imported ? (
              <Button className="flex-[2] font-black h-16 rounded-3xl bg-slate-900 text-white text-xl shadow-2xl" onClick={async () => { await importLead(selectedLead!); setSelectedLead(null); }}>IMPORTAR AGORA</Button>
            ) : (
              <Button className="flex-[2] font-black h-16 rounded-3xl bg-emerald-600 text-white text-xl shadow-2xl" onClick={() => window.location.href = "/crm"}>FALAR COM SDR AI</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
import { Building2 } from "lucide-react";
