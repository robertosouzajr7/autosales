import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, Send, Search,
  Circle, MoreVertical, Smartphone, Bot, 
  Phone, Mail, User,
  ChevronRight, Calendar, Mic, MicOff, Play, Pause, Volume2
} from "lucide-react";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
          isOut ? 'bg-white text-emerald-600' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
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
            isOut ? 'text-white/40 bg-white/20' : 'text-emerald-500 bg-slate-100'
          }`}
          style={{
            background: isOut 
              ? `linear-gradient(to right, rgba(255,255,255,0.8) ${progress}%, rgba(255,255,255,0.2) ${progress}%)`
              : `linear-gradient(to right, #10b981 ${progress}%, #f1f5f9 ${progress}%)`
          }}
        />
        <div className="flex justify-between items-center px-0.5">
           <span className={`text-[8px] font-black uppercase tracking-tighter ${isOut ? 'text-white/60' : 'text-slate-400'}`}>
             {formatTime(currentTime)}
           </span>
           <span className={`text-[8px] font-black uppercase tracking-tighter ${isOut ? 'text-white/60' : 'text-slate-400'}`}>
             {formatTime(duration)}
           </span>
        </div>
      </div>
      <Volume2 className={`w-3 h-3 opacity-30 shrink-0 ${isOut ? 'text-white' : 'text-slate-900'}`} />
    </div>
  );
}

