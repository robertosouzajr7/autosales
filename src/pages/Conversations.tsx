import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, Send, Search,
  Circle, MoreVertical, Smartphone, Bot,
  Phone, Mail, User, Copy, Video, ArrowLeft,
  ChevronRight, Calendar, Mic, MicOff, Play, Pause, Volume2,
  Instagram, Globe, Clock, FileText, Paperclip, ArrowRightLeft, Users, XCircle, Plus
} from "lucide-react";
import { TemplatePreview } from "@/components/templates/TemplatePreview";

// Metadados de canal para o inbox multicanal (ícone, rótulo e cor).
// `selo` é a cor cheia do carimbo sobre o avatar; `cls` é a versão clara,
// para chips e pílulas.
const CHANNEL_META: Record<string, { label: string; cls: string; selo: string; Icon: any }> = {
  WHATSAPP: { label: "WhatsApp", cls: "text-emerald-600 bg-emerald-50", selo: "bg-[#22A06B]", Icon: MessageSquare },
  INSTAGRAM: { label: "Instagram", cls: "text-pink-600 bg-pink-50", selo: "bg-[#DB2777]", Icon: Instagram },
  SITE: { label: "Site", cls: "text-blue-600 bg-blue-50", selo: "bg-[#2563EB]", Icon: Globe },
};
/** Selo curto da fase do atendimento, usado na lista de conversas. */
function faseSelo(chat: any, meuId: string) {
  const fase = chat.phase || "BOT";
  if (fase === "QUEUE") {
    return {
      label: chat.queuePosition ? `Fila #${chat.queuePosition}` : "Na fila",
      cls: "bg-amber-100 text-amber-700",
      title: chat.handoffReason ? `Aguardando atendente — ${chat.handoffReason}` : "Aguardando atendente humano",
    };
  }
  if (fase === "HUMAN") {
    const meu = chat.assignedTo?.id === meuId;
    return {
      label: meu ? "Você" : chat.assignedTo?.name?.split(" ")[0] || "Humano",
      cls: meu ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600",
      title: `Em atendimento com ${chat.assignedTo?.name || "um atendente"}`,
    };
  }
  if (fase === "CLOSED") {
    return { label: "Encerrada", cls: "bg-slate-100 text-slate-400", title: "Atendimento encerrado" };
  }
  // No automático, o que importa destacar é quando um fluxo assumiu a
  // conversa — é o motivo de o agente de IA estar calado.
  if (chat.activeFlow) {
    return {
      label: "Fluxo",
      cls: "bg-violet-100 text-violet-700",
      title: `Fluxo "${chat.activeFlow.name}" conduzindo a conversa`,
    };
  }
  return null; // BOT sem fluxo é o normal: não polui a lista com selo.
}

function channelMeta(ch?: string) {
  return CHANNEL_META[(ch || "WHATSAPP").toUpperCase()] || CHANNEL_META.WHATSAPP;
}

/**
 * Linha de estado do cabeçalho da conversa: quem está conduzindo agora.
 *
 * É a mesma informação do selo da lista, só que por extenso — inclusive o
 * motivo de a IA estar calada quando um fluxo assumiu.
 */
function estadoDaConversa(chat: any, meuId: string) {
  const fase = chat?.phase || "BOT";
  if (fase === "QUEUE") {
    const detalhes = [
      chat.queue?.name ? `fila "${chat.queue.name}"` : null,
      chat.queuePosition ? `posição ${chat.queuePosition}` : null,
      chat.handoffReason || null,
    ].filter(Boolean);
    return {
      texto: `Aguardando atendente${detalhes.length ? ` · ${detalhes.join(" · ")}` : ""}`,
      cor: "text-amber-600",
      ponto: "fill-amber-500 text-amber-500",
    };
  }
  if (fase === "HUMAN") {
    const quem = chat.assignedTo?.id === meuId ? "você" : chat.assignedTo?.name || "um atendente";
    return { texto: `Em atendimento com ${quem}`, cor: "text-accent-text", ponto: "fill-[#2563EB] text-[#2563EB]" };
  }
  if (fase === "CLOSED") {
    return { texto: "Atendimento encerrado", cor: "text-faint", ponto: "fill-slate-300 text-slate-300" };
  }
  if (chat?.activeFlow) {
    const situacao =
      chat.activeFlow.status === "WAITING_INPUT" ? "esperando resposta"
      : chat.activeFlow.status === "WAITING_DELAY" ? "em pausa programada"
      : "executando";
    return {
      texto: `Fluxo "${chat.activeFlow.name}" conduzindo · ${situacao}`,
      cor: "text-violet-600",
      ponto: "fill-violet-500 text-violet-500",
    };
  }
  return { texto: "IA atendendo", cor: "text-emerald-600", ponto: "fill-emerald-500 text-emerald-500" };
}
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { assinarEventos } from "@/lib/eventosDoPainel";
import { enviarArquivo } from "@/lib/enviarArquivo";
import { NovaConversa } from "@/components/conversations/NovaConversa";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// Helper para formatar tempo
const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Componente de Player de Áudio Profissional
function AudioPlayer({ url, isOut }: { url: string, isOut: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    const onLoadedMetadata = () => setDuration(audio.duration);
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const seekTime = (parseFloat(e.target.value) / 100) * duration;
    audioRef.current.currentTime = seekTime;
    setProgress(parseFloat(e.target.value));
  };

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <button 
        onClick={togglePlay}
        className={`w-8 h-8 flex items-center justify-center rounded-full shrink-0 transition-all ${
 isOut ? 'bg-white text-[#2563EB]' : 'bg-[#2563EB] text-white shadow-lg '
 }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
      
      <div className="flex-1 space-y-1">
        <input 
          type="range"
          min="0"
          max="100"
          value={progress || 0}
          onChange={handleSeek}
          className={`w-full h-1 rounded-full appearance-none cursor-pointer accent-current ${
 isOut ? 'text-white/40 bg-white/20' : 'text-[#2563EB] bg-slate-100'
 }`}
          style={{
            background: isOut 
              ? `linear-gradient(to right, rgba(255,255,255,0.8) ${progress}%, rgba(255,255,255,0.2) ${progress}%)`
              : `linear-gradient(to right, #10b981 ${progress}%, #f1f5f9 ${progress}%)`
          }}
        />
        <div className="flex justify-between items-center px-0.5">
           <span className={`text-xs font-semibold tracking-tight ${isOut ? 'text-white/60' : 'text-slate-400'}`}>
             {formatTime(currentTime)}
           </span>
           <span className={`text-xs font-semibold tracking-tight ${isOut ? 'text-white/60' : 'text-slate-400'}`}>
             {formatTime(duration)}
           </span>
        </div>
      </div>
      <Volume2 className={`w-3 h-3 opacity-30 shrink-0 ${isOut ? 'text-white' : 'text-slate-900'}`} />
    </div>
  );
}

