import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  UserCheck,
  CalendarCheck,
  RefreshCw,
  ShoppingCart,
  Star,
  Plus,
  Pencil,
  Copy,
  Trash2,
  Zap,
  GitBranch,
  Send,
  Tag,
  Clock,
  CheckCircle2,
  PlayCircle,
  Circle,
  SlidersHorizontal,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AutomationTemplate {
  id: string;
  icon: React.ReactNode;
  name: string;
  description: string;
  color: string;
}

interface FlowNode {
  id: string;
  type: "trigger" | "condition" | "action" | "end";
  label: string;
  subtitle: string;
  icon: React.ReactNode;
}

interface Automation {
  id: string;
  name: string;
  description: string;
  active: boolean;
  trigger: string;
  executions: number;
  taxaSucesso?: number;
  ultimaExecucao?: string;
  nodes?: FlowNode[];
}

// ---------------------------------------------------------------------------
// Templates Data
// ---------------------------------------------------------------------------

const templates: AutomationTemplate[] = [
  {
    id: "boas-vindas",
    icon: <MessageSquare className="w-6 h-6" />,
    name: "Boas-vindas Automático",
    description: "Envie uma mensagem de boas-vindas personalizada para novos leads assim que entrarem em contato.",
    color: "bg-green-100 text-green-700",
  },
  {
    id: "qualificacao",
    icon: <UserCheck className="w-6 h-6" />,
    name: "Qualificação de Lead",
    description: "Faça perguntas inteligentes para qualificar leads automaticamente e categorizar intenção de compra.",
    color: "bg-blue-100 text-blue-700",
  },
  {
    id: "agendamento",
    icon: <CalendarCheck className="w-6 h-6" />,
    name: "Agendamento Automático",
    description: "Ofereça horários disponíveis e confirme reuniões sem intervenção manual.",
    color: "bg-purple-100 text-purple-700",
  },
  {
    id: "followup",
    icon: <RefreshCw className="w-6 h-6" />,
    name: "Follow-up Inteligente",
    description: "Reengaje automaticamente leads que não responderam após X dias com mensagens contextuais.",
    color: "bg-orange-100 text-orange-700",
  },
  {
    id: "carrinho",
    icon: <ShoppingCart className="w-6 h-6" />,
    name: "Recuperação de Carrinho",
    description: "Recupere vendas perdidas enviando lembretes para clientes que abandonaram o processo de compra.",
    color: "bg-red-100 text-red-700",
  },
  {
    id: "pos-venda",
    icon: <Star className="w-6 h-6" />,
    name: "Pós-venda",
    description: "Colete avaliações e ofereça suporte proativo após a conclusão de uma venda.",
    color: "bg-yellow-100 text-yellow-700",
  },
];

// ---------------------------------------------------------------------------
// Node style helpers
// ---------------------------------------------------------------------------

const nodeStyles: Record<FlowNode["type"], { border: string; bg: string; badge: string; badgeText: string }> = {
  trigger: {
    border: "border-green-400",
    bg: "bg-green-50",
    badge: "bg-green-100 text-green-700",
    badgeText: "Gatilho",
  },
  condition: {
    border: "border-yellow-400",
    bg: "bg-yellow-50",
    badge: "bg-yellow-100 text-yellow-700",
    badgeText: "Condição",
  },
  action: {
    border: "border-blue-400",
    bg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    badgeText: "Ação",
  },
  end: {
    border: "border-gray-300",
    bg: "bg-gray-50",
    badge: "bg-gray-100 text-gray-600",
    badgeText: "Fim",
  },
};

// ---------------------------------------------------------------------------
// Mini flow preview (inside automation cards)
// ---------------------------------------------------------------------------

