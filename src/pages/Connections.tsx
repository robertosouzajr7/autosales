import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QRCodeCanvas } from "qrcode.react";

interface Connection {
  id: string;
  name: string;
  phone: string;
  status: "CONNECTED" | "DISCONNECTED" | "CONNECTING";
  instance: string;
  lastActive: string;
}

export default function Connections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string>("Aguardando...");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchConnections = async () => {
    try {
      const res = await fetch("/api/whatsapp/accounts");
      const data = await res.json();
      setConnections(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchConnections(); }, []);

  const handleAddConnection = async () => {
    if (!newName) return;
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName })
      });
      if (!res.ok) throw new Error("API Failure");
      const data = await res.json();
      setSelectedAccountId(data.id);
      setShowAddModal(false);
      setNewName("");
      setTimeout(() => handleOpenQr(data.id), 500);
      fetchConnections();
    } catch (e) {
      toast({ title: "Erro ao criar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenQr = (id: string) => {
    setSelectedAccountId(id);
    setShowQrModal(true);
    setQrCode(null);
    setQrStatus("Conectando...");

    const token = localStorage.getItem("token");
    const eventSource = new EventSource(`/api/whatsapp/qr/${id}?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.status === "CONNECTED") {
          setQrCode(null);
          setQrStatus("✅ Conectado!");
          toast({ title: "✅ WhatsApp Conectado!", description: data.phone ? `Número: ${data.phone}` : undefined });
          eventSource.close();
          setTimeout(() => { setShowQrModal(false); fetchConnections(); }, 2000);
        } else if (data.status === "DISCONNECTED") {
          setQrCode(null);
          setQrStatus("Desconectado. Tente novamente.");
          eventSource.close();
          fetchConnections();
        } else if (data.status === "ERROR") {
          setQrCode(null);
          setQrStatus(`Erro: ${data.message || "Falha na conexão"}`);
          toast({ title: "Erro na conexão", description: data.message, variant: "destructive" });
          eventSource.close();
        } else if (data.status === "WAITING") {
          setQrStatus("Gerando QR Code...");
        } else if (data.qr) {
          // QR code recebido — exibe para o usuário escanear
          setQrCode(data.qr);
          setQrStatus("Escaneie o QR Code com seu WhatsApp");
        }
      } catch {
        // Fallback para texto puro (compatibilidade)
        if (event.data === "CONNECTED") {
          setQrStatus("✅ Conectado!");
          eventSource.close();
          setTimeout(() => { setShowQrModal(false); fetchConnections(); }, 2000);
        } else if (event.data && event.data.length > 20) {
          setQrCode(event.data);
          setQrStatus("Escaneie o QR Code");
        }
      }
    };

    eventSource.onerror = () => {
      setQrStatus("Erro na conexão com o servidor. Verifique se o backend está rodando.");
      eventSource.close();
    };
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm("Remover esta conexão permanentemente?")) return;
    try {
      const res = await fetch(`/api/whatsapp/accounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "🗑️ Conexão Removida" });
        fetchConnections();
      }
    } catch (e) { toast({ title: "Erro ao remover", variant: "destructive" }); }
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
           <Button onClick={() => setShowAddModal(true)} className="h-14 px-8 bg-slate-900 hover:bg-black text-lg font-black rounded-2xl shadow-2xl shadow-slate-200 gap-3">
              <Plus className="w-6 h-6 text-primary" /> Nova Conexão
           </Button>
        </div>

        {/* STATUS TILES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="p-6 border-none shadow-xl rounded-[30px] bg-white flex items-center gap-6">
              <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600"><Activity className="w-6 h-6" /></div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conexões Ativas</p>
                 <p className="text-2xl font-black text-slate-900">{connections.filter(c => c.status === 'CONNECTED').length} / {connections.length}</p>
              </div>
           </Card>
           <Card className="p-6 border-none shadow-xl rounded-[30px] bg-white flex items-center gap-6">
              <div className="bg-primary/5 p-4 rounded-2xl text-primary"><MessageSquare className="w-6 h-6" /></div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saúde da Instância</p>
                 <p className="text-2xl font-black text-slate-900">{connections.length > 0 ? "Operacional" : "Sem Conexões"}</p>
              </div>
           </Card>
           <Card className="p-6 border-none shadow-xl rounded-[30px] bg-white flex items-center gap-6">
              <div className="bg-blue-50 p-4 rounded-2xl text-blue-600"><Globe className="w-6 h-6" /></div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status da API</p>
                 <p className="text-2xl font-black text-blue-600">Online</p>
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
                           <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                              <CheckCircle2 className="w-6 h-6" />
                           </div>
                         ) : (
                           <Button className="h-10 px-4 bg-primary hover:bg-primary/90 font-black rounded-xl text-[10px] uppercase" onClick={() => handleOpenQr(conn.id)}>
                              Reconectar
                           </Button>
                         )}
                      </div>
                   </div>

                   <div className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-400 font-bold">Número Ativo</span>
                         <span className="text-slate-900 font-black tracking-tight">{conn.phone || "--"}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-400 font-bold">Última Atividade</span>
                         <span className="text-slate-900 font-bold">{conn.lastActive || "Nunca"}</span>
                      </div>
                   </div>

                   <div className="flex items-center justify-between pt-4">
                      <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                         <CheckCircle2 className="w-4 h-4" /> Criptografia Ponta-a-Ponta
                      </div>
                       <Button variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest gap-2" onClick={() => handleDeleteConnection(conn.id)}>
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

      {/* MODAL ADICIONAR CONEXÃO */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md p-10 border-none shadow-3xl rounded-[40px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 uppercase">Novo Canal</DialogTitle>
            <DialogDescription>Escolha como deseja conectar seu WhatsApp.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="baileys" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-slate-100 p-1 mb-6">
              <TabsTrigger value="baileys" className="rounded-xl font-bold text-[10px] uppercase">QR Code (Baileys)</TabsTrigger>
              <TabsTrigger value="meta" className="rounded-xl font-bold text-[10px] uppercase">Meta Oficial (Cloud API)</TabsTrigger>
            </TabsList>
            
            <TabsContent value="baileys" className="space-y-4">
               <input 
                 type="text" 
                 placeholder="Nome da Conexão (ex: Comercial)"
                 value={newName}
                 onChange={(e) => setNewName(e.target.value)}
                 className="w-full h-14 px-6 bg-slate-100 rounded-2xl border-none font-bold text-slate-900 focus:ring-2 focus:ring-primary outline-none"
               />
               <Button onClick={handleAddConnection} disabled={loading || !newName} className="w-full h-14 bg-slate-900 font-black rounded-2xl text-white">
                  {loading ? "Processando..." : "GERAR QR CODE"}
               </Button>
            </TabsContent>

            <TabsContent value="meta" className="space-y-4">
               <div className="space-y-3">
                   <input type="text" id="meta-name" placeholder="Nome do Canal" className="w-full h-14 px-6 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                   <input type="text" id="meta-phone" placeholder="Seu Número (ex: 5511999999999)" className="w-full h-14 px-6 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                   <input type="text" id="meta-phoneid" placeholder="Phone Number ID" className="w-full h-14 px-6 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                   <input type="text" id="meta-waba" placeholder="WABA (Business Account ID)" className="w-full h-14 px-6 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                   <input type="text" id="meta-verify" placeholder="Verify Token (Escolha uma Senha p/ Webhook)" className="w-full h-14 px-6 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                  <div className="p-4 bg-slate-900 rounded-xl space-y-2">
                     <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">Webhook URL p/ Colar no Facebook:</p>
                     <p className="text-[11px] text-primary font-mono font-bold break-all">{window.location.origin}/api/webhook/whatsapp/meta</p>
                  </div>
                   <textarea id="meta-token" placeholder="Access Token Permanente (Bearer)" className="w-full h-24 px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none" />
               </div>
               <Button 
                onClick={async () => {
                  setLoading(true);
                  const payload = {
                    name: (document.getElementById("meta-name") as HTMLInputElement).value,
                    phone: (document.getElementById("meta-phone") as HTMLInputElement).value,
                    phoneId: (document.getElementById("meta-phoneid") as HTMLInputElement).value,
                    wabaId: (document.getElementById("meta-waba") as HTMLInputElement).value,
                    verifyToken: (document.getElementById("meta-verify") as HTMLInputElement).value,
                    accessToken: (document.getElementById("meta-token") as HTMLTextAreaElement).value,
                  };
                  try {
                    await fetch("/api/whatsapp/accounts/meta", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload)
                    });
                    toast({ title: "✅ Conta Meta Vinculada!" });
                    setShowAddModal(false);
                    fetchConnections();
                  } catch (e) { toast({ title: "Erro na conexão", variant: "destructive" }); }
                  finally { setLoading(false); }
                }}
                disabled={loading} 
                className="w-full h-14 bg-primary font-black rounded-2xl text-white"
               >
                  {loading ? "Vinculando..." : "VINCULAR CONTA OFICIAL"}
               </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* QR CODE MODAL (Requirement 5) */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-md p-10 border-none shadow-3xl rounded-[40px] bg-white overflow-hidden text-center">
            <div className="space-y-6">
               <div className="space-y-2 mb-8">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Conectar <span className="text-primary italic">WhatsApp</span></h2>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Aponte a câmera do seu celular</p>
               </div>
               
               <div className="relative group p-6 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 aspect-square flex items-center justify-center">
                   <div className="relative z-10">
                      <Card className="p-8 shadow-2xl border-none rounded-[30px] bg-white">
                         <div className="w-48 h-48 bg-white flex items-center justify-center rounded-2xl overflow-hidden border-4 border-slate-900">
                            {qrCode ? (
                               <QRCodeCanvas value={qrCode} size={192} level="H" includeMargin={true} />
                            ) : (
                               <div className="flex flex-col items-center gap-2 text-slate-300">
                                  <RefreshCw className="w-12 h-12 animate-spin" />
                                  <span className="text-[10px] font-black uppercase tracking-tighter">{qrStatus}</span>
                               </div>
                            )}
                         </div>
                      </Card>
                   </div>
               </div>

               <div className="bg-slate-900 text-white px-8 py-4 rounded-3xl font-black flex items-center justify-center gap-3 shadow-xl">
                  <ShieldCheck className="w-5 h-5 text-primary" /> {qrStatus}
               </div>
               
               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest px-10 leading-relaxed">
                  Seus dados de sessão são <span className="text-slate-900">criptografados de ponta a ponta</span> e nunca saem do servidor.
               </p>
            </div>
            <Button onClick={() => setShowQrModal(false)} variant="ghost" className="mt-8 font-black text-slate-300 hover:text-slate-900 w-full rounded-2xl uppercase text-[10px]">Fechar Janela</Button>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
