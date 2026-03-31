import { useState } from "react";
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
} from "@/components/ui/dialog";
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
  Circle,
  PlayCircle,
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
  execucoes: number;
  taxaSucesso: number;
  ultimaExecucao: string;
  nodes: FlowNode[];
}

// ---------------------------------------------------------------------------
// Mock data
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

const defaultNodes: FlowNode[] = [
  {
    id: "n1",
    type: "trigger",
    label: "Gatilho: Nova mensagem",
    subtitle: "Novo lead via WhatsApp",
    icon: <PlayCircle className="w-4 h-4" />,
  },
  {
    id: "n2",
    type: "condition",
    label: "Se contém palavra-chave",
    subtitle: '"preço", "valor", "comprar"',
    icon: <GitBranch className="w-4 h-4" />,
  },
  {
    id: "n3",
    type: "action",
    label: "Enviar mensagem",
    subtitle: "Template de boas-vindas",
    icon: <Send className="w-4 h-4" />,
  },
  {
    id: "n4",
    type: "action",
    label: "Atribuir tag",
    subtitle: "Lead Quente",
    icon: <Tag className="w-4 h-4" />,
  },
  {
    id: "n5",
    type: "action",
    label: "Agendar follow-up",
    subtitle: "Em 2 dias",
    icon: <Clock className="w-4 h-4" />,
  },
  {
    id: "n6",
    type: "end",
    label: "Fim do fluxo",
    subtitle: "Automação concluída",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
];

const automations: Automation[] = [
  {
    id: "a1",
    name: "Boas-vindas Novos Leads",
    description: "Envio automático de mensagem de boas-vindas para leads que entram em contato pelo WhatsApp.",
    active: true,
    trigger: "Quando: Novo lead via WhatsApp",
    execucoes: 3840,
    taxaSucesso: 98,
    ultimaExecucao: "há 3 minutos",
    nodes: defaultNodes,
  },
  {
    id: "a2",
    name: "Qualificação Automática",
    description: "Fluxo de perguntas para identificar interesse, orçamento e urgência de novos contatos.",
    active: true,
    trigger: "Quando: Lead sem qualificação há +1h",
    execucoes: 2210,
    taxaSucesso: 91,
    ultimaExecucao: "há 12 minutos",
    nodes: defaultNodes,
  },
  {
    id: "a3",
    name: "Follow-up D+3",
    description: "Reengajamento de leads que não responderam em 3 dias com oferta especial.",
    active: true,
    trigger: "Quando: Sem resposta por 3 dias",
    execucoes: 1590,
    taxaSucesso: 74,
    ultimaExecucao: "há 1 hora",
    nodes: defaultNodes,
  },
  {
    id: "a4",
    name: "Agendamento de Demo",
    description: "Oferece horários de demonstração automaticamente após qualificação do lead.",
    active: true,
    trigger: "Quando: Lead qualificado como 'Quente'",
    execucoes: 870,
    taxaSucesso: 88,
    ultimaExecucao: "há 2 horas",
    nodes: defaultNodes,
  },
  {
    id: "a5",
    name: "Recuperação de Proposta",
    description: "Lembra clientes que receberam proposta mas não responderam após 5 dias.",
    active: true,
    trigger: "Quando: Proposta enviada há 5 dias sem resposta",
    execucoes: 620,
    taxaSucesso: 62,
    ultimaExecucao: "há 4 horas",
    nodes: defaultNodes,
  },
  {
    id: "a6",
    name: "Pesquisa Pós-venda",
    description: "Coleta NPS e feedback dos clientes 7 dias após a conclusão da venda.",
    active: true,
    trigger: "Quando: Venda marcada como concluída",
    execucoes: 1190,
    taxaSucesso: 95,
    ultimaExecucao: "ontem, 18:32",
    nodes: defaultNodes,
  },
  {
    id: "a7",
    name: "Carrinho Abandonado v2",
    description: "Sequência de 3 mensagens para recuperar clientes que não finalizaram a compra.",
    active: false,
    trigger: "Quando: Checkout abandonado há +2h",
    execucoes: 430,
    taxaSucesso: 55,
    ultimaExecucao: "há 3 dias",
    nodes: defaultNodes,
  },
  {
    id: "a8",
    name: "Onboarding Cliente",
    description: "Série de mensagens de onboarding enviadas após a primeira compra confirmada.",
    active: false,
    trigger: "Quando: Primeira compra confirmada",
    execucoes: 700,
    taxaSucesso: 99,
    ultimaExecucao: "há 5 dias",
    nodes: defaultNodes,
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
  if (!automation) return null;

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
                {idx < automation.nodes.length - 1 && (
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

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1">
            Salvar Fluxo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Automations() {
  const [automationList, setAutomationList] = useState<Automation[]>(automations);
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const activeCount = automationList.filter((a) => a.active).length;
  const draftCount = automationList.filter((a) => !a.active).length;
  const totalExecucoes = automationList.reduce((sum, a) => sum + a.execucoes, 0);

  function toggleActive(id: string) {
    setAutomationList((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
    );
  }

  function openEditor(automation: Automation) {
    setSelectedAutomation(automation);
    setBuilderOpen(true);
  }

  function duplicateAutomation(automation: Automation) {
    const newItem: Automation = {
      ...automation,
      id: `a${Date.now()}`,
      name: `${automation.name} (cópia)`,
      active: false,
      execucoes: 0,
      ultimaExecucao: "nunca",
    };
    setAutomationList((prev) => [newItem, ...prev]);
  }

  function deleteAutomation(id: string) {
    setAutomationList((prev) => prev.filter((a) => a.id !== id));
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

            <Button className="gap-2">
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
            {automationList.map((automation) => (
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
                        {automation.execucoes.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">Taxa de sucesso</p>
                      <p
                        className={`font-semibold text-sm ${
                          automation.taxaSucesso >= 80
                            ? "text-green-600"
                            : automation.taxaSucesso >= 60
                            ? "text-yellow-600"
                            : "text-red-500"
                        }`}
                      >
                        {automation.taxaSucesso}%
                      </p>
                    </div>
                  </div>

                  {/* Mini flow preview */}
                  <MiniFlowPreview nodes={automation.nodes} />

                  {/* Divider + footer */}
                  <div className="border-t pt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Última execução: {automation.ultimaExecucao}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        title="Editar"
                        onClick={() => openEditor(automation)}
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

      {/* ------------------------------------------------------------------ */}
      {/* Flow Builder Dialog                                                 */}
      {/* ------------------------------------------------------------------ */}
      <FlowBuilderDialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        automation={selectedAutomation}
      />
    </DashboardLayout>
  );
}
