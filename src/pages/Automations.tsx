import { useState, useEffect, useCallback, useMemo, useRef, DragEvent } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Zap, Plus, Trash2, Play, ArrowRight, Save, X, UserPlus,
  MessageSquare, Target, MessageCircle, Timer, Split, Globe, Bot,
  Inbox, Clock, Tag, MoveRight, Users, Calendar, FileEdit,
  StopCircle, Copy, Search, Send, ChevronRight, Layers, Map,
  Sparkles, Brain, GitBranch, Shuffle, BarChart3, Wrench, ScanText,
  Image, Workflow, Lock, MousePointerClick, List, FileText,
  Download, Upload, PlayCircle, Terminal, Variable, RotateCcw, Unlink, Info
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
  reconnectEdge,
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

// Só a aparência de cada gatilho. A lista, os rótulos e a configuração vêm do
// catálogo do backend (GET /automations/triggers) — antes a tela tinha uma
// lista própria com quatro opções, que não conversava com o motor.
const TRIGGER_STYLE: Record<string, { icon: JSX.Element; color: string }> = {
  NEW_LEAD: { icon: <UserPlus className="w-4 h-4" />, color: "#3b82f6" },
  FIRST_MESSAGE: { icon: <MessageCircle className="w-4 h-4" />, color: "#0ea5e9" },
  INCOMING_MESSAGE: { icon: <MessageSquare className="w-4 h-4" />, color: "#0284c7" },
  KEYWORD: { icon: <ScanText className="w-4 h-4" />, color: "#8b5cf6" },
  BUTTON_CLICK: { icon: <MousePointerClick className="w-4 h-4" />, color: "#7c3aed" },
  MEDIA_RECEIVED: { icon: <Image className="w-4 h-4" />, color: "#059669" },
  INACTIVITY: { icon: <Clock className="w-4 h-4" />, color: "#ef4444" },
  OPT_OUT: { icon: <StopCircle className="w-4 h-4" />, color: "#64748b" },
  HANDOFF_QUEUED: { icon: <Users className="w-4 h-4" />, color: "#f59e0b" },
  ATTENDANCE_ASSIGNED: { icon: <UserPlus className="w-4 h-4" />, color: "#2563EB" },
  ATTENDANCE_CLOSED: { icon: <StopCircle className="w-4 h-4" />, color: "#94a3b8" },
  APPOINTMENT_CREATED: { icon: <Calendar className="w-4 h-4" />, color: "#6366f1" },
  APPOINTMENT_CONFIRMED: { icon: <Calendar className="w-4 h-4" />, color: "#10b981" },
  APPOINTMENT_CANCELLED: { icon: <Calendar className="w-4 h-4" />, color: "#f97316" },
  APPOINTMENT_NOSHOW: { icon: <Calendar className="w-4 h-4" />, color: "#ef4444" },
  APPOINTMENT_COMPLETED: { icon: <Calendar className="w-4 h-4" />, color: "#14b8a6" },
  PIPELINE_MOVE: { icon: <MoveRight className="w-4 h-4" />, color: "#6366f1" },
  TAG_ADDED: { icon: <Tag className="w-4 h-4" />, color: "#f59e0b" },
  CAMPAIGN_REPLY: { icon: <Send className="w-4 h-4" />, color: "#db2777" },
  SCHEDULE: { icon: <Timer className="w-4 h-4" />, color: "#ec4899" },
  WEBHOOK: { icon: <Globe className="w-4 h-4" />, color: "#334155" },
};

const estiloGatilho = (id?: string) => TRIGGER_STYLE[id || ""] || { icon: <Zap className="w-4 h-4" />, color: "#10b981" };

interface NodeTypeDef {
  id: string; label: string; icon: JSX.Element; color: string; category: string;
}

const NODE_TYPES_DEF: NodeTypeDef[] = [
  { id: "SEND_MSG", label: "Enviar Texto", icon: <MessageCircle className="w-4 h-4" />, color: "#10b981", category: "action" },
  { id: "AI_RESPONSE", label: "Chamar IA", icon: <Bot className="w-4 h-4" />, color: "#2563EB", category: "action" },
  { id: "COLLECT_INPUT", label: "Coletar Resposta", icon: <Inbox className="w-4 h-4" />, color: "#06b6d4", category: "action" },
  { id: "SEND_BUTTONS", label: "Enviar Botões", icon: <MousePointerClick className="w-4 h-4" />, color: "#8b5cf6", category: "action" },
  { id: "SEND_LIST", label: "Enviar Menu (lista)", icon: <List className="w-4 h-4" />, color: "#7c3aed", category: "action" },
  { id: "SEND_TEMPLATE", label: "Enviar Template", icon: <FileText className="w-4 h-4" />, color: "#0ea5e9", category: "action" },
  { id: "SEND_MEDIA", label: "Enviar Mídia", icon: <Image className="w-4 h-4" />, color: "#059669", category: "action" },
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
  { id: "SUBFLOW", label: "Subfluxo", icon: <Workflow className="w-4 h-4" />, color: "#2563EB", category: "logic" },
  { id: "SEND_MEDIA", label: "Enviar Mídia", icon: <Image className="w-4 h-4" />, color: "#059669", category: "action" },
  // Lógica
  { id: "CONDITION", label: "Condição IF/ELSE", icon: <Split className="w-4 h-4" />, color: "#f97316", category: "logic" },
  { id: "END", label: "Fim do Fluxo", icon: <StopCircle className="w-4 h-4" />, color: "#94a3b8", category: "logic" },
];

/**
 * O que cada bloco faz e o que ele deixa disponível para os próximos.
 * Sem isso o builder tinha blocos mudos: dava para arrastar e não havia
 * como saber o que configurar nem o que sai do outro lado.
 */
const NODE_HELP: Record<string, { o_que: string; saidas?: string; variaveis?: string }> = {
  SEND_MSG: { o_que: "Envia uma mensagem de texto para o contato.", saidas: "Uma saída: segue para o próximo bloco." },
  AI_RESPONSE: { o_que: "Chama a IA com o prompt que você escrever e (opcionalmente) envia a resposta.", variaveis: "{{ai.response}}" },
  COLLECT_INPUT: { o_que: "Faz uma pergunta e espera a resposta do contato antes de continuar.", variaveis: "{{input.<variável>}}" },
  SEND_BUTTONS: { o_que: "Envia até 3 botões. O fluxo para até o contato clicar.", saidas: "Uma saída por botão (pelo id da opção)." },
  SEND_LIST: { o_que: "Envia um menu em lista (até 10 opções). O fluxo para até o contato escolher.", saidas: "Uma saída por opção." },
  SEND_TEMPLATE: { o_que: "Envia um template aprovado pela Meta — único jeito de falar fora da janela de 24h." },
  SEND_MEDIA: { o_que: "Envia imagem, vídeo, áudio ou documento." },
  WAIT: { o_que: "Pausa o fluxo por um tempo antes de seguir." },
  ADD_TAG: { o_que: "Marca o contato com uma tag." },
  MOVE_STAGE: { o_que: "Move o contato para outra etapa do funil." },
  TRANSFER_HUMAN: { o_que: "Coloca a conversa na fila de atendimento humano e para a IA." },
  SCHEDULE_APPOINTMENT: { o_que: "Cria um agendamento na agenda do negócio." },
  UPDATE_LEAD: { o_que: "Grava um valor num campo do contato." },
  HTTP_REQUEST: { o_que: "Chama uma URL externa (webhook/API).", variaveis: "{{http.response}}" },
  AI_TOOLS: { o_que: "IA com acesso às ferramentas do CRM (agenda, tags, funil)." },
  EXTRACT_DATA: { o_que: "Lê o texto da conversa e extrai campos estruturados.", variaveis: "{{extracted.<campo>}}" },
  CLASSIFY_INTENT: { o_que: "Classifica a intenção da mensagem.", saidas: "Uma saída por intenção configurada.", variaveis: "{{ai.intent}}" },
  AB_TEST: { o_que: "Divide o tráfego entre variantes.", saidas: "Uma saída por variante.", variaveis: "{{ab.variant}}" },
  AI_SCORE: { o_que: "Dá uma nota de 0 a 100 ao lead.", saidas: "Frio, morno e quente.", variaveis: "{{ai.score}}" },
  SUBFLOW: { o_que: "Chama outro fluxo e volta quando ele terminar." },
  CONDITION: { o_que: "Divide o caminho conforme as regras.", saidas: "Verdadeiro e Falso." },
  END: { o_que: "Encerra o fluxo neste ponto.", saidas: "Nenhuma — é o fim do caminho." },
};

