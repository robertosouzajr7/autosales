import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Plus, Smartphone, MessageSquare, CheckCircle2, 
  RefreshCw, Trash2, ShieldCheck, QrCode, AlertTriangle, 
  Activity, Globe, Link as LinkIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from "@/components/ui/dialog";

interface Connection {
  id: string;
  name: string;
  phone: string;
  status: "CONNECTED" | "DISCONNECTED" | "CONNECTING";
  instance: string;
  lastActive: string;
}

export default function Connections() {
  const [connections, setConnections] = useState<Connection[]>([
    { id: "1", name: "WhatsApp Main", phone: "+55 (11) 98823-1200", status: "CONNECTED", instance: "inst_01", lastActive: "Agora" },
    { id: "2", name: "Atendimento Pro", phone: "-", status: "DISCONNECTED", instance: "inst_02", lastActive: "Há 2 dias" }
  ]);
  const [showQrModal, setShowQrModal] = useState(false);
  const { toast } = useToast();

  const handleDisconnect = (id: string) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, status: "DISCONNECTED" as const } : c));
    toast({ title: "Conexão Encerrada", description: "O bot foi desconectado com sucesso." });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 p-6 lg:p-12 max-w-screen-xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4 uppercase">
                 <Smartphone className="w-10 h-10 text-primary" />
                 Canais de <span className="text-primary italic">Atendimento</span>
              </h1>
              <p className="text-slate-500 font-bold">Conecte suas contas de WhatsApp para ativar os SDRs.</p>
           </div>
           <Button onClick={() => setShowQrModal(true)} className="h-14 px-8 bg-slate-900 hover:bg-black text-lg font-black rounded-2xl shadow-2xl shadow-slate-200 gap-3">
              <Plus className="w-6 h-6 text-primary" /> Nova Conexão
           </Button>
        </div>

        {/* STATUS TILES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="p-6 border-none shadow-xl rounded-[30px] bg-white flex items-center gap-6">
              <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600"><Activity className="w-6 h-6" /></div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saúde da Rede</p>
                 <p className="text-2xl font-black text-emerald-600">100% Online</p>
              </div>
           </Card>
           <Card className="p-6 border-none shadow-xl rounded-[30px] bg-white flex items-center gap-6">
              <div className="bg-primary/5 p-4 rounded-2xl text-primary"><MessageSquare className="w-6 h-6" /></div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mensagens / Hora</p>
                 <p className="text-2xl font-black text-slate-900">~142 msgs</p>
              </div>
           </Card>
           <Card className="p-6 border-none shadow-xl rounded-[30px] bg-white flex items-center gap-6">
              <div className="bg-blue-50 p-4 rounded-2xl text-blue-600"><Globe className="w-6 h-6" /></div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Latência API</p>
                 <p className="text-2xl font-black text-blue-600">24ms</p>
              </div>
           </Card>
        </div>

        {/* CONNECTION LIST */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {connections.map(conn => (
             <Card key={conn.id} className="overflow-hidden border-none shadow-2xl rounded-[40px] bg-white group">
                <CardContent className="p-10 space-y-8">
                   <div className="flex justify-between items-start">
                      <div className="flex items-center gap-5">
                         <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${conn.status === 'CONNECTED' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            <Smartphone className="w-8 h-8" />
                         </div>
                         <div className="space-y-1">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{conn.name}</h3>
                            <div className="flex items-center gap-2">
                               <Badge className={`text-[9px] font-black uppercase tracking-widest border-none ${conn.status === 'CONNECTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                  {conn.status}
                               </Badge>
                               <span className="text-[10px] font-bold text-slate-400">ID: {conn.instance}</span>
                            </div>
                         </div>
                      </div>
                      <div className="flex gap-2">
                        {conn.status === 'CONNECTED' ? (
                          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl hover:bg-slate-100" onClick={() => handleDisconnect(conn.id)}>
                            <RefreshCw className="w-5 h-5 text-slate-400" />
                          </Button>
                        ) : (
                          <Button className="h-10 px-4 bg-primary hover:bg-primary/90 font-black rounded-xl text-[10px] uppercase" onClick={() => setShowQrModal(true)}>
                             Reconectar
                          </Button>
                        )}
                      </div>
                   </div>

                   <div className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-400 font-bold">Número Ativo</span>
                         <span className="text-slate-900 font-black tracking-tight">{conn.phone}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-400 font-bold">Última Atividade</span>
                         <span className="text-slate-900 font-bold">{conn.lastActive}</span>
                      </div>
                   </div>

                   <div className="flex items-center justify-between pt-4">
                      <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                         <CheckCircle2 className="w-4 h-4" /> Criptografia Ponta-a-Ponta
                      </div>
                      <Button variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest gap-2" onClick={() => handleDisconnect(conn.id)}>
                         <Trash2 className="w-4 h-4" /> Deletar Canal
                      </Button>
                   </div>
                </CardContent>
             </Card>
           ))}
        </div>

        {/* SECURITY INFO */}
        <div className="bg-slate-900 p-10 rounded-[40px] text-white flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl rounded-full translate-x-1/2" />
           <ShieldCheck className="w-16 h-16 text-primary shrink-0" />
           <div className="space-y-2 flex-1">
              <h4 className="text-xl font-black tracking-tight">Arquitetura SaaS Multi-Instância</h4>
              <p className="text-white/40 text-sm font-medium leading-relaxed">Cada conexão roda em um container isolado (Isolation Layer). Seus dados de sessão são criptografados e destruídos em caso de desconexão forçada.</p>
           </div>
           <Button className="h-14 px-10 bg-white text-slate-900 hover:bg-slate-100 font-black rounded-2xl gap-3">
              <LinkIcon className="w-5 h-5" /> Documentação API
           </Button>
        </div>
      </div>

      {/* QR CODE MODAL (Requirement 5) */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-md p-10 border-none shadow-3xl rounded-[40px] bg-white overflow-hidden text-center">
            <div className="space-y-6">
               <div className="space-y-2 mb-8">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Conectar <span className="text-primary italic">WhatsApp</span></h2>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Aponte a câmera do seu celular</p>
               </div>
               
               <div className="relative group p-6 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 aspect-square flex items-center justify-center">
                  <QrCode className="w-full h-full text-slate-900 opacity-20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                     <Card className="p-8 shadow-2xl border-none rounded-[30px] bg-white animate-in zoom-in-95 duration-500">
                        <div className="w-48 h-48 bg-slate-900 flex items-center justify-center rounded-2xl">
                           {/* PLACEHOLDER REAL QR */}
                           <div className="grid grid-cols-4 gap-2 opacity-50 p-4">
                              {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => <div key={i} className="w-full aspect-square bg-primary rounded" />)}
                           </div>
                        </div>
                     </Card>
                  </div>
               </div>

               <div className="flex items-center gap-3 justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest pt-4">
                  <Activity className="w-4 h-4 text-emerald-500 animate-pulse" /> Aguardando Sincronização...
               </div>

               <div className="space-y-4 pt-10">
                  <div className="flex items-start gap-4 text-left p-4 rounded-2xl bg-orange-50 border border-orange-100">
                     <AlertTriangle className="w-8 h-8 text-orange-500 shrink-0" />
                     <p className="text-[10px] font-bold text-orange-700 leading-normal uppercase">Dica: Mantenha o celular conectado à internet e não feche o app durante o pareamento inicial.</p>
                  </div>
               </div>
            </div>
            <Button onClick={() => setShowQrModal(false)} variant="ghost" className="mt-8 font-black text-slate-300 hover:text-slate-900 w-full rounded-2xl">FECHAR JANELA</Button>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
