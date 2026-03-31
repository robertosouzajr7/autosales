import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, User, Bot, UserCheck } from "lucide-react";
import { format } from "date-fns";

export default function Conversations() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    fetch("/api/conversations").then(r => r.json()).then(setConversations);
  }, []);

  const loadMessages = async (conv) => {
    setActiveConv(conv);
    const data = await fetch(`/api/conversations/${conv.id}/messages`).then(r => r.json());
    setMessages(data);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeConv) return;
    const text = inputText;
    setInputText("");
    
    // Optimistic UI
    const tempMsg = { id: Date.now(), role: "system", content: text, createdAt: new Date() };
    setMessages(prev => [...prev, tempMsg]);

    await fetch(`/api/conversations/${activeConv.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text })
    });
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-100px)] gap-6 pb-4">
        
        {/* Lista de Chats */}
        <div className="w-1/3 flex flex-col gap-4 overflow-y-auto">
          <h2 className="text-xl font-bold px-2 text-slate-800">Inbox Helpdesk</h2>
          {conversations.map(conv => (
            <Card 
              key={conv.id} 
              className={`p-4 cursor-pointer hover:bg-slate-50 transition border-l-4 ${activeConv?.id === conv.id ? 'border-l-indigo-500 bg-slate-50' : 'border-l-transparent'} shadow-sm`}
              onClick={() => loadMessages(conv)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-slate-800">{conv.lead.name}</h3>
                  <p className="text-xs text-slate-500">{conv.lead.phone}</p>
                </div>
                {conv.botActive ? (
                   <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full flex items-center gap-1"><Bot className="w-3 h-3"/> SDR IA</span>
                ) : (
                   <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full flex items-center gap-1"><UserCheck className="w-3 h-3"/> Humano</span>
                )}
              </div>
              <p className="text-sm text-slate-600 truncate mt-2">
                {conv.messages?.[0]?.content || "Iniciou a conversa..."}
              </p>
            </Card>
          ))}
          {conversations.length === 0 && <p className="text-slate-500 text-sm p-4">Nenhuma conversa encontrada na base.</p>}
        </div>

        {/* Janela de Chat Aberto */}
        <Card className="flex-1 flex flex-col bg-slate-50/50 border-slate-200">
          {activeConv ? (
            <>
              {/* Header do Chat */}
              <div className="p-4 border-b bg-white rounded-t-xl flex justify-between items-center">
                 <div>
                    <h3 className="font-bold text-lg">{activeConv.lead.name}</h3>
                    <p className="text-xs text-slate-500">{activeConv.lead.phone} • Status: {activeConv.lead.status}</p>
                 </div>
                 {activeConv.botActive && (
                    <div className="text-xs bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg text-indigo-600 font-medium">
                      🤖 A Inteligência Artificial está pilotando este chat. Se você enviar uma mensagem, o bot será desligado (Handoff Automático).
                    </div>
                 )}
              </div>
              
              {/* Corpo das Mensagens */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg, idx) => {
                  const isUser = msg.role === "user";
                  const isAI = msg.role === "assistant";
                  return (
                    <div key={idx} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[70%] p-4 rounded-2xl ${isUser ? "bg-white border text-slate-800 rounded-bl-sm" : isAI ? "bg-indigo-600 text-white rounded-br-sm shadow-md" : "bg-teal-600 text-white rounded-br-sm shadow-md"}`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <span className={`text-[10px] block mt-1 text-right opacity-70`}>
                           {msg.createdAt && new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {isAI ? "SDR IA" : isUser ? "Cliente" : "Atendente Humano"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Caixa de Texto (Footer) */}
              <div className="p-4 bg-white border-t rounded-b-xl flex gap-3">
                <Input 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Envie uma mensagem (A IA vai pausar automaticamente)..."
                  className="flex-1"
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                />
                <Button onClick={handleSend} className="bg-teal-600 hover:bg-teal-700">
                  <Send className="w-4 h-4 mr-2" /> Enviar (Assumir)
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
               <Bot className="w-16 h-16 mb-4 opacity-20" />
               <p>Selecione um chat na esquerda para ler a conversa e assumir o atendimento.</p>
            </div>
          )}
        </Card>

      </div>
    </DashboardLayout>
  );
}
