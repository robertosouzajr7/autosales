import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Settings as SettingsIcon, Shield, Bell, Database, Globe, Sliders, Save, CheckCircle2, 
  Trash2, Plus, Zap, Bot, Target, HelpCircle, Loader2, Sparkles, MapPin, Search, Linkedin,
  ExternalLink, Mail, Smartphone, Phone, Calendar, Share2, Terminal, Code2, Key, RefreshCw, AlertCircle,
  CreditCard, DollarSign, Wallet, AlertTriangle, Check
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface IcpProfile {
  id: string;
  name: string;
  niche: string;
  role: string;
  location: string;
  isAutoHunterEnabled: boolean;
  dailyLimit: number;
}

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("general");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [icpProfiles, setIcpProfiles] = useState<IcpProfile[]>([]);
  const [newIcp, setNewIcp] = useState<Partial<IcpProfile>>({
      name: "", niche: "", role: "", location: "Brasil", isAutoHunterEnabled: false, dailyLimit: 200
  });
  
  const [users, setUsers] = useState<any[]>([]);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "AGENT" });

  // SaaS Billing & Subscription States
  const [billingData, setBillingData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [cardDetails, setCardDetails] = useState({
    cardHolder: "",
    cardNumber: "",
    cvv: "",
    expiry: ""
  });
  const [isPaying, setIsPaying] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const [aiConfig, setAiConfig] = useState({
    openAiKey: "",
    aiApiKey: "",
    elevenLabsKey: "",
    apolloApiKey: "",
    snovClientId: "",
    snovClientSecret: "",
    googleRefreshToken: "",
    webChatUrl: "",
    systemPrompt: "Você é um SDR de elite focado em qualificação de leads B2B.",
    language: "pt-BR",
  });

  const [metaConfig, setMetaConfig] = useState({
    phoneId: "",
    wabaId: "",
    accessToken: "",
    verifyToken: "autosales_webhook_token"
  });

  const [smtpConfig, setSmtpConfig] = useState({
    host: "",
    port: 587,
    user: "",
    pass: "",
    from: ""
  });

  const [listmonkConfig, setListmonkConfig] = useState({
    url: "",
    token: "",
    listId: ""
  });

  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const [resSettings, resIcp, resUsers] = await Promise.all([
        fetch("/api/settings", { headers }),
        fetch("/api/icp-profiles", { headers }),
        fetch("/api/users", { headers })
      ]);

      // Token expirado → redireciona para login
      if (resSettings.status === 401) {
        localStorage.clear();
        navigate("/login");
        return;
      }
      
      const dataSettings = await resSettings.json();
      const dataIcp = await resIcp.json();
      const dataUsers = await resUsers.json();
      
      setAiConfig({
        openAiKey: dataSettings.openAiKey || "",
        aiApiKey: dataSettings.aiApiKey || "",
        elevenLabsKey: dataSettings.elevenLabsKey || "",
        apolloApiKey: dataSettings.apolloApiKey || "",
        snovClientId: dataSettings.snovClientId || "",
        snovClientSecret: dataSettings.snovClientSecret || "",
        googleRefreshToken: dataSettings.googleRefreshToken || "",
        webChatUrl: dataSettings.webChatUrl || "",
        systemPrompt: dataSettings.systemPrompt || "Você é um SDR de elite focado em qualificação de leads B2B.",
        language: dataSettings.language || "pt-BR",
      });

      setSmtpConfig({
        host: dataSettings.smtpHost || "",
        port: dataSettings.smtpPort || 587,
        user: dataSettings.smtpUser || "",
        pass: dataSettings.smtpPass || "",
        from: dataSettings.smtpFrom || ""
      });

      setListmonkConfig({
        url: dataSettings.listmonkUrl || "",
        token: dataSettings.listmonkToken || "",
        listId: dataSettings.listmonkListId || ""
      });

      setIcpProfiles(Array.isArray(dataIcp) ? dataIcp : []);
      setUsers(Array.isArray(dataUsers) ? dataUsers : []);

      // Fetch SaaS Billing details dynamically
      try {
        const resBilling = await fetch("/api/billing/portal", { headers });
        if (resBilling.ok) {
          const billingPortalData = await resBilling.json();
          setBillingData(billingPortalData);
        }
      } catch (err) {
        console.error("Error loading billing details:", err);
      }

      try {
        const resPlans = await fetch("/api/billing/plans", { headers });
        if (resPlans.ok) {
          const activePlansData = await resPlans.json();
          setPlans(activePlansData);
        }
      } catch (err) {
        console.error("Error loading plans:", err);
      }

    } catch (e) {
      toast({ title: "Erro ao carregar configurações", variant: "destructive" });
    }
    setLoading(false);
  };

  const handlePayInvoice = async (invoiceId: string) => {
    setIsPaying(true);
    const token = localStorage.getItem("token");
    const headers: any = { 
      "Content-Type": "application/json"
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`/api/billing/pay-invoice/${invoiceId}`, {
        method: "POST",
        headers,
        body: JSON.stringify(cardDetails)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Fatura paga com sucesso!", description: "Seu plano foi atualizado/confirmado e o consumo resetado." });
        setIsPayModalOpen(false);
        setCardDetails({ cardHolder: "", cardNumber: "", cvv: "", expiry: "" });
        fetchData(); // Refresh all billing details
      } else {
        toast({ title: "Erro ao pagar fatura", description: data.error || "Dados inválidos", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro na transação de pagamento", variant: "destructive" });
    }
    setIsPaying(false);
  };

  const handleUpgradePlan = async (planId: string, planName: string) => {
    if (!confirm(`Confirmar upgrade para o plano ${planName}? Uma nova fatura será gerada.`)) return;
    setIsUpgrading(true);
    const token = localStorage.getItem("token");
    const headers: any = { 
      "Content-Type": "application/json"
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers,
        body: JSON.stringify({ planId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: `Plano atualizado para ${planName}!`, description: data.message });
        fetchData(); // Refresh all details
      } else {
        toast({ title: "Erro ao atualizar plano", description: data.error || "Tente novamente mais tarde.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro ao realizar upgrade", variant: "destructive" });
    }
    setIsUpgrading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    const token = localStorage.getItem("token");
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          ...aiConfig,
          elevenLabsKey: aiConfig.elevenLabsKey,
          smtpHost: smtpConfig.host,
          smtpPort: smtpConfig.port,
          smtpUser: smtpConfig.user,
          smtpPass: smtpConfig.pass,
          smtpFrom: smtpConfig.from,
          listmonkUrl: listmonkConfig.url,
          listmonkToken: listmonkConfig.token,
          listmonkListId: listmonkConfig.listId,
          metaConfig
        })
      });
      if (res.ok) toast({ title: "Configurações salvas!", description: "Tudo atualizado!" });
    } catch (e) {
      toast({ title: "Falha ao salvar", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleAddIcp = async () => {
    const token = localStorage.getItem("token");
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch("/api/icp-profiles", {
        method: "POST",
        headers,
        body: JSON.stringify(newIcp)
      });
      const data = await res.json();
      setIcpProfiles([...icpProfiles, data]);
      setNewIcp({ name: "", niche: "", role: "", location: "Brasil", isAutoHunterEnabled: false, dailyLimit: 200 });
      toast({ title: "Perfil ICP Criado!" });
    } catch (e) {}
  };

  const handleDeleteIcp = async (id: string) => {
    const token = localStorage.getItem("token");
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      await fetch(`/api/icp-profiles/${id}`, { method: "DELETE", headers });
      setIcpProfiles(icpProfiles.filter(p => p.id !== id));
      toast({ title: "Perfil Removido" });
    } catch (e) {}
  };

  const toggleAutoHunter = async (id: string, active: boolean) => {
      try {
          const profile = icpProfiles.find(p => p.id === id);
          if (!profile) return;
          const token = localStorage.getItem("token");
          const headers: any = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const res = await fetch(`/api/icp-profiles/${id}`, {
              method: "PUT",
              headers,
              body: JSON.stringify({ ...profile, isAutoHunterEnabled: active })
          });
          if (res.ok) {
              setIcpProfiles(icpProfiles.map(p => p.id === id ? { ...p, isAutoHunterEnabled: active } : p));
              toast({ title: active ? "Hunter Mode ATIVADO 🦁" : "Hunter Mode Desativado" });
          }
      } catch (e) {}
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#820AD1]" /></div>;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-12 max-w-[1200px] mx-auto animate-in fade-in duration-700">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div className="space-y-1">
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-1 flex items-center gap-3">
                   Configurações <span className="text-[#820AD1] italic">SaaS</span>
                </h1>
                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Ecossistema de SDR & Vendas Automáticas</p>
            </div>
            <Button onClick={handleSaveSettings} disabled={saving} className="h-16 px-10 bg-slate-900 text-white rounded-[22px] font-black uppercase text-[10px] tracking-widest flex items-center gap-3 shadow-2xl hover:scale-105 transition-all outline-none">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 text-[#9d4edd]" />}
                Salvar Painel
            </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-10">
          <TabsList className="bg-slate-50 p-1.5 rounded-[22px] border border-slate-100 shadow-sm inline-flex h-16 w-full md:w-auto">
            <TabsTrigger value="general" className="rounded-[18px] h-full px-8 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <Zap className="w-4 h-4 mr-2 text-rose-500" /> Geral
            </TabsTrigger>
            <TabsTrigger value="hunter" className="rounded-[18px] h-full px-8 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <Target className="w-4 h-4 mr-2 text-[#820AD1]" /> Hunter System
            </TabsTrigger>
            <TabsTrigger value="integrations" className="rounded-[18px] h-full px-8 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <Database className="w-4 h-4 mr-2 text-[#820AD1]" /> Integrações
            </TabsTrigger>
            <TabsTrigger value="channels" className="rounded-[18px] h-full px-8 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <Mail className="w-4 h-4 mr-2 text-[#820AD1]" /> Canais de Disparo
            </TabsTrigger>
            <TabsTrigger value="connections" className="rounded-[18px] h-full px-8 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <Share2 className="w-4 h-4 mr-2 text-amber-500" /> Conexões & API
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-[18px] h-full px-8 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <Shield className="w-4 h-4 mr-2 text-purple-500" /> Equipe
            </TabsTrigger>
            <TabsTrigger value="billing" className="rounded-[18px] h-full px-8 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <CreditCard className="w-4 h-4 mr-2 text-indigo-500" /> Assinatura & Cobrança
            </TabsTrigger>
          </TabsList>

          {/* ABA GERAL */}
          <TabsContent value="general">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="border-none shadow-xl rounded-[40px] overflow-hidden bg-white p-12 space-y-8">
                    <h3 className="text-xl font-black text-slate-900 uppercase">Personalização SDR</h3>
                    <div className="space-y-4">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">System Prompt Master</Label>
                       <textarea 
                        className="w-full min-h-[250px] bg-slate-50 border-none rounded-[35px] p-10 font-bold text-slate-600 outline-none"
                        value={aiConfig.systemPrompt}
                        onChange={(e) => setAiConfig({...aiConfig, systemPrompt: e.target.value})}
                       />
                    </div>
                </Card>
                <Card className="border-none shadow-xl rounded-[40px] overflow-hidden bg-white p-12 space-y-8 relative">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-black text-slate-900 uppercase">Seu Hub Digital</h3>
                        <Badge className="bg-[#820AD1] text-white border-none font-black text-[9px] uppercase tracking-widest px-4">Gerado Automaticamente</Badge>
                    </div>
                    <div className="space-y-6">
                       <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Hub de Agendamento do SDR (IA)</Label>
                          <div className="flex gap-4">
                             <div className="flex-1 h-16 bg-slate-50 border-2 border-slate-100 rounded-[28px] px-8 flex items-center font-bold text-slate-600 truncate border-dashed select-all">
                                {window.location.origin}/b/{localStorage.getItem("tenantId")}
                             </div>
                             <Button 
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/b/${localStorage.getItem("tenantId")}`);
                                    toast({ title: "Link Copiado!", description: "Envie este link para os seus leads pelo WhatsApp." });
                                }}
                                className="h-16 px-10 bg-slate-900 text-white rounded-[28px] font-black uppercase text-[10px] tracking-widest flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all outline-none"
                             >
                                <ExternalLink className="w-5 h-5 text-[#9d4edd]" /> Copiar Link
                             </Button>
                          </div>
                          <p className="text-[10px] text-slate-400 italic pl-2">Este é o seu link único de SDR que a IA enviará para qualificar e agendar com novos leads.</p>
                       </div>
                       
                       <Separator className="opacity-50" />

                       <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Redirecionar para Site Personalizado (Opcional)</Label>
                          <Input value={aiConfig.webChatUrl} onChange={(e) => setAiConfig({...aiConfig, webChatUrl: e.target.value})} placeholder="https://www.seusite.com.br" className="h-16 bg-slate-50 border-none rounded-3xl px-8 font-bold" />
                       </div>
                    </div>
                </Card>
             </div>
          </TabsContent>

          {/* ABA HUNTER SYSTEM */}
          <TabsContent value="hunter">
             <div className="space-y-8">
                <div className="flex justify-between items-center bg-slate-900 p-10 rounded-[45px] text-white">
                   <div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter italic">Prospecção Hunter</h3>
                      <p className="text-[10px] font-bold text-[#9d4edd] uppercase tracking-widest mt-1">Busca automática de leads baseada no ICP</p>
                   </div>
                   <Dialog>
                      <DialogTrigger asChild>
                         <Button className="bg-white text-slate-900 hover:bg-[#820AD1] hover:text-white rounded-3xl h-14 px-8 font-black uppercase text-[10px] tracking-widest transition-all">
                            <Plus className="w-5 h-5 mr-2" /> Novo ICP
                         </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-xl p-0 border-none shadow-3xl rounded-[50px] overflow-hidden">
                         <div className="bg-slate-900 p-12 text-white"><h2 className="text-3xl font-black uppercase tracking-tighter">Mapeamento ICP</h2></div>
                         <div className="p-12 space-y-8 bg-white">
                            <div className="space-y-3">
                               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Segmento</Label>
                               <Input placeholder="Ex: CEOs de TI" value={newIcp.name} onChange={(e) => setNewIcp({...newIcp, name: e.target.value})} className="h-14 bg-slate-50 rounded-2xl px-6 font-bold" />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                               <Input placeholder="Nicho" value={newIcp.niche} onChange={(e) => setNewIcp({...newIcp, niche: e.target.value})} className="h-14" />
                               <Input placeholder="Cargo" value={newIcp.role} onChange={(e) => setNewIcp({...newIcp, role: e.target.value})} className="h-14" />
                            </div>
                            <Input placeholder="Localização (Ex: São Paulo, Brasil)" value={newIcp.location} onChange={(e) => setNewIcp({...newIcp, location: e.target.value})} className="h-14" />
                            <Button onClick={handleAddIcp} className="w-full h-16 bg-slate-900 text-white rounded-[28px] font-black uppercase tracking-widest">Ativar Caçador</Button>
                         </div>
                      </DialogContent>
                   </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                   {icpProfiles.map(profile => (
                     <Card key={profile.id} className="border-none shadow-lg rounded-[40px] bg-white p-10 hover:shadow-2xl transition-all">
                        <div className="flex justify-between items-start mb-6">
                           <h4 className="text-xl font-black text-slate-900 uppercase leading-none">{profile.name}</h4>
                           <Button size="icon" variant="ghost" onClick={() => handleDeleteIcp(profile.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-8">
                           <Badge className="bg-purple-50 text-[#820AD1] px-4 py-1.5 rounded-full text-[9px] uppercase font-black tracking-widest">{profile.location}</Badge>
                           <Badge className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-[9px] uppercase font-black tracking-widest">{profile.role}</Badge>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-50 pt-8">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hunter Mode (200/dia)</Label>
                           <Switch checked={profile.isAutoHunterEnabled} onCheckedChange={(c) => toggleAutoHunter(profile.id, c)} />
                        </div>
                     </Card>
                   ))}
                </div>
             </div>
          </TabsContent>

          {/* ABA INTEGRAÇÕES (APIs Intel) */}
          <TabsContent value="integrations">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <Card className="border-none shadow-xl rounded-[40px] bg-white p-12 space-y-8">
                   <div className="flex items-center gap-4 text-rose-500 mb-4"><Zap className="w-8 h-8" /><h3 className="text-xl font-black text-slate-900 uppercase">Inteligência Apollo & Snov</h3></div>
                   <div className="space-y-6">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Apollo.io API Key</Label><Input type="password" value={aiConfig.apolloApiKey} onChange={(e) => setAiConfig({...aiConfig, apolloApiKey: e.target.value})} className="h-16 bg-slate-50 rounded-3xl px-8 font-bold" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Snov.io Client ID</Label><Input value={aiConfig.snovClientId} onChange={(e) => setAiConfig({...aiConfig, snovClientId: e.target.value})} className="h-14 bg-slate-50 rounded-2xl px-6 font-bold" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Snov.io Client Secret</Label><Input type="password" value={aiConfig.snovClientSecret} onChange={(e) => setAiConfig({...aiConfig, snovClientSecret: e.target.value})} className="h-14 bg-slate-50 rounded-2xl px-6 font-bold" /></div>
                   </div>
                </Card>
                <Card className="border-none shadow-xl rounded-[40px] bg-white p-12 space-y-8">
                    <div className="flex items-center gap-4 text-[#820AD1] mb-4"><Bot className="w-8 h-8" /><h3 className="text-xl font-black text-slate-900 uppercase">Modelos de IA (LLMs)</h3></div>
                    <div className="space-y-6">
                       <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Google Gemini API Key</Label><Input type="password" value={aiConfig.aiApiKey} onChange={(e) => setAiConfig({...aiConfig, aiApiKey: e.target.value})} className="h-16 bg-slate-50 rounded-3xl px-8 font-bold" /></div>
                       <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">OpenAI API Key (Opcional)</Label><Input type="password" value={aiConfig.openAiKey} onChange={(e) => setAiConfig({...aiConfig, openAiKey: e.target.value})} className="h-16 bg-slate-50 rounded-3xl px-8 font-bold" /></div>
                       
                       <Separator />
                       
                       <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">ElevenLabs API Key (Voz Natural)</Label>
                            <Badge className="bg-purple-50 text-[#820AD1] border-none text-[8px]">Novo</Badge>
                          </div>
                          <Input type="password" value={aiConfig.elevenLabsKey} onChange={(e) => setAiConfig({...aiConfig, elevenLabsKey: e.target.value})} className="h-16 bg-slate-50 rounded-3xl px-8 font-bold" placeholder="Sua chave da ElevenLabs" />
                       </div>
                    </div>
                 </Card>
             </div>
          </TabsContent>

          {/* ABA CONEXÕES (Google Calendar & Meta Webhook) */}
          <TabsContent value="connections">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <Card className="border-none shadow-xl rounded-[40px] bg-white p-12 space-y-8 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-5"><Calendar className="w-48 h-48" /></div>
                   <div className="flex items-center gap-4 text-amber-500 mb-4"><Calendar className="w-8 h-8" /><h3 className="text-xl font-black text-slate-900 uppercase underline decoration-amber-500 decoration-4">Google Calendar</h3></div>
                   <div className="space-y-6">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Google Refresh Token (Offline Access)</Label>
                         <Input value={aiConfig.googleRefreshToken} onChange={(e) => setAiConfig({...aiConfig, googleRefreshToken: e.target.value})} className="h-16 bg-slate-50 rounded-3xl px-8 font-bold" />
                      </div>
                      <Button className="w-full bg-slate-900 text-white h-14 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest">
                         <ExternalLink className="w-4 h-4" /> Autorizar Nova Conta Google
                      </Button>
                   </div>
                </Card>

                <Card className="border-none shadow-xl rounded-[40px] bg-white p-12 space-y-8 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-5"><Smartphone className="w-48 h-48" /></div>
                   <div className="flex items-center gap-4 text-[#820AD1] mb-4"><Smartphone className="w-8 h-8" /><h3 className="text-xl font-black text-slate-900 uppercase underline decoration-[#6c08b0] decoration-4">WhatsApp Cloud API (Meta)</h3></div>
                   <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Phone Number ID</Label><Input value={metaConfig.phoneId} onChange={(e) => setMetaConfig({...metaConfig, phoneId: e.target.value})} className="h-14 bg-slate-50 rounded-2xl px-6 font-bold" /></div>
                         <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">WABA Account ID</Label><Input value={metaConfig.wabaId} onChange={(e) => setMetaConfig({...metaConfig, wabaId: e.target.value})} className="h-14 bg-slate-50 rounded-2xl px-6 font-bold" /></div>
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Permanent Access Token</Label>
                         <Input type="password" value={metaConfig.accessToken} onChange={(e) => setMetaConfig({...metaConfig, accessToken: e.target.value})} className="h-14 bg-slate-50 rounded-2xl px-6 font-bold" />
                      </div>
                      <Separator />
                      <div className="p-6 bg-slate-900 rounded-3xl space-y-4">
                         <div className="flex items-center gap-2 text-[#9d4edd]"><Code2 className="w-4 h-4" /><p className="text-[10px] font-black uppercase tracking-widest">Webhook URL Configuration</p></div>
                         <div className="space-y-2">
                             <p className="text-[11px] text-slate-400 font-bold">Callback URL:</p>
                             <div className="bg-black/50 p-3 rounded-xl text-[#820AD1] font-mono text-[10px] break-all border border-[#820AD1]/20">https://{window.location.hostname}/api/webhooks/meta</div>
                         </div>
                         <div className="space-y-2">
                             <p className="text-[11px] text-slate-400 font-bold">Verify Token:</p>
                             <div className="bg-black/50 p-3 rounded-xl text-yellow-500 font-mono text-[10px] border border-yellow-500/20">{metaConfig.verifyToken}</div>
                         </div>
                      </div>
                   </div>
                </Card>
             </div>
          </TabsContent>

          {/* ABA USUÁRIOS */}
          <TabsContent value="channels" className="animate-in slide-in-from-bottom-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <Card className="border-none shadow-xl rounded-[40px] bg-white p-12 space-y-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-5"><Mail className="w-48 h-48" /></div>
                      <div className="flex items-center gap-4 text-[#820AD1] mb-4"><Mail className="w-8 h-8" /><h3 className="text-xl font-black text-slate-900 uppercase underline decoration-[#820AD1] decoration-4">Servidor de E-mail (SMTP)</h3></div>
                      
                      <div className="space-y-6">
                          <div className="grid grid-cols-1 gap-6">
                              <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Host SMTP</Label>
                                  <Input value={smtpConfig.host} onChange={(e) => setSmtpConfig({...smtpConfig, host: e.target.value})} className="h-14 bg-slate-50 rounded-2xl font-bold" placeholder="smtp.exemplo.com" />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Porta</Label>
                                      <Input type="number" value={smtpConfig.port} onChange={(e) => setSmtpConfig({...smtpConfig, port: parseInt(e.target.value)})} className="h-14 bg-slate-50 rounded-2xl font-bold" />
                                  </div>
                                  <div className="space-y-2">
                                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">E-mail de Envio (From)</Label>
                                      <Input value={smtpConfig.from} onChange={(e) => setSmtpConfig({...smtpConfig, from: e.target.value})} className="h-14 bg-slate-50 rounded-2xl font-bold" placeholder="disparos@seu-dominio.com" />
                                  </div>
                              </div>
                              <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Usuário SMTP</Label>
                                  <Input value={smtpConfig.user} onChange={(e) => setSmtpConfig({...smtpConfig, user: e.target.value})} className="h-14 bg-slate-50 rounded-2xl font-bold" />
                              </div>
                              <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Senha SMTP</Label>
                                  <Input type="password" value={smtpConfig.pass} onChange={(e) => setSmtpConfig({...smtpConfig, pass: e.target.value})} className="h-14 bg-slate-50 rounded-2xl font-bold" />
                              </div>
                          </div>
                      </div>
                  </Card>

                  <Card className="border-none shadow-xl rounded-[40px] bg-slate-900 text-white p-12 space-y-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-5"><Smartphone className="w-48 h-48" /></div>
                      <div className="flex items-center gap-4 text-[#9d4edd] mb-4"><Smartphone className="w-8 h-8" /><h3 className="text-xl font-black uppercase underline decoration-[#9d4edd] decoration-4">WhatsApp Sender</h3></div>
                      
                      <div className="space-y-6">
                        <p className="text-slate-400 text-sm font-medium leading-relaxed">
                          O remetente de WhatsApp é configurado automaticamente através das conexões ativas no seu painel de <span className="text-[#9d4edd] font-black">Conexões Diárias</span>.
                        </p>
                        <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                           <div className="flex items-center gap-3">
                              <CheckCircle2 className="w-5 h-5 text-[#9d4edd]" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Multi-Instância Ativa</span>
                           </div>
                           <p className="text-[11px] text-white/40 font-bold italic">
                             * O sistema rotaciona automaticamente entre os números conectados para evitar bloqueios em disparos em massa.
                           </p>
                        </div>
                        <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/5 h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => window.location.href="/connections"}>
                          Gerenciar Conexões
                        </Button>
                      </div>
                  </Card>
              </div>

              <div className="mt-10">
                  <Card className="border-none shadow-xl rounded-[40px] bg-slate-50 p-12 space-y-8 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-slate-800 mb-4">
                          <div className="p-4 bg-white rounded-3xl shadow-sm"><RefreshCw className="w-8 h-8 text-[#820AD1]" /></div>
                          <div>
                            <h3 className="text-xl font-black uppercase underline decoration-[#820AD1] decoration-4">E-mail em Massa (Listmonk API)</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Conecte sua infraestrutura de prospecção em massa</p>
                          </div>
                        </div>
                        <Badge className="bg-blue-100 text-[#820AD1] border-none font-black px-4 py-2 rounded-full text-[9px] uppercase tracking-widest">Enterprise Ready</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">URL do Listmonk</Label>
                              <Input value={listmonkConfig.url} onChange={(e) => setListmonkConfig({...listmonkConfig, url: e.target.value})} className="h-14 bg-white rounded-2xl font-bold" placeholder="https://listmonk.exemplo.com" />
                          </div>
                          <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">API Token</Label>
                              <Input type="password" value={listmonkConfig.token} onChange={(e) => setListmonkConfig({...listmonkConfig, token: e.target.value})} className="h-14 bg-white rounded-2xl font-bold" />
                          </div>
                          <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Default List ID</Label>
                              <Input value={listmonkConfig.listId} onChange={(e) => setListmonkConfig({...listmonkConfig, listId: e.target.value})} className="h-14 bg-white rounded-2xl font-bold" placeholder="1" />
                          </div>
                      </div>
                      
                      <div className="p-6 bg-purple-50 rounded-3xl border border-purple-100 flex items-center gap-4 text-[#2D0052]">
                        <AlertCircle className="w-6 h-6 shrink-0" />
                        <p className="text-[11px] font-bold leading-relaxed italic">
                          Ao configurar o Listmonk, Agentes Virtuais passará a gerenciar seus contatos e campanhas através dele, permitindo maior taxa de entrega e controle de bounces automático.
                        </p>
                      </div>
                  </Card>
              </div>
          </TabsContent>
          <TabsContent value="users" className="space-y-6 animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Gestão da Equipe</h3>
               <Button onClick={() => setIsNewUserModalOpen(true)} className="h-12 bg-slate-900 text-white rounded-xl px-6 font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">
                  <Plus className="w-4 h-4 mr-2" /> Novo Colaborador
               </Button>
            </div>

            <Card className="border-none shadow-3xl rounded-[40px] overflow-hidden bg-white">
               <CardContent className="p-0">
                  <div className="overflow-x-auto p-4">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="border-b border-slate-50">
                              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível de Acesso</th>
                              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                           </tr>
                        </thead>
                        <tbody>
                           {users.map((user) => (
                              <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                 <td className="p-6">
                                    <div className="flex items-center gap-3">
                                       <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400">
                                          {user.name.charAt(0)}
                                       </div>
                                       <div>
                                          <p className="font-extrabold text-slate-800">{user.name}</p>
                                          <p className="text-[10px] font-bold text-slate-400 italic">{user.email}</p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="p-6">
                                    <Badge variant="outline" className={`font-black text-[9px] uppercase tracking-widest ${user.role === 'ADMIN' ? 'border-purple-200 text-purple-600 bg-purple-50' : 'border-slate-200 text-slate-500 bg-slate-50'}`}>
                                       {user.role}
                                    </Badge>
                                 </td>
                                 <td className="p-6 text-right">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="text-red-400 hover:text-red-600 active:scale-90"
                                      onClick={async () => {
                                         if (confirm(`Remover acesso de ${user.name}?`)) {
                                            const token = localStorage.getItem("token");
                                            await fetch(`/api/users/${user.id}`, { 
                                               method: "DELETE",
                                               headers: { "Authorization": `Bearer ${token}` }
                                            });
                                            fetchData();
                                         }
                                      }}
                                    >
                                       <Trash2 className="w-4 h-4" />
                                    </Button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </CardContent>
             </Card>
           </TabsContent>

           <TabsContent value="billing" className="space-y-8 animate-in slide-in-from-bottom-4">
             {/* Visão Geral da Assinatura */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <Card className="border-none shadow-xl rounded-[30px] bg-gradient-to-tr from-slate-900 to-indigo-950 text-white p-8 relative overflow-hidden">
                 <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
                   <Zap className="w-48 h-48 text-indigo-400" />
                 </div>
                 <div className="space-y-4">
                   <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/20 px-3 py-1 rounded-full">Plano Atual</span>
                   <h2 className="text-3xl font-black uppercase tracking-tight">{billingData?.plan?.name || "Nenhum Plano"}</h2>
                   <p className="text-sm font-semibold text-slate-300">
                     {billingData?.plan?.priceMonthly ? `R$ ${billingData.plan.priceMonthly.toFixed(2)}/mês` : "Sem custo associado"}
                   </p>
                   <div className="pt-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                     Status: <span className={`font-black ${billingData?.tenant?.subscriptionStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-400'}`}>{billingData?.tenant?.subscriptionStatus || "TRIAL"}</span>
                   </div>
                 </div>
               </Card>

               <Card className="border-none shadow-xl rounded-[30px] bg-white p-8 relative overflow-hidden">
                 <div className="space-y-4">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Próxima Cobrança</span>
                   <h2 className="text-2xl font-black text-slate-800">
                     {billingData?.tenant?.nextBillingDate ? new Date(billingData.tenant.nextBillingDate).toLocaleDateString("pt-BR") : "Não agendada"}
                   </h2>
                   <p className="text-xs text-slate-400 font-bold uppercase">Ciclo mensal recorrente</p>
                   <div className="pt-2">
                     <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full">Renovação Automática</span>
                   </div>
                 </div>
               </Card>

               <Card className="border-none shadow-xl rounded-[30px] bg-white p-8 relative overflow-hidden">
                 <div className="space-y-4">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Status da Assinatura</span>
                   <div className="flex items-center gap-2">
                     <div className={`w-3 h-3 rounded-full ${billingData?.tenant?.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                     <h2 className="text-xl font-black uppercase text-slate-800">{billingData?.tenant?.subscriptionStatus || "TESTE GRÁTIS"}</h2>
                   </div>
                   <p className="text-xs text-slate-400 font-medium">Controle de limites renovado todo dia {billingData?.tenant?.nextBillingDate ? new Date(billingData.tenant.nextBillingDate).getDate() : "1"}</p>
                   <div className="pt-2">
                     {billingData?.tenant?.subscriptionStatus === 'OVERDUE' && (
                       <Badge className="bg-rose-500 text-white font-black text-[9px] uppercase px-3 py-1">Atraso no Pagamento</Badge>
                     )}
                   </div>
                 </div>
               </Card>
             </div>

             {/* Consumo e Limites Detalhados */}
             <Card className="border-none shadow-xl rounded-[40px] bg-white p-12 space-y-8">
               <div>
                 <h3 className="text-xl font-black text-slate-900 uppercase">Métricas de Consumo do Período</h3>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Uso de limites em tempo real conforme plano ativo</p>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* SDRs Actives */}
                 <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                   <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2">
                       <Bot className="w-5 h-5 text-indigo-500" />
                       <span className="text-xs font-black uppercase tracking-widest text-slate-700">Agentes SDR Ativos</span>
                     </div>
                     <span className="text-xs font-black text-slate-900">
                       {billingData?.plan?.enableSdr ? `${billingData?.tenant?.activeSdrs || 0} / ${billingData?.plan?.maxSdrs || 0}` : "Bloqueado"}
                     </span>
                   </div>
                   {billingData?.plan?.enableSdr ? (
                     <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                       <div 
                         className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                         style={{ width: `${Math.min(100, ((billingData?.tenant?.activeSdrs || 0) / (billingData?.plan?.maxSdrs || 1)) * 100)}%` }} 
                       />
                     </div>
                   ) : (
                     <div className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 p-2.5 rounded-xl border border-dashed text-center">
                       Disponível apenas a partir do plano Pro
                     </div>
                   )}
                 </div>

                 {/* Tokens IA */}
                 <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                   <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2">
                       <Zap className="w-5 h-5 text-[#820AD1]" />
                       <span className="text-xs font-black uppercase tracking-widest text-slate-700">Créditos de Tokens / IA</span>
                     </div>
                     <span className="text-xs font-black text-slate-900">
                       {billingData?.plan?.enableTokens ? `${billingData?.tenant?.usedTokens || 0} / ${billingData?.plan?.maxTokens || 0}` : "Bloqueado"}
                     </span>
                   </div>
                   {billingData?.plan?.enableTokens ? (
                     <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                       <div 
                         className="bg-[#820AD1] h-full rounded-full transition-all duration-500" 
                         style={{ width: `${Math.min(100, ((billingData?.tenant?.usedTokens || 0) / (billingData?.plan?.maxTokens || 1)) * 100)}%` }} 
                       />
                     </div>
                   ) : (
                     <div className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 p-2.5 rounded-xl border border-dashed text-center">
                       Disponível apenas em planos pagos
                     </div>
                   )}
                 </div>

                 {/* Prospects Search (BDR) */}
                 <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                   <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2">
                       <Target className="w-5 h-5 text-emerald-500" />
                       <span className="text-xs font-black uppercase tracking-widest text-slate-700">Varreduras BDR / Mês</span>
                     </div>
                     <span className="text-xs font-black text-slate-900">
                       {billingData?.plan?.enableProspects ? `${billingData?.tenant?.usedProspects || 0} / ${billingData?.plan?.maxProspects || 0}` : "Bloqueado"}
                     </span>
                   </div>
                   {billingData?.plan?.enableProspects ? (
                     <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                       <div 
                         className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                         style={{ width: `${Math.min(100, ((billingData?.tenant?.usedProspects || 0) / (billingData?.plan?.maxProspects || 1)) * 100)}%` }} 
                       />
                     </div>
                   ) : (
                     <div className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 p-2.5 rounded-xl border border-dashed text-center">
                       Recurso Desativado
                     </div>
                   )}
                 </div>

                 {/* Deep Research */}
                 <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                   <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2">
                       <Search className="w-5 h-5 text-amber-500" />
                       <span className="text-xs font-black uppercase tracking-widest text-slate-700">Deep Research / Mês</span>
                     </div>
                     <span className="text-xs font-black text-slate-900">
                       {billingData?.plan?.enableResearch ? `${billingData?.tenant?.usedResearch || 0} / ${billingData?.plan?.maxResearch || 0}` : "Bloqueado"}
                     </span>
                   </div>
                   {billingData?.plan?.enableResearch ? (
                     <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                       <div 
                         className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                         style={{ width: `${Math.min(100, ((billingData?.tenant?.usedResearch || 0) / (billingData?.plan?.maxResearch || 1)) * 100)}%` }} 
                       />
                     </div>
                   ) : (
                     <div className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 p-2.5 rounded-xl border border-dashed text-center">
                       Recurso Desativado
                     </div>
                   )}
                 </div>

                 {/* Messages/month */}
                 <div className="p-6 bg-slate-50 rounded-3xl space-y-4 col-span-1 md:col-span-2">
                   <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2">
                       <Mail className="w-5 h-5 text-blue-500" />
                       <span className="text-xs font-black uppercase tracking-widest text-slate-700">Mensagens Disparadas / Mês</span>
                     </div>
                     <span className="text-xs font-black text-slate-900">
                       {billingData?.plan?.enableMessages ? `${billingData?.tenant?.usedMessages || 0} / ${billingData?.plan?.maxMessages || 0}` : "Bloqueado"}
                     </span>
                   </div>
                   {billingData?.plan?.enableMessages ? (
                     <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                       <div 
                         className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                         style={{ width: `${Math.min(100, ((billingData?.tenant?.usedMessages || 0) / (billingData?.plan?.maxMessages || 1)) * 100)}%` }} 
                       />
                     </div>
                   ) : (
                     <div className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 p-2.5 rounded-xl border border-dashed text-center">
                       Disparos Bloqueados
                     </div>
                   )}
                 </div>
               </div>
             </Card>

             {/* Histórico de Invoices */}
             <Card className="border-none shadow-xl rounded-[40px] bg-white p-12 space-y-8">
               <div>
                 <h3 className="text-xl font-black text-slate-900 uppercase">Histórico de Cobrança</h3>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Acompanhe suas mensalidades e faturas pendentes</p>
               </div>

               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="border-b border-slate-100">
                       <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificador</th>
                       <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                       <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Vencimento</th>
                       <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Pagamento</th>
                       <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                       <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                     </tr>
                   </thead>
                   <tbody>
                     {(billingData?.invoices || []).length === 0 ? (
                       <tr>
                         <td colSpan={6} className="py-8 text-center text-xs font-bold text-slate-400 uppercase">
                           Nenhuma fatura encontrada.
                         </td>
                       </tr>
                     ) : (
                       (billingData.invoices).map((invoice: any) => (
                         <tr key={invoice.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                           <td className="py-4 font-mono text-xs text-slate-500">#{invoice.id.slice(0, 8)}</td>
                           <td className="py-4 font-black text-slate-800">R$ {invoice.amount.toFixed(2)}</td>
                           <td className="py-4 text-xs font-semibold text-slate-600">
                             {new Date(invoice.dueDate).toLocaleDateString("pt-BR")}
                           </td>
                           <td className="py-4 text-xs font-semibold text-slate-600">
                             {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString("pt-BR") : "-"}
                           </td>
                           <td className="py-4">
                             <Badge className={`font-black text-[9px] uppercase tracking-widest border-none ${
                               invoice.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' :
                               invoice.status === 'PENDING' ? 'bg-amber-50 text-amber-600' :
                               'bg-rose-50 text-rose-600'
                             }`}>
                               {invoice.status === 'PAID' ? 'PAGO' : invoice.status === 'PENDING' ? 'PENDENTE' : 'ATRASADO'}
                             </Badge>
                           </td>
                           <td className="py-4 text-right">
                             {invoice.status !== 'PAID' && (
                               <Button 
                                 size="sm"
                                 onClick={() => {
                                   setSelectedInvoice(invoice);
                                   setIsPayModalOpen(true);
                                 }}
                                 className="bg-[#820AD1] hover:bg-[#6c08b0] text-white font-black uppercase text-[10px] tracking-widest rounded-xl px-4 h-9 shadow-md shadow-[#820AD1]/20 active:scale-95 transition-all"
                               >
                                 Pagar Fatura
                               </Button>
                             )}
                           </td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>
             </Card>

             {/* Upgrade de Planos */}
             <Card className="border-none shadow-xl rounded-[40px] bg-slate-900 text-white p-12 space-y-10">
               <div className="text-center space-y-2 max-w-2xl mx-auto">
                 <Badge className="bg-[#820AD1] text-white border-none font-black px-4 py-1.5 rounded-full text-[9px] uppercase tracking-widest">Nossos Planos</Badge>
                 <h2 className="text-3xl font-black uppercase tracking-tight">Eleve seus resultados com mais performance</h2>
                 <p className="text-sm text-slate-400 font-medium">Faça upgrade a qualquer momento. Mudanças são aplicadas instantaneamente.</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {plans.map((p: any) => {
                   const isCurrent = billingData?.plan?.id === p.id;
                   return (
                     <Card 
                       key={p.id} 
                       className={`border-none shadow-2xl rounded-[35px] overflow-hidden flex flex-col p-8 ${
                         isCurrent 
                           ? 'bg-slate-850 ring-4 ring-[#820AD1] text-white' 
                           : 'bg-white text-slate-900'
                       }`}
                     >
                       <div className="space-y-4 flex-1">
                         <div className="flex justify-between items-start">
                           <h4 className="text-xl font-black uppercase tracking-tight">{p.name}</h4>
                           {isCurrent && (
                             <Badge className="bg-[#820AD1] text-white border-none font-black text-[9px] uppercase px-3 py-1 rounded-full">Atual</Badge>
                           )}
                         </div>

                         <div className="py-2">
                           <span className="text-3xl font-black">R$ {p.priceMonthly.toFixed(2)}</span>
                           <span className={`text-xs font-bold ${isCurrent ? 'text-slate-400' : 'text-slate-500'}`}>/mês</span>
                         </div>

                         <Separator className={isCurrent ? 'bg-slate-700' : 'bg-slate-100'} />

                         {/* Recursos list */}
                         <ul className="space-y-3 pt-4 text-xs font-bold">
                           <li className="flex items-center gap-2">
                             <Check className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-indigo-400' : 'text-indigo-600'}`} />
                             <span>Até {p.maxSdrs} SDRs Ativos</span>
                           </li>
                           <li className="flex items-center gap-2">
                             <Check className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-indigo-400' : 'text-indigo-600'}`} />
                             <span>{p.maxTokens.toLocaleString("pt-BR")} Tokens IA/mês</span>
                           </li>
                           <li className="flex items-center gap-2">
                             <Check className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-indigo-400' : 'text-indigo-600'}`} />
                             <span>{p.maxProspects} Varreduras BDR/mês</span>
                           </li>
                           <li className="flex items-center gap-2">
                             <Check className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-indigo-400' : 'text-indigo-600'}`} />
                             <span>{p.maxResearch} Deep Research/mês</span>
                           </li>
                           <li className="flex items-center gap-2">
                             <Check className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-indigo-400' : 'text-indigo-600'}`} />
                             <span>{p.maxMessages} Mensagens/mês</span>
                           </li>
                         </ul>
                       </div>

                       <div className="pt-8">
                         {isCurrent ? (
                           <Button 
                             disabled 
                             className="w-full h-14 rounded-2xl bg-slate-700 text-slate-400 font-black uppercase text-[10px] tracking-widest cursor-not-allowed"
                           >
                             Plano Ativo
                           </Button>
                         ) : (
                           <Button 
                             onClick={() => handleUpgradePlan(p.id, p.name)}
                             disabled={isUpgrading}
                             className={`w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
                               isCurrent 
                                 ? 'bg-slate-700 text-white' 
                                 : 'bg-[#820AD1] hover:bg-[#6c08b0] text-white shadow-xl shadow-[#820AD1]/20 hover:scale-105 active:scale-95'
                             }`}
                           >
                             Contratar Plano
                           </Button>
                         )}
                       </div>
                     </Card>
                   );
                 })}
               </div>
             </Card>
           </TabsContent>
         </Tabs>
      </div>

      <Dialog open={isNewUserModalOpen} onOpenChange={setIsNewUserModalOpen}>
         <DialogContent className="rounded-[40px] p-10 max-w-md border-none shadow-3xl">
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-6">Novo <span className="text-[#820AD1]">Colaborador</span></h2>
            <div className="space-y-4">
               <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Nome Completo</Label>
                  <Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" placeholder="Ex: João Silva" />
               </div>
               <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">E-mail de Acesso</Label>
                  <Input value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" placeholder="joao@empresa.com" />
               </div>
               <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Senha Temporária</Label>
                  <Input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" placeholder="******" />
               </div>
               <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Nível de Permissão</Label>
                  <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v})}>
                     <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-2xl border-none shadow-2xl">
                        <SelectItem value="AGENT">Colaborador (Agente)</SelectItem>
                        <SelectItem value="ADMIN">Administrador (Total)</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <Button 
                  className="w-full h-16 bg-[#820AD1] hover:bg-[#6c08b0] text-white font-black rounded-2xl uppercase tracking-widest mt-4 shadow-xl shadow-[#820AD1]/20"
                  onClick={async () => {
                     const token = localStorage.getItem("token");
                     const res = await fetch("/api/users", {
                        method: "POST",
                        headers: { 
                           "Content-Type": "application/json",
                           "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify(newUser)
                     });
                     if (res.ok) {
                        toast({ title: "✅ Colaborador cadastrado!" });
                        setIsNewUserModalOpen(false);
                        setNewUser({ name: "", email: "", password: "", role: "AGENT" });
                        fetchData();
                     }
                  }}
               >
                  Finalizar Cadastro
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
