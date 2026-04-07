import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, MapPin, Target, Loader2, CheckCircle2, Globe, Phone, Mail, Plus, Zap, ChevronRight, MessageSquare, Star,
  LayoutGrid, List, Layers, Info, CheckSquare, Square, Download, Building2, Briefcase, Rocket, Sparkles, Linkedin
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DiscoveredLead {
  id: string;
  name: string;
  phone: string;
  displayPhone: string;
  email: string | null;
  website?: string | null;
  address?: string;
  category?: string;
  rating?: number;
  reviews?: number;
  imported: boolean;
  company?: string;
  title?: string;
  source: string;
  url?: string;
}

export default function Prospecting() {
  const [source, setSource] = useState<"maps" | "apollo" | "linkedin">("linkedin");
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [title, setTitle] = useState(""); 
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<DiscoveredLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedLead, setSelectedLead] = useState<DiscoveredLead | null>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!niche && source === "maps") return toast({ title: "Preencha o nicho", variant: "destructive" });
    if (!title && source === "linkedin") return toast({ title: "Qual o cargo alvo?", variant: "destructive" });
    
    setSearching(true);
    setResults([]);
    setSelectedIds(new Set());
    
    const tenantId = localStorage.getItem("tenantId");

    try {
      let endpoint = "/api/prospect";
      if (source === "apollo") endpoint = "/api/apollo/search";
      if (source === "linkedin") endpoint = "/api/prospect/linkedin";
      
      const body = source === "apollo" 
        ? { query: niche, location, title } 
        : source === "linkedin"
        ? { title, location }
        : { niche, location };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "x-tenant-id": tenantId || ""
        },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na busca");
      
      setResults(data.map((d: any) => ({ 
          ...d, 
          imported: false, 
          displayPhone: d.displayPhone || d.phone || "Solicitar WhatsApp",
          source: d.source || (source === 'linkedin' ? 'LinkedIn Pro' : source === 'maps' ? 'Google Maps' : 'Apollo.io')
      })));
      toast({ title: `🚀 ${data.length} Decisores Localizados!`, description: `Fonte: ${source.toUpperCase()}` });
    } catch (e: any) { 
      toast({ title: "Falha na Prospecção", description: e.message, variant: "destructive" }); 
    }
    setSearching(false);
  };

  const handleEnrich = async (lead: DiscoveredLead) => {
    if (!lead.url || enrichingIds.has(lead.id)) return;
    
    setEnrichingIds(prev => new Set(prev).add(lead.id));
    const tenantId = localStorage.getItem("tenantId");
    try {
      const res = await fetch("/api/prospect/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId || "" },
        body: JSON.stringify({ url: lead.url })
      });
      const data = await res.json();
      if (data.success) {
        setResults(prev => prev.map(r => r.id === lead.id ? { 
            ...r, 
            phone: data.phone, 
            displayPhone: data.phone, 
            email: data.email, 
            company: data.company || r.company 
        } : r));
        toast({ title: "✨ Perfil Enriquecido!", description: "Dados de contato localizados no motor " + (data.provider || "Premium") });
      } else {
        toast({ title: "Dado não localizado", description: data.error || "Este perfil não possui dados de contato públicos.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Falha técnica no Enriquecimento", variant: "destructive" });
    }
    setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
    });
  };

  const importLead = async (lead: DiscoveredLead) => {
    const tenantId = localStorage.getItem("tenantId");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "x-tenant-id": tenantId || ""
        },
        body: JSON.stringify({
          name: lead.name,
          phone: lead.phone || "5500000000000",
          email: lead.email,
          source: lead.source.toUpperCase(),
          tags: `PROSPECÇÃO, ${source.toUpperCase()}`,
          notes: `Empresa: ${lead.company || 'N/A'}\nCargo: ${lead.title || 'N/A'}\nPerfil: ${lead.url || 'Links LinkedIn'}`,
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
    toast({ title: "✅ Sucesso!", description: `${successCount} perfis importados para o CRM.` });
    setSelectedIds(new Set());
  };

  const toggleSelectLead = (id: string, e?: any) => {
    if (e) e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 p-6 lg:p-12 max-w-[1600px] mx-auto animate-in fade-in duration-1000">
        
        {/* HEADER & TABS ESTRATÉGICAS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
           <div className="space-y-2">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-slate-900 rounded-[22px] shadow-2xl overflow-hidden relative">
                    <Target className="w-8 h-8 text-emerald-400 relative z-10" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-transparent" />
                 </div>
                 <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                    Prospector <span className="text-emerald-500 italic">Ultra</span>
                 </h1>
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[8px] pl-1">Vendas & Inteligência Corporativa</p>
           </div>
           
           <Tabs value={source} onValueChange={(v: any) => setSource(v)} className="bg-slate-50 p-1.5 rounded-[22px] border border-slate-100 shadow-sm">
              <TabsList className="flex h-12 bg-transparent gap-2">
                 <TabsTrigger value="linkedin" className="rounded-[18px] h-full px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-blue-600">
                    <Linkedin className="w-4 h-4 mr-2" /> LinkedIn Pro
                 </TabsTrigger>
                 <TabsTrigger value="apollo" className="rounded-[18px] h-full px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-emerald-600">
                    <Zap className="w-4 h-4 mr-2" /> Apollo Search
                 </TabsTrigger>
                 <TabsTrigger value="maps" className="rounded-[18px] h-full px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-rose-500">
                    <MapPin className="w-4 h-4 mr-2" /> Google Maps
                 </TabsTrigger>
              </TabsList>
           </Tabs>
        </div>

        {/* MÁQUINA DE BUSCA LINKEDIN / MAPS / APOLLO */}
        <Card className="border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] bg-white rounded-[50px] overflow-hidden p-12 lg:p-16 border-t-2 border-slate-50 relative">
           <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-end relative z-10">
              
              {source === "linkedin" ? (
                <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-8">
                   <div className="space-y-3">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Cargo Alvo</Label>
                      <Input placeholder="Ex: Diretor de Vendas, CEO..." value={title} onChange={e => setTitle(e.target.value)} className="h-16 border-2 border-slate-50 bg-slate-50/50 text-lg font-black rounded-3xl px-8 focus:bg-white transition-all outline-none" />
                   </div>
                   <div className="space-y-3">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Localização</Label>
                      <div className="relative">
                         <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                         <Input placeholder="Salvador, BR" value={location} onChange={e => setLocation(e.target.value)} className="h-16 pl-14 border-2 border-slate-50 bg-slate-50/50 text-lg font-black rounded-3xl px-8 focus:bg-white transition-all" />
                      </div>
                   </div>
                   <div className="flex items-end">
                      <Button 
                        onClick={handleSearch} 
                        disabled={searching}
                        className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-[28px] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-all flex items-center gap-3"
                      >
                         {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Linkedin className="w-5 h-5 text-blue-200" />}
                         {searching ? "Procurando..." : "Varredura LinkedIn"}
                      </Button>
                   </div>
                </div>
              ) : (
                <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-8">
                   <div className="md:col-span-5 space-y-3">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">{source === "apollo" ? "Palavras-Chave" : "Nicho de Atuação"}</Label>
                      <Input placeholder="Ex: Restaurantes, Farmácias..." value={niche} onChange={e => setNiche(e.target.value)} className="h-16 border-2 border-slate-50 bg-slate-50/50 text-lg font-black rounded-3xl px-8 focus:bg-white transition-all outline-none" />
                   </div>
                   <div className="md:col-span-4 space-y-3">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Cidade / Estado</Label>
                      <Input placeholder="Bahia, BR" value={location} onChange={e => setLocation(e.target.value)} className="h-16 border-2 border-slate-50 bg-slate-50/50 text-lg font-black rounded-3xl px-8 focus:bg-white transition-all" />
                   </div>
                   <div className="md:col-span-3 flex items-end">
                      <Button onClick={handleSearch} disabled={searching} className="w-full h-16 bg-slate-900 hover:bg-black text-white rounded-[28px] font-black uppercase tracking-widest text-xs shadow-2xl flex items-center gap-3">
                        {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        {searching ? "Mapeando..." : "Localizar Agora"}
                      </Button>
                   </div>
                </div>
              )}
           </div>
        </Card>

        {/* ÁREA DE RESULTADOS DINÂMICA */}
        {results.length > 0 && !searching && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
             <div className="flex items-center justify-between border-b border-slate-100 pb-10">
                <div className="flex items-center gap-6">
                   <div className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 border-emerald-100/50">
                      IDENTIFICADOS: <span className="text-lg ml-2">{results.length}</span>
                   </div>
                   {selectedIds.size > 0 && (
                     <Button onClick={handleImportSelected} disabled={importing} className="bg-slate-900 text-white rounded-3xl h-14 px-10 font-black uppercase text-[10px] tracking-widest flex items-center gap-4 animate-in zoom-in shadow-xl">
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-emerald-400" />}
                        Mover para CRM ({selectedIds.size})
                     </Button>
                   )}
                </div>
                <Button variant="ghost" onClick={() => setSelectedIds(new Set(results.filter(r => !r.imported).map(r => r.id)))} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 px-8 h-12 rounded-2xl">Marcar Todos</Button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {results.map((lead) => (
                   <Card 
                     key={lead.id} 
                     onClick={() => !lead.imported && toggleSelectLead(lead.id)}
                     className={`border-none rounded-[50px] bg-white p-10 transition-all hover:translate-y-[-8px] cursor-pointer group relative overflow-hidden flex flex-col justify-between ${
                       selectedIds.has(lead.id) ? 'ring-4 ring-emerald-500 shadow-[0_45px_90px_-15px_rgba(16,185,129,0.2)]' : 'shadow-xl'
                     } ${lead.imported ? 'opacity-30 grayscale' : ''}`}
                   >
                      <div className="space-y-8">
                         <div className="flex justify-between items-start">
                            <div className="h-16 w-16 bg-slate-900 rounded-3xl flex items-center justify-center text-white font-black text-2xl uppercase shadow-lg group-hover:rotate-6 transition-transform">
                               {lead.name.substring(0,2)}
                            </div>
                            <div className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all ${selectedIds.has(lead.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-50 bg-slate-50 text-transparent'}`}>
                               <CheckCircle2 className="w-5 h-5" />
                            </div>
                         </div>

                         <div className="space-y-2">
                            <h3 className="text-xl font-black text-slate-900 tracking-tighter leading-tight uppercase line-clamp-2">{lead.name}</h3>
                            <div className="flex items-center gap-2">
                               <Badge className="bg-slate-100 text-slate-500 border-none font-black text-[8px] uppercase tracking-widest">{lead.source}</Badge>
                               <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest truncate max-w-[150px]">{lead.title || lead.company}</span>
                            </div>
                         </div>

                         <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-600 bg-slate-50 p-4 rounded-3xl group/phone">
                               <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-emerald-500" /> {lead.displayPhone}
                               </div>
                               {!lead.imported && (lead.source === 'LinkedIn Pro' || lead.source === 'LinkedIn Search') && lead.displayPhone === 'Aguardando Enriquecimento' && (
                                 <Button 
                                   onClick={(e) => { e.stopPropagation(); handleEnrich(lead); }}
                                   size="sm" 
                                   disabled={enrichingIds.has(lead.id)}
                                   className="h-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] uppercase tracking-tighter"
                                 >
                                    {enrichingIds.has(lead.id) ? (
                                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                    ) : (
                                      <Sparkles className="w-3 h-3 mr-1" />
                                    )}
                                    {enrichingIds.has(lead.id) ? "Buscando..." : "Revelar"}
                                 </Button>
                               )}
                            </div>
                         </div>
                      </div>

                      <div className="mt-8 flex items-center justify-between">
                         {lead.url ? (
                           <a href={lead.url} target="_blank" onClick={(e) => e.stopPropagation()} className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 hover:underline">
                              <Linkedin className="w-4 h-4" /> Perfil LinkedIn
                           </a>
                         ) : <span></span>}
                         <Button size="icon" variant="ghost" className="rounded-full bg-slate-50" onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}>
                            <Info className="w-4 h-4 text-slate-400" />
                         </Button>
                      </div>
                   </Card>
                ))}
             </div>
          </div>
        )}

        {/* LOADING STATE - CINEMATIC */}
        {searching && (
          <div className="py-48 flex flex-col items-center justify-center gap-12 bg-white shadow-3xl rounded-[80px] border-4 border-dashed border-slate-50">
             <div className="relative">
                <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping duration-[3s]" />
                <div className="w-36 h-36 bg-slate-900 text-white rounded-[50px] flex items-center justify-center shadow-3xl relative z-10 rotate-6">
                   <Linkedin className="w-16 h-16 text-blue-400" />
                </div>
             </div>
             <div className="text-center space-y-4">
                <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Extraindo Perfis...</h2>
                <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px]">Acessando a rede profissional para minerar os melhores decisores.</p>
             </div>
          </div>
        )}

      </div>

      {/* MODAL DETALHE LEAD */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-3xl rounded-[50px]">
           <div className={`p-16 text-white relative ${source === 'linkedin' ? 'bg-blue-600' : 'bg-slate-900'}`}>
              <div className="absolute top-0 right-0 p-8 opacity-10">
                 <Rocket className="w-32 h-32 rotate-12" />
              </div>
              <h2 className="text-4xl font-black leading-none uppercase tracking-tighter mb-4">{selectedLead?.name}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">{selectedLead?.title} • {selectedLead?.source}</p>
           </div>
           
           <div className="p-12 space-y-8 bg-white">
              <div className="p-8 bg-slate-50 rounded-[40px] space-y-6">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Contato Identificado</p>
                    <p className="text-2xl font-black text-slate-900">{selectedLead?.displayPhone}</p>
                 </div>
                 {selectedLead?.email && (
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">E-mail</p>
                      <p className="text-sm font-black text-blue-600 truncate">{selectedLead.email}</p>
                   </div>
                 )}
              </div>

              <div className="flex gap-4">
                  <Button variant="ghost" className="flex-1 font-black h-16 rounded-[24px]" onClick={() => setSelectedLead(null)}>VOLTAR</Button>
                  <Button className="flex-[2] font-black h-16 rounded-[24px] bg-slate-900 text-white text-xl shadow-2xl" onClick={async () => { await importLead(selectedLead!); setSelectedLead(null); }}>IMPORTAR</Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
