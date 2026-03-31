import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Calendar, Phone, Bot, User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type Lead = {
  id: string;
  name: string;
  phone: string;
  status: string;
  source: string;
  conversations: { botActive: boolean }[];
};

export default function CRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLeads = async () => {
    try {
      const resp = await fetch("/api/leads");
      if (!resp.ok) throw new Error("Erro na rede");
      const data = await resp.json();
      setLeads(data);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Falha ao carregar leads", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kanbanColumns = [
    { id: "NEW", title: "Novos Leads", color: "bg-blue-50 border-blue-200", headerColor: "bg-blue-100 text-blue-800" },
    { id: "QUALIFYING", title: "Em Atendimento (IA)", color: "bg-amber-50 border-amber-200", headerColor: "bg-amber-100 text-amber-800" },
    { id: "APPOINTMENT", title: "Reunião Agendada", color: "bg-purple-50 border-purple-200", headerColor: "bg-purple-100 text-purple-800" },
    { id: "CONVERTED", title: "Venda Fechada", color: "bg-emerald-50 border-emerald-200", headerColor: "bg-emerald-100 text-emerald-800" }
  ];

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  const handleTestWebhook = async () => {
    const nome = prompt("Nome do Lead de Teste:");
    if (!nome) return;
    const msg = prompt("Mensagem que ele enviou:");
    if (!msg) return;

    try {
      const resp = await fetch("/api/webhook/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "551199999999" + Math.floor(Math.random()*10), name: nome, content: msg, source: "Simulador UI" })
      });
      const data = await resp.json();
      toast({ title: "Webhook Sucesso", description: `IA Respondeu: ${data.ai_response}` });
      fetchLeads(); // Recarrega o kanban
    } catch(err) {
      toast({ title: "Erro Webhook", description: "Falha ao simular envio.", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-800">Funil de Vendas</h1>
          <div className="flex gap-2">
            <button onClick={handleTestWebhook} className="px-4 py-1.5 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors">
              Simular Lead (Webhook)
            </button>
            <Badge variant="outline" className="text-sm px-3 py-1">Mês atual</Badge>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
        ) : (
          <div className="flex space-x-4 overflow-x-auto pb-4 h-[calc(100vh-140px)]">
            {kanbanColumns.map((col) => {
              const colLeads = leads.filter(l => l.status === col.id);
              return (
                <div key={col.id} className={`flex-shrink-0 w-80 rounded-xl border ${col.color} flex flex-col`}>
                  <div className={`px-4 py-3 rounded-t-xl font-semibold flex justify-between items-center ${col.headerColor}`}>
                    <span>{col.title}</span>
                    <Badge className="bg-white/50 text-slate-800 hover:bg-white">{colLeads.length}</Badge>
                  </div>
                  
                  <div className="p-3 flex-1 overflow-y-auto space-y-3">
                    {colLeads.map((lead) => {
                      const isBotActive = lead.conversations[0]?.botActive ?? true;
                      
                      return (
                        <Card key={lead.id} className="cursor-pointer hover:shadow-md transition-shadow border-slate-200">
                          <CardContent className="p-4">
                            <div className="flex gap-3 items-start mb-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-slate-200 text-slate-700 font-bold">
                                  {getInitials(lead.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-slate-800 text-sm leading-tight">{lead.name}</p>
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                  <Phone className="h-3 w-3" /> {lead.phone}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-100 relative">
                              <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 flex items-center gap-1">
                                {isBotActive ? <Bot className="w-3 h-3 text-emerald-500" /> : <User className="w-3 h-3 text-amber-500" />}
                                {lead.source}
                              </Badge>
                              <div className="flex gap-1">
                                <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Conversas">
                                  <MessageCircle className="h-4 w-4" />
                                </button>
                                <button className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-md transition-colors" title="Agendar">
                                  <Calendar className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {colLeads.length === 0 && <p className="text-center text-xs text-slate-400 py-6">Nenhum lead</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
