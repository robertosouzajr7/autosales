import { useState, useEffect, useCallback, useMemo, DragEvent } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Zap, Plus, Trash2, Play, ArrowRight, Save, X, UserPlus,
  MessageSquare, Target, MessageCircle, Timer, Split, Globe, Bot,
  Inbox, Clock, Tag, MoveRight, Users, Calendar, FileEdit,
  StopCircle, Copy, Search, Send, ChevronRight, Layers, Map,
  Sparkles, Brain, GitBranch, Shuffle, BarChart3, Wrench, ScanText,
  Image, Workflow, Lock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Connection,
  type Node,
  type Edge,
  MarkerType,
  Panel,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// =================== CONSTANTS ===================

const TRIGGERS = [
  { id: "NEW_LEAD", label: "Novo Lead", icon: <UserPlus className="w-4 h-4" />, color: "#3b82f6" },
  { id: "NEW_MSG", label: "Nova Mensagem", icon: <MessageSquare className="w-4 h-4" />, color: "#10b981" },
  { id: "KEYWORD", label: "Palavra-chave", icon: <Search className="w-4 h-4" />, color: "#f59e0b" },
  { id: "PIPELINE_MOVE", label: "Mudança de Etapa", icon: <Target className="w-4 h-4" />, color: "#8b5cf6" },
  { id: "INACTIVITY", label: "Inatividade", icon: <Clock className="w-4 h-4" />, color: "#ef4444" },
  { id: "APPOINTMENT_CREATED", label: "Novo Agendamento", icon: <Calendar className="w-4 h-4" />, color: "#6366f1" },
  { id: "SCHEDULE", label: "Agendador Recorrente (Cron)", icon: <Timer className="w-4 h-4" />, color: "#ec4899" },
];

interface NodeTypeDef {
  id: string; label: string; icon: JSX.Element; color: string; category: string;
}

const NODE_TYPES_DEF: NodeTypeDef[] = [
  { id: "PROSPECT_LEAD", label: "Prospecção Inteligente", icon: <Target className="w-4 h-4" />, color: "#0ea5e9", category: "action" },
  { id: "SEND_MSG", label: "Enviar Texto", icon: <MessageCircle className="w-4 h-4" />, color: "#10b981", category: "action" },
  { id: "AI_RESPONSE", label: "Chamar IA", icon: <Bot className="w-4 h-4" />, color: "#7c3aed", category: "action" },
  { id: "COLLECT_INPUT", label: "Coletar Resposta", icon: <Inbox className="w-4 h-4" />, color: "#06b6d4", category: "action" },
  { id: "WAIT", label: "Aguardar Tempo", icon: <Timer className="w-4 h-4" />, color: "#3b82f6", category: "action" },
  { id: "ADD_TAG", label: "Adicionar Tag", icon: <Tag className="w-4 h-4" />, color: "#f59e0b", category: "action" },
  { id: "MOVE_STAGE", label: "Mover Etapa", icon: <MoveRight className="w-4 h-4" />, color: "#6366f1", category: "action" },
  { id: "TRANSFER_HUMAN", label: "Transferir Humano", icon: <Users className="w-4 h-4" />, color: "#ef4444", category: "action" },
  { id: "SCHEDULE_APPOINTMENT", label: "Agendar Reunião", icon: <Calendar className="w-4 h-4" />, color: "#14b8a6", category: "action" },
  { id: "UPDATE_LEAD", label: "Atualizar Lead", icon: <FileEdit className="w-4 h-4" />, color: "#0284c7", category: "action" },
  { id: "HTTP_REQUEST", label: "Webhook / API", icon: <Globe className="w-4 h-4" />, color: "#334155", category: "action" },
  // Fase 3 — IA Avançada
  { id: "AI_TOOLS", label: "IA + Ferramentas", icon: <Wrench className="w-4 h-4" />, color: "#9333ea", category: "ai" },
  { id: "EXTRACT_DATA", label: "Extrair Dados (NER)", icon: <ScanText className="w-4 h-4" />, color: "#0891b2", category: "ai" },
  { id: "CLASSIFY_INTENT", label: "Classificar Intent", icon: <GitBranch className="w-4 h-4" />, color: "#c026d3", category: "ai" },
  { id: "AB_TEST", label: "Teste A/B", icon: <Shuffle className="w-4 h-4" />, color: "#ea580c", category: "ai" },
  { id: "AI_SCORE", label: "Score IA", icon: <BarChart3 className="w-4 h-4" />, color: "#16a34a", category: "ai" },
  // Fase 4 — Escalabilidade
  { id: "SUBFLOW", label: "Subfluxo", icon: <Workflow className="w-4 h-4" />, color: "#6d28d9", category: "logic" },
  { id: "SEND_MEDIA", label: "Enviar Mídia", icon: <Image className="w-4 h-4" />, color: "#059669", category: "action" },
  // Lógica
  { id: "CONDITION", label: "Condição IF/ELSE", icon: <Split className="w-4 h-4" />, color: "#f97316", category: "logic" },
  { id: "END", label: "Fim do Fluxo", icon: <StopCircle className="w-4 h-4" />, color: "#94a3b8", category: "logic" },
];

const OPERATORS = [
  { id: "equals", label: "É igual a" }, { id: "not_equals", label: "Não é igual a" },
  { id: "contains", label: "Contém" }, { id: "not_contains", label: "Não contém" },
  { id: "starts_with", label: "Começa com" }, { id: "ends_with", label: "Termina com" },
  { id: "gt", label: "Maior que" }, { id: "lt", label: "Menor que" },
  { id: "empty", label: "Está vazio" }, { id: "not_empty", label: "Não está vazio" },
  { id: "regex", label: "Regex match" }, { id: "in", label: "Está na lista" },
];

const VARIABLE_HINTS = [
  "{{lead.name}}", "{{lead.phone}}", "{{lead.email}}", "{{lead.status}}",
  "{{lead.source}}", "{{tenant.name}}", "{{conversation.last_message}}",
  "{{appointment.date}}", "{{appointment.time}}", "{{input.resposta}}",
  "{{ai.response}}", "{{ai.intent}}", "{{ai.confidence}}", "{{ai.score}}",
  "{{ai.score_reasoning}}", "{{ai.tool_calls}}", "{{ab.variant}}",
  "{{extracted.nome}}", "{{extracted.empresa}}", "{{extracted.cargo}}",
  "{{current.date}}", "{{current.time}}", "{{current.day_of_week}}"
];

