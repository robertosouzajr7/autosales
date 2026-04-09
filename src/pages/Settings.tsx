import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Settings as SettingsIcon, Shield, Bell, Database, Globe, Sliders, Save, CheckCircle2, 
  Trash2, Plus, Zap, Bot, Target, HelpCircle, Loader2, Sparkles, MapPin, Search, Linkedin,
  ExternalLink, Mail, Smartphone, Phone, Calendar, Share2, Terminal, Code2, Key
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

  const [aiConfig, setAiConfig] = useState({
    openaiKey: "",
    geminiKey: "",
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

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const tenantId = localStorage.getItem("tenantId");
    try {
      const [resSettings, resIcp, resUsers] = await Promise.all([
        fetch("/api/settings", { headers: { "x-tenant-id": tenantId || "" } }),
        fetch("/api/icp-profiles", { headers: { "x-tenant-id": tenantId || "" } }),
        fetch("/api/users", { headers: { "x-tenant-id": tenantId || "" } })
      ]);
      
      const dataSettings = await resSettings.json();
      const dataIcp = await resIcp.json();
      const dataUsers = await resUsers.json();
      
      setAiConfig({
        openaiKey: dataSettings.openAiKey || "",
        geminiKey: dataSettings.aiApiKey || "",
        apolloApiKey: dataSettings.apolloApiKey || "",
        snovClientId: dataSettings.snovClientId || "",
        snovClientSecret: dataSettings.snovClientSecret || "",
        googleRefreshToken: dataSettings.googleRefreshToken || "",
        webChatUrl: dataSettings.webChatUrl || "",
        systemPrompt: dataSettings.systemPrompt || aiConfig.systemPrompt,
        language: "pt-BR"
      });

      setIcpProfiles(dataIcp);
      setUsers(Array.isArray(dataUsers) ? dataUsers : []);

    } catch (e) {
      toast({ title: "Erro ao carregar configurações", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    const tenantId = localStorage.getItem("tenantId");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId || "" },
        body: JSON.stringify({
          ...aiConfig,
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
    const tenantId = localStorage.getItem("tenantId");
    try {
      const res = await fetch("/api/icp-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId || "" },
        body: JSON.stringify(newIcp)
      });
      const data = await res.json();
      setIcpProfiles([...icpProfiles, data]);
      setNewIcp({ name: "", niche: "", role: "", location: "Brasil", isAutoHunterEnabled: false, dailyLimit: 200 });
      toast({ title: "Perfil ICP Criado!" });
    } catch (e) {}
  };

  const handleDeleteIcp = async (id: string) => {
    try {
      await fetch(`/api/icp-profiles/${id}`, { method: "DELETE" });
      setIcpProfiles(icpProfiles.filter(p => p.id !== id));
      toast({ title: "Perfil Removido" });
    } catch (e) {}
  };

  const toggleAutoHunter = async (id: string, active: boolean) => {
      try {
          const profile = icpProfiles.find(p => p.id === id);
          if (!profile) return;
          const res = await fetch(`/api/icp-profiles/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...profile, isAutoHunterEnabled: active })
          });
          if (res.ok) {
              setIcpProfiles(icpProfiles.map(p => p.id === id ? { ...p, isAutoHunterEnabled: active } : p));
              toast({ title: active ? "Hunter Mode ATIVADO 🦁" : "Hunter Mode Desativado" });
          }
      } catch (e) {}
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-12 max-w-[1200px] mx-auto animate-in fade-in duration-700">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div className="space-y-1">
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-1 flex items-center gap-3">
                   Configurações <span className="text-emerald-500 italic">SaaS</span>
                </h1>
                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Ecossistema de SDR & Vendas Automáticas</p>
            </div>
            <Button onClick={handleSaveSettings} disabled={saving} className="h-16 px-10 bg-slate-900 text-white rounded-[22px] font-black uppercase text-[10px] tracking-widest flex items-center gap-3 shadow-2xl hover:scale-105 transition-all outline-none">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 text-emerald-400" />}
                Salvar Painel
            </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-10">
          <TabsList className="bg-slate-50 p-1.5 rounded-[22px] border border-slate-100 shadow-sm inline-flex h-16 w-full md:w-auto">
            <TabsTrigger value="general" className="rounded-[18px] h-full px-8 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <Zap className="w-4 h-4 mr-2 text-rose-500" /> Geral
            </TabsTrigger>
            <TabsTrigger value="hunter" className="rounded-[18px] h-full px-8 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <Target className="w-4 h-4 mr-2 text-blue-500" /> Hunter System
            </TabsTrigger>
            <TabsTrigger value="integrations" className="rounded-[18px] h-full px-8 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <Database className="w-4 h-4 mr-2 text-emerald-500" /> Integrações
            </TabsTrigger>
            <TabsTrigger value="connections" className="rounded-[18px] h-full px-8 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <Share2 className="w-4 h-4 mr-2 text-amber-500" /> Conexões & API
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-[18px] h-full px-8 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <Shield className="w-4 h-4 mr-2 text-purple-500" /> Equipe
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
                        <Badge className="bg-emerald-500 text-white border-none font-black text-[9px] uppercase tracking-widest px-4">Gerado Automaticamente</Badge>
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
                                <ExternalLink className="w-5 h-5 text-emerald-400" /> Copiar Link
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
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-1">Busca automática de leads baseada no ICP</p>
                   </div>
                   <Dialog>
                      <DialogTrigger asChild>
                         <Button className="bg-white text-slate-900 hover:bg-emerald-500 hover:text-white rounded-3xl h-14 px-8 font-black uppercase text-[10px] tracking-widest transition-all">
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
                           <Badge className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-[9px] uppercase font-black tracking-widest">{profile.location}</Badge>
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
                      <div className="space-y-2"><Label>Apollo.io API Key</Label><Input type="password" value={aiConfig.apolloApiKey} onChange={(e) => setAiConfig({...aiConfig, apolloApiKey: e.target.value})} className="h-16 bg-slate-50 rounded-3xl px-8" /></div>
                      <div className="space-y-2"><Label>Snov.io Client ID</Label><Input value={aiConfig.snovClientId} onChange={(e) => setAiConfig({...aiConfig, snovClientId: e.target.value})} className="h-14 bg-slate-50 rounded-2xl px-6" /></div>
                      <div className="space-y-2"><Label>Snov.io Client Secret</Label><Input type="password" value={aiConfig.snovClientSecret} onChange={(e) => setAiConfig({...aiConfig, snovClientSecret: e.target.value})} className="h-14 bg-slate-50 rounded-2xl px-6" /></div>
                   </div>
                </Card>
                <Card className="border-none shadow-xl rounded-[40px] bg-white p-12 space-y-8">
                   <div className="flex items-center gap-4 text-blue-500 mb-4"><Bot className="w-8 h-8" /><h3 className="text-xl font-black text-slate-900 uppercase">Modelos de IA (LLMs)</h3></div>
                   <div className="space-y-6">
                      <div className="space-y-2"><Label>Google Gemini API Key</Label><Input type="password" value={aiConfig.geminiKey} onChange={(e) => setAiConfig({...aiConfig, geminiKey: e.target.value})} className="h-16 bg-slate-50 rounded-3xl px-8" /></div>
                      <div className="space-y-2"><Label>OpenAI API Key (Opcional)</Label><Input type="password" value={aiConfig.openaiKey} onChange={(e) => setAiConfig({...aiConfig, openaiKey: e.target.value})} className="h-16 bg-slate-50 rounded-3xl px-8" /></div>
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
                         <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Google Refresh Token (Offline Access)</Label>
                         <Input value={aiConfig.googleRefreshToken} onChange={(e) => setAiConfig({...aiConfig, googleRefreshToken: e.target.value})} className="h-16 bg-slate-50 rounded-3xl px-8 font-bold" />
                      </div>
                      <Button className="w-full bg-slate-900 text-white h-14 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest">
                         <ExternalLink className="w-4 h-4" /> Autorizar Nova Conta Google
                      </Button>
                   </div>
                </Card>

                <Card className="border-none shadow-xl rounded-[40px] bg-white p-12 space-y-8 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-5"><Smartphone className="w-48 h-48" /></div>
                   <div className="flex items-center gap-4 text-blue-600 mb-4"><Smartphone className="w-8 h-8" /><h3 className="text-xl font-black text-slate-900 uppercase underline decoration-blue-600 decoration-4">WhatsApp Cloud API (Meta)</h3></div>
                   <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2"><Label>Phone Number ID</Label><Input value={metaConfig.phoneId} onChange={(e) => setMetaConfig({...metaConfig, phoneId: e.target.value})} className="h-14 bg-slate-50 rounded-2xl" /></div>
                         <div className="space-y-2"><Label>WABA Account ID</Label><Input value={metaConfig.wabaId} onChange={(e) => setMetaConfig({...metaConfig, wabaId: e.target.value})} className="h-14 bg-slate-50 rounded-2xl" /></div>
                      </div>
                      <div className="space-y-2">
                         <Label>Permanent Access Token</Label>
                         <Input type="password" value={metaConfig.accessToken} onChange={(e) => setMetaConfig({...metaConfig, accessToken: e.target.value})} className="h-14 bg-slate-50 rounded-2xl" />
                      </div>
                      <Separator />
                      <div className="p-6 bg-slate-900 rounded-3xl space-y-4">
                         <div className="flex items-center gap-2 text-emerald-400"><Code2 className="w-4 h-4" /><p className="text-[10px] font-black uppercase tracking-widest">Webhook URL Configuration</p></div>
                         <div className="space-y-2">
                             <p className="text-[11px] text-slate-400 font-bold">Callback URL:</p>
                             <div className="bg-black/50 p-3 rounded-xl text-emerald-500 font-mono text-[10px] break-all border border-emerald-500/20">https://{window.location.hostname}/api/webhooks/meta</div>
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
                                            await fetch(`/api/users/${user.id}`, { 
                                               method: "DELETE",
                                               headers: { "x-tenant-id": localStorage.getItem("tenantId") || "" }
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
        </Tabs>
      </div>

      <Dialog open={isNewUserModalOpen} onOpenChange={setIsNewUserModalOpen}>
         <DialogContent className="rounded-[40px] p-10 max-w-md border-none shadow-3xl">
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-6">Novo <span className="text-emerald-500">Colaborador</span></h2>
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
                  className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest mt-4 shadow-xl shadow-emerald-500/20"
                  onClick={async () => {
                     const res = await fetch("/api/users", {
                        method: "POST",
                        headers: { 
                           "Content-Type": "application/json",
                           "x-tenant-id": localStorage.getItem("tenantId") || ""
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
