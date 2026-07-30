import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, Send, Search,
  Circle, MoreVertical, Smartphone, Bot,
  Phone, Mail, User,
  ChevronRight, Calendar, Mic, MicOff, Play, Pause, Volume2,
  Instagram, Globe, Clock, FileText, Paperclip
} from "lucide-react";
import { TemplatePreview } from "@/components/templates/TemplatePreview";

// Metadados de canal para o inbox multicanal (ícone, rótulo e cor).
const CHANNEL_META: Record<string, { label: string; cls: string; Icon: any }> = {
  WHATSAPP: { label: "WhatsApp", cls: "text-emerald-600 bg-emerald-50", Icon: MessageSquare },
  INSTAGRAM: { label: "Instagram", cls: "text-pink-600 bg-pink-50", Icon: Instagram },
  SITE: { label: "Site", cls: "text-blue-600 bg-blue-50", Icon: Globe },
};
function channelMeta(ch?: string) {
  return CHANNEL_META[(ch || "WHATSAPP").toUpperCase()] || CHANNEL_META.WHATSAPP;
}
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { notificationStore } from "@/lib/notifications";

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
  if (mesmoDia) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

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
  const [search, setSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sdrTyping, setSdrTyping] = useState(false);
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
  // Unread
  const [countOfUnread, setCountOfUnread] = useState(0);
  const selectedChatRef = useRef(selectedChat);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const [convRes, settingsRes, connRes, tplRes] = await Promise.all([
        fetch("/api/conversations", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/settings", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/whatsapp/accounts", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/templates", { headers: { "Authorization": `Bearer ${token}` } })
      ]);

      const convData = convRes.ok ? await convRes.json() : [];
      const settingsData = await settingsRes.json();
      const connData = connRes.ok ? await connRes.json() : [];
      const tplData = tplRes.ok ? await tplRes.json() : [];

      // O endpoint já devolve ordenado por última mensagem. `id` vira o leadId
      // porque o resto da tela (mensagens, toggle do bot) trabalha com ele.
      setChats(
        (Array.isArray(convData) ? convData : []).map((c: any) => ({
          ...c,
          id: c.leadId,
          conversationId: c.id,
          waAccountId: c.accountId,
          conversations: [{ id: c.id, botActive: c.botActive }],
        }))
      );
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
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/messages/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const upData = await up.json();
      if (!up.ok || !upData.url) throw new Error(upData.error || "Falha no upload");

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
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selectedChat.id, content, role: "SDR" })
      });
      if (res.ok) {
        fetchMessages(selectedChat.id);
      }
    } catch (e) {}
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
      const fd = new FormData();
      fd.append("file", audioBlob, "gravacao.webm");
      const up = await fetch("/api/messages/upload", {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok || !upData.url) throw new Error(upData.error || "Falha ao subir o áudio");

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
      setCountOfUnread(0);
    }
  }, [selectedChat]);

  useEffect(() => {
    fetchData();
    const token = localStorage.getItem("token");
    if (!token) return;

    const eventSource = new EventSource(`/api/events?token=${token}`);
    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
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

        // Chat não está aberto → incrementa unread (apenas local para badge da lista se quiser)
        if (message.role === 'USER') {
          setCountOfUnread(c => c + 1);
        }

        // Atualiza preview da lista
        fetchData();
      } catch {}
    };
    return () => eventSource.close();
  }, []);

  // O backend já entrega ordenado por última mensagem; aqui só filtramos.
  const visibleChats = chats.filter((c: any) => {
    if (channelFilter === "SITE") { if ((c.channel || "").toUpperCase() !== "SITE") return false; }
    else if (channelFilter !== "ALL") { if (c.waAccountId !== channelFilter) return false; }
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${c.name || ""} ${c.phone || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-140px)] flex gap-6 p-2 animate-in fade-in duration-500">

        {/* LISTA DE CONVERSAS */}
        <Card className="w-96 border-none shadow-sm rounded-2xl bg-white overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30 space-y-6">
             <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-800 tracking-tight">Conversas</h3>
                <Badge className={`${hasWhatsApp ? "bg-[#2563EB]/10 text-[#2563EB]" : "bg-red-500/10 text-red-600"} border-none font-bold text-xs `}>
                  {hasWhatsApp ? "WhatsApp Conectado" : "WhatsApp Desconectado"}
                </Badge>
             </div>
             {!hasWhatsApp && (
               <div className="p-4 bg-red-50 rounded-2xl border border-red-100 mb-4">
                 <p className="text-xs font-semibold text-red-600 mb-1 flex items-center gap-2">
                   <Smartphone className="w-4 h-4" /> Conexão Necessária
                 </p>
                 <p className="text-xs text-red-500 font-bold leading-relaxed uppercase">
                   Seu WhatsApp não está conectado. As mensagens não serão recebidas nem enviadas até que você estabeleça uma conexão.
                 </p>
                 <Button 
                   onClick={() => window.location.href = "/connections"} 
                   variant="link" 
                   className="p-0 h-auto text-xs font-semibold text-red-600 uppercase mt-2 underline"
                 >
                   Ir para Conexões
                 </Button>
               </div>
             )}
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <Input
                  placeholder="Buscar chat..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 pl-10 border-slate-200 rounded-2xl bg-white text-xs font-bold"
                />
             </div>

             {/* Filtro por canal / conexão (só aparece se houver >1 origem) */}
             {(connections.length > 0) && (
               <div className="flex flex-wrap gap-1.5 mt-3">
                 <button
                   onClick={() => setChannelFilter("ALL")}
                   className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${channelFilter === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                 >
                   Todos
                 </button>
                 {connections.map((c: any) => {
                   const m = channelMeta(c.channel);
                   const active = channelFilter === c.id;
                   return (
                     <button
                       key={c.id}
                       onClick={() => setChannelFilter(c.id)}
                       className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-colors ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                       title={c.channel}
                     >
                       <m.Icon className="w-3 h-3" /> {c.name || c.phoneNumber || m.label}
                     </button>
                   );
                 })}
                 <button
                   onClick={() => setChannelFilter("SITE")}
                   className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-colors ${channelFilter === "SITE" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                 >
                   <Globe className="w-3 h-3" /> Site
                 </button>
               </div>
             )}
          </div>

          <ScrollArea className="flex-1">
             <div className="p-3 space-y-2">
                {visibleChats.map(chat => (
                  <div 
                    key={chat.id} 
                    onClick={() => setSelectedChat(chat)}
                    className={`p-4 rounded-2xl transition-all cursor-pointer flex items-center gap-4 group ${selectedChat?.id === chat.id ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-2 ring-emerald-500/20">
                      <AvatarFallback className={`${selectedChat?.id === chat.id ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-500'} font-semibold text-xs`}>
                        {chat.name.substring(0,2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-center mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {(() => { const m = channelMeta(chat.channel); return (
                              <span
                                className={`shrink-0 inline-flex items-center justify-center h-4 w-4 rounded ${selectedChat?.id === chat.id ? 'bg-white/15 text-white' : m.cls}`}
                                title={m.label}
                              >
                                <m.Icon className="w-2.5 h-2.5" />
                              </span>
                            ); })()}
                            <p className="font-semibold text-sm truncate">{chat.name}</p>
                            {chat.handle && chat.handle !== chat.name && (
                              <span className={`text-[10px] font-medium truncate shrink-0 ${selectedChat?.id === chat.id ? 'text-white/40' : 'text-slate-400'}`}>
                                {chat.handle}
                              </span>
                            )}
                          </div>
                          <span className={`text-xs font-bold uppercase shrink-0 ${selectedChat?.id === chat.id ? 'text-white/40' : 'text-slate-300'}`}>
                            {chat.lastMessageAt ? fmtWhen(chat.lastMessageAt) : ""}
                          </span>
                       </div>
                       <div className="flex items-center gap-1.5">
                         <p className={`text-xs truncate flex-1 ${chat.unreadCount > 0 && selectedChat?.id !== chat.id ? 'font-bold text-slate-600' : 'font-bold'} ${selectedChat?.id === chat.id ? 'text-white/50' : chat.unreadCount > 0 ? '' : 'text-slate-400'}`}>
                           {chat.lastMessagePreview || "Nenhuma mensagem iniciada"}
                         </p>
                         {chat.unreadCount > 0 && selectedChat?.id !== chat.id && (
                           <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                             {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                           </span>
                         )}
                         {/* Sinaliza conversas em que a IA está pausada (atendimento humano) */}
                         {chat.conversations?.[0]?.botActive === false && (
                           <span
                             title="IA pausada — abra a conversa e clique em 'Devolver ao assistente'"
                             className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selectedChat?.id === chat.id ? 'bg-white/15 text-amber-200' : 'bg-amber-100 text-amber-700'}`}
                           >
                             IA pausada
                           </span>
                         )}
                       </div>
                    </div>
                  </div>
                ))}
             </div>
          </ScrollArea>
        </Card>

        {/* ÁREA DO CHAT */}
        <Card className="flex-1 border-none shadow-sm rounded-2xl bg-white overflow-hidden flex flex-col">
          {selectedChat ? (
            <>
            <div className="flex-1 flex flex-col relative min-h-0 bg-slate-50/10">
              {/* Header do Chat */}
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white px-10 shrink-0">
                 {!hasWhatsApp && !loading && (
                    <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-12 text-center animate-in fade-in duration-500 rounded-2xl">
                       <Card className="max-w-md border-none shadow-sm rounded-2xl p-12 space-y-6 bg-white">
                          <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                             <Smartphone className="w-10 h-10 text-amber-500 animate-pulse" />
                          </div>
                          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">WhatsApp <span className="text-amber-500">Desconectado</span></h2>
                          <p className="text-slate-500 font-bold text-sm leading-relaxed">Você precisa conectar um aparelho para visualizar e responder as conversas em tempo real.</p>
                          <Button onClick={() => window.location.href = "/connections"} className="w-full h-10 bg-slate-900 hover:bg-black font-semibold rounded-2xl shadow-sm shadow-slate-200">
                             CONECTAR AGORA
                          </Button>
                       </Card>
                    </div>
                 )}

                 <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-[#2563EB] text-white font-semibold text-xs">
                        {selectedChat.name.substring(0,2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                       <div className="flex items-center gap-2">
                         <p className="font-semibold text-slate-800 leading-none">{selectedChat.name}</p>
                         {(() => { const m = channelMeta(selectedChat.channel); const conn = connections.find((c: any) => c.id === selectedChat.waAccountId); return (
                           <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.cls}`}>
                             <m.Icon className="w-2.5 h-2.5" /> {conn?.name || m.label}
                           </span>
                         ); })()}
                       </div>
                       <p className="text-xs font-bold text-[#2563EB] mt-1.5 flex items-center gap-1.5">
                         {selectedChat.conversations?.[0]?.botActive !== false ? (
                            <><Circle className="w-2 h-2 fill-emerald-500" /> Atendimento via IA</>
                         ) : (
                            <><Circle className="w-2 h-2 fill-amber-500" /> IA Pausada (Transbordo Humano)</>
                         )}
                       </p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <Button 
                      onClick={toggleBot} 
                      variant="outline" 
                      className={`rounded-xl border-slate-100 font-bold text-xs ${selectedChat.conversations?.[0]?.botActive !== false ? 'hover:bg-slate-50' : 'bg-blue-50 border-emerald-100 text-[#2563EB] hover:bg-emerald-100'}`}
                    >
                      {selectedChat.conversations?.[0]?.botActive !== false ? "Assumir conversa" : "Devolver ao assistente"}
                    </Button>
                      <Button variant="outline" size="icon" className="rounded-xl border-slate-100 hover:bg-blue-50 hover:border-slate-300 group/call transition-colors"
                        onClick={handleOpenCallModal}
                        title="Iniciar contato por WhatsApp"
                      >
                        <Phone className="w-4 h-4 text-slate-400 group-hover/call:text-[#2563EB] transition-colors" />
                      </Button>
                     <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                         <Button variant="outline" size="icon" className="rounded-xl border-slate-100 hover:bg-slate-50">
                           <MoreVertical className="w-4 h-4 text-slate-400" />
                         </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-sm p-2 w-52">
                         <DropdownMenuItem
                           className="rounded-xl font-bold text-xs cursor-pointer"
                           onClick={() => navigate(`/crm?lead=${selectedChat?.id}`)}
                         >
                           <User className="w-4 h-4 mr-2 text-[#2563EB]" />
                           Ver no CRM
                         </DropdownMenuItem>
                         <DropdownMenuItem
                           className="rounded-xl font-bold text-xs cursor-pointer"
                           onClick={() => {
                             if (selectedChat?.phone) {
                               navigator.clipboard.writeText(selectedChat.phone);
                               toast({ title: "📋 Telefone copiado!" });
                             }
                           }}
                         >
                           <Phone className="w-4 h-4 mr-2 text-[#2563EB]" />
                           Copiar Telefone
                         </DropdownMenuItem>
                         <DropdownMenuSeparator />
                         <DropdownMenuItem
                           className="rounded-xl font-bold text-xs cursor-pointer text-red-500 focus:text-red-600"
                           onClick={() => {
                             if (confirm(`Apagar conversa de ${selectedChat?.name}?`)) {
                               setSelectedChat(null);
                             }
                           }}
                         >
                           <ChevronRight className="w-4 h-4 mr-2" />
                           Fechar Conversa
                         </DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                 </div>
              </div>

              {/* Mensagens */}
              <ScrollArea className="flex-1 p-10 bg-slate-50/30">
                 <div className="space-y-6 max-w-4xl mx-auto flex flex-col">
                    {messages.map(msg => {
                      const isOut = msg.role === 'SDR' || msg.role === 'ASSISTANT';
                      return (
                        <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] p-4 rounded-2xl text-sm font-medium shadow-sm ${isOut ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                            {msg.messageType === 'AUDIO' && (msg.mediaUrl || (typeof msg.content === 'string' && msg.content.includes('/uploads/'))) ? (
                              <div className="space-y-1.5">
                                <AudioPlayer url={msg.mediaUrl || msg.content} isOut={isOut} />
                                {/* Mostra a transcrição/legenda quando houver texto */}
                                {msg.content && !String(msg.content).includes('/uploads/') && (
                                  <p className="text-xs opacity-80">{msg.content}</p>
                                )}
                              </div>
                            ) : msg.content}
                            <p className={`text-xs font-bold uppercase mt-2 text-right ${isOut ? 'text-white/30' : 'text-slate-300'}`}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    
                    {sdrTyping && (
                      <div className="flex justify-start">
                         <div className="max-w-[70%] p-5 rounded-2xl text-sm font-medium shadow-sm bg-slate-900 text-white rounded-tl-none">
                            <span className="flex items-center gap-2">
                               <Bot className="w-4 h-4" /> SDR está digitando
                               <span className="flex space-x-1">
                                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></span>
                                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                               </span>
                            </span>
                         </div>
                      </div>
                    )}

                    {messages.length === 0 && !sdrTyping && (
                      <div className="py-20 text-center text-slate-300 font-semibold uppercase text-xs ">
                         Nenhuma mensagem trocada ainda
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                 </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-6 px-8 bg-white border-t border-slate-50">
                {audioUrl ? (
                  // Preview de áudio gravado
                  <div className="flex items-center gap-3 bg-blue-50 p-3 pl-5 rounded-2xl border border-emerald-100">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-emerald-700 mb-2">Prévia da Mensagem</p>
                      <AudioPlayer url={audioUrl} isOut={false} />
                    </div>
                    <div className="flex items-center gap-2 border-l border-slate-300 pl-4 ml-2">
                      <Button onClick={cancelAudio} variant="ghost" size="icon" className="text-slate-400 hover:text-red-500 rounded-xl"><MicOff className="w-4 h-4" /></Button>
                      <Button onClick={sendAudio} className="h-10 px-5 bg-[#2563EB] hover:bg-[#1D4ED8] rounded-2xl text-xs font-semibold shadow-lg "><Send className="w-4 h-4 mr-1" /> Enviar</Button>
                    </div>
                  </div>
                ) : isRecording ? (
                  // Gravando
                  <div className="flex items-center gap-3 bg-red-50 p-3 pl-5 rounded-2xl border border-red-100 animate-pulse">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <p className="flex-1 text-sm font-semibold text-red-600 ">Gravando áudio...</p>
                    <Button onClick={stopRecording} className="h-10 px-5 bg-red-500 hover:bg-red-600 rounded-2xl text-xs font-semibold text-white"><MicOff className="w-4 h-4 mr-1" /> Parar</Button>
                    <Button onClick={cancelAudio} variant="ghost" size="icon" className="text-slate-400 rounded-xl">✕</Button>
                  </div>
                ) : selectedChat.windowOpen === false ? (
                  // Fora da janela de 24h o WhatsApp recusa texto livre: em vez
                  // de deixar digitar e falhar, oferecemos o caminho válido.
                  <div className="flex items-center gap-3 bg-amber-50 p-4 pl-5 rounded-2xl border border-amber-100">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-900">Janela de 24h encerrada</p>
                      <p className="text-[11px] text-amber-700">
                        O cliente precisa responder para reabrir o atendimento — ou envie um template aprovado.
                      </p>
                    </div>
                    <Button
                      onClick={() => setTemplateModal(true)}
                      className="h-9 px-4 bg-amber-600 hover:bg-amber-700 rounded-2xl text-xs font-bold text-white shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" /> Enviar template
                    </Button>
                  </div>
                ) : (
                  // Input normal
                  <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-center gap-3 bg-slate-50 p-2 pl-5 rounded-2xl border border-slate-100 focus-within:ring-4 focus-within:ring-emerald-500/5 transition-all">
                    <Input placeholder="Responda manualmente ou deixe a IA agir..."
                      className="border-none bg-transparent shadow-none focus-visible:ring-0 font-bold text-xs"
                      value={message} onChange={e => setMessage(e.target.value)} />
                    <input
                      type="file" id="chat-file" className="hidden"
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = ""; }}
                    />
                    <button type="button" onClick={() => document.getElementById("chat-file")?.click()}
                      title="Enviar imagem, vídeo ou documento"
                      className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 transition-colors shrink-0">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button type="button" onClick={startRecording}
                      className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 transition-colors shrink-0">
                      <Mic className="w-5 h-5" />
                    </button>
                    <Button type="submit" className="h-10 w-10 bg-[#2563EB] hover:bg-[#1D4ED8] rounded-2xl shadow-lg shrink-0">
                      <Send className="w-4 h-4 text-white" />
                    </Button>
                  </form>
                )}
              </div>
               </div>
             </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4">
               <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-10 h-10 text-slate-200" />
               </div>
               <p className="text-sm font-medium text-muted-foreground">Selecione uma conversa para começar</p>
            </div>
          )}
        </Card>

        {/* INFO DO PACIENTE (LATERAL DIREITA) */}
        {selectedChat && (
          <Card className="w-80 border border-border shadow-sm rounded-2xl bg-card overflow-hidden hidden xl:flex flex-col p-6">
             <div className="space-y-6">
                <div className="text-center space-y-3">
                   <Avatar className="h-16 w-16 mx-auto">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                        {selectedChat.name.substring(0,2).toUpperCase()}
                      </AvatarFallback>
                   </Avatar>
                   <div>
                      <p className="text-base font-semibold text-foreground">{selectedChat.name}</p>
                      <p className="text-sm text-muted-foreground">Cliente</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <InfoRow icon={<Phone className="w-4 h-4" />} label="WhatsApp" value={selectedChat.phone} />
                   <InfoRow icon={<Mail className="w-4 h-4" />} label="E-mail" value={selectedChat.email || "Não informado"} />
                </div>

                <Button variant="outline" className="w-full" onClick={() => navigate("/crm")}>Ver no funil de pacientes</Button>
             </div>
          </Card>
        )}
      </div>

      {/* MODAL DE CONTATO VIA WHATSAPP */}
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

    </DashboardLayout>
  );
}

function InfoRow({ icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="space-y-1">
       <p className="text-xs font-medium text-muted-foreground">{label}</p>
       <div className="flex items-center gap-2 text-sm text-foreground">
          <div className="text-primary">{icon}</div>
          <span className="truncate">{value}</span>
       </div>
    </div>
  );
}
