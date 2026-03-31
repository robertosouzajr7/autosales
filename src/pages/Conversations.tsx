import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  Send,
  Paperclip,
  Mic,
  Bot,
  Play,
  ChevronRight,
  ChevronLeft,
  Calendar,
  UserPlus,
  FileText,
  Clock,
  Tag,
  Star,
  CheckCheck,
  Check,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConversationStatus = "active" | "waiting" | "converted";
type FilterTab = "todos" | "ativos" | "aguardando" | "convertidos";
type MessageSender = "ai" | "customer";

interface Conversation {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  lastMessage: string;
  time: string;
  unread: number;
  status: ConversationStatus;
  email: string;
  tags: string[];
  leadScore: number;
  funnelStage: string;
}

interface Message {
  id: string;
  sender: MessageSender;
  text?: string;
  time: string;
  type: "text" | "audio";
  audioDuration?: string;
  read?: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockConversations: Conversation[] = [
  {
    id: "1",
    name: "Carlos Mendes",
    initials: "CM",
    avatarColor: "bg-blue-500",
    phone: "+55 11 99234-5678",
    email: "carlos.mendes@empresa.com",
    lastMessage: "Tenho interesse no plano empresarial, pode me passar mais detalhes?",
    time: "14:32",
    unread: 3,
    status: "active",
    tags: ["Lead Quente", "Empresarial"],
    leadScore: 87,
    funnelStage: "negociacao",
  },
  {
    id: "2",
    name: "Ana Paula Lima",
    initials: "AL",
    avatarColor: "bg-purple-500",
    phone: "+55 21 98765-4321",
    email: "ana.lima@gmail.com",
    lastMessage: "Ok, vou pensar e te aviso.",
    time: "12:15",
    unread: 0,
    status: "waiting",
    tags: ["Interessado", "PME"],
    leadScore: 62,
    funnelStage: "proposta",
  },
  {
    id: "3",
    name: "Roberto Alves",
    initials: "RA",
    avatarColor: "bg-green-600",
    phone: "+55 31 97654-3210",
    email: "roberto.alves@corp.com.br",
    lastMessage: "Fechamos! Pode enviar o contrato.",
    time: "Ontem",
    unread: 0,
    status: "converted",
    tags: ["Convertido", "Corporativo"],
    leadScore: 98,
    funnelStage: "fechamento",
  },
  {
    id: "4",
    name: "Fernanda Costa",
    initials: "FC",
    avatarColor: "bg-pink-500",
    phone: "+55 11 96543-2109",
    email: "fernanda@startup.io",
    lastMessage: "Qual é o prazo de implementação?",
    time: "Ontem",
    unread: 1,
    status: "active",
    tags: ["Lead Quente", "Startup"],
    leadScore: 74,
    funnelStage: "qualificacao",
  },
  {
    id: "5",
    name: "Marcelo Santos",
    initials: "MS",
    avatarColor: "bg-orange-500",
    phone: "+55 85 95432-1098",
    email: "marcelo.santos@vendas.com",
    lastMessage: "Você pode agendar uma demonstração?",
    time: "Seg",
    unread: 2,
    status: "active",
    tags: ["Demo Agendada"],
    leadScore: 81,
    funnelStage: "apresentacao",
  },
  {
    id: "6",
    name: "Juliana Ferreira",
    initials: "JF",
    avatarColor: "bg-teal-500",
    phone: "+55 41 94321-0987",
    email: "juliana.f@negocio.com",
    lastMessage: "Preciso de um desconto para fechar hoje.",
    time: "Seg",
    unread: 0,
    status: "waiting",
    tags: ["Negociação"],
    leadScore: 55,
    funnelStage: "negociacao",
  },
  {
    id: "7",
    name: "Diego Rodrigues",
    initials: "DR",
    avatarColor: "bg-indigo-500",
    phone: "+55 48 93210-9876",
    email: "diego.r@techco.dev",
    lastMessage: "Quais são as integrações disponíveis?",
    time: "Dom",
    unread: 0,
    status: "active",
    tags: ["Técnico", "Dev"],
    leadScore: 69,
    funnelStage: "qualificacao",
  },
  {
    id: "8",
    name: "Patrícia Nunes",
    initials: "PN",
    avatarColor: "bg-red-500",
    phone: "+55 62 92109-8765",
    email: "patricia.nunes@comercio.net",
    lastMessage: "Já utilizamos outro sistema, mas estamos avaliando.",
    time: "Sáb",
    unread: 0,
    status: "waiting",
    tags: ["Avaliando"],
    leadScore: 43,
    funnelStage: "prospeccao",
  },
  {
    id: "9",
    name: "Lucas Oliveira",
    initials: "LO",
    avatarColor: "bg-yellow-600",
    phone: "+55 11 91098-7654",
    email: "lucas.o@agencia.com.br",
    lastMessage: "Muito bom! Vou indicar para minha rede.",
    time: "Sex",
    unread: 0,
    status: "converted",
    tags: ["Convertido", "Indicação"],
    leadScore: 95,
    funnelStage: "fechamento",
  },
  {
    id: "10",
    name: "Beatriz Campos",
    initials: "BC",
    avatarColor: "bg-cyan-600",
    phone: "+55 71 90987-6543",
    email: "beatriz.c@loja.com",
    lastMessage: "Pode me ligar amanhã às 10h?",
    time: "Sex",
    unread: 1,
    status: "waiting",
    tags: ["Retorno", "Varejo"],
    leadScore: 58,
    funnelStage: "qualificacao",
  },
];

const mockMessages: Message[] = [
  {
    id: "m1",
    sender: "ai",
    text: "Olá, Carlos! 👋 Sou a assistente virtual da AutoSales. Vi que você demonstrou interesse em nossos planos. Como posso te ajudar hoje?",
    time: "14:10",
    type: "text",
  },
  {
    id: "m2",
    sender: "customer",
    text: "Oi! Sim, estou buscando uma solução de automação de vendas para a minha equipe. Temos cerca de 20 vendedores.",
    time: "14:12",
    type: "text",
  },
  {
    id: "m3",
    sender: "ai",
    text: "Perfeito! Para equipes acima de 10 vendedores, nosso Plano Empresarial é ideal. Ele inclui automação com IA no WhatsApp, CRM integrado, relatórios avançados e suporte prioritário. 🚀",
    time: "14:13",
    type: "text",
  },
  {
    id: "m4",
    sender: "customer",
    text: "Qual é o valor mensal?",
    time: "14:15",
    type: "text",
  },
  {
    id: "m5",
    sender: "ai",
    text: "O Plano Empresarial começa em R$ 1.497/mês para até 20 usuários, com todos os recursos inclusos. Temos também um período de teste gratuito de 14 dias, sem necessidade de cartão de crédito!",
    time: "14:16",
    type: "text",
  },
  {
    id: "m6",
    sender: "customer",
    type: "audio",
    audioDuration: "0:32",
    time: "14:20",
  },
  {
    id: "m7",
    sender: "ai",
    text: "Entendido! Posso agendar uma demonstração personalizada com um de nossos especialistas para mostrar exatamente como funciona para o seu segmento. Qual seria o melhor horário para você?",
    time: "14:22",
    type: "text",
  },
  {
    id: "m8",
    sender: "customer",
    text: "Amanhã às 15h seria ótimo.",
    time: "14:25",
    type: "text",
  },
  {
    id: "m9",
    sender: "ai",
    text: "Agendado! ✅ Você receberá um link de confirmação no seu e-mail. Nosso especialista entrará em contato amanhã às 15h. Alguma dúvida adicional?",
    time: "14:26",
    type: "text",
  },
  {
    id: "m10",
    sender: "customer",
    text: "Tenho interesse no plano empresarial, pode me passar mais detalhes sobre as integrações disponíveis?",
    time: "14:32",
    type: "text",
  },
];

const funnelStageLabels: Record<string, string> = {
  prospeccao: "Prospecção",
  qualificacao: "Qualificação",
  apresentacao: "Apresentação",
  proposta: "Proposta",
  negociacao: "Negociação",
  fechamento: "Fechamento",
};

const activityTimeline = [
  { icon: "msg", text: "Primeira mensagem recebida", time: "Hoje, 14:10" },
  { icon: "bot", text: "IA iniciou atendimento automático", time: "Hoje, 14:10" },
  { icon: "cal", text: "Demo agendada para amanhã 15h", time: "Hoje, 14:26" },
  { icon: "tag", text: "Tag 'Lead Quente' adicionada", time: "Hoje, 14:28" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ConversationStatus }) {
  const colors: Record<ConversationStatus, string> = {
    active: "bg-green-500",
    waiting: "bg-yellow-400",
    converted: "bg-blue-500",
  };
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]} flex-shrink-0`}
    />
  );
}

function AudioBubble({ duration, sender }: { duration: string; sender: MessageSender }) {
  const isAI = sender === "ai";
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl min-w-[200px] ${isAI ? "bg-green-500 text-white" : "bg-white border border-gray-200 text-gray-800"}`}>
      <button
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isAI ? "bg-green-600 hover:bg-green-700" : "bg-gray-100 hover:bg-gray-200"} transition-colors`}
      >
        <Play className="w-3.5 h-3.5 ml-0.5" />
      </button>
      {/* Waveform */}
      <div className="flex items-center gap-0.5 flex-1">
        {[3, 5, 8, 6, 10, 7, 4, 9, 6, 5, 8, 4, 7, 5, 9, 6, 4, 8, 5, 7].map((h, i) => (
          <div
            key={i}
            className={`w-1 rounded-full ${isAI ? "bg-green-200" : "bg-gray-300"}`}
            style={{ height: `${h * 2}px` }}
          />
        ))}
      </div>
      <span className={`text-xs flex-shrink-0 ${isAI ? "text-green-100" : "text-gray-500"}`}>{duration}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Conversations() {
  const [selectedId, setSelectedId] = useState<string>("1");
  const [filter, setFilter] = useState<FilterTab>("todos");
  const [search, setSearch] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [aiMode, setAiMode] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConversation = mockConversations.find((c) => c.id === selectedId)!;

  const filteredConversations = mockConversations.filter((c) => {
    const matchesFilter =
      filter === "todos" ||
      (filter === "ativos" && c.status === "active") ||
      (filter === "aguardando" && c.status === "waiting") ||
      (filter === "convertidos" && c.status === "converted");
    const matchesSearch =
      search === "" ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedId]);

  const handleSend = () => {
    if (messageInput.trim()) {
      setMessageInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-50 -m-6">
        {/* ── Left Panel: Conversation List ─────────────────────────────── */}
        <div className="w-80 flex-shrink-0 flex flex-col bg-white border-r border-gray-200">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Conversas</h2>
              <Badge variant="secondary" className="text-xs">
                {mockConversations.filter((c) => c.unread > 0).length} novas
              </Badge>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar conversa..."
                className="pl-9 h-9 bg-gray-50 border-gray-200 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 pb-2">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
              <TabsList className="grid grid-cols-4 h-8 w-full bg-gray-100">
                <TabsTrigger value="todos" className="text-xs px-1">Todos</TabsTrigger>
                <TabsTrigger value="ativos" className="text-xs px-1">Ativos</TabsTrigger>
                <TabsTrigger value="aguardando" className="text-xs px-1">Aguard.</TabsTrigger>
                <TabsTrigger value="convertidos" className="text-xs px-1">Convert.</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1">
            <div className="py-1">
              {filteredConversations.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  Nenhuma conversa encontrada
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${
                      selectedId === conv.id ? "bg-green-50 border-l-2 border-l-green-500" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-11 h-11 rounded-full ${conv.avatarColor} flex items-center justify-center text-white font-semibold text-sm`}
                      >
                        {conv.initials}
                      </div>
                      <StatusDot status={conv.status} />
                      <span className="absolute -bottom-0.5 -right-0.5">
                        <span
                          className={`w-3 h-3 rounded-full border-2 border-white block ${
                            conv.status === "active"
                              ? "bg-green-500"
                              : conv.status === "waiting"
                              ? "bg-yellow-400"
                              : "bg-blue-500"
                          }`}
                        />
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-sm truncate ${conv.unread > 0 ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
                          {conv.name}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{conv.time}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <p className="text-xs text-gray-500 truncate">{conv.lastMessage}</p>
                        {conv.unread > 0 && (
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-medium">
                            {conv.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── Center Panel: Chat Window ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
          {/* Chat Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="relative flex-shrink-0">
              <div
                className={`w-10 h-10 rounded-full ${selectedConversation.avatarColor} flex items-center justify-center text-white font-semibold text-sm`}
              >
                {selectedConversation.initials}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white block ${
                  selectedConversation.status === "active"
                    ? "bg-green-500"
                    : selectedConversation.status === "waiting"
                    ? "bg-yellow-400"
                    : "bg-blue-500"
                }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                {selectedConversation.name}
              </h3>
              <p className="text-xs text-gray-500">{selectedConversation.phone}</p>
            </div>

            {/* Status Badge */}
            <Badge
              className={`text-xs px-2 py-0.5 ${
                selectedConversation.status === "active"
                  ? "bg-green-100 text-green-700 border-green-200"
                  : selectedConversation.status === "waiting"
                  ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                  : "bg-blue-100 text-blue-700 border-blue-200"
              }`}
              variant="outline"
            >
              {selectedConversation.status === "active"
                ? "IA Ativa"
                : selectedConversation.status === "waiting"
                ? "Aguardando"
                : "Convertido"}
            </Badge>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-500 hover:text-gray-700">
                <Phone className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-500 hover:text-gray-700">
                <Video className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-gray-500 hover:text-gray-700"
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
              >
                {rightPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-500 hover:text-gray-700">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 px-4 py-4">
            <div className="max-w-3xl mx-auto space-y-3">
              {/* Date divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Hoje</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {mockMessages.map((msg) => {
                const isAI = msg.sender === "ai";
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isAI ? "justify-end" : "justify-start"}`}
                  >
                    {/* Customer avatar */}
                    {!isAI && (
                      <div
                        className={`w-7 h-7 rounded-full ${selectedConversation.avatarColor} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mb-1`}
                      >
                        {selectedConversation.initials}
                      </div>
                    )}

                    <div className={`flex flex-col gap-1 max-w-[65%] ${isAI ? "items-end" : "items-start"}`}>
                      {msg.type === "audio" ? (
                        <AudioBubble duration={msg.audioDuration!} sender={msg.sender} />
                      ) : (
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            isAI
                              ? "bg-green-500 text-white rounded-br-sm"
                              : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
                          }`}
                        >
                          {msg.text}
                        </div>
                      )}
                      {/* Time + read status */}
                      <div className={`flex items-center gap-1 px-1 ${isAI ? "flex-row-reverse" : ""}`}>
                        <span className="text-[10px] text-gray-400">{msg.time}</span>
                        {isAI && (
                          <CheckCheck className="w-3 h-3 text-blue-400" />
                        )}
                      </div>
                    </div>

                    {/* AI avatar badge */}
                    {isAI && (
                      <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mb-1 shadow-sm">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
            {/* AI Mode Toggle */}
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => setAiMode(!aiMode)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  aiMode
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-gray-50 text-gray-600 border-gray-200"
                }`}
              >
                <Bot className={`w-3.5 h-3.5 ${aiMode ? "text-green-500" : "text-gray-400"}`} />
                <span>Modo:</span>
                <span className={aiMode ? "text-green-600" : "text-gray-500"}>
                  {aiMode ? "IA Automático" : "Manual"}
                </span>
                <span
                  className={`w-6 h-3.5 rounded-full relative transition-colors ml-1 ${
                    aiMode ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-all ${
                      aiMode ? "left-3" : "left-0.5"
                    }`}
                  />
                </span>
              </button>
              {aiMode && (
                <span className="text-xs text-gray-400">
                  A IA está respondendo automaticamente nesta conversa
                </span>
              )}
            </div>

            {/* Input Row */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="w-9 h-9 text-gray-400 hover:text-gray-600 flex-shrink-0">
                <Paperclip className="w-4 h-4" />
              </Button>
              <div className="flex-1 relative">
                <Input
                  placeholder={aiMode ? "IA está no controle — clique em Manual para digitar" : "Digite uma mensagem..."}
                  className="h-10 pr-4 bg-gray-50 border-gray-200 text-sm rounded-xl"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={aiMode}
                />
              </div>
              <Button variant="ghost" size="icon" className="w-9 h-9 text-gray-400 hover:text-gray-600 flex-shrink-0">
                <Mic className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                className="w-9 h-9 bg-green-500 hover:bg-green-600 text-white flex-shrink-0 rounded-xl"
                onClick={handleSend}
                disabled={aiMode || !messageInput.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Right Panel: Contact Info ──────────────────────────────────── */}
        {rightPanelOpen && (
          <div className="w-72 flex-shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-5">
                {/* Contact Header */}
                <div className="flex flex-col items-center text-center pt-2">
                  <div
                    className={`w-16 h-16 rounded-full ${selectedConversation.avatarColor} flex items-center justify-center text-white font-bold text-xl mb-3`}
                  >
                    {selectedConversation.initials}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-base leading-tight">
                    {selectedConversation.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{selectedConversation.phone}</p>
                  <p className="text-xs text-gray-400">{selectedConversation.email}</p>
                </div>

                <Separator />

                {/* Tags */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Tag className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedConversation.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 cursor-default"
                      >
                        {tag}
                      </Badge>
                    ))}
                    <button className="text-xs text-gray-400 hover:text-gray-600 px-1">+ adicionar</button>
                  </div>
                </div>

                <Separator />

                {/* Lead Score */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Star className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead Score</span>
                    <span
                      className={`ml-auto text-sm font-bold ${
                        selectedConversation.leadScore >= 80
                          ? "text-green-600"
                          : selectedConversation.leadScore >= 60
                          ? "text-yellow-600"
                          : "text-red-500"
                      }`}
                    >
                      {selectedConversation.leadScore}
                    </span>
                  </div>
                  <Progress
                    value={selectedConversation.leadScore}
                    className="h-2"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {selectedConversation.leadScore >= 80
                      ? "Alta probabilidade de conversão"
                      : selectedConversation.leadScore >= 60
                      ? "Moderado — acompanhar de perto"
                      : "Baixa probabilidade — nutrir lead"}
                  </p>
                </div>

                <Separator />

                {/* Funnel Stage */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Etapa do Funil</span>
                  </div>
                  <Select defaultValue={selectedConversation.funnelStage}>
                    <SelectTrigger className="h-8 text-xs bg-gray-50 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(funnelStageLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value} className="text-xs">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Quick Actions */}
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                    Ações Rápidas
                  </span>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs justify-start gap-2 border-gray-200 text-gray-700 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Agendar Reunião
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs justify-start gap-2 border-gray-200 text-gray-700 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Adicionar ao CRM
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs justify-start gap-2 border-gray-200 text-gray-700 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Enviar Proposta
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Activity Timeline */}
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-3">
                    Atividade Recente
                  </span>
                  <div className="space-y-3">
                    {activityTimeline.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            item.icon === "bot"
                              ? "bg-green-100"
                              : item.icon === "cal"
                              ? "bg-blue-100"
                              : item.icon === "tag"
                              ? "bg-purple-100"
                              : "bg-gray-100"
                          }`}
                        >
                          {item.icon === "bot" && <Bot className="w-3 h-3 text-green-600" />}
                          {item.icon === "cal" && <Calendar className="w-3 h-3 text-blue-600" />}
                          {item.icon === "tag" && <Tag className="w-3 h-3 text-purple-600" />}
                          {item.icon === "msg" && <Check className="w-3 h-3 text-gray-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 leading-snug">{item.text}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