function MiniFlowPreview({ nodes }: { nodes: FlowNode[] }) {
  const preview = nodes.slice(0, 4);
  const colors: Record<FlowNode["type"], string> = {
    trigger: "bg-green-500",
    condition: "bg-yellow-400",
    action: "bg-blue-500",
    end: "bg-gray-400",
  };

  return (
    <div className="flex items-center gap-1 mt-3">
      {preview.map((node, idx) => (
        <div key={node.id} className="flex items-center gap-1">
          <div
            className={`w-3 h-3 rounded-full ${colors[node.type]} flex-shrink-0`}
            title={node.label}
          />
          {idx < preview.length - 1 && (
            <div className="w-4 h-px bg-gray-300 flex-shrink-0" />
          )}
        </div>
      ))}
      {nodes.length > 4 && (
        <span className="text-xs text-muted-foreground ml-1">+{nodes.length - 4}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Automation Form Dialog
// ---------------------------------------------------------------------------

function AutomationFormDialog({
  open, onClose, initial, onSaved,
}: {
  open: boolean; onClose: () => void; initial?: Automation | null; onSaved: (a: Automation) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", trigger: "NEW_LEAD" });

  useEffect(() => {
    if (initial) {
      setForm({ name: initial.name || "", description: initial.description || "", trigger: initial.trigger || "NEW_LEAD" });
    } else {
      setForm({ name: "", description: "", trigger: "NEW_LEAD" });
    }
  }, [initial, open]);

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const url = initial ? `/api/automations/${initial.id}` : "/api/automations";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, active: initial ? initial.active : true })
      });
      const saved = await res.json();
      onSaved(saved);
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Editar" : "Nova"} Automação</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1"><Label>Nome</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nome da automação" /></div>
          <div className="space-y-1"><Label>Descrição</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Para que serve?" /></div>
          <div className="space-y-1">
            <Label>Gatilho (Trigger)</Label>
            <select className="w-full h-10 px-3 border rounded-md text-sm" value={form.trigger} onChange={e => setForm({...form, trigger: e.target.value})}>
              <option value="NEW_LEAD">Novo Lead</option>
              <option value="APPOINTMENT_SCHEDULED">Agendamento Criado</option>
              <option value="MSG_RECEIVED">Mensagem Recebida</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Flow Builder Dialog
// ---------------------------------------------------------------------------

function FlowBuilderDialog({
  open,
  onClose,
  automation,
}: {
  open: boolean;
  onClose: () => void;
  automation: Automation | null;
}) {
  if (!automation || !automation.nodes) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            {automation.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-0 py-2">
          {automation.nodes.map((node, idx) => {
            const style = nodeStyles[node.type];
            return (
              <div key={node.id} className="flex flex-col items-center w-full">
                {/* Node card */}
                <div
                  className={`w-full border-2 rounded-xl px-4 py-3 ${style.border} ${style.bg} flex items-start gap-3`}
                >
                  <div className={`mt-0.5 p-1.5 rounded-lg ${style.badge}`}>
                    {node.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">{node.label}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}
                      >
                        {style.badgeText}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{node.subtitle}</p>
                  </div>
                </div>

                {/* Connector + Add button */}
                {idx < automation.nodes!.length - 1 && (
                  <div className="flex flex-col items-center my-1 gap-0.5">
                    <div className="w-px h-3 bg-gray-300" />
                    <button
                      className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-colors"
                      title="Adicionar passo"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <div className="w-px h-3 bg-gray-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex gap-2 pt-2 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1">
            Salvar Fluxo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Automations() {
  const [automationList, setAutomationList] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editAutomation, setEditAutomation] = useState<Automation | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/automations");
      const data = await res.json();
      if (Array.isArray(data)) setAutomationList(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const activeCount = automationList.filter((a) => a.active).length;
  const draftCount = automationList.filter((a) => !a.active).length;
  const totalExecucoes = automationList.reduce((sum, a) => sum + (a.executions || 0), 0);

  async function toggleActive(id: string) {
    const auto = automationList.find(a => a.id === id);
    if (!auto) return;
    try {
      await fetch(`/api/automations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auto, active: !auto.active })
      });
      setAutomationList((prev) =>
        prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
      );
    } catch (e) { console.error(e); }
  }

  function openForm(a?: Automation) {
    setEditAutomation(a || null);
    setFormOpen(true);
  }

  function openEditor(a: Automation) {
    setSelectedAutomation(a);
    setBuilderOpen(true);
  }

  function duplicateAutomation(a: Automation) {
    createFromTemplate({ id: a.trigger, name: `${a.name} (Copy)`, description: a.description });
  }

  async function createFromTemplate(tpl: Partial<AutomationTemplate>) {
    setLoading(true);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tpl.name,
          description: tpl.description,
          trigger: tpl.id?.toUpperCase() || "NEW_LEAD",
          active: true
        })
      });
      const saved = await res.json();
      setAutomationList(p => [saved, ...p]);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function deleteAutomation(id: string) {
    if (!confirm("Excluir esta automação?")) return;
    try {
      await fetch(`/api/automations/${id}`, { method: "DELETE" });
      setAutomationList((prev) => prev.filter((a) => a.id !== id));
    } catch (e) { console.error(e); }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-screen-xl mx-auto">

        {/* ---------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Automações</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Crie fluxos automáticos para engajar e converter leads sem esforço manual.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Stat pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-sm font-medium px-3 py-1.5 rounded-full">
                <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500" />
                {activeCount} Ativas
              </span>
              <span className="inline-flex items-center gap-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 text-sm font-medium px-3 py-1.5 rounded-full">
                <Circle className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                {draftCount} Rascunhos
              </span>
              <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium px-3 py-1.5 rounded-full">
                <Zap className="w-3 h-3" />
                {totalExecucoes.toLocaleString("pt-BR")} Execuções
              </span>
            </div>

            <Button className="gap-2" onClick={() => openForm()}>
              <Plus className="w-4 h-4" />
              Nova Automação
            </Button>
            <Link to="/automations/config">
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Parâmetros
              </Button>
            </Link>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Template Gallery                                                  */}
        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Começar com um template</h2>
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
            {templates.map((tpl) => (
              <Card
                key={tpl.id}
                className="flex-shrink-0 w-56 border border-gray-200 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
              >
                <CardContent className="p-4 flex flex-col gap-3 h-full">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tpl.color}`}>
                    {tpl.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900 leading-tight">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">
                      {tpl.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors"
                    onClick={() => createFromTemplate(tpl)}
                  >
                    Usar Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Active automations grid                                           */}
        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Suas automações</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full py-12 text-center text-slate-400">Carregando automações...</div>
            ) : automationList.length === 0 ? (
               <div className="col-span-full py-12 text-center text-slate-400 border border-dashed rounded-xl">
                 Nenhuma automação personalizada criada.<br/>Use os templates acima ou o novo robô SDR.
               </div>
            ) : automationList.map((automation) => (
              <Card
                key={automation.id}
                className={`border transition-all ${
                  automation.active
                    ? "border-gray-200 hover:shadow-md"
                    : "border-gray-200 opacity-70 hover:opacity-90"
                }`}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold text-gray-900 leading-snug">
                        {automation.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {automation.description}
                      </p>
                    </div>
                    <Switch
                      checked={automation.active}
                      onCheckedChange={() => toggleActive(automation.id)}
                      className="flex-shrink-0 mt-0.5"
                    />
                  </div>
                </CardHeader>

                <CardContent className="px-4 pb-4 flex flex-col gap-3">
                  {/* Status badge */}
                  <div>
                    <Badge
                      variant="secondary"
                      className={
                        automation.active
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-gray-100 text-gray-500 border border-gray-200"
                      }
                    >
                      {automation.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>

                  {/* Trigger */}
                  <div className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <PlayCircle className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-700 leading-relaxed">{automation.trigger}</span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">Execuções</p>
                      <p className="font-semibold text-sm text-gray-900">
                        {(automation.executions || 0).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">Taxa de sucesso</p>
                      <p
                        className={`font-semibold text-sm ${
                          (automation.taxaSucesso || 0) >= 80
                            ? "text-green-600"
                            : (automation.taxaSucesso || 0) >= 60
                            ? "text-yellow-600"
                            : "text-red-500"
                        }`}
                      >
                        {automation.taxaSucesso || 0}%
                      </p>
                    </div>
                  </div>

                  {/* Mini flow preview */}
                  {automation.nodes && <MiniFlowPreview nodes={automation.nodes} />}

                  {/* Divider + footer */}
                  <div className="border-t pt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Última execução: {automation.ultimaExecucao || "nunca"}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        title="Editar"
                        onClick={() => openForm(automation)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                        title="Duplicar"
                        onClick={() => duplicateAutomation(automation)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Excluir"
                        onClick={() => deleteAutomation(automation.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <AutomationFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editAutomation}
        onSaved={load}
      />
      <FlowBuilderDialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        automation={selectedAutomation}
      />
    </DashboardLayout>
  );
}