// =================== TEMPLATES ===================
const FLOW_TEMPLATES = [
  {
    name: "Boas-vindas",
    trigger: "NEW_LEAD",
    description: "Saudação automática ao novo lead com qualificação via IA",
    nodes: [
      { id: "n1", type: "SEND_MSG", position: { x: 250, y: 0 }, data: { label: "Enviar Texto", config: { message: "Olá {{lead.name}}! 👋 Bem-vindo! Como posso te ajudar hoje?" } } },
      { id: "n2", type: "COLLECT_INPUT", position: { x: 250, y: 160 }, data: { label: "Coletar Resposta", config: { prompt: "Poderia me dizer seu interesse principal?", variable: "interesse" } } },
      { id: "n3", type: "AI_RESPONSE", position: { x: 250, y: 320 }, data: { label: "Chamar IA", config: { prompt: "Qualifique o lead {{lead.name}} com base no interesse: {{input.interesse}}", sendToLead: true } } },
      { id: "n4", type: "ADD_TAG", position: { x: 250, y: 480 }, data: { label: "Adicionar Tag", config: { tag: "qualificado" } } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" }, { id: "e2", source: "n2", target: "n3" }, { id: "e3", source: "n3", target: "n4" },
    ]
  },
  {
    name: "Follow-up Inteligente",
    trigger: "INACTIVITY",
    triggerConfig: JSON.stringify({ inactivityMinutes: 1440 }),
    description: "Reengaja leads inativos há 24h com mensagem personalizada por IA",
    nodes: [
      { id: "n1", type: "SEND_MSG", position: { x: 250, y: 0 }, data: { label: "Lembrete", config: { message: "Oi {{lead.name}}! 😊 Vi que ficou com dúvidas. Posso te ajudar?" } } },
      { id: "n2", type: "WAIT", position: { x: 250, y: 160 }, data: { label: "Aguardar 48h", config: { value: 48, unit: "hour" } } },
      { id: "n3", type: "AI_RESPONSE", position: { x: 250, y: 320 }, data: { label: "Segundo Follow-up IA", config: { prompt: "Gere uma mensagem criativa de follow-up para {{lead.name}} que mostrou interesse anteriormente", sendToLead: true } } },
      { id: "n4", type: "WAIT", position: { x: 250, y: 480 }, data: { label: "Aguardar 72h", config: { value: 72, unit: "hour" } } },
      { id: "n5", type: "SEND_MSG", position: { x: 250, y: 640 }, data: { label: "Último Contato", config: { message: "{{lead.name}}, esta é sua última chance de aproveitar condições especiais! ⏰" } } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" }, { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" }, { id: "e4", source: "n4", target: "n5" },
    ]
  },
  {
    name: "Qualificação c/ Condição",
    trigger: "NEW_MSG",
    description: "Qualifica lead e direciona para caminhos diferentes com IF/ELSE",
    nodes: [
      { id: "n1", type: "COLLECT_INPUT", position: { x: 300, y: 0 }, data: { label: "Perguntar interesse", config: { prompt: "Olá! Você gostaria de agendar uma demonstração? (sim/não)", variable: "resposta" } } },
      { id: "n2", type: "CONDITION", position: { x: 300, y: 180 }, data: { label: "Verificar Resposta", config: { logic: "OR", rules: [{ field: "{{input.resposta}}", operator: "contains", value: "sim" }, { field: "{{input.resposta}}", operator: "contains", value: "quero" }] } } },
      { id: "n3", type: "SEND_MSG", position: { x: 80, y: 380 }, data: { label: "Resposta SIM", config: { message: "Ótimo! Vou verificar os horários disponíveis para você! 📅" } } },
      { id: "n4", type: "MOVE_STAGE", position: { x: 80, y: 540 }, data: { label: "Mover p/ Agendados", config: { stageName: "Agendados" } } },
      { id: "n5", type: "SEND_MSG", position: { x: 520, y: 380 }, data: { label: "Resposta NÃO", config: { message: "Entendo! Posso te enviar nosso material informativo? 📄" } } },
      { id: "n6", type: "ADD_TAG", position: { x: 520, y: 540 }, data: { label: "Tag: Nutrir", config: { tag: "nutrir" } } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3", sourceHandle: "true" },
      { id: "e3", source: "n2", target: "n5", sourceHandle: "false" },
      { id: "e4", source: "n3", target: "n4" },
      { id: "e5", source: "n5", target: "n6" },
    ]
  },
  {
    name: "Pós-Venda",
    trigger: "APPOINTMENT_CREATED",
    description: "Pesquisa de satisfação após agendamento concluído",
    nodes: [
      { id: "n1", type: "WAIT", position: { x: 250, y: 0 }, data: { label: "Aguardar 24h", config: { value: 24, unit: "hour" } } },
      { id: "n2", type: "COLLECT_INPUT", position: { x: 250, y: 160 }, data: { label: "Pesquisa NPS", config: { prompt: "Oi {{lead.name}}! De 0 a 10, como foi sua experiência? 🌟", variable: "nota" } } },
      { id: "n3", type: "CONDITION", position: { x: 250, y: 340 }, data: { label: "Nota >= 8?", config: { logic: "AND", rules: [{ field: "{{input.nota}}", operator: "gte", value: "8" }] } } },
      { id: "n4", type: "SEND_MSG", position: { x: 50, y: 520 }, data: { label: "Pedir Indicação", config: { message: "Que incrível! 🎉 Conhece alguém que também se beneficiaria? Me indica!" } } },
      { id: "n5", type: "TRANSFER_HUMAN", position: { x: 450, y: 520 }, data: { label: "Alertar Equipe", config: { message: "O cliente {{lead.name}} deu nota baixa ({{input.nota}}). Transferindo para suporte." } } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" }, { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4", sourceHandle: "true" },
      { id: "e4", source: "n3", target: "n5", sourceHandle: "false" },
    ]
  }
];

// =================== CUSTOM NODE COMPONENT ===================

function AutomationNode({ data, selected }: any) {
  if (!data) return <div className="p-4 border-2 border-red-500 bg-red-50 rounded-xl font-bold uppercase text-[10px] text-red-600">Erro de Dado</div>;

  const typeDef = NODE_TYPES_DEF.find(t => t.id === (data.nodeType || "SEND_MSG"));
  const nodeType = data.nodeType || "SEND_MSG";
  
  const isCondition = nodeType === "CONDITION";
  const isEnd = nodeType === "END";
  const isClassifyIntent = nodeType === "CLASSIFY_INTENT";
  const isAIScore = nodeType === "AI_SCORE";
  const isABTest = nodeType === "AB_TEST";
  const hasMultipleOutputs = isCondition || isClassifyIntent || isAIScore;

  const config = data.config || {};

  return (
    <div className={`relative transition-all duration-200 ${selected ? 'scale-105' : ''}`}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-300 !border-2 !border-white" />

      <div className={`min-w-[220px] max-w-[280px] rounded-2xl bg-white shadow-xl border-2 transition-all ${selected ? 'border-emerald-400 shadow-emerald-500/20' : 'border-slate-100 hover:border-slate-300'}`}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0" style={{ backgroundColor: typeDef?.color || "#64748b" }}>
            {typeDef?.icon || <Zap className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{nodeType}</p>
            <p className="text-[11px] font-black text-slate-900 truncate">{data.label || typeDef?.label || "Bloco"}</p>
          </div>
        </div>

        {config.message && (
          <div className="px-4 pb-3">
            <p className="text-[9px] text-slate-400 bg-slate-50 rounded-lg p-2 truncate font-medium">
              💬 {String(config.message).substring(0, 50)}...
            </p>
          </div>
        )}

        {config.prompt && !['SEND_MSG', 'AB_TEST'].includes(nodeType) && (
          <div className="px-4 pb-3">
            <p className="text-[9px] text-violet-400 bg-violet-50 rounded-lg p-2 truncate font-medium">
              🤖 {String(config.prompt).substring(0, 50)}...
            </p>
          </div>
        )}

        {isCondition && (
          <div className="px-4 pb-3 grid grid-cols-2 gap-2">
            <div className="text-center p-1.5 rounded-lg text-[8px] font-black uppercase bg-emerald-50 text-emerald-600">✅ SIM</div>
            <div className="text-center p-1.5 rounded-lg text-[8px] font-black uppercase bg-red-50 text-red-500">❌ NÃO</div>
          </div>
        )}

        {isClassifyIntent && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-1">
              {(config.intents || [{id:'comprar'},{id:'duvida'},{id:'outro'}]).slice(0, 4).map((i: any) => (
                <span key={i?.id || Math.random()} className="text-[7px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full font-black uppercase">{i?.id || "OUTRO"}</span>
              ))}
            </div>
          </div>
        )}

        {isAIScore && (
          <div className="px-4 pb-3 grid grid-cols-3 gap-1">
            <div className="text-center p-1 rounded-lg text-[7px] font-black uppercase bg-red-50 text-red-500">🥶 Frio</div>
            <div className="text-center p-1 rounded-lg text-[7px] font-black uppercase bg-amber-50 text-amber-600">☀️ Morno</div>
            <div className="text-center p-1 rounded-lg text-[7px] font-black uppercase bg-emerald-50 text-emerald-600">🔥 Quente</div>
          </div>
        )}

        {isABTest && config.variants && (
          <div className="px-4 pb-3">
            <p className="text-[8px] text-orange-500 font-bold">{Array.isArray(config.variants) ? config.variants.length : 0} variantes</p>
          </div>
        )}
      </div>

      {!isEnd && !hasMultipleOutputs && (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-white" />
      )}

      {isCondition && (
        <>
          <Handle type="source" position={Position.Bottom} id="true" className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white" style={{ left: "30%" }} />
          <Handle type="source" position={Position.Bottom} id="false" className="!w-3 !h-3 !bg-red-500 !border-2 !border-white" style={{ left: "70%" }} />
        </>
      )}

      {isClassifyIntent && (
        <>
          {(config.intents || [{id:'comprar'},{id:'duvida'},{id:'suporte'},{id:'cancelar'},{id:'outro'}]).map((intent: any, idx: number, arr: any[]) => (
            <Handle
              key={intent?.id || idx}
              type="source"
              position={Position.Bottom}
              id={intent?.id || `out_${idx}`}
              className="!w-2.5 !h-2.5 !bg-violet-500 !border-2 !border-white"
              style={{ left: `${((idx + 1) / (arr.length + 1)) * 100}%` }}
            />
          ))}
        </>
      )}

      {isAIScore && (
        <>
          <Handle type="source" position={Position.Bottom} id="cold" className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white" style={{ left: "20%" }} />
          <Handle type="source" position={Position.Bottom} id="warm" className="!w-3 !h-3 !bg-amber-400 !border-2 !border-white" style={{ left: "50%" }} />
          <Handle type="source" position={Position.Bottom} id="hot" className="!w-3 !h-3 !bg-red-500 !border-2 !border-white" style={{ left: "80%" }} />
        </>
      )}
    </div>
  );
}

// =================== MAIN COMPONENT ===================

export default function Automations() {
  const [autos, setAutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedAuto, setSelectedAuto] = useState<any | null>(null);
  const [newAuto, setNewAuto] = useState({ name: "", trigger: "NEW_LEAD", description: "", triggerConfig: "{}" });
  const [execStats, setExecStats] = useState<any>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [tenantLimits, setTenantLimits] = useState<any>({ aiEnabled: false, webhookEnabled: false });

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { toast } = useToast();

  const nodeTypes: NodeTypes = useMemo(() => ({
    automationNode: AutomationNode,
  }), []);

  const defaultEdgeOptions = useMemo(() => ({
    animated: true,
    style: { stroke: "#94a3b8", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
  }), []);

  // -------- FETCH --------
  const fetchData = async () => {
    try {
      const res = await fetch("/api/automations");
      const data = await res.json();
      setAutos(Array.isArray(data) ? data : []);
    } catch (e) { toast({ title: "Erro nas automações", variant: "destructive" }); }
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/automations/executions/stats");
      const data = await res.json();
      setExecStats(data);
    } catch { }
  };

  const [hasSdr, setHasSdr] = useState<boolean>(false);

  const fetchTenantData = async () => {
    try {
      const res = await fetch("/api/tenant/settings");
      if (res.ok) {
        const data = await res.json();
        setTenantLimits(data.planFeatures || { aiEnabled: false, webhookEnabled: false });
        setHasSdr(!!data.hasSdr);
      }
    } catch { }
  };

  useEffect(() => { fetchData(); fetchStats(); fetchTenantData(); }, []);

  // -------- CRUD --------
  const handleCreateAuto = async () => {
    if (!newAuto.name) return toast({ title: "Nome obrigatório", variant: "destructive" });
    try {
      const res = await fetch("/api/automations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAuto)
      });
      if (res.ok) {
        toast({ title: "✅ Workflow Criado!" }); setIsAddModalOpen(false);
        setNewAuto({ name: "", trigger: "NEW_LEAD", description: "", triggerConfig: "{}" }); fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Atenção", description: err.error || "Falha ao criar", variant: "destructive" });
      }
    } catch (e) { toast({ title: "Falha conexão", variant: "destructive" }); }
  };

  const createFromTemplate = async (template: typeof FLOW_TEMPLATES[0]) => {
    try {
      const res = await fetch("/api/automations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          trigger: template.trigger,
          triggerConfig: template.triggerConfig || "{}",
          description: template.description,
          nodes: JSON.stringify(template.nodes),
          edges: JSON.stringify(template.edges),
        })
      });
      if (res.ok) {
        toast({ title: `✅ Template "${template.name}" criado!` }); setShowTemplates(false); fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Bloqueado", description: err.error || "Erro", variant: "destructive" });
      }
    } catch { toast({ title: "Falha conexão", variant: "destructive" }); }
  };

  const toggleAuto = async (id: string, current: boolean) => {
    await fetch(`/api/automations/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current })
    });
    toast({ title: current ? "⏸ Pausado" : "▶ Ativado" }); fetchData();
  };

  const deleteAuto = async (id: string) => {
    if (!confirm("Deletar esta automação?")) return;
    await fetch(`/api/automations/${id}`, { method: "DELETE" }); fetchData();
  };

  const duplicateAuto = async (id: string) => {
    try {
      const res = await fetch(`/api/automations/${id}/duplicate`, { method: "POST" });
      if (res.ok) {
        toast({ title: "📋 Duplicado" }); fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Opa!", description: err.error, variant: "destructive" });
      }
    } catch { toast({ title: "Erdro", variant: "destructive" }); }
  };

  // -------- BUILDER --------
  const openBuilder = (auto: any) => {
    setSelectedAuto(auto);
    try {
      const parsedNodes = JSON.parse(auto.nodes || "[]");
      const rfNodes = (Array.isArray(parsedNodes) ? parsedNodes : []).map((n: any) => ({
        id: n.id || `node_${Math.random()}`, 
        type: "automationNode", 
        position: n.position || { x: 250, y: 0 },
        data: { ...(n.data || {}), nodeType: n.type || "SEND_MSG" },
      }));
      setNodes(rfNodes);
    } catch (e) { 
      console.error("Erro nodes:", e);
      setNodes([]); 
    }
    
    try { 
      const parsedEdges = JSON.parse(auto.edges || "[]");
      setEdges(Array.isArray(parsedEdges) ? parsedEdges : []); 
    } catch { 
      setEdges([]); 
    }
    
    setSelectedNodeId(null);
    setIsBuilderOpen(true);
  };

  const handleSaveWorkflow = async () => {
    // Convert ReactFlow nodes back to our format
    const ourNodes = nodes.map(n => ({
      id: n.id, type: (n.data as any).nodeType, position: n.position,
      data: { label: (n.data as any).label, config: (n.data as any).config || {} },
    }));
    try {
      await fetch(`/api/automations/${selectedAuto.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: JSON.stringify(ourNodes), edges: JSON.stringify(edges) })
      });
      toast({ title: "💎 Workflow Salvo!" }); setIsBuilderOpen(false); fetchData();
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({ ...connection, animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" } }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
  }, [selectedNodeId]);

  // Drag & Drop from palette
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const typeId = event.dataTransfer.getData("application/reactflow");
      if (!typeId) return;

      const typeDef = NODE_TYPES_DEF.find(t => t.id === typeId);
      if (typeDef?.category === 'ai' && !tenantLimits?.aiEnabled) {
         toast({ title: "Plano Inicial", description: "Faça Upgrade para liberar a Inteligência Artificial avançada.", variant: "destructive" });
         return;
      }
      if (typeId === 'HTTP_REQUEST' && !tenantLimits?.webhookEnabled) {
         toast({ title: "Plano Inicial", description: "Faça Upgrade para liberar integrações e Webhooks externos.", variant: "destructive" });
         return;
      }

      const reactFlowBounds = document.querySelector(".react-flow")?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left - 140,
        y: event.clientY - reactFlowBounds.top - 30,
      };

      const newNode: Node = {
        id: `node_${Date.now()}`,
        type: "automationNode",
        position,
        data: { label: typeDef?.label || typeId, nodeType: typeId, config: {} },
      };

      setNodes(nds => [...nds, newNode]);
    },
    [setNodes]
  );

  const onDragStart = (event: DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const addNodeClick = (typeId: string) => {
    const typeDef = NODE_TYPES_DEF.find(t => t.id === typeId);
    const lastNode = nodes[nodes.length - 1];
    const position = lastNode
      ? { x: lastNode.position.x, y: lastNode.position.y + 180 }
      : { x: 250, y: 0 };

    const newNode: Node = {
      id: `node_${Date.now()}`, type: "automationNode", position,
      data: { label: typeDef?.label || typeId, nodeType: typeId, config: {} },
    };

    setNodes(nds => [...nds, newNode]);

    if (lastNode) {
      setEdges(eds => addEdge({
        id: `edge_${Date.now()}`, source: lastNode.id, target: newNode.id,
        animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" }
      }, eds));
    }
  };

  const removeNode = (nodeId: string) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const updateNodeConfig = (nodeId: string, key: string, value: any) => {
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, config: { ...(n.data as any).config, [key]: value } } } : n
    ));
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedNodeData = selectedNode?.data as any;

  // =================== RENDER ===================
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 p-6 lg:p-10 max-w-[1600px] mx-auto animate-in slide-in-from-top duration-700">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
              <Zap className="w-8 h-8 text-emerald-500" />
              Hub de <span className="text-emerald-500 italic">Automações</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
              Builder Visual Drag & Drop — Powered by ReactFlow
            </p>
          </div>

          <div className="flex gap-3 items-center">
            {execStats && (
              <div className="hidden lg:flex items-center gap-6 mr-4">
                <div className="text-center"><p className="text-[9px] font-black text-slate-300 uppercase">Total</p><p className="text-lg font-black text-slate-900">{execStats.total || 0}</p></div>
                <div className="text-center"><p className="text-[9px] font-black text-emerald-400 uppercase">OK</p><p className="text-lg font-black text-emerald-600">{execStats.completed || 0}</p></div>
                <div className="text-center"><p className="text-[9px] font-black text-red-400 uppercase">Falhas</p><p className="text-lg font-black text-red-500">{execStats.failed || 0}</p></div>
              </div>
            )}
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-3">
                <Button 
                  onClick={() => hasSdr ? setShowTemplates(true) : toast({ title: "SDR Necessário", description: "Contrate um SDR antes de criar automações.", variant: "destructive" })} 
                  variant="outline" 
                  className={`h-11 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 ${!hasSdr ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Layers className="w-4 h-4 mr-2" /> Templates
                </Button>
                <Button 
                  onClick={() => hasSdr ? setIsAddModalOpen(true) : toast({ title: "SDR Necessário", description: "Contrate um SDR antes de criar automações.", variant: "destructive" })} 
                  className={`h-11 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white shadow-xl ${!hasSdr ? 'bg-slate-700 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`}
                >
                  <Plus className="w-4 h-4 mr-2" /> Criar
                </Button>
              </div>
              {!hasSdr && (
                <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest animate-pulse mr-1">Requer SDR Contratado</p>
              )}
            </div>
          </div>
        </div>

        {/* GRID */}
        {autos.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-40">
            <Zap className="w-16 h-16 text-slate-200 mb-4" />
            <p className="text-sm font-black uppercase tracking-widest text-slate-400">Crie seu primeiro workflow</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {autos.map(auto => {
              const triggerDef = TRIGGERS.find(t => t.id === auto.trigger);
              const nodeCount = (() => { try { return JSON.parse(auto.nodes || "[]").length; } catch { return 0; } })();
              return (
                <Card key={auto.id} className="border-none shadow-xl rounded-[32px] bg-white overflow-hidden hover:-translate-y-1 transition-all duration-300 group">
                  <CardContent className="p-0">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between group-hover:bg-slate-900 transition-colors duration-300">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: auto.active ? (triggerDef?.color || "#10b981") : "#94a3b8" }}>
                          {triggerDef?.icon || <Zap className="w-6 h-6" />}
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-800 tracking-tight group-hover:text-white transition-colors">{auto.name}</h3>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[7px] font-black border-none ${auto.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                              {auto.active ? "ATIVO" : "PAUSADO"}
                            </Badge>
                            <span className="text-[8px] font-bold text-slate-400 group-hover:text-white/30">{triggerDef?.label}</span>
                          </div>
                        </div>
                      </div>
                      <Switch checked={auto.active} onCheckedChange={() => toggleAuto(auto.id, auto.active)} className="data-[state=checked]:bg-emerald-500" />
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl text-center"><p className="text-[7px] font-black text-slate-300 uppercase">Execuções</p><p className="text-lg font-black text-slate-700">{auto.totalExecutions || 0}</p></div>
                        <div className="p-3 bg-slate-50 rounded-xl text-center"><p className="text-[7px] font-black text-slate-300 uppercase">Nós</p><p className="text-lg font-black text-slate-700">{nodeCount}</p></div>
                      </div>
                      {auto.description && <p className="text-[10px] text-slate-400 font-medium line-clamp-2">{auto.description}</p>}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg" onClick={() => duplicateAuto(auto.id)}><Copy className="w-3.5 h-3.5 text-slate-300" /></Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg hover:bg-red-50" onClick={() => deleteAuto(auto.id)}><Trash2 className="w-3.5 h-3.5 text-slate-300" /></Button>
                        </div>
                        <button onClick={() => openBuilder(auto)} className="text-emerald-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                          Editar <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* =============== CRIAR MODAL =============== */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="rounded-[32px] p-10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2"><Zap className="text-emerald-500" /> Novo Workflow</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-widest">Nome</Label>
              <Input value={newAuto.name} onChange={e => setNewAuto({ ...newAuto, name: e.target.value })} className="h-14 rounded-2xl border-2 border-slate-50" placeholder="Ex: Follow-up Inteligente" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-widest">Gatilho</Label>
              <Select value={newAuto.trigger} onValueChange={v => setNewAuto({ ...newAuto, trigger: v })}>
                <SelectTrigger className="h-14 rounded-2xl border-2 border-slate-50 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl shadow-2xl">
                  {TRIGGERS.map(t => <SelectItem key={t.id} value={t.id} className="font-bold py-3"><span className="flex items-center gap-2">{t.icon} {t.label}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {newAuto.trigger === "KEYWORD" && (
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-widest">Palavras-chave</Label>
                <Input placeholder="preço, promoção, desconto" onChange={e => setNewAuto({ ...newAuto, triggerConfig: JSON.stringify({ keywords: e.target.value.split(",").map(k => k.trim()) }) })} className="h-12 rounded-2xl border-2 border-slate-50" />
              </div>
            )}
            {newAuto.trigger === "INACTIVITY" && (
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-widest">Minutos de Inatividade</Label>
                <Input type="number" defaultValue={1440} onChange={e => setNewAuto({ ...newAuto, triggerConfig: JSON.stringify({ inactivityMinutes: parseInt(e.target.value) }) })} className="h-12 rounded-2xl border-2 border-slate-50" />
              </div>
            )}
            {newAuto.trigger === "SCHEDULE" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-widest">Frequência</Label>
                  <Select defaultValue="daily_9" onValueChange={v => {
                    const presets: Record<string, string> = {
                      "every_hour": "0 * * * *",
                      "daily_9": "0 9 * * *",
                      "daily_14": "0 14 * * *",
                      "weekdays_9": "0 9 * * 1-5",
                      "monday_9": "0 9 * * 1",
                      "custom": ""
                    };
                    const prev = JSON.parse(newAuto.triggerConfig || "{}");
                    setNewAuto({ ...newAuto, triggerConfig: JSON.stringify({ ...prev, schedule: presets[v], preset: v }) });
                  }}>
                    <SelectTrigger className="h-12 rounded-2xl border-2 border-slate-50 font-bold"><SelectValue placeholder="Diário às 9h" /></SelectTrigger>
                    <SelectContent className="rounded-2xl shadow-xl">
                      <SelectItem value="every_hour">A cada hora</SelectItem>
                      <SelectItem value="daily_9">Diário às 9h</SelectItem>
                      <SelectItem value="daily_14">Diário às 14h</SelectItem>
                      <SelectItem value="weekdays_9">Dias úteis às 9h</SelectItem>
                      <SelectItem value="monday_9">Segundas às 9h</SelectItem>
                      <SelectItem value="custom">Personalizado (cron)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(() => { try { return JSON.parse(newAuto.triggerConfig || "{}").preset === "custom"; } catch { return false; } })() && (
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-widest">Expressão Cron</Label>
                    <Input placeholder="0 9 * * 1-5" onChange={e => {
                      const prev = JSON.parse(newAuto.triggerConfig || "{}");
                      setNewAuto({ ...newAuto, triggerConfig: JSON.stringify({ ...prev, schedule: e.target.value }) });
                    }} className="h-12 rounded-2xl border-2 border-slate-50 font-mono tracking-widest" />
                    <p className="text-[10px] font-bold text-slate-400">Formato: minuto hora dia mês dia_semana</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-widest">Filtro Alvo (Aplicar para:)</Label>
                  <Select onValueChange={v => {
                      let cfg: any = { schedule: "0 9 * * *", targetFilter: { status: "NEW" }, preset: "daily_9" };
                      try { cfg = JSON.parse(newAuto.triggerConfig || "{}"); } catch(err){}
                      cfg.targetFilter = { status: v };
                      setNewAuto({ ...newAuto, triggerConfig: JSON.stringify(cfg) });
                  }}>
                    <SelectTrigger className="h-12 rounded-2xl border-2 border-slate-50 font-bold">
                      <SelectValue placeholder="Selecione o filtro dos leads..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl shadow-xl">
                      <SelectItem value="NEW" className="font-bold">Leads Novos (Sem atendimento)</SelectItem>
                      <SelectItem value="INACTIVE_7_DAYS" className="font-bold">Leads Inativos (Últimos 7 dias)</SelectItem>
                      <SelectItem value="ALL" className="font-bold">Todos os Leads da Conta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-widest">Descrição</Label>
              <Textarea value={newAuto.description} onChange={e => setNewAuto({ ...newAuto, description: e.target.value })} className="min-h-[80px] rounded-2xl border-2 border-slate-50" placeholder="O que este fluxo faz?" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateAuto} className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl uppercase tracking-widest text-sm shadow-2xl">
              <Save className="w-4 h-4 mr-2 text-emerald-500" /> Criar Automação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =============== TEMPLATES MODAL =============== */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="rounded-[32px] p-10 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2"><Layers className="text-violet-500" /> Templates Pré-Configurados</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {FLOW_TEMPLATES.map((tmpl, i) => {
              const trigDef = TRIGGERS.find(t => t.id === tmpl.trigger);
              return (
                <div key={i} className="p-6 rounded-2xl border-2 border-slate-100 hover:border-emerald-200 transition-all cursor-pointer group" onClick={() => createFromTemplate(tmpl)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: trigDef?.color || "#10b981" }}>
                        {trigDef?.icon || <Zap className="w-6 h-6" />}
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">{tmpl.name}</h4>
                        <p className="text-[10px] text-slate-400 font-medium">{tmpl.description}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge className="text-[7px] bg-slate-100 text-slate-500 border-none font-black">{trigDef?.label}</Badge>
                          <Badge className="text-[7px] bg-violet-100 text-violet-600 border-none font-black">{tmpl.nodes.length} nós</Badge>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* =============== BUILDER (REACTFLOW) =============== */}
      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className="max-w-[1500px] h-[94vh] p-0 overflow-hidden border-none shadow-3xl rounded-[32px] flex flex-col bg-slate-50">

          {/* Header */}
          <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500 p-2.5 rounded-xl shadow-lg"><Zap className="text-white w-5 h-5" /></div>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">{selectedAuto?.name}</h2>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  {nodes.length} blocos · {edges.length} conexões · Trigger: {TRIGGERS.find(t => t.id === selectedAuto?.trigger)?.label || selectedAuto?.trigger}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setIsBuilderOpen(false)} variant="ghost" className="h-10 w-10 rounded-xl text-slate-300"><X className="w-5 h-5" /></Button>
              <Button onClick={handleSaveWorkflow} className="h-10 bg-slate-900 hover:bg-black px-6 rounded-xl font-black uppercase text-[10px] tracking-widest text-white shadow-xl">
                <Save className="w-4 h-4 mr-2 text-emerald-500" /> Salvar
              </Button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* SIDEBAR */}
            <div className="w-56 bg-white border-r border-slate-100 p-3 flex flex-col gap-3 overflow-y-auto shrink-0">
              <h4 className="text-[8px] font-black text-slate-300 uppercase tracking-widest px-2">Ações — arraste ou clique</h4>
              {NODE_TYPES_DEF.filter(t => t.category === "action").map(st => (
                <div
                  key={st.id}
                  draggable
                  onDragStart={e => onDragStart(e, st.id)}
                  onClick={() => addNodeClick(st.id)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 active:scale-95 transition-all cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-100"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md shrink-0" style={{ backgroundColor: st.color }}>{st.icon}</div>
                  <div className="flex flex-1 items-center justify-between">
                     <span className="text-[9px] font-black uppercase text-slate-600 tracking-tight">{st.label}</span>
                     {(st.id === "HTTP_REQUEST" && !tenantLimits?.webhookEnabled) && <Lock className="w-3 h-3 text-red-400" />}
                  </div>
                </div>
              ))}
              <h4 className="text-[8px] font-black text-purple-400 uppercase tracking-widest px-2 mt-2">⚡ IA Avançada</h4>
              {NODE_TYPES_DEF.filter(t => t.category === "ai").map(st => (
                <div
                  key={st.id}
                  draggable
                  onDragStart={e => onDragStart(e, st.id)}
                  onClick={() => addNodeClick(st.id)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-purple-50 active:scale-95 transition-all cursor-grab active:cursor-grabbing border border-transparent hover:border-purple-100"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md shrink-0" style={{ backgroundColor: st.color }}>{st.icon}</div>
                  <div className="flex flex-1 items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-600 tracking-tight">{st.label}</span>
                    {!tenantLimits.aiEnabled && <Lock className="w-3 h-3 text-red-400" />}
                  </div>
                </div>
              ))}
              <h4 className="text-[8px] font-black text-slate-300 uppercase tracking-widest px-2 mt-2">Lógica</h4>
              {NODE_TYPES_DEF.filter(t => t.category === "logic").map(st => (
                <div
                  key={st.id}
                  draggable
                  onDragStart={e => onDragStart(e, st.id)}
                  onClick={() => addNodeClick(st.id)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 active:scale-95 transition-all cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-100"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md shrink-0" style={{ backgroundColor: st.color }}>{st.icon}</div>
                  <span className="text-[9px] font-black uppercase text-slate-600 tracking-tight">{st.label}</span>
                </div>
              ))}

              <div className="mt-auto p-3 bg-violet-50 border border-violet-100 rounded-xl">
                <p className="text-[8px] font-black text-violet-700 uppercase tracking-widest mb-2">Variáveis</p>
                <div className="flex flex-wrap gap-1">
                  {VARIABLE_HINTS.slice(0, 10).map(v => (
                    <span key={v} className="text-[7px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-bold cursor-pointer hover:bg-violet-200" onClick={() => navigator.clipboard.writeText(v)}>
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* REACTFLOW CANVAS */}
            <div className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                fitView
                snapToGrid
                snapGrid={[20, 20]}
                className="react-flow"
                deleteKeyCode={["Backspace", "Delete"]}
              >
                <Background color="#e2e8f0" gap={20} size={1} />
                <Controls className="!rounded-xl !shadow-xl !border-none" />
                <MiniMap
                  nodeColor={(node) => {
                    const typeDef = NODE_TYPES_DEF.find(t => t.id === (node.data as any).nodeType);
                    return typeDef?.color || "#94a3b8";
                  }}
                  className="!rounded-xl !shadow-xl !border-none"
                  maskColor="rgba(0,0,0,0.05)"
                />
                <Panel position="top-right" className="flex gap-2">
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg flex items-center gap-2">
                    <Map className="w-4 h-4 text-slate-400" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Arraste blocos do menu · Conecte arrastando os handles
                    </span>
                  </div>
                </Panel>
              </ReactFlow>
            </div>

            {/* PROPERTIES PANEL */}
            {selectedNode && selectedNodeData && (
              <div className="w-72 bg-white border-l border-slate-100 p-5 overflow-y-auto shrink-0">
                <div className="flex items-center justify-between mb-5">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Propriedades</h4>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg hover:bg-red-50" onClick={() => removeNode(selectedNode.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setSelectedNodeId(null)}>
                      <X className="w-3.5 h-3.5 text-slate-300" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedNodeData.nodeType === "SEND_MSG" && (
                    <div className="space-y-2">
                      <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Mensagem</Label>
                      <Textarea value={selectedNodeData.config?.message || ""} onChange={e => updateNodeConfig(selectedNode.id, "message", e.target.value)} className="min-h-[100px] rounded-xl border-slate-100 text-xs" placeholder="Olá {{lead.name}}! 👋" />
                    </div>
                  )}

                  {selectedNodeData.nodeType === "WAIT" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Tempo</Label>
                        <Input type="number" value={selectedNodeData.config?.value || 1} onChange={e => updateNodeConfig(selectedNode.id, "value", parseInt(e.target.value))} className="h-10 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Unidade</Label>
                        <Select value={selectedNodeData.config?.unit || "hour"} onValueChange={v => updateNodeConfig(selectedNode.id, "unit", v)}>
                          <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="min">Minutos</SelectItem><SelectItem value="hour">Horas</SelectItem><SelectItem value="day">Dias</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {selectedNodeData.nodeType === "COLLECT_INPUT" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Pergunta</Label>
                        <Textarea value={selectedNodeData.config?.prompt || ""} onChange={e => updateNodeConfig(selectedNode.id, "prompt", e.target.value)} className="min-h-[80px] rounded-xl text-xs" placeholder="Qual seu nome?" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Variável</Label>
                        <Input value={selectedNodeData.config?.variable || "resposta"} onChange={e => updateNodeConfig(selectedNode.id, "variable", e.target.value)} className="h-10 rounded-lg" />
                        <p className="text-[7px] text-cyan-500 font-bold">Acesse: {"{{input." + (selectedNodeData.config?.variable || "resposta") + "}}"}</p>
                      </div>
                    </>
                  )}

                  {selectedNodeData.nodeType === "AI_RESPONSE" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Prompt IA</Label>
                        <Textarea value={selectedNodeData.config?.prompt || ""} onChange={e => updateNodeConfig(selectedNode.id, "prompt", e.target.value)} className="min-h-[100px] rounded-xl text-xs" placeholder="Qualifique o lead {{lead.name}}..." />
                      </div>
                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <span className="text-[8px] font-black uppercase text-slate-500">Enviar ao lead</span>
                        <Switch checked={selectedNodeData.config?.sendToLead !== false} onCheckedChange={v => updateNodeConfig(selectedNode.id, "sendToLead", v)} />
                      </div>
                    </>
                  )}

                  {selectedNodeData.nodeType === "CONDITION" && (
                    <>
                      <Select value={selectedNodeData.config?.logic || "AND"} onValueChange={v => updateNodeConfig(selectedNode.id, "logic", v)}>
                        <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="AND">AND</SelectItem><SelectItem value="OR">OR</SelectItem></SelectContent>
                      </Select>
                      {(selectedNodeData.config?.rules || []).map((rule: any, rIdx: number) => (
                        <div key={rIdx} className="p-2 bg-slate-50 rounded-lg space-y-1.5">
                          <Input value={rule.field} placeholder="{{lead.status}}" onChange={e => { const r = [...(selectedNodeData.config?.rules || [])]; r[rIdx] = { ...r[rIdx], field: e.target.value }; updateNodeConfig(selectedNode.id, "rules", r); }} className="h-8 rounded-md text-[10px]" />
                          <Select value={rule.operator} onValueChange={v => { const r = [...(selectedNodeData.config?.rules || [])]; r[rIdx] = { ...r[rIdx], operator: v }; updateNodeConfig(selectedNode.id, "rules", r); }}>
                            <SelectTrigger className="h-8 rounded-md text-[10px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{OPERATORS.map(op => <SelectItem key={op.id} value={op.id}>{op.label}</SelectItem>)}</SelectContent>
                          </Select>
                          {!["empty", "not_empty"].includes(rule.operator) && (
                            <Input value={rule.value} placeholder="Valor" onChange={e => { const r = [...(selectedNodeData.config?.rules || [])]; r[rIdx] = { ...r[rIdx], value: e.target.value }; updateNodeConfig(selectedNode.id, "rules", r); }} className="h-8 rounded-md text-[10px]" />
                          )}
                          <Button variant="ghost" size="sm" className="text-red-400 text-[8px] p-0 h-6" onClick={() => { const r = (selectedNodeData.config?.rules || []).filter((_: any, i: number) => i !== rIdx); updateNodeConfig(selectedNode.id, "rules", r); }}>
                            <Trash2 className="w-3 h-3 mr-1" /> Remover
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full rounded-lg text-[8px] font-black uppercase" onClick={() => updateNodeConfig(selectedNode.id, "rules", [...(selectedNodeData.config?.rules || []), { field: "", operator: "contains", value: "" }])}>
                        <Plus className="w-3 h-3 mr-1" /> Regra
                      </Button>
                    </>
                  )}

                  {selectedNodeData.nodeType === "ADD_TAG" && (
                    <div className="space-y-2">
                      <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Tag</Label>
                      <Input value={selectedNodeData.config?.tag || ""} onChange={e => updateNodeConfig(selectedNode.id, "tag", e.target.value)} className="h-10 rounded-lg" placeholder="quente" />
                    </div>
                  )}

                  {selectedNodeData.nodeType === "MOVE_STAGE" && (
                    <div className="space-y-2">
                      <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Etapa</Label>
                      <Input value={selectedNodeData.config?.stageName || ""} onChange={e => updateNodeConfig(selectedNode.id, "stageName", e.target.value)} className="h-10 rounded-lg" placeholder="Qualificando" />
                    </div>
                  )}

                  {selectedNodeData.nodeType === "TRANSFER_HUMAN" && (
                    <div className="space-y-2">
                      <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Mensagem</Label>
                      <Textarea value={selectedNodeData.config?.message || ""} onChange={e => updateNodeConfig(selectedNode.id, "message", e.target.value)} className="min-h-[80px] rounded-xl text-xs" placeholder="Transferindo..." />
                    </div>
                  )}

                  {selectedNodeData.nodeType === "HTTP_REQUEST" && (
                    <>
                      <div className="space-y-2"><Label className="text-[8px] font-black uppercase text-slate-400">URL</Label><Input value={selectedNodeData.config?.url || ""} onChange={e => updateNodeConfig(selectedNode.id, "url", e.target.value)} className="h-9 rounded-lg text-xs" /></div>
                      <Select value={selectedNodeData.config?.method || "POST"} onValueChange={v => updateNodeConfig(selectedNode.id, "method", v)}>
                        <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem><SelectItem value="PUT">PUT</SelectItem></SelectContent>
                      </Select>
                      <div className="space-y-2"><Label className="text-[8px] font-black uppercase text-slate-400">Body</Label><Textarea value={selectedNodeData.config?.body || ""} onChange={e => updateNodeConfig(selectedNode.id, "body", e.target.value)} className="min-h-[60px] rounded-xl font-mono text-[10px]" /></div>
                    </>
                  )}

                  {selectedNodeData.nodeType === "SCHEDULE_APPOINTMENT" && (
                    <>
                      <div className="space-y-2"><Label className="text-[8px] font-black uppercase text-slate-400">Título</Label><Input value={selectedNodeData.config?.title || ""} onChange={e => updateNodeConfig(selectedNode.id, "title", e.target.value)} className="h-9 rounded-lg text-xs" /></div>
                      <div className="space-y-2"><Label className="text-[8px] font-black uppercase text-slate-400">Data (ISO)</Label><Input value={selectedNodeData.config?.date || ""} onChange={e => updateNodeConfig(selectedNode.id, "date", e.target.value)} className="h-9 rounded-lg text-xs" placeholder="{{input.data}}" /></div>
                    </>
                  )}

                  {selectedNodeData.nodeType === "UPDATE_LEAD" && (
                    <>
                      <div className="space-y-2"><Label className="text-[8px] font-black uppercase text-slate-400">Nome</Label><Input value={selectedNodeData.config?.name || ""} onChange={e => updateNodeConfig(selectedNode.id, "name", e.target.value)} className="h-9 rounded-lg text-xs" /></div>
                      <div className="space-y-2"><Label className="text-[8px] font-black uppercase text-slate-400">Email</Label><Input value={selectedNodeData.config?.email || ""} onChange={e => updateNodeConfig(selectedNode.id, "email", e.target.value)} className="h-9 rounded-lg text-xs" /></div>
                    </>
                  )}

                  {/* ===== FASE 4 — SUBFLOW & MEDIA ===== */}

                  {selectedNodeData.nodeType === "SUBFLOW" && (
                    <div className="space-y-2">
                      <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">ID da Automação</Label>
                      <Input value={selectedNodeData.config?.automationId || ""} onChange={e => updateNodeConfig(selectedNode.id, "automationId", e.target.value)} className="h-9 rounded-lg text-xs font-mono" placeholder="UUID da automação alvo" />
                      <p className="text-[7px] text-violet-400 font-bold">Dispara outra automação para o mesmo lead (enfileirado)</p>
                    </div>
                  )}

                  {selectedNodeData.nodeType === "SEND_MEDIA" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">URL da Mídia</Label>
                        <Input value={selectedNodeData.config?.mediaUrl || ""} onChange={e => updateNodeConfig(selectedNode.id, "mediaUrl", e.target.value)} className="h-9 rounded-lg text-xs" placeholder="https://..." />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Tipo</Label>
                        <Select value={selectedNodeData.config?.mediaType || "image"} onValueChange={v => updateNodeConfig(selectedNode.id, "mediaType", v)}>
                          <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="image">Imagem</SelectItem>
                            <SelectItem value="video">Vídeo</SelectItem>
                            <SelectItem value="document">Documento</SelectItem>
                            <SelectItem value="audio">Áudio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Legenda</Label>
                        <Textarea value={selectedNodeData.config?.caption || ""} onChange={e => updateNodeConfig(selectedNode.id, "caption", e.target.value)} className="min-h-[60px] rounded-xl text-xs" placeholder="Veja nosso catálogo..." />
                      </div>
                    </>
                  )}

                  {/* ===== FASE 3 — IA AVANÇADA ===== */}

                  {selectedNodeData.nodeType === "AI_TOOLS" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Prompt IA</Label>
                        <Textarea value={selectedNodeData.config?.prompt || ""} onChange={e => updateNodeConfig(selectedNode.id, "prompt", e.target.value)} className="min-h-[80px] rounded-xl text-xs" placeholder="Atenda o lead usando as ferramentas do CRM..." />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Ferramentas Habilitadas</Label>
                        {["search_leads", "create_appointment", "move_lead_stage", "add_tag", "get_availability"].map(tool => (
                          <div key={tool} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                            <span className="text-[8px] font-bold text-slate-600 font-mono">{tool}</span>
                            <Switch
                              checked={(selectedNodeData.config?.tools || ["search_leads", "create_appointment"]).includes(tool)}
                              onCheckedChange={v => {
                                const current = selectedNodeData.config?.tools || ["search_leads", "create_appointment"];
                                const updated = v ? [...current, tool] : current.filter((t: string) => t !== tool);
                                updateNodeConfig(selectedNode.id, "tools", updated);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <span className="text-[8px] font-black uppercase text-slate-500">Enviar ao lead</span>
                        <Switch checked={selectedNodeData.config?.sendToLead !== false} onCheckedChange={v => updateNodeConfig(selectedNode.id, "sendToLead", v)} />
                      </div>
                      <p className="text-[7px] text-purple-400 font-bold">Resultado: {"{{ai.response}}"} · Tools: {"{{ai.tool_calls}}"}</p>
                    </>
                  )}

                  {selectedNodeData.nodeType === "EXTRACT_DATA" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Texto Fonte</Label>
                        <Input value={selectedNodeData.config?.sourceText || "{{conversation.last_message}}"} onChange={e => updateNodeConfig(selectedNode.id, "sourceText", e.target.value)} className="h-9 rounded-lg text-xs" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Campos para Extrair</Label>
                        <Textarea
                          value={(selectedNodeData.config?.fields || ["nome", "empresa", "cargo", "email", "telefone", "interesse"]).join(", ")}
                          onChange={e => updateNodeConfig(selectedNode.id, "fields", e.target.value.split(",").map((f: string) => f.trim()).filter(Boolean))}
                          className="min-h-[60px] rounded-xl text-xs"
                          placeholder="nome, empresa, cargo, email, interesse"
                        />
                        <p className="text-[7px] text-cyan-500 font-bold">Dados salvos em {"{{extracted.campo}}"} e no Lead.extractedData</p>
                      </div>
                    </>
                  )}

                  {selectedNodeData.nodeType === "CLASSIFY_INTENT" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Texto para Classificar</Label>
                        <Input value={selectedNodeData.config?.sourceText || "{{conversation.last_message}}"} onChange={e => updateNodeConfig(selectedNode.id, "sourceText", e.target.value)} className="h-9 rounded-lg text-xs" />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Intents (categorias)</Label>
                        {(selectedNodeData.config?.intents || []).map((intent: any, idx: number) => (
                          <div key={idx} className="p-2 bg-violet-50 rounded-lg space-y-1.5">
                            <Input value={intent.id} placeholder="ID (ex: comprar)" onChange={e => {
                              const intents = [...(selectedNodeData.config?.intents || [])];
                              intents[idx] = { ...intents[idx], id: e.target.value };
                              updateNodeConfig(selectedNode.id, "intents", intents);
                            }} className="h-8 rounded-md text-[10px] font-mono" />
                            <Input value={intent.description} placeholder="Lead quer comprar..." onChange={e => {
                              const intents = [...(selectedNodeData.config?.intents || [])];
                              intents[idx] = { ...intents[idx], description: e.target.value };
                              updateNodeConfig(selectedNode.id, "intents", intents);
                            }} className="h-8 rounded-md text-[10px]" />
                            <Button variant="ghost" size="sm" className="text-red-400 text-[8px] p-0 h-5" onClick={() => {
                              updateNodeConfig(selectedNode.id, "intents", (selectedNodeData.config?.intents || []).filter((_: any, i: number) => i !== idx));
                            }}><Trash2 className="w-3 h-3 mr-1" /> Remover</Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full rounded-lg text-[8px] font-black uppercase" onClick={() => {
                          updateNodeConfig(selectedNode.id, "intents", [...(selectedNodeData.config?.intents || []), { id: "", description: "" }]);
                        }}><Plus className="w-3 h-3 mr-1" /> Intent</Button>
                      </div>
                      <p className="text-[7px] text-violet-400 font-bold">Roteamento automático: cada intent gera uma saída. Resultado em {"{{ai.intent}}"}</p>
                    </>
                  )}

                  {selectedNodeData.nodeType === "AB_TEST" && (
                    <>
                      <div className="space-y-3">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Variantes de Mensagem</Label>
                        {(selectedNodeData.config?.variants || []).map((variant: any, idx: number) => (
                          <div key={idx} className="p-2 bg-orange-50 rounded-lg space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-orange-600">Variante {variant.id || String.fromCharCode(65 + idx)}</span>
                              <Button variant="ghost" size="sm" className="text-red-400 text-[8px] p-0 h-5" onClick={() => {
                                updateNodeConfig(selectedNode.id, "variants", (selectedNodeData.config?.variants || []).filter((_: any, i: number) => i !== idx));
                              }}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                            <Input value={variant.id} placeholder="A" onChange={e => {
                              const variants = [...(selectedNodeData.config?.variants || [])];
                              variants[idx] = { ...variants[idx], id: e.target.value };
                              updateNodeConfig(selectedNode.id, "variants", variants);
                            }} className="h-7 rounded-md text-[10px] font-mono" />
                            <Textarea value={variant.message} placeholder="Olá {{lead.name}}! Versão A..." onChange={e => {
                              const variants = [...(selectedNodeData.config?.variants || [])];
                              variants[idx] = { ...variants[idx], message: e.target.value };
                              updateNodeConfig(selectedNode.id, "variants", variants);
                            }} className="min-h-[50px] rounded-md text-[10px]" />
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full rounded-lg text-[8px] font-black uppercase" onClick={() => {
                          const variants = selectedNodeData.config?.variants || [];
                          updateNodeConfig(selectedNode.id, "variants", [...variants, { id: String.fromCharCode(65 + variants.length), message: "" }]);
                        }}><Plus className="w-3 h-3 mr-1" /> Variante</Button>
                      </div>
                      <p className="text-[7px] text-orange-400 font-bold">Variante selecionada salva em {"{{ab.variant}}"}</p>
                    </>
                  )}

                  {selectedNodeData.nodeType === "AI_SCORE" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Critérios de Qualificação</Label>
                        <Textarea
                          value={selectedNodeData.config?.criteria || "Avalie com base em: interesse, urgência, fit com produto, engajamento."}
                          onChange={e => updateNodeConfig(selectedNode.id, "criteria", e.target.value)}
                          className="min-h-[100px] rounded-xl text-xs"
                          placeholder="Descreva os critérios de pontuação..."
                        />
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-xl space-y-1">
                        <p className="text-[8px] font-black text-emerald-700 uppercase">Roteamento por Score</p>
                        <p className="text-[7px] text-emerald-600 font-medium">🔥 Quente: ≥ 70 · ☀️ Morno: 40-69 · 🥶 Frio: &lt; 40</p>
                      </div>
                      <p className="text-[7px] text-emerald-500 font-bold">Score salvo em {"{{ai.score}}"} e no Lead.qualificationScore</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