/** Hoje mostra a hora; ontem, "Ontem"; antes disso, a data. */
function fmtWhen(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Rótulo do separador de dia dentro da thread. */
function fmtDia(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: d.getFullYear() === hoje.getFullYear() ? undefined : "numeric" });
}

/** "Cliente desde março de 2026" — só o mês e o ano, o dia não importa aqui. */
function desdeQuando(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/**
 * Respostas rápidas do composer.
 *
 * São trechos locais: clicar preenche o campo para o atendente revisar e
 * enviar, nunca dispara sozinho. Não vêm do banco porque o produto ainda não
 * tem cadastro de respostas prontas — quando tiver, é só trocar a origem.
 */
const RESPOSTAS_RAPIDAS = [
  { rotulo: "Confirmar horário", texto: "Consigo confirmar seu horário. Qual dia e período ficam melhores para você?" },
  { rotulo: "Enviar valores", texto: "Vou te passar os valores agora mesmo." },
  { rotulo: "Pedir documento", texto: "Para seguir, você pode me enviar o documento por aqui?" },
  { rotulo: "Um momento", texto: "Só um momento, já verifico isso para você." },
];

export default function Conversations() {
  const [chats, setChats] = useState<any[]>([]);
  // Templates aprovados, para reabrir conversa fora da janela de 24h.
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateModal, setTemplateModal] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  // Escolher deixou de disparar direto: agora seleciona e mostra a prévia.
  const [templateEscolhido, setTemplateEscolhido] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>("ALL"); // ALL | conexão(id) | SITE
  // Fase do atendimento: fila humana, meus atendimentos, automático, encerradas.
  const [phaseFilter, setPhaseFilter] = useState<string>("ALL");
  const [agents, setAgents] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferAlvo, setTransferAlvo] = useState<string>("");
  const meuId = localStorage.getItem("userId") || "";
  const [search, setSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [novaConversa, setNovaConversa] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasWhatsApp, setHasWhatsApp] = useState<boolean>(false);
  const messagesEndRef = useRef<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callMessage, setCallMessage] = useState("");
  const [callingLoading, setCallingLoading] = useState(false);
  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const selectedChatRef = useRef(selectedChat);
  // Ficha do contato (terceiro painel): etapa do funil, tags, próximo
  // agendamento e anotação interna.
  const [ficha, setFicha] = useState<any>(null);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [anotacao, setAnotacao] = useState("");
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false);

  // Chegou pelo sino de notificações: abre direto a conversa apontada, em vez
  // de largar o atendente no inbox para procurar de quem era a mensagem.
  useEffect(() => {
    const alvo = new URLSearchParams(window.location.search).get("lead");
    if (!alvo || !chats.length || selectedChat) return;
    const achado = chats.find((c: any) => c.id === alvo);
    if (achado) setSelectedChat(achado);
  }, [chats, selectedChat]);

  // Qual conversa está aberta na última rolagem — é o que distingue "abri uma
  // conversa" de "chegou mensagem na conversa que já estava aberta".
  const conversaRolada = useRef<string | null>(null);

  useEffect(() => {
    const atual = selectedChat?.id || null;
    const acabouDeAbrir = conversaRolada.current !== atual;
    conversaRolada.current = atual;
    // Ao abrir, a última mensagem já tem de estar à vista: animar faria a tela
    // percorrer o histórico inteiro até o fim. A animação fica só para a
    // mensagem que chega com a conversa aberta.
    messagesEndRef.current?.scrollIntoView({
      behavior: acabouDeAbrir ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, selectedChat?.id]);

  /**
   * Só a lista de conversas. Separada do resto porque é a única coisa que
   * muda quando chega mensagem — recarregar templates, agentes, filas e
   * etapas a cada mensagem nova deixava o inbox lento no horário de pico.
   */
  /**
   * Contato escolhido no CRM: a conversa já foi criada no servidor, aqui é só
   * trazê-la para a tela. Fora da janela de 24 h na conexão oficial, o único
   * caminho é template — então a janela de templates abre junto, em vez de
   * deixar o atendente escrever uma mensagem que seria recusada.
   */
  const abrirConversaDoCrm = async (dados: any, contato: any) => {
    await fetchConversations();
    setSelectedChat({
      id: contato.id,
      conversationId: dados.conversationId,
      name: contato.name,
      phone: contato.phone,
      handle: contato.phoneFormatado || contato.phone || contato.email,
      channel: dados.channel,
      phase: "HUMAN",
      botActive: false,
      windowOpen: dados.janelaAberta,
      windowMinutesLeft: dados.minutosRestantes,
      assignedTo: dados.assignedTo,
      conversations: [{ id: dados.conversationId, botActive: false }],
    });
    if (dados.aviso) {
      toast({
        title: dados.precisaTemplate ? "Fora da janela de 24 h" : "Atenção",
        description: dados.aviso,
      });
    }
    if (dados.precisaTemplate && dados.templates?.length) setTemplateModal(true);
  };

  const fetchConversations = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/conversations", { headers: { Authorization: `Bearer ${token}` } });
      const convData = res.ok ? await res.json() : [];
      const lista = Array.isArray(convData) ? convData : [];

      // O endpoint já devolve ordenado por última mensagem. `id` vira o leadId
      // porque o resto da tela (mensagens, toggle do bot) trabalha com ele.
      setChats(
        lista.map((c: any) => ({
          ...c,
          id: c.leadId,
          conversationId: c.id,
          waAccountId: c.accountId,
          conversations: [{ id: c.id, botActive: c.botActive }],
        }))
      );
      // Mantém o cabeçalho do chat aberto em dia com a fase/dono atual.
      setSelectedChat((prev: any) => {
        if (!prev) return prev;
        const fresco = lista.find((c: any) => c.leadId === prev.id);
        return fresco ? { ...prev, ...fresco, id: prev.id, conversationId: fresco.id } : prev;
      });
    } catch (e) {}
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const [settingsRes, connRes, tplRes, agentsRes, queuesRes, etapasRes] = await Promise.all([
        fetch("/api/settings", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/whatsapp/accounts", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/templates", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/attendance/agents", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/queues", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/pipeline-stages", { headers: { "Authorization": `Bearer ${token}` } })
      ]);
      await fetchConversations();

      const settingsData = await settingsRes.json();
      const connData = connRes.ok ? await connRes.json() : [];
      const tplData = tplRes.ok ? await tplRes.json() : [];
      setAgents(agentsRes.ok ? await agentsRes.json() : []);
      setQueues(queuesRes.ok ? await queuesRes.json() : []);
      const etapasData = etapasRes.ok ? await etapasRes.json() : [];
      setEtapas(Array.isArray(etapasData) ? etapasData : []);

      setTemplates(tplData.filter((t: any) => t.status === "APPROVED"));
      setConnections(Array.isArray(connData) ? connData : []);
      setHasWhatsApp(!!settingsData.hasWhatsAppConnection);
    } catch (e) {}
    setLoading(false);
  };

  const fetchMessages = async (leadId: string) => {
    if (!leadId) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/messages/${leadId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  /**
   * Ações de atendimento. Uma função só porque todas seguem o mesmo formato:
   * POST na conversa, recarrega a lista e mostra o resultado.
   */
  const acaoAtendimento = async (
    acao: "assign" | "transfer" | "return-bot" | "close" | "reopen" | "enqueue",
    corpo: any = {},
    okMsg?: string
  ) => {
    const conversationId = selectedChat?.conversationId;
    if (!conversationId) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/conversations/${conversationId}/${acao}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível concluir a ação.");
      if (okMsg) toast({ title: okMsg });
      await fetchData();
      fetchMessages(selectedChat.id);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const encerrarAtendimento = async () => {
    if (!confirm(`Encerrar o atendimento de ${selectedChat?.name}?\n\nO cliente recebe um aviso de encerramento. Se ele escrever de novo, a IA reabre a conversa.`)) return;
    await acaoAtendimento("close", {}, "Atendimento encerrado");
  };

  const confirmarTransferencia = async () => {
    if (!transferAlvo) return;
    const [tipo, id] = transferAlvo.split(":");
    await acaoAtendimento(
      "transfer",
      tipo === "user" ? { userId: id } : { queueId: id },
      tipo === "user" ? "Conversa transferida" : "Conversa devolvida à fila"
    );
    setTransferOpen(false);
    setTransferAlvo("");
  };

  const toggleBot = async () => {
    if (!selectedChat) return;
    const token = localStorage.getItem("token");
    const currentStatus = selectedChat.conversations?.[0]?.botActive ?? true;
    const newStatus = !currentStatus;
    
    try {
      const res = await fetch(`/api/conversations/${selectedChat.id}/toggle-bot`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ botActive: newStatus })
      });
      if (res.ok) {
        // Update local state by re-fetching
        fetchData();
        // Update current selected object manually to react instantly
        setSelectedChat((prev: any) => ({
           ...prev,
           conversations: [{ ...(prev.conversations?.[0] || {}), botActive: newStatus }]
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenCallModal = () => {
    if (!selectedChat?.phone) {
      toast({ title: "Lead sem telefone cadastrado", variant: "destructive" });
      return;
    }
    const firstName = selectedChat.name?.split(" ")[0] || "tudo bem";
    setCallMessage(
      `Olá, ${firstName}! 👋\n\nPosso te chamar agora por aqui para uma conversa rápida? Tenho algumas novidades que podem te interessar! 📞\n\nResponda com "SIM" se estiver disponível ou me diga o melhor horário. 😊`
    );
    setCallModalOpen(true);
  };

  const handleCallIntent = async () => {
    if (!selectedChat) return;
    setCallingLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/messages/call-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ leadId: selectedChat.id, customMessage: callMessage })
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "📞 Aviso enviado!", description: "Mensagem enviada. Abrindo WhatsApp Web..." });
        setCallModalOpen(false);
        fetchMessages(selectedChat.id);
        setTimeout(() => window.open(data.waLink, "_blank"), 800);
      } else {
        toast({ title: "Erro ao enviar", description: data.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Falha na conexão", variant: "destructive" });
    }
    setCallingLoading(false);
  };

  /** Sobe o arquivo e envia como mídia pelo canal do lead. */
  const sendFile = async (file: File) => {
    if (!selectedChat) return;
    const token = localStorage.getItem("token");
    try {
      const envio = await enviarArquivo<{ url: string; kind: string }>("/api/messages/upload", file);
      if (!envio.ok) throw new Error(envio.erro);
      const upData = envio.dados;
      if (!upData?.url) throw new Error("O servidor não devolveu o endereço do arquivo.");

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          leadId: selectedChat.id, content: file.name, mediaUrl: upData.url,
          messageType: upData.kind, role: "SDR",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Falha ao enviar");
      fetchMessages(selectedChat.id);
    } catch (e: any) {
      toast({ title: e.message || "Não foi possível enviar o arquivo", variant: "destructive" });
    }
  };

  /** Template aprovado — único jeito de reabrir conversa fora das 24h. */
  const sendTemplate = async (templateId: string) => {
    if (!selectedChat) return;
    setSendingTemplate(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/messages/template", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadId: selectedChat.id, templateId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Falha ao enviar template");
      toast({ title: "Template enviado" });
      setTemplateModal(false);
      setTemplateEscolhido(null);
      fetchMessages(selectedChat.id);
      fetchData();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSendingTemplate(false); }
  };

  const handleSend = async () => {
    if (!message.trim() || !selectedChat) return;
    const content = message;
    setMessage("");

    // O balão aparece na hora, antes da resposta do servidor. Antes a tela
    // esperava o envio e recarregava a conversa inteira — e quando o envio
    // falhava não aparecia nada: a mensagem simplesmente sumia.
    const provisorio = {
      id: `local-${Date.now()}`,
      content,
      role: "SDR",
      messageType: "TEXT",
      createdAt: new Date().toISOString(),
      enviando: true,
    };
    setMessages((prev: any[]) => [...prev, provisorio]);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selectedChat.id, content, role: "SDR" })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível enviar a mensagem.");
      setMessages((prev: any[]) => prev.map((m) => (m.id === provisorio.id ? d : m)));
      fetchConversations();
    } catch (e: any) {
      setMessages((prev: any[]) => prev.filter((m) => m.id !== provisorio.id));
      // Devolve o texto ao campo: reescrever tudo por causa de uma falha de
      // envio é o pior desfecho possível para quem está atendendo.
      setMessage((atual: string) => atual || content);
      toast({ title: "Mensagem não enviada", description: e.message, variant: "destructive" });
    }
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setIsRecording(true);
    } catch {
      toast({ title: "Microfone não disponível", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const cancelAudio = () => {
    if (isRecording) mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
  };



  const sendAudio = async () => {
    if (!audioBlob || !selectedChat) return;
    const token = localStorage.getItem("token");
    try {
      // Sobe o arquivo e deixa o servidor converter para OGG/Opus. Antes isso
      // ia como data-URL base64 no corpo JSON e sem token: nunca chegava.
      const gravacao = new File([audioBlob], "gravacao.webm", { type: audioBlob.type || "audio/webm" });
      const envio = await enviarArquivo<{ url: string }>("/api/messages/upload", gravacao);
      if (!envio.ok) throw new Error(envio.erro);
      const upData = envio.dados;
      if (!upData?.url) throw new Error("O servidor não devolveu o endereço do áudio.");

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          leadId: selectedChat.id,
          content: "🎙️ Áudio",
          mediaUrl: upData.url,
          role: "SDR",
          messageType: "AUDIO",
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Falha ao enviar o áudio");

      fetchMessages(selectedChat.id);
      setAudioBlob(null);
      setAudioUrl(null);
      toast({ title: "🎙️ Áudio enviado" });
    } catch (e: any) {
      toast({ title: e.message || "Erro ao enviar áudio", variant: "destructive" });
    }
  };

  useEffect(() => {
    selectedChatRef.current = selectedChat;
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      // Abrir a conversa marca como lida, como em qualquer chat.
      if (selectedChat.unreadCount > 0) {
        const token = localStorage.getItem("token");
        fetch(`/api/conversations/${selectedChat.id}/read`, {
          method: "PUT", headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
        setChats((prev) => prev.map((c) => (c.id === selectedChat.id ? { ...c, unreadCount: 0 } : c)));
      }
    }
  }, [selectedChat]);

  // Ficha do contato. Depende só do id: `selectedChat` é recriado a cada
  // atualização da lista, e um efeito no objeto inteiro recarregaria a ficha
  // (perdendo a anotação em edição) a cada mensagem que chega.
  useEffect(() => {
    const leadId = selectedChat?.id;
    if (!leadId) { setFicha(null); setAnotacao(""); return; }
    let cancelado = false;
    const token = localStorage.getItem("token");
    fetch(`/api/conversations/${leadId}/contact`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelado || !d) return;
        setFicha(d);
        setAnotacao(d.notes || "");
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [selectedChat?.id]);

  /** Grava etapa ou anotação da ficha. */
  const salvarFicha = async (campos: any) => {
    const leadId = selectedChat?.id;
    if (!leadId) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/conversations/${leadId}/contact`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(campos),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível salvar.");
      setFicha((f: any) => (f ? { ...f, ...d } : f));
      return true;
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
      return false;
    }
  };

  useEffect(() => {
    fetchData();
    return assinarEventos((msg: any) => {
      try {
        // O servidor emite { conversationId, role, content, ... } ou nested { message: {...} }
        const message = msg.message || msg;
        const conversationId = message.conversationId || msg.conversationId;

        // Mensagem DO CLIENTE reabre a janela de 24h. Sem atualizar aqui, a
        // tela continuava mostrando "janela encerrada" mesmo depois de ele
        // responder ao template, porque o estado vinha da carga inicial.
        if (message.role === "USER") {
          const alvoLeadId = message.leadId || null;
          setChats((prev) => prev.map((c) => {
            const daConversa = c.conversationId === conversationId || (alvoLeadId && c.id === alvoLeadId);
            return daConversa ? { ...c, windowOpen: true, windowMinutesLeft: 24 * 60 } : c;
          }));
          setSelectedChat((sel: any) =>
            sel && (sel.conversationId === conversationId || (alvoLeadId && sel.id === alvoLeadId))
              ? { ...sel, windowOpen: true, windowMinutesLeft: 24 * 60 }
              : sel
          );
        }

        // Atualiza mensagens se for o chat ativo
        const current = selectedChatRef.current;
        if (current) {
          const conv = current.conversations?.[0];
          if (conv && (conv.id === conversationId || !conversationId)) {
            setMessages(prev => {
              const exists = prev.find(m => m.id === message.id);
              if (exists) return prev;
              return [...prev, message];
            });
            return; // não incrementa unread pois está vendo o chat
          }
        }

        // Chat fechado: recarrega só a lista, que é o que muda (prévia,
        // não-lidas, ordem). O resto da tela não depende da mensagem nova.
        fetchConversations();
      } catch {}
    });
  }, []);

  // Abas por fase do atendimento. "Minhas" = atribuídas a mim.
  const contaFase = (fase: string) =>
    chats.filter((c: any) =>
      fase === "MINE"
        ? c.phase === "HUMAN" && c.assignedTo?.id === meuId
        : fase === "ALL"
        ? c.phase !== "CLOSED"
        : c.phase === fase
    ).length;

  const ABAS = [
    { id: "ALL", label: "Ativas" },
    { id: "QUEUE", label: "Na fila" },
    { id: "MINE", label: "Minhas" },
    { id: "BOT", label: "Com a IA" },
    { id: "CLOSED", label: "Encerradas" },
  ];

  // O backend já entrega ordenado por última mensagem; aqui só filtramos.
  const visibleChats = chats.filter((c: any) => {
    const fase = c.phase || "BOT";
    if (phaseFilter === "MINE") { if (!(fase === "HUMAN" && c.assignedTo?.id === meuId)) return false; }
    else if (phaseFilter === "ALL") { if (fase === "CLOSED") return false; }
    else if (fase !== phaseFilter) return false;
    if (channelFilter === "SITE") { if ((c.channel || "").toUpperCase() !== "SITE") return false; }
    else if (channelFilter !== "ALL") { if (c.waAccountId !== channelFilter) return false; }
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${c.name || ""} ${c.phone || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const iniciais = (nome?: string) => (nome || "?").trim().substring(0, 2).toUpperCase();
  const estadoAtual = estadoDaConversa(selectedChat, meuId);
  // O toggle reflete o botActive da conversa aberta; sem registro, a IA está
  // ligada (é o padrão do backend).
  const agenteAtivo = selectedChat?.conversations?.[0]?.botActive ?? true;

  const copiar = (texto: string, aviso: string) => {
    navigator.clipboard.writeText(texto).then(() => toast({ title: aviso })).catch(() => {});
  };

  return (
    <DashboardLayout>
      {/* Três painéis, sem rolagem na página: cada coluna rola por conta. */}
      <div className="flex h-[calc(100vh-60px)] overflow-hidden bg-surface-2">

        {/* ───────── LISTA DE CONVERSAS ───────── */}
        <aside
          className={`${selectedChat ? "hidden lg:flex" : "flex"} w-full shrink-0 flex-col border-r border-border-soft bg-background lg:w-[330px] lg:min-w-[260px]`}
        >
          <div className="space-y-3 border-b border-border-soft px-4 py-4">
            {/* Sem título: o cabeçalho do painel já diz "Conversas". */}
            <div className="flex items-center justify-between gap-2">
              <span className="num text-[11px] font-semibold uppercase tracking-wide text-faint">
                {visibleChats.length} {visibleChats.length === 1 ? "conversa" : "conversas"}
              </span>
              {/* Até aqui a conversa só nascia quando o cliente escrevia
                  primeiro: contato cadastrado e nunca contatado não tinha por
                  onde ser abordado. */}
              <Button
                size="sm"
                onClick={() => setNovaConversa(true)}
                className="h-7 gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Nova
              </Button>
            </div>

            {!hasWhatsApp && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-900">
                  <Smartphone className="h-3.5 w-3.5" /> WhatsApp desconectado
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                  Nada entra nem sai enquanto não houver um aparelho conectado.
                </p>
                <button
                  onClick={() => navigate("/connections")}
                  className="mt-2 text-[11px] font-semibold text-amber-900 underline underline-offset-2"
                >
                  Ir para Conexões
                </button>
              </div>
            )}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <Input
                placeholder="Buscar chat..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-lg border-border-soft bg-surface-2 pl-9 text-[13px] placeholder:text-faint"
              />
            </div>

            {/* Abas por fase: a fila humana precisa saltar aos olhos. */}
            <div className="flex flex-wrap gap-1.5">
              {ABAS.map((aba) => {
                const n = contaFase(aba.id);
                const ativa = phaseFilter === aba.id;
                const espera = aba.id === "QUEUE" && n > 0;
                return (
                  <button
                    key={aba.id}
                    onClick={() => setPhaseFilter(aba.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      ativa
                        ? "border-accent-text/30 bg-accent-soft text-accent-text"
                        : espera
                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "border-transparent bg-surface-2 text-faint hover:text-foreground"
                    }`}
                  >
                    {aba.label}
                    {n > 0 && <span className="num opacity-70">{n}</span>}
                  </button>
                );
              })}
            </div>

            {/* Filtro por canal / conexão (só aparece se houver origem cadastrada) */}
            {connections.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setChannelFilter("ALL")}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    channelFilter === "ALL"
                      ? "border-accent-text/30 bg-accent-soft text-accent-text"
                      : "border-transparent bg-surface-2 text-faint hover:text-foreground"
                  }`}
                >
                  Todos os canais
                </button>
                {connections.map((c: any) => {
                  const m = channelMeta(c.channel);
                  const ativo = channelFilter === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setChannelFilter(c.id)}
                      title={c.channel}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        ativo
                          ? "border-accent-text/30 bg-accent-soft text-accent-text"
                          : "border-transparent bg-surface-2 text-faint hover:text-foreground"
                      }`}
                    >
                      <m.Icon className="h-3 w-3" /> {c.name || c.phoneNumber || m.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => setChannelFilter("SITE")}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    channelFilter === "SITE"
                      ? "border-accent-text/30 bg-accent-soft text-accent-text"
                      : "border-transparent bg-surface-2 text-faint hover:text-foreground"
                  }`}
                >
                  <Globe className="h-3 w-3" /> Site
                </button>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-surface-2" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
                      <div className="h-2.5 w-full animate-pulse rounded bg-surface-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visibleChats.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <MessageSquare className="mx-auto mb-3 h-8 w-8 text-border-soft" />
                <p className="text-[13px] font-medium text-faint">
                  {search.trim() ? "Nenhuma conversa com esse termo." : "Nenhuma conversa neste filtro."}
                </p>
              </div>
            ) : (
              <div>
                {visibleChats.map((chat) => {
                  const selecionado = selectedChat?.id === chat.id;
                  const m = channelMeta(chat.channel);
                  const selo = faseSelo(chat, meuId);
                  const naoLidas = chat.unreadCount > 0 && !selecionado;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => setSelectedChat(chat)}
                      className={`flex w-full items-start gap-3 border-l-[3px] border-b border-b-border-soft px-3.5 py-3 text-left transition-colors ${
                        selecionado
                          ? "border-l-[#2563EB] bg-accent-soft"
                          : "border-l-transparent hover:bg-surface-2"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-surface-2 text-[11px] font-semibold text-faint">
                            {iniciais(chat.name)}
                          </AvatarFallback>
                        </Avatar>
                        {/* Selo do canal: de onde essa conversa está chegando. */}
                        <span
                          title={m.label}
                          className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-background ${m.selo}`}
                        >
                          <m.Icon className="h-2 w-2 text-white" />
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={`truncate text-[13px] ${naoLidas ? "font-bold text-foreground" : "font-semibold text-foreground"}`}>
                            {chat.name}
                          </p>
                          <span className="num shrink-0 text-[11px] text-faint">
                            {chat.lastMessageAt ? fmtWhen(chat.lastMessageAt) : ""}
                          </span>
                        </div>
                        <p className={`linha-unica-elipse mt-0.5 text-[12px] ${naoLidas ? "font-semibold text-foreground" : "text-faint"}`}>
                          {chat.lastMessagePreview || "Nenhuma mensagem ainda"}
                        </p>
                        {(selo || naoLidas) && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            {selo && (
                              <span title={selo.title} className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${selo.cls}`}>
                                {selo.label}
                              </span>
                            )}
                            {naoLidas && (
                              <span className="num ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#2563EB] px-1 text-[10px] font-bold text-white">
                                {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </aside>

        {/* ───────── THREAD ───────── */}
        <section
          className={`${selectedChat ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col bg-background lg:min-w-[420px]`}
        >
          {selectedChat ? (
            <>
              {/* Cabeçalho da conversa */}
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    onClick={() => setSelectedChat(null)}
                    className="-ml-1 rounded-lg p-1.5 text-faint hover:bg-surface-2 lg:hidden"
                    title="Voltar para a lista"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-accent-soft text-[11px] font-semibold text-accent-text">
                      {iniciais(selectedChat.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-foreground">{selectedChat.name}</p>
                    {/* Quem está com a conversa, por onde ela chega e o contato. */}
                    <p className="linha-unica-elipse text-[11.5px]">
                      <span className={estadoAtual.cor}>
                        <Circle className={`mr-1 inline h-2 w-2 ${estadoAtual.ponto}`} />
                        {estadoAtual.texto}
                      </span>
                      {/* O contato não repete aqui: ele está na ficha ao lado,
                          e nesta largura empurrava o estado para fora. */}
                      <span className="text-faint">{" · "}{channelMeta(selectedChat.channel).label}</span>
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {/* Agente ativo por conversa: desligar aqui cala a IA só nesta
                      thread. O controle existia no código mas não tinha
                      interface — o atendente não conseguia usá-lo. */}
                  <label className="hidden items-center gap-2 rounded-lg border border-border-soft px-2.5 py-1.5 sm:flex">
                    <span className="text-[11px] font-semibold text-faint">Agente</span>
                    <Switch checked={agenteAtivo} onCheckedChange={toggleBot} aria-label="Agente ativo nesta conversa" />
                  </label>

                  {selectedChat.phase === "CLOSED" ? (
                    <Button
                      onClick={() => acaoAtendimento("reopen", { comoHumano: true }, "Atendimento reaberto")}
                      className="h-9 rounded-lg bg-[#2563EB] px-3.5 text-[12px] font-semibold hover:bg-[#1D4ED8]"
                    >
                      Iniciar conversa
                    </Button>
                  ) : selectedChat.phase === "HUMAN" && selectedChat.assignedTo?.id === meuId ? (
                    <Button
                      onClick={encerrarAtendimento}
                      variant="outline"
                      className="h-9 rounded-lg border-border-soft px-3.5 text-[12px] font-semibold text-red-600 hover:bg-red-50"
                    >
                      Encerrar
                    </Button>
                  ) : (
                    <Button
                      onClick={() =>
                        acaoAtendimento("assign", {}, selectedChat.phase === "QUEUE" ? "Você assumiu o atendimento" : "Atendimento assumido")
                      }
                      className="h-9 rounded-lg bg-[#2563EB] px-3.5 text-[12px] font-semibold hover:bg-[#1D4ED8]"
                    >
                      {selectedChat.phase === "QUEUE" ? "Atender agora" : "Assumir conversa"}
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-border-soft">
                        <MoreVertical className="h-4 w-4 text-faint" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
                      <DropdownMenuItem
                        className="cursor-pointer rounded-lg text-[12px] font-medium"
                        onClick={handleOpenCallModal}
                      >
                        <Phone className="mr-2 h-4 w-4 text-accent-text" /> Chamar no WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer rounded-lg text-[12px] font-medium"
                        onClick={() => navigate(`/crm?lead=${selectedChat?.id}`)}
                      >
                        <User className="mr-2 h-4 w-4 text-accent-text" /> Ver no funil
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer rounded-lg text-[12px] font-medium"
                        onClick={() => {
                          if (selectedChat?.phone) {
                            navigator.clipboard.writeText(selectedChat.phone);
                            toast({ title: "Telefone copiado" });
                          }
                        }}
                      >
                        <Phone className="mr-2 h-4 w-4 text-accent-text" /> Copiar telefone
                      </DropdownMenuItem>
                      {selectedChat.phase !== "CLOSED" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer rounded-lg text-[12px] font-medium"
                            onClick={() => { setTransferAlvo(""); setTransferOpen(true); }}
                          >
                            <ArrowRightLeft className="mr-2 h-4 w-4 text-accent-text" /> Transferir conversa
                          </DropdownMenuItem>
                          {selectedChat.phase !== "BOT" && (
                            <DropdownMenuItem
                              className="cursor-pointer rounded-lg text-[12px] font-medium"
                              onClick={() => acaoAtendimento("return-bot", {}, "Conversa devolvida ao agente de IA")}
                            >
                              <Bot className="mr-2 h-4 w-4 text-emerald-600" /> Devolver para a IA
                            </DropdownMenuItem>
                          )}
                          {selectedChat.phase === "BOT" && (
                            <DropdownMenuItem
                              className="cursor-pointer rounded-lg text-[12px] font-medium"
                              onClick={() => acaoAtendimento("enqueue", { reason: "Enviada manualmente para a fila" }, "Conversa enviada para a fila")}
                            >
                              <Users className="mr-2 h-4 w-4 text-amber-600" /> Enviar para a fila
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="cursor-pointer rounded-lg text-[12px] font-medium"
                            onClick={encerrarAtendimento}
                          >
                            <XCircle className="mr-2 h-4 w-4 text-faint" /> Encerrar atendimento
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer rounded-lg text-[12px] font-medium"
                        onClick={() => setSelectedChat(null)}
                      >
                        <ChevronRight className="mr-2 h-4 w-4 text-faint" /> Fechar conversa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </header>

              {/* Corpo da conversa */}
              <div className="relative min-h-0 flex-1">
                {!hasWhatsApp && !loading && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/95 p-10 text-center backdrop-blur-sm">
                    <div className="max-w-sm space-y-4">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
                        <Smartphone className="h-8 w-8 text-amber-500" />
                      </div>
                      <h2 className="text-xl font-semibold tracking-tight text-foreground">WhatsApp desconectado</h2>
                      <p className="text-[13px] leading-relaxed text-faint">
                        Conecte um aparelho para receber e responder as conversas em tempo real.
                      </p>
                      <Button onClick={() => navigate("/connections")} className="h-10 w-full rounded-xl bg-[#2563EB] font-semibold hover:bg-[#1D4ED8]">
                        Conectar agora
                      </Button>
                    </div>
                  </div>
                )}

                <ScrollArea className="h-full bg-surface-2 px-5 py-6">
                  <div className="mx-auto flex max-w-3xl flex-col gap-3">
                    {messages.map((msg, i) => {
                      const isOut = msg.role === "SDR" || msg.role === "ASSISTANT";
                      const anterior = messages[i - 1];
                      const novoDia =
                        !anterior ||
                        new Date(anterior.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

                      // Marco do atendimento (entrou na fila, fulano assumiu,
                      // encerrado): centralizado, sem virar fala de ninguém.
                      const corpo =
                        msg.role === "SYSTEM" ? (
                          <div key={msg.id} className="flex justify-center py-1">
                            <span className="rounded-full bg-border-soft px-3 py-1 text-[11px] font-medium text-faint">
                              {msg.content}
                            </span>
                          </div>
                        ) : (
                          <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[76%] px-3.5 py-2.5 text-[13px] leading-relaxed transition-opacity ${
                                isOut
                                  ? "rounded-[14px_14px_4px_14px] bg-[#2563EB] text-white"
                                  : "rounded-[14px_14px_14px_4px] border border-border-soft bg-background text-foreground"
                              } ${msg.enviando ? "opacity-60" : ""}`}
                            >
                              {msg.messageType === "AUDIO" && (msg.mediaUrl || (typeof msg.content === "string" && msg.content.includes("/uploads/"))) ? (
                                <div className="space-y-1.5">
                                  <AudioPlayer url={msg.mediaUrl || msg.content} isOut={isOut} />
                                  {msg.content && !String(msg.content).includes("/uploads/") && (
                                    <p className="text-[12px] opacity-80">{msg.content}</p>
                                  )}
                                </div>
                              ) : (
                                <span className="whitespace-pre-wrap">{msg.content}</span>
                              )}
                              <p className={`num mt-1 text-right text-[10px] ${isOut ? "text-white/50" : "text-faint"}`}>
                                {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );

                      if (!novoDia) return corpo;
                      return (
                        <div key={`d-${msg.id}`} className="contents">
                          <div className="flex justify-center py-2">
                            <span className="rounded-full bg-background px-3 py-1 text-[11px] font-semibold text-faint shadow-card">
                              {fmtDia(msg.createdAt)}
                            </span>
                          </div>
                          {corpo}
                        </div>
                      );
                    })}

                    {messages.length === 0 && (
                      <div className="py-20 text-center text-[13px] font-medium text-faint">
                        Nenhuma mensagem trocada ainda
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>

              {/* Composer */}
              <div className="shrink-0 border-t border-border-soft bg-background px-5 py-3">
                {audioUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border-soft bg-surface-2 p-2.5 pl-4">
                    <div className="flex-1">
                      <p className="mb-1.5 text-[11px] font-semibold text-faint">Prévia do áudio</p>
                      <AudioPlayer url={audioUrl} isOut={false} />
                    </div>
                    <Button onClick={cancelAudio} variant="ghost" size="icon" className="rounded-lg text-faint hover:text-red-500">
                      <MicOff className="h-4 w-4" />
                    </Button>
                    <Button onClick={sendAudio} className="h-9 rounded-lg bg-[#2563EB] px-4 text-[12px] font-semibold hover:bg-[#1D4ED8]">
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar
                    </Button>
                  </div>
                ) : isRecording ? (
                  <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-2.5 pl-4">
                    <span className="h-2.5 w-2.5 animate-pulseDot rounded-full bg-red-500" />
                    <p className="flex-1 text-[13px] font-semibold text-red-600">Gravando áudio…</p>
                    <Button onClick={stopRecording} className="h-9 rounded-lg bg-red-500 px-4 text-[12px] font-semibold text-white hover:bg-red-600">
                      <MicOff className="mr-1.5 h-3.5 w-3.5" /> Parar
                    </Button>
                    <Button onClick={cancelAudio} variant="ghost" size="icon" className="rounded-lg text-faint">✕</Button>
                  </div>
                ) : selectedChat.windowOpen === false ? (
                  // Fora da janela de 24h o WhatsApp recusa texto livre: em vez
                  // de deixar digitar e falhar, oferecemos o caminho válido.
                  <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 pl-4">
                    <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-amber-900">Janela de 24h encerrada</p>
                      <p className="text-[11px] text-amber-700">
                        O cliente precisa responder para reabrir — ou envie um template aprovado.
                      </p>
                    </div>
                    <Button
                      onClick={() => setTemplateModal(true)}
                      className="h-9 shrink-0 rounded-lg bg-amber-600 px-3.5 text-[12px] font-semibold text-white hover:bg-amber-700"
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Enviar template
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Respostas rápidas: preenchem o campo, não enviam. */}
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {RESPOSTAS_RAPIDAS.map((r) => (
                        <button
                          key={r.rotulo}
                          type="button"
                          onClick={() => setMessage(r.texto)}
                          className="rounded-full border border-border-soft bg-surface-2 px-3 py-1 text-[11px] font-semibold text-faint transition-colors hover:border-accent-text/30 hover:bg-accent-soft hover:text-accent-text"
                        >
                          {r.rotulo}
                        </button>
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                      className="flex items-center gap-2 rounded-xl border border-border-soft bg-surface-2 p-1.5 pl-4 transition-shadow focus-within:border-accent-text/40"
                    >
                      <Input
                        placeholder="Responda manualmente ou deixe a IA agir…"
                        className="h-11 border-none bg-transparent text-[13px] shadow-none placeholder:text-faint focus-visible:ring-0"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                      <input
                        type="file" id="chat-file" className="hidden"
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = ""; }}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById("chat-file")?.click()}
                        title="Enviar imagem, vídeo ou documento"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint transition-colors hover:bg-accent-soft hover:text-accent-text"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={startRecording}
                        title="Gravar áudio"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint transition-colors hover:bg-accent-soft hover:text-accent-text"
                      >
                        <Mic className="h-4 w-4" />
                      </button>
                      <Button type="submit" className="h-9 w-9 shrink-0 rounded-lg bg-[#2563EB] p-0 hover:bg-[#1D4ED8]">
                        <Send className="h-4 w-4 text-white" />
                      </Button>
                    </form>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-surface-2">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background">
                <MessageSquare className="h-8 w-8 text-border-soft" />
              </div>
              <p className="text-[13px] font-medium text-faint">Selecione uma conversa para começar</p>
            </div>
          )}
        </section>

        {/* ───────── FICHA DO CONTATO ───────── */}
        {selectedChat && (
          <aside className="hidden w-[300px] min-w-[240px] shrink-0 flex-col border-l border-border-soft bg-background xl:flex">
            <ScrollArea className="flex-1">
              <div className="space-y-5 p-5">
                <div className="text-center">
                  <Avatar className="mx-auto h-[60px] w-[60px]">
                    <AvatarFallback className="bg-accent-soft text-[17px] font-semibold text-accent-text">
                      {iniciais(selectedChat.name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="mt-3 text-[15px] font-semibold tracking-tight text-foreground">{selectedChat.name}</p>
                  <p className="mt-0.5 text-[11.5px] text-faint">
                    {desdeQuando(ficha?.firstContactAt)
                      ? `Cliente desde ${desdeQuando(ficha?.firstContactAt)}`
                      : "Contato recente"}
                  </p>
                  {ficha?.optedOut && (
                    <p className="mt-2 inline-block rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                      Pediu para não receber mensagens
                    </p>
                  )}
                </div>

                {ficha?.tags?.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {ficha.tags.map((t: any) => (
                      <span
                        key={t.id}
                        className="rounded-md px-2 py-0.5 text-[10.5px] font-semibold"
                        style={{ backgroundColor: `${t.color || "#cbd5e1"}22`, color: t.color || "#64748b" }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-3 border-t border-border-soft pt-4">
                  <ParDado
                    rotulo="Telefone"
                    valor={selectedChat.phone || "—"}
                    aoCopiar={selectedChat.phone ? () => copiar(selectedChat.phone, "Telefone copiado") : undefined}
                  />
                  <ParDado
                    rotulo="E-mail"
                    valor={ficha?.email || selectedChat.email || "Não informado"}
                    aoCopiar={ficha?.email ? () => copiar(ficha.email, "E-mail copiado") : undefined}
                  />
                  <ParDado rotulo="Canal" valor={channelMeta(selectedChat.channel).label} />
                  {ficha?.source && <ParDado rotulo="Origem" valor={ficha.source} />}
                  <ParDado rotulo="Mensagens" valor={String(ficha?.messageCount ?? "—")} />
                </div>

                {/* Etapa do funil: mover daqui evita sair da conversa. */}
                <div className="space-y-1.5 border-t border-border-soft pt-4">
                  <label className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Etapa do funil</label>
                  <select
                    value={ficha?.stageId || ""}
                    onChange={(e) => salvarFicha({ stageId: e.target.value || null })}
                    disabled={!ficha}
                    className="h-9 w-full rounded-lg border border-border-soft bg-background px-2.5 text-[12.5px] font-medium text-foreground disabled:opacity-50"
                  >
                    <option value="">Sem etapa</option>
                    {etapas.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>

                {/* Próximo agendamento, com o link da reunião à mão. */}
                <div className="space-y-2 border-t border-border-soft pt-4">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Próximo agendamento</p>
                  {ficha?.nextAppointment ? (
                    <div className="rounded-xl border border-border-soft bg-surface-2 p-3">
                      <p className="text-[12.5px] font-semibold text-foreground">{ficha.nextAppointment.title}</p>
                      <p className="num mt-0.5 flex items-center gap-1.5 text-[11.5px] text-faint">
                        <Calendar className="h-3 w-3" />
                        {new Date(ficha.nextAppointment.date).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                      {ficha.nextAppointment.meetLink && (
                        <div className="mt-2 flex gap-1.5">
                          <a
                            href={ficha.nextAppointment.meetLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1D4ED8]"
                          >
                            <Video className="h-3 w-3" /> Abrir reunião
                          </a>
                          <button
                            onClick={() => copiar(ficha.nextAppointment.meetLink, "Link da reunião copiado")}
                            title="Copiar link da reunião"
                            className="rounded-lg border border-border-soft px-2 text-faint hover:text-accent-text"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[12px] text-faint">Nenhum agendamento futuro.</p>
                  )}
                </div>

                {/* Anotações internas: o cliente nunca vê. */}
                <div className="space-y-1.5 border-t border-border-soft pt-4">
                  <label className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Anotações</label>
                  <Textarea
                    value={anotacao}
                    onChange={(e) => setAnotacao(e.target.value)}
                    placeholder="Só a equipe vê o que for escrito aqui."
                    rows={4}
                    disabled={!ficha}
                    className="resize-none rounded-lg border-border-soft bg-surface-2 text-[12.5px] placeholder:text-faint"
                  />
                  {anotacao !== (ficha?.notes || "") && (
                    <Button
                      onClick={async () => {
                        setSalvandoAnotacao(true);
                        const ok = await salvarFicha({ notes: anotacao });
                        setSalvandoAnotacao(false);
                        if (ok) toast({ title: "Anotação salva" });
                      }}
                      disabled={salvandoAnotacao}
                      className="h-8 w-full rounded-lg bg-[#2563EB] text-[12px] font-semibold hover:bg-[#1D4ED8]"
                    >
                      {salvandoAnotacao ? "Salvando…" : "Salvar anotação"}
                    </Button>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={() => navigate(`/crm?lead=${selectedChat.id}`)}
                  className="h-9 w-full rounded-lg border-border-soft text-[12px] font-semibold"
                >
                  Ver no funil de clientes
                </Button>
              </div>
            </ScrollArea>
          </aside>
        )}
      </div>

      {/* MODAL DE CONTATO VIA WHATSAPP */}
      {/* Transferência: outro atendente ou de volta para uma fila */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-bold">Transferir conversa</DialogTitle>
            <DialogDescription>
              Escolha um atendente para assumir agora, ou devolva para uma fila de atendimento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto py-2">
            {agents.length > 0 && (
              <p className="text-[11px] font-bold text-slate-400 uppercase px-1">Atendentes</p>
            )}
            {agents.map((a: any) => (
              <button
                key={a.id}
                onClick={() => setTransferAlvo(`user:${a.id}`)}
                className={`w-full text-left p-3 rounded-2xl transition flex items-center justify-between ${
                  transferAlvo === `user:${a.id}` ? "bg-blue-50 ring-2 ring-[#2563EB]" : "bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <span className="font-bold text-sm text-slate-700">
                  {a.name} {a.id === meuId && <span className="text-slate-400 font-medium">(você)</span>}
                </span>
                <span className="text-[11px] font-bold text-slate-400">{a.emAtendimento} em atendimento</span>
              </button>
            ))}

            {queues.length > 0 && (
              <p className="text-[11px] font-bold text-slate-400 uppercase px-1 pt-2">Filas</p>
            )}
            {queues.map((f: any) => (
              <button
                key={f.id}
                onClick={() => setTransferAlvo(`queue:${f.id}`)}
                className={`w-full text-left p-3 rounded-2xl transition flex items-center justify-between ${
                  transferAlvo === `queue:${f.id}` ? "bg-blue-50 ring-2 ring-[#2563EB]" : "bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <span className="font-bold text-sm text-slate-700">{f.name}</span>
                <span className="text-[11px] font-bold text-slate-400">{f.aguardando} aguardando</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={confirmarTransferencia} disabled={!transferAlvo} className="rounded-2xl font-bold bg-[#2563EB]">
              <ArrowRightLeft className="w-4 h-4 mr-2" /> Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Templates aprovados para reabrir conversa fora da janela de 24h */}
      <Dialog open={templateModal} onOpenChange={setTemplateModal}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-bold">Enviar template</DialogTitle>
            <DialogDescription>
              Fora da janela de 24h o WhatsApp só aceita mensagens aprovadas pela Meta.
              O envio reabre a conversa por mais 24h.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-2 max-h-80 overflow-y-auto py-2">
              {templates.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  Nenhum template aprovado ainda.{" "}
                  <a href="/templates" className="text-[#2563EB] font-bold underline">Criar um</a>
                </p>
              ) : templates.map((t) => (
                <button
                  key={t.id} disabled={sendingTemplate}
                  onClick={() => setTemplateEscolhido(t)}
                  className={`w-full text-left p-4 rounded-2xl transition disabled:opacity-50 ${
                    templateEscolhido?.id === t.id
                      ? "bg-blue-50 ring-2 ring-[#2563EB]"
                      : "bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <span className="block font-bold text-sm text-slate-700">{t.name}</span>
                  <span className="block text-xs text-slate-500 mt-1 line-clamp-2">{t.content}</span>
                </button>
              ))}
            </div>

            {/* Template custa dinheiro: mostrar o balão antes de enviar evita
                mandar o texto errado para o cliente. */}
            <div className="space-y-3 sm:border-l sm:pl-5">
              {templateEscolhido ? (
                <>
                  <TemplatePreview
                    template={templateEscolhido}
                    contactName={selectedChat?.name || "Cliente"}
                    businessName={selectedChat?.accountName || "Sua empresa"}
                  />
                  <Button
                    onClick={() => sendTemplate(templateEscolhido.id)}
                    disabled={sendingTemplate}
                    className="w-full rounded-2xl font-bold bg-[#2563EB]"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {sendingTemplate ? "Enviando…" : "Enviar este template"}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-slate-400 font-medium py-8 text-center">
                  Escolha um template para ver como ele chega no WhatsApp.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={callModalOpen} onOpenChange={setCallModalOpen}>
        <DialogContent className="max-w-lg p-0 border-none shadow-sm rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 p-10 text-white">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-[#2563EB] flex items-center justify-center shadow-lg ">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Iniciar Contato</h2>
                <p className="text-xs text-white/40 font-bold ">via WhatsApp</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-xs font-semibold text-[#2DD4BF] mb-1">Como funciona</p>
              <p className="text-xs text-white/60 font-medium leading-relaxed">
                O sistema envia esta mensagem ao lead pelo WhatsApp e abre a conversa no WhatsApp Web para você continuar o contato manualmente.
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-10 bg-white space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-400">
                Mensagem de Aviso (editável)
              </label>
              <Textarea
                value={callMessage}
                onChange={e => setCallMessage(e.target.value)}
                rows={6}
                className="rounded-2xl border-slate-100 bg-slate-50 font-medium text-sm resize-none focus-visible:ring-emerald-500/30"
              />
              <p className="text-xs text-slate-400 font-bold">
                Para: <span className="text-[#2563EB]">{selectedChat?.phone}</span>
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-2xl font-semibold uppercase text-xs border-slate-100"
                onClick={() => setCallModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-[2] h-10 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-2xl font-semibold uppercase text-xs shadow-sm transition-all"
                onClick={handleCallIntent}
                disabled={callingLoading || !callMessage.trim()}
              >
                {callingLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Enviar e Abrir WhatsApp
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <NovaConversa open={novaConversa} onOpenChange={setNovaConversa} aoAbrir={abrirConversaDoCrm} />
    </DashboardLayout>
  );
}

/** Par rótulo/valor da ficha, com botão de copiar quando faz sentido. */
function ParDado({ rotulo, valor, aoCopiar }: { rotulo: string; valor: string; aoCopiar?: () => void }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[11.5px] text-faint">{rotulo}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[12.5px] font-medium text-foreground" title={valor}>{valor}</span>
        {aoCopiar && (
          <button onClick={aoCopiar} title={`Copiar ${rotulo.toLowerCase()}`} className="shrink-0 text-faint hover:text-accent-text">
            <Copy className="h-3 w-3" />
          </button>
        )}
      </span>
    </div>
  );
}