// Tipos que já têm formulário próprio no painel de propriedades. O resto cai
// no editor genérico — nenhum bloco fica sem edição.
const TIPOS_COM_FORMULARIO = [
  "SEND_MSG", "SEND_BUTTONS", "SEND_LIST", "SEND_TEMPLATE", "SEND_MEDIA", "WAIT",
  "COLLECT_INPUT", "AI_RESPONSE", "CONDITION", "ADD_TAG", "MOVE_STAGE", "TRANSFER_HUMAN",
  "HTTP_REQUEST", "SCHEDULE_APPOINTMENT", "UPDATE_LEAD", "SUBFLOW", "AI_TOOLS",
  "EXTRACT_DATA", "CLASSIFY_INTENT", "AB_TEST", "AI_SCORE",
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

/**
 * Formulário do gatilho, montado a partir do catálogo que vem do backend.
 * Assim a tela não precisa saber de cada gatilho: quem manda é o catálogo.
 */
function CamposDoGatilho({
  definicao, config, onChange,
}: { definicao: any; config: any; onChange: (c: any) => void }) {
  if (!definicao?.campos?.length) return null;
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });

  return (
    <div className="space-y-4">
      {definicao.campos.map((campo: any) => {
        const valor = config?.[campo.key] ?? campo.padrao ?? "";
        return (
          <div key={campo.key} className="space-y-1.5">
            <Label className="font-bold text-xs">
              {campo.label}
              {campo.opcional && <span className="text-slate-300 font-medium"> (opcional)</span>}
            </Label>

            {campo.type === "select" ? (
              /* Vazio só vira "__vazio__" quando existe a opção "qualquer";
                 senão o Select ficaria com um valor que não está na lista e
                 apareceria em branco. */
              <Select
                value={
                  String(valor || "") ||
                  ((campo.options || []).some((o: any) => !o.value) ? "__vazio__" : (campo.options?.[0]?.value ?? ""))
                }
                onValueChange={(v) => set(campo.key, v === "__vazio__" ? "" : v)}
              >
                <SelectTrigger className="h-10 rounded-2xl border-2 border-slate-50 font-bold">
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-sm">
                  {(campo.options || []).map((o: any) => (
                    <SelectItem key={o.value || "__vazio__"} value={o.value || "__vazio__"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : campo.type === "tags" ? (
              <Input
                value={Array.isArray(valor) ? valor.join(", ") : valor}
                onChange={(e) => set(campo.key, e.target.value.split(",").map((v) => v.trim()).filter(Boolean))}
                placeholder="separe por vírgula"
                className="h-10 rounded-2xl border-2 border-slate-50"
              />
            ) : campo.type === "number" ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={valor}
                  onChange={(e) => set(campo.key, Number(e.target.value))}
                  className="h-10 w-32 rounded-2xl border-2 border-slate-50"
                />
                {campo.unidade && <span className="text-xs font-bold text-slate-400">{campo.unidade}</span>}
              </div>
            ) : (
              <Input
                value={valor}
                onChange={(e) => set(campo.key, e.target.value)}
                className={`h-10 rounded-2xl border-2 border-slate-50 ${campo.type === "cron" ? "font-mono" : ""}`}
                placeholder={campo.padrao || ""}
              />
            )}

            {campo.hint && <p className="text-[11px] text-slate-400 font-medium">{campo.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}

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
  if (!data) return <div className="p-4 border-2 border-red-500 bg-red-50 rounded-xl font-bold uppercase text-xs text-red-600">Erro de Dado</div>;

  const typeDef = NODE_TYPES_DEF.find(t => t.id === (data.nodeType || "SEND_MSG"));
  const nodeType = data.nodeType || "SEND_MSG";
  
  const isCondition = nodeType === "CONDITION";
  const isEnd = nodeType === "END";
  const isClassifyIntent = nodeType === "CLASSIFY_INTENT";
  const isAIScore = nodeType === "AI_SCORE";
  const isABTest = nodeType === "AB_TEST";
  // Botões/lista abrem uma saída por opção, para ramificar pelo clique.
  const isInteractive = nodeType === "SEND_BUTTONS" || nodeType === "SEND_LIST";
  const config = data.config || {};
  const opcoes: any[] = isInteractive
    ? (nodeType === "SEND_BUTTONS"
        ? (config.buttons || [])
        : (config.sections?.[0]?.rows || config.rows || []))
    : [];
  const hasMultipleOutputs = isCondition || isClassifyIntent || isAIScore || (isInteractive && opcoes.length > 0);

  return (
    <div className={`relative transition-all duration-200 ${selected ? 'scale-105' : ''}`}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-300 !border-2 !border-white" />

      <div className={`min-w-[220px] max-w-[280px] rounded-2xl bg-white shadow-sm border-2 transition-all ${selected ? 'border-emerald-400 ' : 'border-slate-100 hover:border-slate-300'}`}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0" style={{ backgroundColor: typeDef?.color || "#64748b" }}>
            {typeDef?.icon || <Zap className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-300 ">{nodeType}</p>
            <p className="text-xs font-semibold text-slate-900 truncate">{data.label || typeDef?.label || "Bloco"}</p>
          </div>
        </div>

        {config.message && (
          <div className="px-4 pb-3">
            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-2 truncate font-medium">
              💬 {String(config.message).substring(0, 50)}...
            </p>
          </div>
        )}

        {config.prompt && !['SEND_MSG', 'AB_TEST'].includes(nodeType) && (
          <div className="px-4 pb-3">
            <p className="text-xs text-slate-500 bg-blue-50 rounded-lg p-2 truncate font-medium">
              🤖 {String(config.prompt).substring(0, 50)}...
            </p>
          </div>
        )}

        {isCondition && (
          <div className="px-4 pb-3 grid grid-cols-2 gap-2">
            <div className="text-center p-1.5 rounded-lg text-xs font-semibold uppercase bg-blue-50 text-[#2563EB]">✅ SIM</div>
            <div className="text-center p-1.5 rounded-lg text-xs font-semibold uppercase bg-red-50 text-red-500">❌ NÃO</div>
          </div>
        )}

        {isClassifyIntent && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-1">
              {(config.intents || [{id:'comprar'},{id:'duvida'},{id:'outro'}]).slice(0, 4).map((i: any) => (
                <span key={i?.id || Math.random()} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold uppercase">{i?.id || "OUTRO"}</span>
              ))}
            </div>
          </div>
        )}

        {isAIScore && (
          <div className="px-4 pb-3 grid grid-cols-3 gap-1">
            <div className="text-center p-1 rounded-lg text-xs font-semibold uppercase bg-red-50 text-red-500">🥶 Frio</div>
            <div className="text-center p-1 rounded-lg text-xs font-semibold uppercase bg-amber-50 text-amber-600">☀️ Morno</div>
            <div className="text-center p-1 rounded-lg text-xs font-semibold uppercase bg-blue-50 text-[#2563EB]">🔥 Quente</div>
          </div>
        )}

        {isABTest && config.variants && (
          <div className="px-4 pb-3">
            <p className="text-xs text-orange-500 font-bold">{Array.isArray(config.variants) ? config.variants.length : 0} variantes</p>
          </div>
        )}
      </div>

      {!isEnd && !hasMultipleOutputs && (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-white" />
      )}

      {isCondition && (
        <>
          <Handle type="source" position={Position.Bottom} id="true" className="!w-3 !h-3 !bg-[#2563EB] !border-2 !border-white" style={{ left: "30%" }} />
          <Handle type="source" position={Position.Bottom} id="false" className="!w-3 !h-3 !bg-red-500 !border-2 !border-white" style={{ left: "70%" }} />
        </>
      )}

      {/* Uma saída por opção: o id do handle casa com o id do botão, que é o
          que o WhatsApp devolve no clique. */}
      {isInteractive && opcoes.length > 0 && opcoes.map((o: any, i: number) => (
        <Handle
          key={o.id || `opt_${i + 1}`}
          type="source"
          position={Position.Bottom}
          id={o.id || `opt_${i + 1}`}
          title={o.title || o.label || `Opção ${i + 1}`}
          className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white"
          style={{ left: `${((i + 1) * 100) / (opcoes.length + 1)}%` }}
        />
      ))}

      {isClassifyIntent && (
        <>
          {(config.intents || [{id:'comprar'},{id:'duvida'},{id:'suporte'},{id:'cancelar'},{id:'outro'}]).map((intent: any, idx: number, arr: any[]) => (
            <Handle
              key={intent?.id || idx}
              type="source"
              position={Position.Bottom}
              id={intent?.id || `out_${idx}`}
              className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
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
  // Catálogo de gatilhos vem do backend: uma fonte só para tela e motor.
  const [catalogo, setCatalogo] = useState<{ triggers: any[]; categorias: any[] }>({ triggers: [], categorias: [] });
  const [gatilhoModal, setGatilhoModal] = useState(false);
  const [gatilhoEdit, setGatilhoEdit] = useState<{ trigger: string; config: any }>({ trigger: "NEW_LEAD", config: {} });

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  // Simulador: sessão, trilha de execução e o que o "cliente" digita.
  const [simAberto, setSimAberto] = useState(false);
  const [sim, setSim] = useState<any>(null);
  const [simMsg, setSimMsg] = useState("");
  const [simAba, setSimAba] = useState<"conversa" | "console" | "variaveis">("conversa");
  const [simCarregando, setSimCarregando] = useState(false);
  // Templates aprovados, para o bloco "Enviar Template".
  const [approvedTemplates, setApprovedTemplates] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/templates", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setApprovedTemplates((d || []).filter((t: any) => t.status === "APPROVED")))
      .catch(() => setApprovedTemplates([]));
  }, []);

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
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/automations", { headers: { "Authorization": `Bearer ${token}` } });
      const data = await res.json();
      setAutos(Array.isArray(data) ? data : []);
    } catch (e) { toast({ title: "Erro nas automações", variant: "destructive" }); }
    setLoading(false);
  };

  const fetchStats = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/automations/executions/stats", { headers: { "Authorization": `Bearer ${token}` } });
      const data = await res.json();
      setExecStats(data);
    } catch { }
  };

  const [hasSdr, setHasSdr] = useState<boolean>(false);

  const fetchTenantData = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/settings", { headers: { "Authorization": `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setTenantLimits(data.planFeatures || { aiEnabled: false, webhookEnabled: false });
        setHasSdr(!!data.hasSdr);
      }
    } catch { }
  };

  useEffect(() => {
    fetchData(); fetchStats(); fetchTenantData();
    fetch("/api/automations/triggers", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => (r.ok ? r.json() : { triggers: [], categorias: [] }))
      .then(setCatalogo)
      .catch(() => {});
  }, []);

  const defGatilho = (id: string) => catalogo.triggers.find((t: any) => t.id === id);

  /** Salva o gatilho de um fluxo já criado — antes era escolhido só na criação. */
  const salvarGatilho = async () => {
    if (!selectedAuto) return;
    try {
      const res = await fetch(`/api/automations/${selectedAuto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ trigger: gatilhoEdit.trigger, triggerConfig: JSON.stringify(gatilhoEdit.config || {}) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Falha ao salvar o gatilho.");
      setSelectedAuto({ ...selectedAuto, trigger: gatilhoEdit.trigger, triggerConfig: JSON.stringify(gatilhoEdit.config || {}) });
      setGatilhoModal(false);
      toast({ title: "Gatilho atualizado" });
      fetchData();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  // -------- CRUD --------
  const handleCreateAuto = async () => {
    if (!newAuto.name) return toast({ title: "Nome obrigatório", variant: "destructive" });
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/automations", {
        method: "POST", 
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
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
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/automations", {
        method: "POST", 
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
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
    const token = localStorage.getItem("token");
    await fetch(`/api/automations/${id}`, {
      method: "PUT", 
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ active: !current })
    });
    toast({ title: current ? "⏸ Pausado" : "▶ Ativado" }); fetchData();
  };

  const deleteAuto = async (id: string) => {
    if (!confirm("Deletar esta automação?")) return;
    const token = localStorage.getItem("token");
    await fetch(`/api/automations/${id}`, { 
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    }); 
    fetchData();
  };

  const duplicateAuto = async (id: string) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/automations/${id}/duplicate`, { 
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
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
      const rfNodes = (Array.isArray(parsedNodes) ? parsedNodes : []).map((n: any, i: number) => ({
        id: n.id || `node_${Math.random()}`,
        type: "automationNode",
        // Sem posição, cada bloco desce uma linha — empilhar todos em (250,0)
        // deixava o fluxo ilegível e parecendo quebrado.
        position: n.position && Number.isFinite(n.position.x) ? n.position : { x: 250, y: i * 180 },
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
    const token = localStorage.getItem("token");
    try {
      await fetch(`/api/automations/${selectedAuto.id}`, {
        method: "PUT", 
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ nodes: JSON.stringify(ourNodes), edges: JSON.stringify(edges) })
      });
      toast({ title: "💎 Workflow Salvo!" }); setIsBuilderOpen(false); fetchData();
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({ ...connection, animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" } }, eds));
  }, [setEdges]);

  // Ligação feita não era mais editável: só dava para apagar e refazer.
  // Agora a ponta pode ser arrastada para outro bloco (reconexão) e soltar
  // no vazio remove a ligação.
  const reconectando = useRef(false);

  const onReconnectStart = useCallback(() => { reconectando.current = true; }, []);

  const onReconnect = useCallback((antiga: Edge, nova: Connection) => {
    reconectando.current = false;
    setEdges(eds => reconnectEdge(antiga, nova, eds));
  }, [setEdges]);

  const onReconnectEnd = useCallback((_: any, edge: Edge) => {
    if (reconectando.current) {
      setEdges(eds => eds.filter(e => e.id !== edge.id));
      toast({ title: "Ligação removida" });
    }
    reconectando.current = false;
  }, [setEdges, toast]);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdgeId(prev => (prev === edge.id ? null : edge.id));
    setSelectedNodeId(null);
  }, []);

  const removerLigacao = (edgeId: string) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId));
    setSelectedEdgeId(null);
  };

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
    setSelectedEdgeId(null);
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

  // -------- SIMULADOR --------

  /** Nós/ligações no formato que o backend entende (igual ao salvar). */
  const rascunho = () => ({
    nodes: nodes.map((n) => ({
      id: n.id, type: (n.data as any).nodeType, position: n.position,
      data: { label: (n.data as any).label, config: (n.data as any).config || {} },
    })),
    edges,
  });

  const simIniciar = async () => {
    if (!selectedAuto) return;
    setSimCarregando(true);
    try {
      const res = await fetch(`/api/automations/${selectedAuto.id}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        // Manda o rascunho: dá para testar antes de salvar.
        body: JSON.stringify(rascunho()),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Não foi possível iniciar a simulação.");
      setSim(d);
      setSimAberto(true);
      setSimAba("conversa");
      // Painel de propriedades e simulador juntos espremem o canvas.
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSimCarregando(false);
    }
  };

  const simEnviar = async (texto: string, replyId: string | null = null) => {
    if (!sim?.sessionId || (!texto.trim() && !replyId)) return;
    setSimCarregando(true);
    try {
      const res = await fetch(`/api/automations/simulate/${sim.sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ text: texto, replyId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Falha ao enviar.");
      setSim(d);
      setSimMsg("");
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSimCarregando(false);
    }
  };

  const simEncerrar = async () => {
    if (sim?.sessionId) {
      fetch(`/api/automations/simulate/${sim.sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }).catch(() => {});
    }
    setSim(null);
    setSimAberto(false);
  };

  // -------- EXPORTAR / IMPORTAR --------

  const exportarFluxo = async (auto: any) => {
    try {
      const res = await fetch(`/api/automations/${auto.id}/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Falha ao exportar.");
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fluxo-${(auto.name || "sem-nome").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Fluxo exportado" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const importarFluxo = async (file: File) => {
    try {
      const texto = await file.text();
      const pacote = JSON.parse(texto);
      const res = await fetch("/api/automations/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(pacote),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Arquivo recusado.");
      toast({
        title: "Fluxo importado (desligado)",
        description: `${d.blocos} bloco(s) e ${d.ligacoes} ligação(ões).${
          d.ligacoesDescartadas > 0 ? ` ${d.ligacoesDescartadas} ligação(ões) órfã(s) foram descartadas.` : ""
        } Revise e ative quando quiser.`,
      });
      fetchData();
    } catch (e: any) {
      toast({ title: e.message || "Arquivo inválido", variant: "destructive" });
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
  const selectedEdge = edges.find(e => e.id === selectedEdgeId);

  // Ligação selecionada fica destacada; durante a simulação os blocos que já
  // rodaram acendem, e o bloco que está esperando resposta pulsa.
  const caminhoSim: string[] = sim?.caminho || [];
  const nodeAtualSim: string | null = sim?.nodeAtual || null;

  const nodesRender = useMemo(
    () =>
      nodes.map((n) => {
        if (!sim) return n;
        const executou = caminhoSim.includes(n.id);
        const atual = nodeAtualSim === n.id;
        if (!executou && !atual) return { ...n, style: { ...(n.style || {}), opacity: 0.45 } };
        return {
          ...n,
          style: {
            ...(n.style || {}),
            outline: atual ? "3px solid #f59e0b" : "3px solid #10b981",
            outlineOffset: "3px",
            borderRadius: "16px",
          },
        };
      }),
    [nodes, sim, caminhoSim.join(","), nodeAtualSim]
  );

  const edgesRender = useMemo(
    () =>
      edges.map((e) =>
        e.id === selectedEdgeId
          ? { ...e, style: { ...(e.style || {}), stroke: "#2563EB", strokeWidth: 3 }, animated: true }
          : e
      ),
    [edges, selectedEdgeId]
  );

  // =================== RENDER ===================
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 p-6 lg:p-10 max-w-[1600px] mx-auto animate-in slide-in-from-top duration-700">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight uppercase flex items-center gap-3">
              <Zap className="w-8 h-8 text-[#2563EB]" />
              Hub de <span className="text-[#2563EB]">Automações</span>
            </h1>
            <p className="text-slate-400 font-bold text-xs">
              Builder Visual Drag & Drop — Powered by ReactFlow
            </p>
          </div>

          <div className="flex gap-3 items-center">
            {execStats && (
              <div className="hidden lg:flex items-center gap-6 mr-4">
                <div className="text-center"><p className="text-xs font-semibold text-slate-300 uppercase">Total</p><p className="text-lg font-semibold text-slate-900">{execStats.total || 0}</p></div>
                <div className="text-center"><p className="text-xs font-semibold text-[#2DD4BF] uppercase">OK</p><p className="text-lg font-semibold text-[#2563EB]">{execStats.completed || 0}</p></div>
                <div className="text-center"><p className="text-xs font-semibold text-red-400 uppercase">Falhas</p><p className="text-lg font-semibold text-red-500">{execStats.failed || 0}</p></div>
              </div>
            )}
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-3">
                <input
                  type="file" id="importar-fluxo" accept="application/json,.json" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importarFluxo(f); e.target.value = ""; }}
                />
                <Button
                  onClick={() => document.getElementById("importar-fluxo")?.click()}
                  variant="outline"
                  className="h-11 px-6 rounded-2xl font-semibold uppercase text-xs border-2"
                  title="Importar um fluxo exportado (.json)"
                >
                  <Upload className="w-4 h-4 mr-2" /> Importar
                </Button>
                <Button 
                  onClick={() => hasSdr ? setShowTemplates(true) : toast({ title: "SDR Necessário", description: "Contrate um SDR antes de criar automações.", variant: "destructive" })} 
                  variant="outline" 
                  className={`h-11 px-6 rounded-2xl font-semibold uppercase text-xs border-2 ${!hasSdr ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Layers className="w-4 h-4 mr-2" /> Templates
                </Button>
                <Button 
                  onClick={() => hasSdr ? setIsAddModalOpen(true) : toast({ title: "SDR Necessário", description: "Contrate um SDR antes de criar automações.", variant: "destructive" })} 
                  className={`h-11 px-6 rounded-2xl font-semibold uppercase text-xs text-white shadow-sm ${!hasSdr ? 'bg-slate-700 cursor-not-allowed' : 'bg-[#2563EB] hover:bg-[#1D4ED8] '}`}
                >
                  <Plus className="w-4 h-4 mr-2" /> Criar
                </Button>
              </div>
              {!hasSdr && (
                <p className="text-xs font-semibold text-[#2563EB] animate-pulse mr-1">Requer SDR Contratado</p>
              )}
            </div>
          </div>
        </div>

        {/* GRID */}
        {autos.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-40">
            <Zap className="w-16 h-16 text-slate-200 mb-4" />
            <p className="text-sm font-semibold text-slate-400">Crie seu primeiro workflow</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {autos.map(auto => {
              const triggerDef = { ...estiloGatilho(auto.trigger), label: defGatilho(auto.trigger)?.label || auto.trigger };
              const nodeCount = (() => { try { return JSON.parse(auto.nodes || "[]").length; } catch { return 0; } })();
              return (
                <Card key={auto.id} className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden hover:-translate-y-1 transition-all duration-300 group">
                  <CardContent className="p-0">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between group-hover:bg-slate-900 transition-colors duration-300">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: auto.active ? (triggerDef?.color || "#10b981") : "#94a3b8" }}>
                          {triggerDef?.icon || <Zap className="w-6 h-6" />}
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-slate-800 tracking-tight group-hover:text-white transition-colors">{auto.name}</h3>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs font-semibold border-none ${auto.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                              {auto.active ? "ATIVO" : "PAUSADO"}
                            </Badge>
                            <span className="text-xs font-bold text-slate-400 group-hover:text-white/30">{triggerDef?.label}</span>
                          </div>
                        </div>
                      </div>
                      <Switch checked={auto.active} onCheckedChange={() => toggleAuto(auto.id, auto.active)} className="data-[state=checked]:bg-[#2563EB]" />
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl text-center"><p className="text-xs font-semibold text-slate-300 uppercase">Execuções</p><p className="text-lg font-semibold text-slate-700">{auto.totalExecutions || 0}</p></div>
                        <div className="p-3 bg-slate-50 rounded-xl text-center"><p className="text-xs font-semibold text-slate-300 uppercase">Nós</p><p className="text-lg font-semibold text-slate-700">{nodeCount}</p></div>
                      </div>
                      {auto.description && <p className="text-xs text-slate-400 font-medium line-clamp-2">{auto.description}</p>}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg" onClick={() => duplicateAuto(auto.id)} title="Duplicar"><Copy className="w-3.5 h-3.5 text-slate-300" /></Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg" onClick={() => exportarFluxo(auto)} title="Exportar (.json)"><Download className="w-3.5 h-3.5 text-slate-300" /></Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg hover:bg-red-50" onClick={() => deleteAuto(auto.id)}><Trash2 className="w-3.5 h-3.5 text-slate-300" /></Button>
                        </div>
                        <button onClick={() => openBuilder(auto)} className="text-[#2563EB] font-semibold text-xs flex items-center gap-1 hover:gap-2 transition-all">
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
            <DialogTitle className="text-2xl font-semibold flex items-center gap-2"><Zap className="text-[#2563EB]" /> Novo Workflow</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs ">Nome</Label>
              <Input value={newAuto.name} onChange={e => setNewAuto({ ...newAuto, name: e.target.value })} className="h-10 rounded-2xl border-2 border-slate-50" placeholder="Ex: Follow-up Inteligente" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs ">Gatilho — o que faz o fluxo começar</Label>
              <Select
                value={newAuto.trigger}
                onValueChange={(v) => setNewAuto({ ...newAuto, trigger: v, triggerConfig: "{}" })}
              >
                <SelectTrigger className="h-10 rounded-2xl border-2 border-slate-50 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl shadow-sm max-h-80">
                  {catalogo.categorias.map((cat: any) => {
                    const doGrupo = catalogo.triggers.filter((t: any) => t.categoria === cat.id);
                    if (!doGrupo.length) return null;
                    return (
                      <div key={cat.id}>
                        <p className="px-2 py-1.5 text-[10px] font-bold uppercase text-slate-400">{cat.label}</p>
                        {doGrupo.map((t: any) => (
                          <SelectItem key={t.id} value={t.id} className="font-bold py-2">{t.label}</SelectItem>
                        ))}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
              {defGatilho(newAuto.trigger)?.hint && (
                <p className="text-[11px] text-slate-400 font-medium">{defGatilho(newAuto.trigger)?.hint}</p>
              )}
            </div>

            <CamposDoGatilho
              definicao={defGatilho(newAuto.trigger)}
              config={(() => { try { return JSON.parse(newAuto.triggerConfig || "{}"); } catch { return {}; } })()}
              onChange={(c) => setNewAuto({ ...newAuto, triggerConfig: JSON.stringify(c) })}
            />

            <div className="space-y-2">
              <Label className="font-bold text-xs ">Descrição</Label>
              <Textarea value={newAuto.description} onChange={e => setNewAuto({ ...newAuto, description: e.target.value })} className="min-h-[80px] rounded-2xl border-2 border-slate-50" placeholder="O que este fluxo faz?" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateAuto} className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-2xl text-sm shadow-sm">
              <Save className="w-4 h-4 mr-2 text-[#2563EB]" /> Criar Automação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =============== GATILHO DO FLUXO =============== */}
      <Dialog open={gatilhoModal} onOpenChange={setGatilhoModal}>
        <DialogContent className="rounded-[32px] p-8 max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <Zap className="text-[#2563EB]" /> Quando este fluxo começa
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-3">
            <div className="space-y-2">
              <Label className="font-bold text-xs">Gatilho</Label>
              <Select
                value={gatilhoEdit.trigger}
                onValueChange={(v) => setGatilhoEdit({ trigger: v, config: {} })}
              >
                <SelectTrigger className="h-10 rounded-2xl border-2 border-slate-50 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl shadow-sm max-h-80">
                  {catalogo.categorias.map((cat: any) => {
                    const doGrupo = catalogo.triggers.filter((t: any) => t.categoria === cat.id);
                    if (!doGrupo.length) return null;
                    return (
                      <div key={cat.id}>
                        <p className="px-2 py-1.5 text-[10px] font-bold uppercase text-slate-400">{cat.label}</p>
                        {doGrupo.map((t: any) => (
                          <SelectItem key={t.id} value={t.id} className="font-bold py-2">{t.label}</SelectItem>
                        ))}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
              {defGatilho(gatilhoEdit.trigger)?.hint && (
                <p className="text-[11px] text-slate-400 font-medium">{defGatilho(gatilhoEdit.trigger)?.hint}</p>
              )}
            </div>

            <CamposDoGatilho
              definicao={defGatilho(gatilhoEdit.trigger)}
              config={gatilhoEdit.config}
              onChange={(c) => setGatilhoEdit({ ...gatilhoEdit, config: c })}
            />

            {gatilhoEdit.trigger === "WEBHOOK" && (
              <div className="rounded-2xl bg-slate-50 p-3 space-y-1">
                <p className="text-[11px] font-bold text-slate-500">URL para o sistema externo chamar</p>
                <code className="block text-[11px] text-slate-600 break-all">
                  POST {window.location.origin}/api/public/flows/{selectedAuto?.id}/trigger
                </code>
                <p className="text-[11px] text-slate-400">
                  Cabeçalho <code>X-Flow-Secret</code> com a chave acima, e no corpo{" "}
                  <code>{"{ \"phone\": \"5571...\" }"}</code> para identificar o contato.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={salvarGatilho} className="w-full h-10 bg-slate-900 hover:bg-slate-800 rounded-2xl font-semibold text-sm">
              <Save className="w-4 h-4 mr-2 text-[#2563EB]" /> Salvar gatilho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =============== TEMPLATES MODAL =============== */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="rounded-[32px] p-10 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold flex items-center gap-2"><Layers className="text-blue-500" /> Templates Pré-Configurados</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {FLOW_TEMPLATES.map((tmpl, i) => {
              const trigDef = { ...estiloGatilho(tmpl.trigger), label: defGatilho(tmpl.trigger)?.label || tmpl.trigger };
              return (
                <div key={i} className="p-6 rounded-2xl border-2 border-slate-100 hover:border-slate-300 transition-all cursor-pointer group" onClick={() => createFromTemplate(tmpl)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: trigDef?.color || "#10b981" }}>
                        {trigDef?.icon || <Zap className="w-6 h-6" />}
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-slate-900">{tmpl.name}</h4>
                        <p className="text-xs text-slate-400 font-medium">{tmpl.description}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge className="text-xs bg-slate-100 text-slate-500 border-none font-semibold">{trigDef?.label}</Badge>
                          <Badge className="text-xs bg-slate-200 text-blue-600 border-none font-semibold">{tmpl.nodes.length} nós</Badge>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-[#2563EB] transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* =============== BUILDER (REACTFLOW) =============== */}
      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className="max-w-[1500px] h-[94vh] p-0 overflow-hidden border-none shadow-sm rounded-[32px] flex flex-col bg-slate-50">

          {/* Header */}
          <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-4">
              <div className="bg-[#2563EB] p-2.5 rounded-xl shadow-lg"><Zap className="text-white w-5 h-5" /></div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight leading-none uppercase">{selectedAuto?.name}</h2>
                <p className="text-xs font-bold text-slate-400 mt-1 ">
                  {nodes.length} blocos · {edges.length} conexões · Gatilho:{" "}
                  <button
                    className="underline decoration-dotted hover:text-[#2563EB]"
                    onClick={() => {
                      let cfg = {};
                      try { cfg = JSON.parse(selectedAuto?.triggerConfig || "{}"); } catch { cfg = {}; }
                      setGatilhoEdit({ trigger: selectedAuto?.trigger || "NEW_LEAD", config: cfg });
                      setGatilhoModal(true);
                    }}
                  >
                    {defGatilho(selectedAuto?.trigger)?.label || selectedAuto?.trigger} (alterar)
                  </button>
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={sim ? simEncerrar : simIniciar}
                disabled={simCarregando}
                variant="outline"
                className={`h-10 px-4 rounded-xl font-semibold uppercase text-xs border-2 ${sim ? "border-amber-300 text-amber-600" : ""}`}
              >
                {sim ? <><RotateCcw className="w-4 h-4 mr-2" /> Encerrar teste</> : <><PlayCircle className="w-4 h-4 mr-2" /> Simular</>}
              </Button>
              <Button onClick={() => exportarFluxo(selectedAuto)} variant="outline" className="h-10 px-4 rounded-xl font-semibold uppercase text-xs border-2">
                <Download className="w-4 h-4 mr-2" /> Exportar
              </Button>
              <Button onClick={() => setIsBuilderOpen(false)} variant="ghost" className="h-10 w-10 rounded-xl text-slate-300"><X className="w-5 h-5" /></Button>
              <Button onClick={handleSaveWorkflow} className="h-10 bg-slate-900 hover:bg-black px-6 rounded-xl font-semibold uppercase text-xs text-white shadow-sm">
                <Save className="w-4 h-4 mr-2 text-[#2563EB]" /> Salvar
              </Button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* SIDEBAR */}
            <div className="w-56 bg-white border-r border-slate-100 p-3 flex flex-col gap-3 overflow-y-auto shrink-0">
              <h4 className="text-xs font-semibold text-slate-300 px-2">Ações — arraste ou clique</h4>
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
                     <span className="text-xs font-semibold uppercase text-slate-600 tracking-tight">{st.label}</span>
                     {(st.id === "HTTP_REQUEST" && !tenantLimits?.webhookEnabled) && <Lock className="w-3 h-3 text-red-400" />}
                  </div>
                </div>
              ))}
              <h4 className="text-xs font-semibold text-slate-500 px-2 mt-2">⚡ IA Avançada</h4>
              {NODE_TYPES_DEF.filter(t => t.category === "ai").map(st => (
                <div
                  key={st.id}
                  draggable
                  onDragStart={e => onDragStart(e, st.id)}
                  onClick={() => addNodeClick(st.id)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-blue-50 active:scale-95 transition-all cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md shrink-0" style={{ backgroundColor: st.color }}>{st.icon}</div>
                  <div className="flex flex-1 items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-slate-600 tracking-tight">{st.label}</span>
                    {!tenantLimits.aiEnabled && <Lock className="w-3 h-3 text-red-400" />}
                  </div>
                </div>
              ))}
              <h4 className="text-xs font-semibold text-slate-300 px-2 mt-2">Lógica</h4>
              {NODE_TYPES_DEF.filter(t => t.category === "logic").map(st => (
                <div
                  key={st.id}
                  draggable
                  onDragStart={e => onDragStart(e, st.id)}
                  onClick={() => addNodeClick(st.id)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 active:scale-95 transition-all cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-100"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md shrink-0" style={{ backgroundColor: st.color }}>{st.icon}</div>
                  <span className="text-xs font-semibold uppercase text-slate-600 tracking-tight">{st.label}</span>
                </div>
              ))}

              <div className="mt-auto p-3 bg-blue-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-semibold text-blue-700 mb-2">Variáveis</p>
                <div className="flex flex-wrap gap-1">
                  {VARIABLE_HINTS.slice(0, 10).map(v => (
                    <span key={v} className="text-xs bg-slate-200 text-blue-600 px-1.5 py-0.5 rounded-full font-bold cursor-pointer hover:bg-slate-300" onClick={() => navigator.clipboard.writeText(v)}>
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* REACTFLOW CANVAS */}
            <div className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
              <ReactFlow
                nodes={nodesRender}
                edges={edgesRender}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onReconnect={onReconnect}
                onReconnectStart={onReconnectStart}
                onReconnectEnd={onReconnectEnd}
                onEdgeClick={onEdgeClick}
                onNodeClick={onNodeClick}
                edgesReconnectable
                reconnectRadius={20}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                fitView
                snapToGrid
                snapGrid={[20, 20]}
                className="react-flow"
                deleteKeyCode={["Backspace", "Delete"]}
              >
                <Background color="#e2e8f0" gap={20} size={1} />
                <Controls className="!rounded-xl !shadow-sm !border-none" />
                <MiniMap
                  nodeColor={(node) => {
                    const typeDef = NODE_TYPES_DEF.find(t => t.id === (node.data as any).nodeType);
                    return typeDef?.color || "#94a3b8";
                  }}
                  className="!rounded-xl !shadow-sm !border-none"
                  maskColor="rgba(0,0,0,0.05)"
                />
                <Panel position="top-right" className="flex gap-2">
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg flex items-center gap-2">
                    <Map className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500">
                      Arraste as pontas de uma ligação para religar · solte no vazio para remover
                    </span>
                  </div>
                </Panel>

                {/* Ligação selecionada: dá para ver de onde vem, para onde vai
                    e qual ramo ela representa — e removê-la sem adivinhação. */}
                {selectedEdge && (
                  <Panel position="bottom-center">
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 px-4 py-3 flex items-center gap-4">
                      <div className="text-xs">
                        <p className="font-bold text-slate-700">
                          {(nodes.find(n => n.id === selectedEdge.source)?.data as any)?.label || selectedEdge.source}
                          <ArrowRight className="w-3 h-3 inline mx-1.5 text-slate-400" />
                          {(nodes.find(n => n.id === selectedEdge.target)?.data as any)?.label || selectedEdge.target}
                        </p>
                        <p className="text-slate-400 font-medium mt-0.5">
                          {selectedEdge.sourceHandle
                            ? `Ramo "${selectedEdge.sourceHandle}"`
                            : "Saída padrão"}
                          {" · arraste uma das pontas para religar"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-xs font-bold text-red-500 border-red-100 hover:bg-red-50"
                        onClick={() => removerLigacao(selectedEdge.id)}
                      >
                        <Unlink className="w-3.5 h-3.5 mr-1.5" /> Remover ligação
                      </Button>
                    </div>
                  </Panel>
                )}
              </ReactFlow>
            </div>

            {/* SIMULADOR + DEPURADOR */}
            {simAberto && sim && (
              <div className="w-[400px] bg-white border-l border-slate-100 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <PlayCircle className="w-4 h-4 text-[#2563EB]" /> Simulação
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {sim.status === "WAITING"
                          ? "Esperando a resposta do cliente"
                          : sim.status === "FINISHED"
                          ? "Fluxo terminou"
                          : sim.status === "ERROR"
                          ? "Parou com erro"
                          : "Executando"}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={simEncerrar}>
                      <X className="w-4 h-4 text-slate-300" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    {([
                      ["conversa", "Conversa", MessageCircle],
                      ["console", `Console (${sim.trilha?.length || 0})`, Terminal],
                      ["variaveis", "Variáveis", Variable],
                    ] as const).map(([id, label, Icon]) => (
                      <button
                        key={id}
                        onClick={() => setSimAba(id as any)}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                          simAba === id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        <Icon className="w-3 h-3" /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {simAba === "conversa" && (
                    <>
                      {(sim.mensagens || []).map((m: any, i: number) => (
                        <div key={i} className={`flex ${m.de === "lead" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs font-medium whitespace-pre-wrap ${
                              m.de === "lead" ? "bg-slate-900 text-white rounded-tr-none" : "bg-slate-100 text-slate-700 rounded-tl-none"
                            }`}
                          >
                            {m.texto}
                            {(m.opcoes || []).length > 0 && (
                              <div className="mt-2 space-y-1">
                                {m.opcoes.map((o: any) => (
                                  <button
                                    key={o.id}
                                    disabled={sim.status !== "WAITING" || simCarregando}
                                    onClick={() => simEnviar(o.titulo, o.id)}
                                    className="w-full rounded-lg bg-white border border-slate-200 px-2 py-1 text-[11px] font-bold text-[#2563EB] hover:bg-blue-50 disabled:opacity-50"
                                  >
                                    {o.titulo}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {sim.status === "FINISHED" && (
                        <p className="text-center text-[11px] font-bold text-slate-400 py-3">— fim do fluxo —</p>
                      )}
                    </>
                  )}

                  {simAba === "console" && (
                    <div className="space-y-1.5 font-mono">
                      {(sim.trilha || []).map((t: any, i: number) => {
                        const cor =
                          t.nivel === "erro" ? "border-red-300 bg-red-50" :
                          t.nivel === "aviso" ? "border-amber-300 bg-amber-50" :
                          t.nivel === "logica" ? "border-orange-200 bg-orange-50" :
                          t.nivel === "ia" ? "border-violet-200 bg-violet-50" :
                          t.nivel === "requisicao" ? "border-slate-300 bg-slate-100" :
                          t.nivel === "variavel" ? "border-cyan-200 bg-cyan-50" :
                          "border-slate-200 bg-white";
                        return (
                          <details key={i} className={`rounded-lg border ${cor} px-2 py-1.5`}>
                            <summary className="cursor-pointer text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                              <span className="text-slate-400">{String(t.passo).padStart(2, "0")}</span>
                              {t.rotulo && <span className="text-slate-400">[{t.rotulo}]</span>}
                              {t.titulo}
                            </summary>
                            {t.detalhe && (
                              <p className="mt-1.5 text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed">{t.detalhe}</p>
                            )}
                            {t.saida && (
                              <p className="mt-1 text-[10px] font-bold text-slate-500">→ segue pelo ramo "{t.saida}"</p>
                            )}
                            {t.config && Object.keys(t.config).length > 0 && (
                              <pre className="mt-1.5 max-h-40 overflow-auto rounded bg-slate-900 p-2 text-[10px] text-slate-200">
                                {JSON.stringify(t.config, null, 2)}
                              </pre>
                            )}
                          </details>
                        );
                      })}
                    </div>
                  )}

                  {simAba === "variaveis" && (
                    <pre className="rounded-xl bg-slate-900 p-3 text-[11px] text-slate-200 overflow-auto">
                      {JSON.stringify(sim.variaveis || {}, null, 2)}
                    </pre>
                  )}
                </div>

                <div className="p-3 border-t border-slate-100">
                  <div className="flex gap-2">
                    <Input
                      value={simMsg}
                      onChange={(e) => setSimMsg(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && simEnviar(simMsg)}
                      placeholder={sim.status === "WAITING" ? "Responda como o cliente…" : "O fluxo não espera resposta agora"}
                      className="h-9 rounded-xl text-xs"
                      disabled={simCarregando}
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9 rounded-xl bg-[#2563EB] shrink-0"
                      disabled={simCarregando || !simMsg.trim()}
                      onClick={() => simEnviar(simMsg)}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-2 leading-relaxed">
                    Nada é enviado ao cliente. Tags, etapas, agendamentos e requisições aparecem no console como
                    "ação simulada", sem acontecer de verdade.
                  </p>
                </div>
              </div>
            )}

            {/* PROPERTIES PANEL */}
            {selectedNode && selectedNodeData && (
              <div className="w-72 bg-white border-l border-slate-100 p-5 overflow-y-auto shrink-0">
                <div className="flex items-center justify-between mb-5">
                  <h4 className="text-xs font-semibold text-slate-400 ">Propriedades</h4>
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
                  {/* O que este bloco faz, o que ele produz e quantas saídas
                      tem. Antes o painel abria mudo e o bloco parecia quebrado. */}
                  {(() => {
                    const ajuda = NODE_HELP[selectedNodeData.nodeType];
                    if (!ajuda) return null;
                    return (
                      <div className="rounded-xl bg-slate-50 p-3 space-y-1.5">
                        <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                          <Info className="w-3 h-3" /> {selectedNodeData.label || selectedNodeData.nodeType}
                        </p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{ajuda.o_que}</p>
                        {ajuda.saidas && <p className="text-[11px] text-slate-400">Saídas: {ajuda.saidas}</p>}
                        {ajuda.variaveis && (
                          <p className="text-[11px] text-slate-400">
                            Deixa disponível: <code className="bg-slate-200 px-1 rounded">{ajuda.variaveis}</code>
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Nome do bloco no canvas: sempre editável. */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-400">Nome do bloco</Label>
                    <Input
                      value={selectedNodeData.label || ""}
                      onChange={(e) =>
                        setNodes((nds) =>
                          nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, label: e.target.value } } : n))
                        )
                      }
                      className="h-9 rounded-xl border-slate-100 text-xs"
                      placeholder="Ex.: Perguntar interesse"
                    />
                  </div>

                  {selectedNodeData.nodeType === "SEND_MSG" && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-400">Mensagem</Label>
                      <Textarea value={selectedNodeData.config?.message || ""} onChange={e => updateNodeConfig(selectedNode.id, "message", e.target.value)} className="min-h-[100px] rounded-xl border-slate-100 text-xs" placeholder="Olá {{lead.name}}! 👋" />
                    </div>
                  )}

                  {(selectedNodeData.nodeType === "SEND_BUTTONS" || selectedNodeData.nodeType === "SEND_LIST") && (() => {
                    const ehLista = selectedNodeData.nodeType === "SEND_LIST";
                    const max = ehLista ? 10 : 3;
                    const opcoes = ehLista
                      ? (selectedNodeData.config?.sections?.[0]?.rows || [])
                      : (selectedNodeData.config?.buttons || []);
                    const gravar = (novas: any[]) => {
                      if (ehLista) updateNodeConfig(selectedNode.id, "sections", [{ title: "Opções", rows: novas }]);
                      else updateNodeConfig(selectedNode.id, "buttons", novas);
                    };
                    return (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-400">Mensagem</Label>
                          <Textarea
                            value={selectedNodeData.config?.body || ""}
                            onChange={e => updateNodeConfig(selectedNode.id, "body", e.target.value)}
                            className="min-h-[80px] rounded-xl border-slate-100 text-xs"
                            placeholder="Oi {{lead.name}}! Como posso ajudar?"
                          />
                        </div>

                        {ehLista && (
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-400">Texto do botão que abre a lista</Label>
                            <Input
                              value={selectedNodeData.config?.buttonText || ""}
                              onChange={e => updateNodeConfig(selectedNode.id, "buttonText", e.target.value)}
                              className="h-10 rounded-lg text-xs" placeholder="Ver opções"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-slate-400">
                              Opções ({opcoes.length}/{max})
                            </Label>
                            {opcoes.length < max && (
                              <Button
                                variant="ghost" size="sm" className="h-7 text-[11px] font-bold text-violet-600"
                                onClick={() => gravar([...opcoes, { id: `opt_${opcoes.length + 1}`, title: "" }])}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Adicionar
                              </Button>
                            )}
                          </div>
                          {opcoes.map((o: any, i: number) => (
                            <div key={i} className="flex gap-1.5 items-center">
                              <Input
                                value={o.title || ""}
                                maxLength={ehLista ? 24 : 20}
                                onChange={e => {
                                  const novas = [...opcoes];
                                  novas[i] = { ...novas[i], id: novas[i].id || `opt_${i + 1}`, title: e.target.value };
                                  gravar(novas);
                                }}
                                className="h-9 rounded-lg text-xs"
                                placeholder={`Opção ${i + 1}`}
                              />
                              <Button
                                variant="ghost" size="icon" className="w-8 h-8 shrink-0"
                                onClick={() => gravar(opcoes.filter((_: any, x: number) => x !== i))}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </Button>
                            </div>
                          ))}
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Cada opção vira uma saída do bloco — ligue cada uma ao próximo passo.
                            Opção sem ligação segue pela saída padrão.
                            {ehLista ? " Limite da Meta: 10 opções, 24 caracteres." : " Limite da Meta: 3 botões, 20 caracteres."}
                          </p>
                        </div>
                      </>
                    );
                  })()}

                  {selectedNodeData.nodeType === "SEND_TEMPLATE" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Template aprovado</Label>
                        <select
                          value={selectedNodeData.config?.templateId || ""}
                          onChange={e => updateNodeConfig(selectedNode.id, "templateId", e.target.value)}
                          className="w-full h-10 rounded-lg border border-slate-100 text-xs px-3 bg-white"
                        >
                          <option value="">Escolha…</option>
                          {approvedTemplates.map((t: any) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-400">
                          Único envio que funciona fora da janela de 24h. Só aparecem templates aprovados pela Meta.
                        </p>
                      </div>
                    </>
                  )}

                  {selectedNodeData.nodeType === "SEND_MEDIA" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">URL do arquivo</Label>
                        <Input
                          value={selectedNodeData.config?.mediaUrl || ""}
                          onChange={e => updateNodeConfig(selectedNode.id, "mediaUrl", e.target.value)}
                          className="h-10 rounded-lg text-xs" placeholder="/api/uploads/arquivo.jpg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Tipo</Label>
                        <select
                          value={selectedNodeData.config?.mediaType || "image"}
                          onChange={e => updateNodeConfig(selectedNode.id, "mediaType", e.target.value)}
                          className="w-full h-10 rounded-lg border border-slate-100 text-xs px-3 bg-white"
                        >
                          <option value="image">Imagem</option>
                          <option value="video">Vídeo</option>
                          <option value="audio">Áudio</option>
                          <option value="document">Documento</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Legenda (opcional)</Label>
                        <Input
                          value={selectedNodeData.config?.caption || ""}
                          onChange={e => updateNodeConfig(selectedNode.id, "caption", e.target.value)}
                          className="h-10 rounded-lg text-xs"
                        />
                      </div>
                    </>
                  )}

                  {selectedNodeData.nodeType === "WAIT" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Tempo</Label>
                        <Input type="number" value={selectedNodeData.config?.value || 1} onChange={e => updateNodeConfig(selectedNode.id, "value", parseInt(e.target.value))} className="h-10 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Unidade</Label>
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
                        <Label className="text-xs font-semibold text-slate-400">Pergunta</Label>
                        <Textarea value={selectedNodeData.config?.prompt || ""} onChange={e => updateNodeConfig(selectedNode.id, "prompt", e.target.value)} className="min-h-[80px] rounded-xl text-xs" placeholder="Qual seu nome?" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Variável</Label>
                        <Input value={selectedNodeData.config?.variable || "resposta"} onChange={e => updateNodeConfig(selectedNode.id, "variable", e.target.value)} className="h-10 rounded-lg" />
                        <p className="text-xs text-cyan-500 font-bold">Acesse: {"{{input." + (selectedNodeData.config?.variable || "resposta") + "}}"}</p>
                      </div>
                    </>
                  )}

                  {selectedNodeData.nodeType === "AI_RESPONSE" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Prompt IA</Label>
                        <Textarea value={selectedNodeData.config?.prompt || ""} onChange={e => updateNodeConfig(selectedNode.id, "prompt", e.target.value)} className="min-h-[100px] rounded-xl text-xs" placeholder="Qualifique o lead {{lead.name}}..." />
                      </div>
                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <span className="text-xs font-semibold uppercase text-slate-500">Enviar ao lead</span>
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
                          <Input value={rule.field} placeholder="{{lead.status}}" onChange={e => { const r = [...(selectedNodeData.config?.rules || [])]; r[rIdx] = { ...r[rIdx], field: e.target.value }; updateNodeConfig(selectedNode.id, "rules", r); }} className="h-8 rounded-md text-xs" />
                          <Select value={rule.operator} onValueChange={v => { const r = [...(selectedNodeData.config?.rules || [])]; r[rIdx] = { ...r[rIdx], operator: v }; updateNodeConfig(selectedNode.id, "rules", r); }}>
                            <SelectTrigger className="h-8 rounded-md text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{OPERATORS.map(op => <SelectItem key={op.id} value={op.id}>{op.label}</SelectItem>)}</SelectContent>
                          </Select>
                          {!["empty", "not_empty"].includes(rule.operator) && (
                            <Input value={rule.value} placeholder="Valor" onChange={e => { const r = [...(selectedNodeData.config?.rules || [])]; r[rIdx] = { ...r[rIdx], value: e.target.value }; updateNodeConfig(selectedNode.id, "rules", r); }} className="h-8 rounded-md text-xs" />
                          )}
                          <Button variant="ghost" size="sm" className="text-red-400 text-xs p-0 h-6" onClick={() => { const r = (selectedNodeData.config?.rules || []).filter((_: any, i: number) => i !== rIdx); updateNodeConfig(selectedNode.id, "rules", r); }}>
                            <Trash2 className="w-3 h-3 mr-1" /> Remover
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full rounded-lg text-xs font-semibold uppercase" onClick={() => updateNodeConfig(selectedNode.id, "rules", [...(selectedNodeData.config?.rules || []), { field: "", operator: "contains", value: "" }])}>
                        <Plus className="w-3 h-3 mr-1" /> Regra
                      </Button>
                    </>
                  )}

                  {selectedNodeData.nodeType === "ADD_TAG" && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-400">Tag</Label>
                      <Input value={selectedNodeData.config?.tag || ""} onChange={e => updateNodeConfig(selectedNode.id, "tag", e.target.value)} className="h-10 rounded-lg" placeholder="quente" />
                    </div>
                  )}

                  {selectedNodeData.nodeType === "MOVE_STAGE" && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-400">Etapa</Label>
                      <Input value={selectedNodeData.config?.stageName || ""} onChange={e => updateNodeConfig(selectedNode.id, "stageName", e.target.value)} className="h-10 rounded-lg" placeholder="Qualificando" />
                    </div>
                  )}

                  {selectedNodeData.nodeType === "TRANSFER_HUMAN" && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-400">Mensagem</Label>
                      <Textarea value={selectedNodeData.config?.message || ""} onChange={e => updateNodeConfig(selectedNode.id, "message", e.target.value)} className="min-h-[80px] rounded-xl text-xs" placeholder="Transferindo..." />
                    </div>
                  )}

                  {selectedNodeData.nodeType === "HTTP_REQUEST" && (
                    <>
                      <div className="space-y-2"><Label className="text-xs font-semibold uppercase text-slate-400">URL</Label><Input value={selectedNodeData.config?.url || ""} onChange={e => updateNodeConfig(selectedNode.id, "url", e.target.value)} className="h-9 rounded-lg text-xs" /></div>
                      <Select value={selectedNodeData.config?.method || "POST"} onValueChange={v => updateNodeConfig(selectedNode.id, "method", v)}>
                        <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem><SelectItem value="PUT">PUT</SelectItem></SelectContent>
                      </Select>
                      <div className="space-y-2"><Label className="text-xs font-semibold uppercase text-slate-400">Body</Label><Textarea value={selectedNodeData.config?.body || ""} onChange={e => updateNodeConfig(selectedNode.id, "body", e.target.value)} className="min-h-[60px] rounded-xl font-mono text-xs" /></div>
                    </>
                  )}

                  {selectedNodeData.nodeType === "SCHEDULE_APPOINTMENT" && (
                    <>
                      <div className="space-y-2"><Label className="text-xs font-semibold uppercase text-slate-400">Título</Label><Input value={selectedNodeData.config?.title || ""} onChange={e => updateNodeConfig(selectedNode.id, "title", e.target.value)} className="h-9 rounded-lg text-xs" /></div>
                      <div className="space-y-2"><Label className="text-xs font-semibold uppercase text-slate-400">Data (ISO)</Label><Input value={selectedNodeData.config?.date || ""} onChange={e => updateNodeConfig(selectedNode.id, "date", e.target.value)} className="h-9 rounded-lg text-xs" placeholder="{{input.data}}" /></div>
                    </>
                  )}

                  {selectedNodeData.nodeType === "UPDATE_LEAD" && (
                    <>
                      <div className="space-y-2"><Label className="text-xs font-semibold uppercase text-slate-400">Nome</Label><Input value={selectedNodeData.config?.name || ""} onChange={e => updateNodeConfig(selectedNode.id, "name", e.target.value)} className="h-9 rounded-lg text-xs" /></div>
                      <div className="space-y-2"><Label className="text-xs font-semibold uppercase text-slate-400">Email</Label><Input value={selectedNodeData.config?.email || ""} onChange={e => updateNodeConfig(selectedNode.id, "email", e.target.value)} className="h-9 rounded-lg text-xs" /></div>
                    </>
                  )}

                  {/* ===== FASE 4 — SUBFLOW & MEDIA ===== */}

                  {selectedNodeData.nodeType === "SUBFLOW" && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-400">ID da Automação</Label>
                      <Input value={selectedNodeData.config?.automationId || ""} onChange={e => updateNodeConfig(selectedNode.id, "automationId", e.target.value)} className="h-9 rounded-lg text-xs font-mono" placeholder="UUID da automação alvo" />
                      <p className="text-xs text-slate-500 font-bold">Dispara outra automação para o mesmo lead (enfileirado)</p>
                    </div>
                  )}

                  {selectedNodeData.nodeType === "SEND_MEDIA" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">URL da Mídia</Label>
                        <Input value={selectedNodeData.config?.mediaUrl || ""} onChange={e => updateNodeConfig(selectedNode.id, "mediaUrl", e.target.value)} className="h-9 rounded-lg text-xs" placeholder="https://..." />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Tipo</Label>
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
                        <Label className="text-xs font-semibold text-slate-400">Legenda</Label>
                        <Textarea value={selectedNodeData.config?.caption || ""} onChange={e => updateNodeConfig(selectedNode.id, "caption", e.target.value)} className="min-h-[60px] rounded-xl text-xs" placeholder="Veja nosso catálogo..." />
                      </div>
                    </>
                  )}

                  {/* ===== FASE 3 — IA AVANÇADA ===== */}

                  {selectedNodeData.nodeType === "AI_TOOLS" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Prompt IA</Label>
                        <Textarea value={selectedNodeData.config?.prompt || ""} onChange={e => updateNodeConfig(selectedNode.id, "prompt", e.target.value)} className="min-h-[80px] rounded-xl text-xs" placeholder="Atenda o lead usando as ferramentas do CRM..." />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Ferramentas Habilitadas</Label>
                        {["search_leads", "create_appointment", "move_lead_stage", "add_tag", "get_availability"].map(tool => (
                          <div key={tool} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                            <span className="text-xs font-bold text-slate-600 font-mono">{tool}</span>
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
                        <span className="text-xs font-semibold uppercase text-slate-500">Enviar ao lead</span>
                        <Switch checked={selectedNodeData.config?.sendToLead !== false} onCheckedChange={v => updateNodeConfig(selectedNode.id, "sendToLead", v)} />
                      </div>
                      <p className="text-xs text-slate-500 font-bold">Resultado: {"{{ai.response}}"} · Tools: {"{{ai.tool_calls}}"}</p>
                    </>
                  )}

                  {selectedNodeData.nodeType === "EXTRACT_DATA" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Texto Fonte</Label>
                        <Input value={selectedNodeData.config?.sourceText || "{{conversation.last_message}}"} onChange={e => updateNodeConfig(selectedNode.id, "sourceText", e.target.value)} className="h-9 rounded-lg text-xs" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Campos para Extrair</Label>
                        <Textarea
                          value={(selectedNodeData.config?.fields || ["nome", "empresa", "cargo", "email", "telefone", "interesse"]).join(", ")}
                          onChange={e => updateNodeConfig(selectedNode.id, "fields", e.target.value.split(",").map((f: string) => f.trim()).filter(Boolean))}
                          className="min-h-[60px] rounded-xl text-xs"
                          placeholder="nome, empresa, cargo, email, interesse"
                        />
                        <p className="text-xs text-cyan-500 font-bold">Dados salvos em {"{{extracted.campo}}"} e no Lead.extractedData</p>
                      </div>
                    </>
                  )}

                  {selectedNodeData.nodeType === "CLASSIFY_INTENT" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Texto para Classificar</Label>
                        <Input value={selectedNodeData.config?.sourceText || "{{conversation.last_message}}"} onChange={e => updateNodeConfig(selectedNode.id, "sourceText", e.target.value)} className="h-9 rounded-lg text-xs" />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold text-slate-400">Intents (categorias)</Label>
                        {(selectedNodeData.config?.intents || []).map((intent: any, idx: number) => (
                          <div key={idx} className="p-2 bg-blue-50 rounded-lg space-y-1.5">
                            <Input value={intent.id} placeholder="ID (ex: comprar)" onChange={e => {
                              const intents = [...(selectedNodeData.config?.intents || [])];
                              intents[idx] = { ...intents[idx], id: e.target.value };
                              updateNodeConfig(selectedNode.id, "intents", intents);
                            }} className="h-8 rounded-md text-xs font-mono" />
                            <Input value={intent.description} placeholder="Lead quer comprar..." onChange={e => {
                              const intents = [...(selectedNodeData.config?.intents || [])];
                              intents[idx] = { ...intents[idx], description: e.target.value };
                              updateNodeConfig(selectedNode.id, "intents", intents);
                            }} className="h-8 rounded-md text-xs" />
                            <Button variant="ghost" size="sm" className="text-red-400 text-xs p-0 h-5" onClick={() => {
                              updateNodeConfig(selectedNode.id, "intents", (selectedNodeData.config?.intents || []).filter((_: any, i: number) => i !== idx));
                            }}><Trash2 className="w-3 h-3 mr-1" /> Remover</Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full rounded-lg text-xs font-semibold uppercase" onClick={() => {
                          updateNodeConfig(selectedNode.id, "intents", [...(selectedNodeData.config?.intents || []), { id: "", description: "" }]);
                        }}><Plus className="w-3 h-3 mr-1" /> Intent</Button>
                      </div>
                      <p className="text-xs text-slate-500 font-bold">Roteamento automático: cada intent gera uma saída. Resultado em {"{{ai.intent}}"}</p>
                    </>
                  )}

                  {selectedNodeData.nodeType === "AB_TEST" && (
                    <>
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold text-slate-400">Variantes de Mensagem</Label>
                        {(selectedNodeData.config?.variants || []).map((variant: any, idx: number) => (
                          <div key={idx} className="p-2 bg-orange-50 rounded-lg space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-orange-600">Variante {variant.id || String.fromCharCode(65 + idx)}</span>
                              <Button variant="ghost" size="sm" className="text-red-400 text-xs p-0 h-5" onClick={() => {
                                updateNodeConfig(selectedNode.id, "variants", (selectedNodeData.config?.variants || []).filter((_: any, i: number) => i !== idx));
                              }}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                            <Input value={variant.id} placeholder="A" onChange={e => {
                              const variants = [...(selectedNodeData.config?.variants || [])];
                              variants[idx] = { ...variants[idx], id: e.target.value };
                              updateNodeConfig(selectedNode.id, "variants", variants);
                            }} className="h-7 rounded-md text-xs font-mono" />
                            <Textarea value={variant.message} placeholder="Olá {{lead.name}}! Versão A..." onChange={e => {
                              const variants = [...(selectedNodeData.config?.variants || [])];
                              variants[idx] = { ...variants[idx], message: e.target.value };
                              updateNodeConfig(selectedNode.id, "variants", variants);
                            }} className="min-h-[50px] rounded-md text-xs" />
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full rounded-lg text-xs font-semibold uppercase" onClick={() => {
                          const variants = selectedNodeData.config?.variants || [];
                          updateNodeConfig(selectedNode.id, "variants", [...variants, { id: String.fromCharCode(65 + variants.length), message: "" }]);
                        }}><Plus className="w-3 h-3 mr-1" /> Variante</Button>
                      </div>
                      <p className="text-xs text-orange-400 font-bold">Variante selecionada salva em {"{{ab.variant}}"}</p>
                    </>
                  )}

                  {selectedNodeData.nodeType === "AI_SCORE" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-400">Critérios de Qualificação</Label>
                        <Textarea
                          value={selectedNodeData.config?.criteria || "Avalie com base em: interesse, urgência, fit com produto, engajamento."}
                          onChange={e => updateNodeConfig(selectedNode.id, "criteria", e.target.value)}
                          className="min-h-[100px] rounded-xl text-xs"
                          placeholder="Descreva os critérios de pontuação..."
                        />
                      </div>
                      <div className="p-3 bg-blue-50 rounded-xl space-y-1">
                        <p className="text-xs font-semibold text-emerald-700 uppercase">Roteamento por Score</p>
                        <p className="text-xs text-[#2563EB] font-medium">🔥 Quente: ≥ 70 · ☀️ Morno: 40-69 · 🥶 Frio: &lt; 40</p>
                      </div>
                      <p className="text-xs text-[#2563EB] font-bold">Score salvo em {"{{ai.score}}"} e no Lead.qualificationScore</p>
                    </>
                  )}

                  {/* Editor genérico: qualquer bloco sem formulário próprio
                      continua editável (e o que já estava configurado fica
                      visível), em vez de abrir um painel vazio. */}
                  {!TIPOS_COM_FORMULARIO.includes(selectedNodeData.nodeType) && (
                    <div className="space-y-3">
                      {selectedNodeData.nodeType === "END" ? (
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Este bloco não tem propriedades — ele só encerra o caminho.
                        </p>
                      ) : (
                        <>
                          <Label className="text-xs font-semibold text-slate-400">Propriedades</Label>
                          {Object.entries(selectedNodeData.config || {}).map(([chave, valor]) => (
                            <div key={chave} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px] font-bold text-slate-500">{chave}</Label>
                                <button
                                  className="text-[10px] font-bold text-red-400 hover:text-red-600"
                                  onClick={() => {
                                    const { [chave]: _, ...resto } = selectedNodeData.config || {};
                                    setNodes((nds) =>
                                      nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, config: resto } } : n))
                                    );
                                  }}
                                >
                                  remover
                                </button>
                              </div>
                              <Input
                                value={typeof valor === "object" ? JSON.stringify(valor) : String(valor ?? "")}
                                onChange={(e) => updateNodeConfig(selectedNode.id, chave, e.target.value)}
                                className="h-8 rounded-lg border-slate-100 text-xs"
                              />
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full rounded-xl text-xs font-bold"
                            onClick={() => {
                              const chave = prompt("Nome da propriedade:");
                              if (chave?.trim()) updateNodeConfig(selectedNode.id, chave.trim(), "");
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Adicionar propriedade
                          </Button>
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                            Este bloco ainda não tem um formulário dedicado. Os valores vão direto para a configuração do
                            bloco — use o simulador para conferir o resultado.
                          </p>
                        </>
                      )}
                    </div>
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
