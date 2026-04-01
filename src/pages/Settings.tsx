import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Settings, User, Building, Smartphone, 
  Calendar, Key, ShieldCheck, Mail, 
  LogOut, Save, RefreshCw, ChevronRight,
  UserPlus, CheckCircle2, AlertCircle, Globe
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const [settings, setSettings] = useState({ name: "", openAiKey: "", systemPrompt: "" });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/settings").then(res => res.json()).then(data => {
      setSettings({
        name: data.name || "",
        openAiKey: data.openAiKey || "",
        systemPrompt: data.systemPrompt || ""
      });
    });
  }, []);

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast({ title: "Configurações Salvas", description: "As mudanças foram aplicadas em tempo real." });
      }
    } catch (e) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 p-6 lg:p-10 max-w-[1200px] mx-auto animate-in fade-in duration-700">
        
        {/* HEADER CONFIGURAÇÕES */}
        <div className="flex items-center justify-between">
           <div className="space-y-1">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                 Centro de <span className="text-emerald-500 italic">Controle</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Configurações Estratégicas e Integrações</p>
           </div>
           
           <div className="flex gap-4">
              <Button onClick={handleSaveSettings} disabled={loading} className="h-12 bg-slate-900 hover:bg-slate-800 px-8 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-xl">
                 {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2 text-emerald-500" />}
                 Salvar Tudo
              </Button>
           </div>
        </div>

        <Tabs defaultValue="perfil" className="space-y-8">
           <TabsList className="bg-slate-50 border border-slate-100 p-1.5 rounded-3xl h-16 w-full lg:w-fit shadow-sm">
              <TabsTrigger value="perfil" className="rounded-2xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-slate-900">
                 <User className="w-4 h-4 mr-2" /> Perfil
              </TabsTrigger>
              <TabsTrigger value="empresa" className="rounded-2xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-slate-900">
                 <Building className="w-4 h-4 mr-2" /> Negócio
              </TabsTrigger>
              <TabsTrigger value="integracoes" className="rounded-2xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-slate-900">
                 <Globe className="w-4 h-4 mr-2" /> Integrações
              </TabsTrigger>
           </TabsList>

           <TabsContent value="perfil" className="animate-in slide-in-from-left duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <Card className="border-none shadow-2xl rounded-[40px] bg-white p-10 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Informações Pessoais</h3>
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Nome Completo</Label>
                          <Input className="h-14 rounded-2xl border-2 border-slate-50 font-bold px-6" defaultValue="Roberto Santos" />
                       </div>
                       <div className="space-y-2">
                          <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">E-mail de Login</Label>
                          <Input className="h-14 rounded-2xl border-2 border-slate-50 font-bold px-6" defaultValue="ceo@autosales.ai" />
                       </div>
                    </div>
                 </Card>

                 <Card className="border-none shadow-2xl rounded-[40px] bg-slate-900 text-white p-10 flex flex-col justify-between">
                    <div className="space-y-4">
                       <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center">
                          <ShieldCheck className="w-8 h-8 text-emerald-500" />
                       </div>
                       <h3 className="text-2xl font-black tracking-tighter uppercase italic leading-none">Segurança e <br/>Acesso Master</h3>
                       <p className="text-white/30 text-xs font-bold uppercase tracking-widest">Sua conta possui acesso total de administrador.</p>
                    </div>
                    <Button variant="ghost" className="w-fit text-red-400 font-black uppercase text-[10px] tracking-widest mt-10 hover:bg-red-500/10 rounded-xl px-6 h-12">
                       <LogOut className="w-4 h-4 mr-2" /> Encerrar Sessão
                    </Button>
                 </Card>
              </div>
           </TabsContent>

           <TabsContent value="empresa" className="animate-in slide-in-from-bottom duration-500">
              <Card className="border-none shadow-2xl rounded-[40px] bg-white p-10">
                 <h3 className="text-xl font-black text-slate-800 tracking-tight mb-8">Dados Corporativos</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Razão Social</Label>
                          <Input className="h-14 rounded-2xl border-2 border-slate-50 font-bold px-6" defaultValue="VendAi Tecnologias Ltda" />
                       </div>
                       <div className="space-y-2">
                          <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">CNPJ</Label>
                          <Input className="h-14 rounded-2xl border-2 border-slate-50 font-bold px-6" defaultValue="12.345.678/0001-90" />
                       </div>
                    </div>
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Nicho de Atuação</Label>
                          <Input className="h-14 rounded-2xl border-2 border-slate-50 font-bold px-6" defaultValue="Indústria e Varejo" />
                       </div>
                       <div className="space-y-2">
                          <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400">Website</Label>
                          <Input className="h-14 rounded-2xl border-2 border-slate-50 font-bold px-6" defaultValue="https://vendai.com.br" />
                       </div>
                    </div>
                 </div>
              </Card>
           </TabsContent>

           <TabsContent value="integracoes" className="animate-in zoom-in-95 duration-500">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Google Calendar */}
                  <IntegrationCard 
                     title="Google Calendar" 
                     icon={<Calendar className="text-blue-500" />} 
                     status="Conectado" 
                     desc="Sincronize reuniões com seu SDR automaticamente."
                     buttonText="Vincular Conta Google"
                     onClick={() => window.location.href = "/api/google/auth"}
                  />
                  <IntegrationCard 
                     title="Meta WhatsApp" 
                     icon={<Smartphone className="text-emerald-500" />} 
                     status="Ativo" 
                     desc="API Oficial Cloud para disparo de mensagens em massa."
                     buttonText="Ver Webhooks"
                  />
                  <IntegrationCard 
                     title="OpenAI API" 
                     icon={<Key className="text-slate-400" />} 
                     status={settings.openAiKey ? "Configurada" : "Necessária"} 
                     desc="O motor de inteligência por trás dos seus robôs SDR."
                     buttonText="Trocar Chave"
                     onClick={() => {
                        const key = prompt("Insira sua OpenAI Key (sk-...):", settings.openAiKey);
                        if (key !== null) setSettings({...settings, openAiKey: key});
                     }}
                  />
               </div>
           </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function IntegrationCard({ title, icon, status, desc, buttonText, onClick }: any) {
  return (
    <Card className="border-none shadow-xl rounded-[40px] bg-white overflow-hidden p-8 flex flex-col justify-between hover:scale-[1.02] transition-all duration-500 border-b-8 border-transparent hover:border-emerald-500">
       <div className="space-y-6">
          <div className="flex items-center justify-between">
             <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-lg">{icon}</div>
             <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[9px] uppercase tracking-widest">{status}</Badge>
          </div>
          <div className="space-y-1">
             <h4 className="text-lg font-black text-slate-800 tracking-tight">{title}</h4>
             <p className="text-[11px] font-bold text-slate-400 leading-relaxed italic">{desc}</p>
          </div>
       </div>
       <Button onClick={onClick} variant="ghost" className="w-full h-12 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-2xl font-black uppercase text-[10px] tracking-widest mt-10 transition-all group">
         {buttonText} <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
       </Button>
    </Card>
  );
}
