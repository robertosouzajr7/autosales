import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import {
  Search, Mail, Phone, Loader2, UserPlus, Trash2, Users, CheckCircle2, ArrowRight,
} from "lucide-react";

/**
 * Leads do diagnóstico da landing.
 *
 * Quem responde cinco perguntas sobre o próprio atendimento está comprando —
 * é o lead mais quente do funil, e antes ele ia embora sem deixar contato.
 * Aqui ele aparece com o que respondeu, para o vendedor abrir a conversa já
 * sabendo volume, equipe e canal.
 */

const STATUS: { id: string; label: string; classe: string }[] = [
  { id: "NOVO", label: "Novo", classe: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { id: "EM_CONTATO", label: "Em contato", classe: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { id: "CONVERTIDO", label: "Convertido", classe: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { id: "DESCARTADO", label: "Descartado", classe: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
];

const rotuloStatus = (id: string) => STATUS.find((s) => s.id === id) || STATUS[0];

const data = (v: string) => new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

const telefoneVisivel = (p?: string | null) => {
  if (!p) return null;
  const d = String(p).replace(/\D/g, "");
  const semPais = d.startsWith("55") ? d.slice(2) : d;
  if (semPais.length < 10) return p;
  return `(${semPais.slice(0, 2)}) ${semPais.slice(2, -4)}-${semPais.slice(-4)}`;
};

export function LeadsPanel() {
  const { toast } = useToast();
  const [dados, setDados] = useState<any>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [stages, setStages] = useState<any[]>([]);
  const [importando, setImportando] = useState<any>(null);
  const [stageEscolhido, setStageEscolhido] = useState("NENHUM");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const qs = new URLSearchParams();
    if (filtro !== "TODOS") qs.set("status", filtro);
    if (busca.trim()) qs.set("q", busca.trim());
    const r = await adminApi.get(`/api/admin/leads?${qs}`);
    if (r.ok) setDados(r.data);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [filtro]);
  useEffect(() => {
    const t = setTimeout(carregar, 350); // busca sem disparar a cada tecla
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [busca]);
  useEffect(() => {
    adminApi.get("/api/pipeline-stages").then((r) => {
      if (r.ok && Array.isArray(r.data)) setStages(r.data);
    });
  }, []);

  const mudarStatus = async (lead: any, status: string) => {
    const r = await adminApi.put(`/api/admin/leads/${lead.id}`, { status });
    if (r.ok) { toast({ title: "Status atualizado" }); carregar(); }
    else toast({ title: "Não consegui atualizar", description: r.data?.error, variant: "destructive" });
  };

  const salvarNota = async (lead: any, notes: string) => {
    await adminApi.put(`/api/admin/leads/${lead.id}`, { notes });
    carregar();
  };

  const importar = async () => {
    setSalvando(true);
    const r = await adminApi.post(`/api/admin/leads/${importando.id}/import`, {
      stageId: stageEscolhido !== "NENHUM" ? stageEscolhido : undefined,
    });
    setSalvando(false);
    if (r.ok) {
      toast({
        title: r.data.criado ? "Contato criado" : "Contato já existia — foi atualizado",
        description: r.data.noFunil ? "Entrou também no funil, no estágio escolhido." : "Está na base de contatos.",
      });
      setImportando(null);
      carregar();
    } else {
      toast({ title: "Não consegui importar", description: r.data?.error, variant: "destructive" });
    }
  };

  const remover = async (lead: any) => {
    if (!confirm(`Excluir o lead "${lead.name}"? Isso não apaga o contato já importado.`)) return;
    const r = await adminApi.del(`/api/admin/leads/${lead.id}`);
    if (r.ok) { toast({ title: "Lead excluído" }); carregar(); }
  };

  const leads: any[] = dados?.leads || [];

  return (
    <div className="space-y-4">
      {/* Resumo por status: dá a leitura do funil sem abrir nada. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS.map((s) => (
          <Card key={s.id} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums">{dados?.resumo?.[s.id] || 0}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone"
            className="pl-9"
          />
        </div>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os status</SelectItem>
            {STATUS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!dados ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : leads.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="mx-auto w-8 h-8 text-muted-foreground mb-3" />
          <p className="font-medium">Nenhum lead por aqui ainda</p>
          <p className="text-sm text-muted-foreground mt-1">
            Quem começar o diagnóstico na landing aparece nesta lista.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => (
            <LeadCard
              key={l.id}
              lead={l}
              onStatus={(s: string) => mudarStatus(l, s)}
              onNota={(n: string) => salvarNota(l, n)}
              onImportar={() => { setImportando(l); setStageEscolhido("NENHUM"); }}
              onRemover={() => remover(l)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!importando} onOpenChange={(v) => !v && setImportando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Importar {importando?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O contato vai para a sua base. Se esse e-mail ou telefone já existir lá, ele é
              atualizado em vez de duplicado.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Colocar no funil (opcional)</label>
              <Select value={stageEscolhido} onValueChange={setStageEscolhido}>
                <SelectTrigger><SelectValue placeholder="Só na base de contatos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Só na base de contatos</SelectItem>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {stages.length === 0 && (
                <p className="text-[11px] text-amber-600">
                  Você ainda não criou estágios no funil — dá para importar só para a base.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportando(null)}>Cancelar</Button>
            <Button onClick={importar} disabled={salvando} className="gap-2">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadCard({ lead, onStatus, onNota, onImportar, onRemover }: any) {
  const [nota, setNota] = useState(lead.notes || "");
  const [abrirNota, setAbrirNota] = useState(false);
  const st = rotuloStatus(lead.status);
  const r = lead.respostas || {};

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{lead.name}</p>
            <Badge variant="outline" className={`text-[11px] ${st.classe}`}>{st.label}</Badge>
            {lead.importedAt && (
              <Badge variant="outline" className="text-[11px] gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="w-3 h-3" /> importado
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-foreground">
              <Mail className="w-3.5 h-3.5" /> {lead.email}
            </a>
            {lead.phone && (
              <a href={`https://wa.me/${lead.phone}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-foreground">
                <Phone className="w-3.5 h-3.5" /> {telefoneVisivel(lead.phone)}
              </a>
            )}
            <span className="text-xs">{data(lead.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={lead.status} onValueChange={onStatus}>
            <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={onImportar} className="gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Importar
          </Button>
          <Button size="icon" variant="ghost" onClick={onRemover} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* O que ele respondeu: é isso que faz a ligação valer a pena. */}
      {(r.conversas || r.colaboradores || r.canais) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-xs">
          {r.conversas != null && <span><strong>{Number(r.conversas).toLocaleString("pt-BR")}</strong> conversas/mês</span>}
          {r.colaboradores != null && <span><strong>{r.colaboradores}</strong> pessoa(s)</span>}
          {r.numeros != null && <span><strong>{r.numeros}</strong> número(s)</span>}
          {r.disparos ? <span><strong>{Number(r.disparos).toLocaleString("pt-BR")}</strong> disparos/mês</span> : null}
          {Array.isArray(r.canais) && r.canais.length > 0 && <span>Canais: {r.canais.join(", ")}</span>}
        </div>
      )}

      {(lead.planoQrCode || lead.planoOficial) && (
        <p className="text-xs text-muted-foreground">
          Recomendado:{" "}
          {[lead.planoQrCode && `QR Code — ${lead.planoQrCode}`, lead.planoOficial && `oficial — ${lead.planoOficial}`]
            .filter(Boolean).join(" · ")}
        </p>
      )}

      {abrirNota ? (
        <div className="space-y-2">
          <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} placeholder="O que rolou na conversa…" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onNota(nota); setAbrirNota(false); }}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setNota(lead.notes || ""); setAbrirNota(false); }}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAbrirNota(true)} className="text-xs text-muted-foreground hover:text-foreground text-left">
          {lead.notes ? `📝 ${lead.notes.slice(0, 120)}${lead.notes.length > 120 ? "…" : ""}` : "+ anotar"}
        </button>
      )}
    </Card>
  );
}

export default LeadsPanel;
