import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, Send, Search, Filter, 
  Circle, MoreVertical, Smartphone, Bot, 
  CheckCircle2, Clock, Phone, Mail, User,
  ChevronRight, Calendar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Conversations() {
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sdrTyping, setSdrTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchData = async () => {
    try {
      const tenantId = localStorage.getItem("tenantId");
      const res = await fetch("/api/leads", {
        headers: { "x-tenant-id": tenantId || "" }
      });
      const data = await res.json();
      setChats(Array.isArray(data) ? data : []);
    } catch (e) {}
    setLoading(false);
  };

  const fetchMessages = async (leadId: string) => {
    if (!leadId) return;
    const tenantId = localStorage.getItem("tenantId");
    try {
      const res = await fetch(`/api/messages/${leadId}`, {
        headers: { "x-tenant-id": tenantId || "" }
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const toggleBot = async () => {
    if (!selectedChat) return;
    const tenantId = localStorage.getItem("tenantId");
    const currentStatus = selectedChat.conversations?.[0]?.botActive ?? true;
    const newStatus = !currentStatus;
    
    try {
      const res = await fetch(`/api/conversations/${selectedChat.id}/bot`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId || ""
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

  useEffect(() => {
    fetchData();
    
    // Configurar SSE para tempo real
    const tenantId = localStorage.getItem("tenantId"); // Assumindo que está no localStorage
    if (!tenantId) return;

    const eventSource = new EventSource(`/api/events?tenantId=${tenantId}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "new_message") {
        // Se for o chat selecionado, adiciona ao estado
        if (selectedChatRef.current && selectedChatRef.current.id === data.leadId) {
          setMessages(prev => [...prev.filter(m => m.id !== data.message.id), data.message]);
        }
        // Atualiza a lista de chats para mostrar o preview
        fetchData();
      } else if (data.type === "new_lead") {
        fetchData();
      } else if (data.type === "sdr_action") {
        if (selectedChatRef.current && (selectedChatRef.current.id === data.leadId || selectedChatRef.current.phone === data.leadPhone)) {
          setSdrTyping(data.action === "typing");
        }
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Use ref para acessar selectedChat dentro do useEffect do SSE
  const selectedChatRef = useRef(selectedChat);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    }
  }, [selectedChat]);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-140px)] flex gap-6 p-2 animate-in fade-in duration-500">
        
        {/* LISTA DE CONVERSAS */}
        <Card className="w-96 border-none shadow-2xl rounded-[40px] bg-white overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30 space-y-6">
             <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Conversas</h3>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold text-[9px] uppercase tracking-widest">IA Ativa</Badge>
             </div>
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
              {/* Header do Chat */}
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white px-10">
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
                    <Button variant="outline" size="icon" className="rounded-xl border-slate-100 hover:bg-slate-50"><Phone className="w-4 h-4 text-slate-400" /></Button>
                    <Button variant="outline" size="icon" className="rounded-xl border-slate-100 hover:bg-slate-50"><MoreVertical className="w-4 h-4 text-slate-400" /></Button>
                 </div>
              </div>

              {/* Mensagens */}
              <ScrollArea className="flex-1 p-10 bg-slate-50/30">
                 <div className="space-y-6 max-w-4xl mx-auto flex flex-col">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === 'SDR' || msg.role === 'ASSISTANT' ? 'justify-end' : 'justify-start'}`}>
                         <div className={`max-w-[70%] p-5 rounded-3xl text-sm font-medium shadow-sm ${msg.role === 'SDR' || msg.role === 'ASSISTANT' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                            {msg.content}
                            <p className={`text-[8px] font-bold uppercase mt-2 text-right ${msg.role === 'SDR' || msg.role === 'ASSISTANT' ? 'text-white/30' : 'text-slate-300'}`}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                         </div>
                      </div>
                    ))}
                    
                    {sdrTyping && (
                      <div className="flex justify-start">
                         <div className="max-w-[70%] p-5 rounded-3xl text-sm font-medium shadow-sm bg-slate-900 text-white rounded-tl-none">
                            <span className="flex items-center gap-2">
                               🤖 SDR está digitando
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
              <div className="p-8 px-10 bg-white border-t border-slate-50">
                 <form 
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex items-center gap-4 bg-slate-50 p-2 pl-6 rounded-3xl border border-slate-100 focus-within:ring-4 focus-within:ring-emerald-500/5 transition-all"
                >
                    <Input 
                      placeholder="Responda manualmente ou deixe a IA agir..." 
                      className="border-none bg-transparent shadow-none focus-visible:ring-0 font-bold text-xs"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                    />
                    <Button type="submit" className="h-12 w-12 bg-emerald-500 hover:bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-500/30 shrink-0">
                       <Send className="w-5 h-5 text-white" />
                    </Button>
                 </form>
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