export default function Conversations() {
  const [chats, setChats] = useState<any[]>([]);
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
      const [leadsRes, settingsRes] = await Promise.all([
        fetch("/api/leads", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/settings", { headers: { "Authorization": `Bearer ${token}` } })
      ]);
      
      const leadsData = await leadsRes.json();
      const settingsData = await settingsRes.json();
      
      setChats(Array.isArray(leadsData) ? leadsData : []);
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

  const handleSend = async () => {
    if (!message.trim() || !selectedChat) return;
    const content = message;
    setMessage("");
    const tenantId = localStorage.getItem("tenantId");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": tenantId || ""
        },
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
    
    // Convert blob to base64 to send via JSON
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;
      const tenantId = localStorage.getItem("tenantId");
      
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-tenant-id": tenantId || ""
          },
          body: JSON.stringify({ 
            leadId: selectedChat.id, 
            content: base64Audio, 
            role: "SDR",
            messageType: "AUDIO" 
          })
        });
        
        if (res.ok) {
          fetchMessages(selectedChat.id);
          setAudioBlob(null);
          setAudioUrl(null);
          toast({ title: "🎙️ Áudio enviado com sucesso!" });
        }
      } catch (e) {
        toast({ title: "Erro ao enviar áudio", variant: "destructive" });
      }
    };
  };

  useEffect(() => {
    selectedChatRef.current = selectedChat;
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      setCountOfUnread(0);
    }
  }, [selectedChat]);

  useEffect(() => {
    fetchData();
    const tenantId = localStorage.getItem("tenantId");
    if (!tenantId) return;

    const eventSource = new EventSource(`/api/events?tenantId=${tenantId}`);
    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // O servidor emite { conversationId, role, content, ... } ou nested { message: {...} }
        const message = msg.message || msg;
        const conversationId = message.conversationId || msg.conversationId;

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

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-140px)] flex gap-6 p-2 animate-in fade-in duration-500">
        
        {/* LISTA DE CONVERSAS */}
        <Card className="w-96 border-none shadow-2xl rounded-[40px] bg-white overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30 space-y-6">
             <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Conversas</h3>
                <Badge className={`${hasWhatsApp ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"} border-none font-bold text-[9px] uppercase tracking-widest`}>
                  {hasWhatsApp ? "WhatsApp Conectado" : "WhatsApp Desconectado"}
                </Badge>
             </div>
             {!hasWhatsApp && (
               <div className="p-4 bg-red-50 rounded-2xl border border-red-100 mb-4">
                 <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                   <Smartphone className="w-4 h-4" /> Conexão Necessária
                 </p>
                 <p className="text-[9px] text-red-500 font-bold leading-relaxed uppercase">
                   Seu WhatsApp não está conectado. As mensagens não serão recebidas nem enviadas até que você estabeleça uma conexão.
                 </p>
                 <Button 
                   onClick={() => window.location.href = "/connections"} 
                   variant="link" 
                   className="p-0 h-auto text-[9px] font-black text-red-600 uppercase mt-2 underline"
                 >
                   Ir para Conexões
                 </Button>
               </div>
             )}
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <Input placeholder="Buscar chat..." className="h-11 pl-10 border-slate-200 rounded-2xl bg-white text-xs font-bold" />
             </div>
          </div>
          
          <ScrollArea className="flex-1">
             <div className="p-3 space-y-2">
                {chats.map(chat => (
                  <div 
                    key={chat.id} 
                    onClick={() => setSelectedChat(chat)}
                    className={`p-4 rounded-3xl transition-all cursor-pointer flex items-center gap-4 group ${selectedChat?.id === chat.id ? 'bg-slate-900 text-white shadow-xl' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-2 ring-emerald-500/20">
                      <AvatarFallback className={`${selectedChat?.id === chat.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'} font-black text-xs`}>
                        {chat.name.substring(0,2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-center mb-0.5">
                          <p className="font-black text-sm truncate">{chat.name}</p>
                          <span className={`text-[8px] font-bold uppercase ${selectedChat?.id === chat.id ? 'text-white/40' : 'text-slate-300'}`}>
                            {chat.conversations?.[0]?.messages?.slice(-1)[0]?.createdAt ? new Date(chat.conversations[0].messages.slice(-1)[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                          </span>
                       </div>
                       <p className={`text-[10px] font-bold truncate ${selectedChat?.id === chat.id ? 'text-white/50' : 'text-slate-400'}`}>
                         {chat.conversations?.[0]?.messages?.slice(-1)[0]?.content || "Nenhuma mensagem iniciada"}
                       </p>
                    </div>
                  </div>
                ))}
             </div>
          </ScrollArea>
        </Card>

        {/* ÁREA DO CHAT */}
        <Card className="flex-1 border-none shadow-3xl rounded-[40px] bg-white overflow-hidden flex flex-col">
          {selectedChat ? (
            <>
            <div className="flex-1 flex flex-col relative min-h-0 bg-slate-50/10">
              {/* Header do Chat */}
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white px-10 shrink-0">
                 {!hasWhatsApp && !loading && (
                    <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-12 text-center animate-in fade-in duration-500 rounded-[40px]">
                       <Card className="max-w-md border-none shadow-3xl rounded-[40px] p-12 space-y-6 bg-white">
                          <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                             <Smartphone className="w-10 h-10 text-amber-500 animate-pulse" />
                          </div>
                          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">WhatsApp <span className="text-amber-500 italic">Desconectado</span></h2>
                          <p className="text-slate-500 font-bold text-sm leading-relaxed">Você precisa conectar um aparelho para visualizar e responder as conversas em tempo real.</p>
                          <Button onClick={() => window.location.href = "/connections"} className="w-full h-14 bg-slate-900 hover:bg-black font-black rounded-2xl shadow-xl shadow-slate-200">
                             CONECTAR AGORA
                          </Button>
                       </Card>
                    </div>
                 )}

                 <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-emerald-500 text-white font-black text-xs">
                        {selectedChat.name.substring(0,2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                       <p className="font-black text-slate-800 leading-none">{selectedChat.name}</p>
                       <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
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
                      className={`rounded-xl border-slate-100 font-bold text-xs ${selectedChat.conversations?.[0]?.botActive !== false ? 'hover:bg-slate-50' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'}`}
                    >
                      {selectedChat.conversations?.[0]?.botActive !== false ? "Pausar SDR" : "Retomar SDR"}
                    </Button>
                      <Button variant="outline" size="icon" className="rounded-xl border-slate-100 hover:bg-emerald-50 hover:border-emerald-200 group/call transition-colors"
                        onClick={handleOpenCallModal}
                        title="Iniciar contato por WhatsApp"
                      >
                        <Phone className="w-4 h-4 text-slate-400 group-hover/call:text-emerald-500 transition-colors" />
                      </Button>
                     <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                         <Button variant="outline" size="icon" className="rounded-xl border-slate-100 hover:bg-slate-50">
                           <MoreVertical className="w-4 h-4 text-slate-400" />
                         </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-2xl p-2 w-52">
                         <DropdownMenuItem
                           className="rounded-xl font-bold text-xs cursor-pointer"
                           onClick={() => navigate(`/crm?lead=${selectedChat?.id}`)}
                         >
                           <User className="w-4 h-4 mr-2 text-emerald-500" />
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
                           <Phone className="w-4 h-4 mr-2 text-blue-500" />
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
                          <div className={`max-w-[70%] p-4 rounded-3xl text-sm font-medium shadow-sm ${isOut ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                            {msg.messageType === 'AUDIO' ? (
                              <AudioPlayer url={msg.content} isOut={isOut} />
                            ) : msg.content}
                            <p className={`text-[8px] font-bold uppercase mt-2 text-right ${isOut ? 'text-white/30' : 'text-slate-300'}`}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    
                    {sdrTyping && (
                      <div className="flex justify-start">
                         <div className="max-w-[70%] p-5 rounded-3xl text-sm font-medium shadow-sm bg-slate-900 text-white rounded-tl-none">
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
                      <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-[0.2em]">
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
                  <div className="flex items-center gap-3 bg-emerald-50 p-3 pl-5 rounded-3xl border border-emerald-100">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-2">Prévia da Mensagem</p>
                      <AudioPlayer url={audioUrl} isOut={false} />
                    </div>
                    <div className="flex items-center gap-2 border-l border-emerald-200 pl-4 ml-2">
                      <Button onClick={cancelAudio} variant="ghost" size="icon" className="text-slate-400 hover:text-red-500 rounded-xl"><MicOff className="w-4 h-4" /></Button>
                      <Button onClick={sendAudio} className="h-10 px-5 bg-emerald-500 hover:bg-emerald-600 rounded-2xl text-xs font-black shadow-lg shadow-emerald-500/20"><Send className="w-4 h-4 mr-1" /> Enviar</Button>
                    </div>
                  </div>
                ) : isRecording ? (
                  // Gravando
                  <div className="flex items-center gap-3 bg-red-50 p-3 pl-5 rounded-3xl border border-red-100 animate-pulse">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <p className="flex-1 text-sm font-black text-red-600 uppercase tracking-widest">Gravando áudio...</p>
                    <Button onClick={stopRecording} className="h-10 px-5 bg-red-500 hover:bg-red-600 rounded-2xl text-xs font-black text-white"><MicOff className="w-4 h-4 mr-1" /> Parar</Button>
                    <Button onClick={cancelAudio} variant="ghost" size="icon" className="text-slate-400 rounded-xl">✕</Button>
                  </div>
                ) : (
                  // Input normal
                  <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-center gap-3 bg-slate-50 p-2 pl-5 rounded-3xl border border-slate-100 focus-within:ring-4 focus-within:ring-emerald-500/5 transition-all">
                    <Input placeholder="Responda manualmente ou deixe a IA agir..."
                      className="border-none bg-transparent shadow-none focus-visible:ring-0 font-bold text-xs"
                      value={message} onChange={e => setMessage(e.target.value)} />
                    <button type="button" onClick={startRecording}
                      className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors shrink-0">
                      <Mic className="w-5 h-5" />
                    </button>
                    <Button type="submit" className="h-10 w-10 bg-emerald-500 hover:bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-500/30 shrink-0">
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
               <p className="font-black uppercase tracking-widest text-xs">Selecione uma conversa para iniciar</p>
            </div>
          )}
        </Card>

        {/* INFO DO LEAD (LATERAL DIREITA) */}
        {selectedChat && (
          <Card className="w-80 border-none shadow-2xl rounded-[40px] bg-slate-900 text-white overflow-hidden hidden xl:flex flex-col p-8">
             <div className="space-y-10">
                <div className="text-center space-y-4">
                   <Avatar className="h-20 w-20 mx-auto border-4 border-white/10">
                      <AvatarFallback className="bg-emerald-500 text-white font-black text-xl">
                        {selectedChat.name.substring(0,2).toUpperCase()}
                      </AvatarFallback>
                   </Avatar>
                   <div>
                      <p className="text-lg font-black tracking-tight">{selectedChat.name}</p>
                      <Badge className="bg-white/10 text-emerald-400 border-none font-bold text-[9px] uppercase tracking-widest mt-1">Interessado</Badge>
                   </div>
                </div>

                <div className="space-y-6">
                   <InfoRow icon={<Phone className="w-4 h-4" />} label="WhatsApp" value={selectedChat.phone} />
                   <InfoRow icon={<Mail className="w-4 h-4" />} label="E-mail" value={selectedChat.email || "Não informado"} />
                   <InfoRow icon={<Calendar className="w-4 h-4" />} label="Captado em" value="31 Mar, 2026" />
                </div>

                <div className="p-6 bg-white/5 rounded-3xl space-y-3">
                   <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Resumo da IA</p>
                   <p className="text-[11px] font-bold text-white/50 leading-relaxed italic">"Lead demonstrou interesse no plano PRO mas tem dúvidas sobre o faturamento via boleto corporativo."</p>
                </div>

                <Button className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-500/20">Ver Perfil no CRM</Button>
             </div>
          </Card>
        )}
      </div>

      {/* MODAL DE CONTATO VIA WHATSAPP */}
      <Dialog open={callModalOpen} onOpenChange={setCallModalOpen}>
        <DialogContent className="max-w-lg p-0 border-none shadow-2xl rounded-[40px] overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 p-10 text-white">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tighter">Iniciar Contato</h2>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">via WhatsApp</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Como funciona</p>
              <p className="text-[11px] text-white/60 font-medium leading-relaxed">
                O sistema envia esta mensagem ao lead pelo WhatsApp e abre a conversa no WhatsApp Web para você continuar o contato manualmente.
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-10 bg-white space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Mensagem de Aviso (editável)
              </label>
              <Textarea
                value={callMessage}
                onChange={e => setCallMessage(e.target.value)}
                rows={6}
                className="rounded-2xl border-slate-100 bg-slate-50 font-medium text-sm resize-none focus-visible:ring-emerald-500/30"
              />
              <p className="text-[10px] text-slate-400 font-bold">
                Para: <span className="text-emerald-600">{selectedChat?.phone}</span>
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-14 rounded-2xl font-black uppercase text-xs tracking-widest border-slate-100"
                onClick={() => setCallModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-[2] h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-500/20 transition-all"
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
       <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">{label}</p>
       <div className="flex items-center gap-2 text-sm font-bold">
          <div className="text-emerald-500">{icon}</div>
          <span className="truncate">{value}</span>
       </div>
    </div>
  );
}
