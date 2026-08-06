import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Search, Filter, Plus, MessageSquare, Instagram, Globe,
  X, Save, Trash2, Edit3, GripVertical, UserPlus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Funil de clientes — board arrastável.
 *
 * A coluna é a etapa; o card é o contato. Arrastar move de etapa e grava na
 * hora, com atualização otimista: esperar a API para o card sair do lugar
 * fazia o board parecer travado.
 */

const CANAL: Record<string, { label: string; cls: string; Icon: any }> = {
  WHATSAPP: { label: "WhatsApp", cls: "text-emerald-600", Icon: MessageSquare },
  INSTAGRAM: { label: "Instagram", cls: "text-pink-600", Icon: Instagram },
  SITE: { label: "Site", cls: "text-blue-600", Icon: Globe },
};
const canal = (c?: string) => CANAL[(c || "WHATSAPP").toUpperCase()] || CANAL.WHATSAPP;

const reais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** "agora", "12 min", "3h", "5d" — quando o contato mexeu pela última vez. */
function desde(iso?: string) {
  if (!iso) return "";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d` : `${Math.floor(d / 30)} mês`;
}

export default function CRM() {
  const [leads, setLeads] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditStagesOpen, setIsEditStagesOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [newLead, setNewLead] = useState({ name: "", phone: "", email: "", stageId: "" });
  const [busca, setBusca] = useState("");
  const [filtroCanal, setFiltroCanal] = useState("ALL");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [lRes, sRes] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/pipeline-stages"),
      ]);
      const leadsData = await lRes.json();
      const stagesData = await sRes.json();
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setStages(Array.isArray(stagesData) ? stagesData : []);
      if (stagesData.length > 0 && !newLead.stageId) {
        setNewLead((prev) => ({ ...prev, stageId: stagesData[0].id }));
      }
    } catch (e) { toast({ title: "Erro ao carregar dados", variant: "destructive" }); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateLead = async () => {
    if (!newLead.name || !newLead.phone) return toast({ title: "Preencha nome e telefone", variant: "destructive" });
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLead),
      });
      if (res.ok) {
        toast({ title: "Cliente cadastrado" });
        setIsAddModalOpen(false);
        setNewLead({ name: "", phone: "", email: "", stageId: stages[0]?.id || "" });
        fetchData();
      }
    } catch (e) { toast({ title: "Falha ao salvar", variant: "destructive" }); }
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedLead.name,
          phone: selectedLead.phone,
          email: selectedLead.email,
          stageId: selectedLead.stageId,
          notes: selectedLead.notes,
          source: selectedLead.source,
          value: selectedLead.value,
        }),
      });
      if (res.ok) {
        toast({ title: "Cliente atualizado" });
        setSelectedLead(null);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm("Remover este cliente permanentemente?")) return;
    try {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Cliente removido" });
        setSelectedLead(null);
        fetchData();
      }
    } catch (e) { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const onDragStart = (e: any, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
    setArrastando(leadId);
  };

  const onDrop = async (e: any, newStageId: string) => {
    setArrastando(null);
    const leadId = e.dataTransfer.getData("leadId");
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === newStageId) return;

    // Move o card antes da resposta da API; se falhar, recarrega e volta.
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stageId: newStageId } : l)));
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: newStageId }),
      });
      if (!res.ok) {
        fetchData();
        toast({ title: "Não foi possível mover o cliente", variant: "destructive" });
      }
    } catch (e) {
      fetchData();
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
  };

  const handleAddStage = async () => {
    const name = prompt("Nome da nova etapa:");
    if (!name) return;
    try {
      await fetch("/api/pipeline-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, order: stages.length }),
      });
      fetchData();
    } catch (e) {}
  };

  const etapas = useMemo(() => [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [stages]);

  const visiveis = leads.filter((l) => {
    if (filtroCanal !== "ALL" && (l.channel || "WHATSAPP").toUpperCase() !== filtroCanal) return false;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      if (!`${l.name || ""} ${l.phone || ""} ${l.email || ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Resumo do topo. "Fechado no mês" olha a última etapa do board — quem
  // arrasta para a direita está avançando a venda — e o mês corrente pela
  // data da última alteração do contato, que é quando ele chegou lá.
  const resumo = useMemo(() => {
    const ultima = etapas[etapas.length - 1];
    const emAberto = leads.filter((l) => l.stageId && l.stageId !== ultima?.id);
    const inicioDoMes = new Date();
    inicioDoMes.setDate(1);
    inicioDoMes.setHours(0, 0, 0, 0);
    const fechadosNoMes = leads.filter(
      (l) => l.stageId === ultima?.id && new Date(l.updatedAt || l.createdAt) >= inicioDoMes
    );
    const comEtapa = leads.filter((l) => l.stageId).length;
    const fechadosTotal = leads.filter((l) => l.stageId === ultima?.id).length;
    return {
      ativos: emAberto.length,
      emNegociacao: emAberto.reduce((s, l) => s + (Number(l.value) || 0), 0),
      fechadoNoMes: fechadosNoMes.reduce((s, l) => s + (Number(l.value) || 0), 0),
      conversao: comEtapa > 0 ? (fechadosTotal / comEtapa) * 100 : 0,
    };
  }, [leads, etapas]);

  return (
    <DashboardLayout>
      <div className="mx-auto flex h-[calc(100vh-60px)] max-w-[1800px] flex-col px-4 pt-5 sm:px-6">

        {/* Cabeçalho */}
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Funil de clientes</h1>
            <p className="mt-0.5 max-w-md text-[13.5px] text-muted-foreground">
              Acompanhe cada cliente do primeiro contato até o fechamento. O agente move o card sozinho.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente"
                className="h-10 w-[200px] rounded-lg border-border-soft bg-card pl-9 text-[13px]"
              />
            </div>
            <Select value={filtroCanal} onValueChange={setFiltroCanal}>
              <SelectTrigger className="h-10 w-[172px] rounded-lg border-border-soft bg-card text-[13px]">
                <Filter className="mr-1.5 h-3.5 w-3.5 text-faint" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os canais</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="SITE">Site</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setIsEditStagesOpen(true)} className="h-10 gap-2">
              <Edit3 className="h-4 w-4" /> Editar etapas
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)} className="h-10 gap-2">
              <Plus className="h-4 w-4" /> Novo cliente
            </Button>
          </div>
        </header>

        {/* Resumo */}
        <section className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Resumo rotulo="Clientes ativos" valor={resumo.ativos.toLocaleString("pt-BR")} />
          <Resumo rotulo="Em negociação" valor={reais(resumo.emNegociacao)} />
          <Resumo rotulo="Fechado no mês" valor={reais(resumo.fechadoNoMes)} verde />
          <Resumo rotulo="Taxa de conversão" valor={`${resumo.conversao.toFixed(1).replace(".", ",")}%`} />
        </section>

        {/* Board */}
        {loading ? (
          <div className="flex gap-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[420px] w-[288px] shrink-0 rounded-[14px]" />)}
          </div>
        ) : etapas.length === 0 ? (
          <div className="grid flex-1 place-items-center">
            <div className="text-center">
              <p className="text-[14px] font-medium text-foreground">Nenhuma etapa no funil ainda.</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Crie a primeira para começar a organizar os clientes.</p>
              <Button onClick={handleAddStage} className="mt-4 gap-2"><Plus className="h-4 w-4" /> Criar etapa</Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-6">
            {etapas.map((stage) => {
              const daEtapa = visiveis.filter((l) => l.stageId === stage.id);
              const soma = daEtapa.reduce((s, l) => s + (Number(l.value) || 0), 0);
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, stage.id)}
                  className="flex w-[288px] shrink-0 flex-col rounded-[14px] border border-border-soft bg-surface-2"
                >
                  {/* Cabeçalho fixo: não rola junto com os cards. */}
                  <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border-soft px-3.5 py-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color || "#2563EB" }} />
                      <h2 className="linha-unica-elipse text-[12.5px] font-semibold text-foreground">{stage.name}</h2>
                    </span>
                    <span className="num shrink-0 rounded-md bg-card px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {daEtapa.length}
                    </span>
                  </header>
                  {soma > 0 && (
                    <p className="num shrink-0 border-b border-border-soft px-3.5 py-1.5 text-[11.5px] font-semibold text-faint">
                      {reais(soma)}
                    </p>
                  )}

                  <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-2 p-2.5">
                      {daEtapa.map((lead) => {
                        const m = canal(lead.channel);
                        return (
                          <article
                            key={lead.id}
                            draggable
                            onDragStart={(e) => onDragStart(e, lead.id)}
                            onDragEnd={() => setArrastando(null)}
                            onClick={() => setSelectedLead(lead)}
                            className={`cursor-grab rounded-xl border border-border-soft bg-card p-3 shadow-card transition-shadow hover:shadow-md active:cursor-grabbing ${
                              arrastando === lead.id ? "opacity-40" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-soft text-[10px] font-bold text-accent-text">
                                {(lead.name || "?").substring(0, 2).toUpperCase()}
                              </span>
                              <p className="linha-unica-elipse flex-1 text-[13px] font-semibold text-foreground">{lead.name}</p>
                              <m.Icon className={`h-3.5 w-3.5 shrink-0 ${m.cls}`} />
                            </div>
                            {(lead.notes || lead.source) && (
                              <p className="linha-unica-elipse mt-2 text-[11.5px] text-muted-foreground">
                                {lead.notes || `Chegou por ${lead.source}`}
                              </p>
                            )}
                            <div className="mt-2 flex items-baseline justify-between gap-2">
                              <span className="num text-[13px] font-bold text-foreground">
                                {lead.value ? reais(Number(lead.value)) : ""}
                              </span>
                              <span className="num shrink-0 text-[11px] text-faint">{desde(lead.updatedAt || lead.createdAt)}</span>
                            </div>
                          </article>
                        );
                      })}

                      {daEtapa.length === 0 && (
                        <button
                          onClick={() => { setNewLead((p) => ({ ...p, stageId: stage.id })); setIsAddModalOpen(true); }}
                          className="grid w-full place-items-center gap-1.5 rounded-xl border border-dashed border-border py-10 text-faint transition-colors hover:border-accent-text/40 hover:text-accent-text"
                        >
                          <Plus className="h-5 w-5" />
                          <span className="text-[11.5px] font-medium">Adicionar aqui</span>
                        </button>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}

            <button
              onClick={handleAddStage}
              className="flex w-[220px] shrink-0 flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-border text-faint transition-colors hover:border-accent-text/40 hover:text-accent-text"
            >
              <Plus className="h-6 w-6" />
              <span className="text-[12.5px] font-medium">Nova etapa</span>
            </button>
          </div>
        )}
      </div>

      {/* Ficha do cliente */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-2xl overflow-hidden rounded-2xl p-0">
          <div className="flex items-center gap-4 border-b border-border bg-surface-2 p-6">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-accent-soft text-[16px] font-semibold text-accent-text">
                {selectedLead?.name?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-[20px] font-bold tracking-[-0.02em] text-foreground">{selectedLead?.name}</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {stages.find((s) => s.id === selectedLead?.stageId)?.name || "Sem etapa"}
                {selectedLead?.phone ? ` · ${selectedLead.phone}` : ""}
              </p>
            </div>
            <Button onClick={() => setSelectedLead(null)} variant="ghost" size="icon" className="ml-auto shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 p-6">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">Nome</Label>
              <Input value={selectedLead?.name || ""} onChange={(e) => setSelectedLead({ ...selectedLead, name: e.target.value })} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">Etapa</Label>
              <Select value={selectedLead?.stageId || ""} onValueChange={(v) => setSelectedLead({ ...selectedLead, stageId: v })}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Sem etapa" /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">Telefone</Label>
              <Input value={selectedLead?.phone || ""} onChange={(e) => setSelectedLead({ ...selectedLead, phone: e.target.value })} className="h-10" />
            </div>
            {/* Valor da oportunidade: alimenta "em negociação", "fechado" e o
                ticket médio, aqui e no painel. Vazio é permitido — nem todo
                negócio trabalha com ticket por contato. */}
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">Valor da oportunidade (R$)</Label>
              <Input
                type="number" min="0" step="0.01" inputMode="decimal"
                value={selectedLead?.value ?? ""}
                onChange={(e) => setSelectedLead({ ...selectedLead, value: e.target.value })}
                placeholder="Deixe vazio se não se aplica"
                className="h-10"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">Anotações</Label>
              <textarea
                value={selectedLead?.notes || ""}
                onChange={(e) => setSelectedLead({ ...selectedLead, notes: e.target.value })}
                className="min-h-[110px] w-full rounded-lg border border-input bg-background p-3 text-[13px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="O que já foi conversado, o que ficou combinado…"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border bg-surface-2 p-4">
            <Button onClick={() => handleDeleteLead(selectedLead.id)} variant="outline" className="gap-2 text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> Remover
            </Button>
            <Button onClick={handleUpdateLead} className="gap-2">
              <Save className="h-4 w-4" /> Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Etapas do funil */}
      <Dialog open={isEditStagesOpen} onOpenChange={setIsEditStagesOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold">
              <Edit3 className="h-4 w-4 text-primary" /> Etapas do funil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {etapas.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl border border-border-soft bg-surface-2 p-2.5">
                <GripVertical className="h-4 w-4 shrink-0 text-faint" />
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color || "#2563EB" }} />
                <Input
                  value={s.name}
                  onChange={async (e) => {
                    const novas = [...stages];
                    const alvo = novas.findIndex((x) => x.id === s.id);
                    novas[alvo] = { ...novas[alvo], name: e.target.value };
                    setStages(novas);
                    await fetch(`/api/pipeline-stages/${s.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: e.target.value }),
                    });
                  }}
                  className="h-8 border-none bg-transparent text-[13px] font-medium shadow-none focus-visible:ring-0"
                />
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  onClick={async () => {
                    // O aviso é literal: os contatos não somem, ficam sem etapa
                    // e desaparecem do board até serem recolocados.
                    if (!confirm(`Apagar a etapa "${s.name}"?\n\nOs clientes nela ficam sem etapa e saem do board.`)) return;
                    await fetch(`/api/pipeline-stages/${s.id}`, { method: "DELETE" });
                    fetchData();
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button onClick={handleAddStage} variant="outline" className="w-full gap-2 border-dashed">
              <Plus className="h-4 w-4" /> Adicionar etapa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Novo cliente */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold">
              <UserPlus className="h-4 w-4 text-primary" /> Novo cliente
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">Nome</Label>
              <Input value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} className="h-10" placeholder="Ex: Marina Costa" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">WhatsApp / telefone</Label>
              <Input value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} className="h-10" placeholder="55 71 98812-4477" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">Etapa</Label>
              <Select value={newLead.stageId} onValueChange={(v) => setNewLead({ ...newLead, stageId: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {etapas.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateLead} className="w-full">Adicionar ao funil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Resumo({ rotulo, valor, verde }: { rotulo: string; valor: string; verde?: boolean }) {
  return (
    <article className="rounded-[14px] border border-border bg-card p-4 shadow-card">
      <p className="linha-unica-elipse text-[12px] text-muted-foreground">{rotulo}</p>
      <p className={`num mt-1 text-[22px] font-bold tracking-[-0.03em] ${verde ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
        {valor}
      </p>
    </article>
  );
}
