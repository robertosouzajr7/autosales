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
  Plus,
  Pencil,
  Trash2,
  Zap,
  Tag,
  Clock,
  PlayCircle,
  Circle,
  SlidersHorizontal,
  ChevronRight,
  Split,
  Save,
  X,
  Type,
  MoreVertical,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AutomationStep {
  id: string;
  type: "message" | "delay" | "tag" | "condition";
  content?: string;
  delayValue?: number;
  delayUnit?: "min" | "hour" | "day";
  tagName?: string;
  conditionValue?: string;
}

interface Automation {
  id: string;
  name: string;
  description: string;
  active: boolean;
  trigger: string;
  executions: number;
  nodes: string; // JSON string of AutomationStep[]
}

const TRIGGER_OPTIONS = [
  { value: "NEW_LEAD", label: "Novo Lead via WhatsApp" },
  { value: "KEYWORD_MATCH", label: "Palavra-chave específica" },
  { value: "APPOINTMENT_SCHEDULED", label: "Agendamento Confirmado" },
  { value: "OUT_OF_OFFICE", label: "Mensagem fora de horário" },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Automations() {
  const [automationList, setAutomationList] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Partial<Automation> | null>(null);
  const [steps, setSteps] = useState<AutomationStep[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/automations");
      const data = await res.json();
      if (Array.isArray(data)) setAutomationList(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const openEditor = (auto: Partial<Automation> | null = null) => {
    if (auto) {
      setEditingAutomation(auto);
      setSteps(JSON.parse(auto.nodes || "[]"));
    } else {
      setEditingAutomation({
        name: "",
        description: "",
        trigger: "NEW_LEAD",
        active: true,
      });
      setSteps([]);
    }
    setEditorOpen(true);
  };

  const addStep = (type: AutomationStep["type"]) => {
    const newStep: AutomationStep = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: type === "message" ? "" : undefined,
      delayValue: type === "delay" ? 5 : undefined,
      delayUnit: type === "delay" ? "min" : undefined,
      tagName: type === "tag" ? "" : undefined,
      conditionValue: type === "condition" ? "" : undefined,
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (id: string, updates: Partial<AutomationStep>) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
  };

  const saveAutomation = async () => {
    if (!editingAutomation?.name) return;
    try {
      const payload = {
        ...editingAutomation,
        nodes: JSON.stringify(steps),
      };
      const url = editingAutomation.id ? `/api/automations/${editingAutomation.id}` : "/api/automations";
      const method = editingAutomation.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditorOpen(false);
        load();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteAutomation = async (id: string) => {
    if (!confirm("Excluir esta automação?")) return;
    try {
      await fetch(`/api/automations/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleActive = async (auto: Automation) => {
    try {
      await fetch(`/api/automations/${auto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auto, active: !auto.active }),
      });
      load();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflow de Automacão</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Crie fluxos complexos com passos sequenciais e condicionais inteligentes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button className="gap-2" onClick={() => openEditor()}>
              <Plus className="w-4 h-4" />
              Criar Automação
            </Button>
            <Link to="/automations/config">
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Parâmetros
              </Button>
            </Link>
          </div>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <p>Carregando...</p>
          ) : (
            automationList.map((auto) => (
              <Card key={auto.id} className="overflow-hidden hover:shadow-lg transition-all border-slate-200">
                <CardHeader className="pb-3 border-b border-slate-50">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-bold text-slate-800">{auto.name}</CardTitle>
                      <Badge variant="outline" className="bg-slate-50 text-slate-500 font-normal">
                        {TRIGGER_OPTIONS.find((t) => t.value === auto.trigger)?.label || auto.trigger}
                      </Badge>
                    </div>
                    <Switch checked={auto.active} onCheckedChange={() => toggleActive(auto)} />
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <p className="text-sm text-slate-500 line-clamp-2">{auto.description || "Sem descrição"}</p>
                  
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-blue-500" />
                      {auto.executions} execuções
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                      {JSON.parse(auto.nodes || "[]").length} passos
                    </span>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-50 mt-4">
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEditor(auto)}>
                      <Pencil className="w-3.5 h-3.5" />
                      Configurar Workflow
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteAutomation(auto.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Workflow Editor Modal */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Zap className="w-6 h-6 text-primary fill-primary/10" />
              Workflow Automático
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            {/* Base Configs */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="space-y-2">
                <Label className="text-slate-600 font-semibold">Nome do Fluxo</Label>
                <Input
                  placeholder="Ex: Recuperação de Lead"
                  value={editingAutomation?.name}
                  onChange={(e) => setEditingAutomation({ ...editingAutomation, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-semibold">Gatilho de Entrada</Label>
                <select
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-md shadow-sm focus:ring-2 focus:ring-primary/20 text-sm"
                  value={editingAutomation?.trigger}
                  onChange={(e) => setEditingAutomation({ ...editingAutomation, trigger: e.target.value })}
                >
                  {TRIGGER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Steps Builder */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ChevronRight className="w-4 h-4" /> Passos do Sequenciamento
              </h3>

              <div className="relative pl-6 border-l-2 border-dashed border-slate-200 ml-4 space-y-8">
                {steps.map((step, index) => (
                  <div key={step.id} className="relative group">
                    {/* Node Dot */}
                    <div className="absolute -left-[33px] top-4 w-4 h-4 rounded-full bg-white border-2 border-primary shadow-sm z-10" />

                    <Card className="border-slate-200 shadow-sm group-hover:border-primary/30 transition-all">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <Badge variant="outline" className="gap-1.5 py-1 px-3 bg-slate-50 border-slate-100 text-slate-600">
                             {step.type === "message" && <MessageSquare className="w-3.5 h-3.5 text-blue-500" />}
                             {step.type === "delay" && <Clock className="w-3.5 h-3.5 text-orange-500" />}
                             {step.type === "tag" && <Tag className="w-3.5 h-3.5 text-purple-500" />}
                             {step.type === "condition" && <Split className="w-3.5 h-3.5 text-emerald-500" />}
                             <span className="capitalize">{step.type}</span>
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => removeStep(step.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {step.type === "message" && (
                          <div className="space-y-2">
                             <Label className="text-xs font-bold text-slate-500">Conteúdo do WhatsApp</Label>
                             <textarea
                               className="w-full p-3 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/10 min-h-[80px] resize-none"
                               placeholder="Olá {{name}}, como vai..."
                               value={step.content}
                               onChange={(e) => updateStep(step.id, { content: e.target.value })}
                             />
                          </div>
                        )}

                        {step.type === "delay" && (
                          <div className="flex items-end gap-3">
                            <div className="flex-1 space-y-2">
                              <Label className="text-xs font-bold text-slate-500">Aguardar por</Label>
                              <Input
                                type="number"
                                value={step.delayValue}
                                onChange={(e) => updateStep(step.id, { delayValue: parseInt(e.target.value) })}
                              />
                            </div>
                            <select
                              className="h-10 px-3 bg-slate-50 border-none rounded-md text-sm"
                              value={step.delayUnit}
                              onChange={(e) => updateStep(step.id, { delayUnit: e.target.value as any })}
                            >
                              <option value="min">Minutos</option>
                              <option value="hour">Horas</option>
                              <option value="day">Dias</option>
                            </select>
                          </div>
                        )}

                        {step.type === "tag" && (
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">Adicionar TAG ao Lead</Label>
                            <Input
                              placeholder="Ex: lead-quente, agendado"
                              value={step.tagName}
                              onChange={(e) => updateStep(step.id, { tagName: e.target.value })}
                            />
                          </div>
                        )}

                        {step.type === "condition" && (
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">Se a resposta contiver:</Label>
                            <Input
                              placeholder="Ex: preco, valor, quanto"
                              value={step.conditionValue}
                              onChange={(e) => updateStep(step.id, { conditionValue: e.target.value })}
                            />
                            <p className="text-[10px] text-slate-400">O fluxo aguardará a próxima resposta do lead para validar.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}

                {/* Add Step Tooltip Bar */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="bg-white rounded-full border-dashed border-slate-300 hover:border-primary hover:text-primary gap-1.5" onClick={() => addStep("message")}>
                    <Plus className="w-3.5 h-3.5" /> Msg
                  </Button>
                  <Button variant="outline" size="sm" className="bg-white rounded-full border-dashed border-slate-300 hover:border-primary hover:text-primary gap-1.5" onClick={() => addStep("delay")}>
                    <Clock className="w-3.5 h-3.5" /> Delay
                  </Button>
                  <Button variant="outline" size="sm" className="bg-white rounded-full border-dashed border-slate-300 hover:border-primary hover:text-primary gap-1.5" onClick={() => addStep("tag")}>
                    <Tag className="w-3.5 h-3.5" /> Tag
                  </Button>
                  <Button variant="outline" size="sm" className="bg-white rounded-full border-dashed border-slate-300 hover:border-primary hover:text-primary gap-1.5" onClick={() => addStep("condition")}>
                    <Split className="w-3.5 h-3.5" /> Condição
                  </Button>
                </div>
              </div>

              {steps.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/20">
                  <PlayCircle className="w-12 h-12 text-slate-200 mb-3" />
                  <p className="text-slate-400 text-sm font-medium">Nenhum passo adicionado ao fluxo.</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 border-t bg-white">
            <Button variant="ghost" onClick={() => setEditorOpen(false)} className="gap-2">
              <X className="w-4 h-4" /> Cancelar
            </Button>
            <Button onClick={saveAutomation} className="gap-2 shadow-lg px-8">
              <Save className="w-4 h-4" /> Salvar Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
