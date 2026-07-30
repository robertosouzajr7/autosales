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
  CreditCard, DollarSign, Wallet, AlertTriangle, Check, Lock, ShieldCheck, KeyRound, QrCode
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecurityPanel } from "@/components/settings/SecurityPanel";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Settings() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // SaaS Billing & Subscription States
  const [billingData, setBillingData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const [aiConfig, setAiConfig] = useState({
    googleRefreshToken: "",
    webChatUrl: "",
    systemPrompt: "Você é um agente de atendimento inbound. Qualifica e agenda no WhatsApp.",
    language: "pt-BR",
  });

  // Modelo de IA global (somente leitura) — a chave é gerida pelo admin do SaaS.
  const [aiModel, setAiModel] = useState<{ provider: string; model: string }>({ provider: "", model: "" });

  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const resSettings = await fetch("/api/settings", { headers });

      // Token expirado → redireciona para login
      if (resSettings.status === 401) {
        localStorage.clear();
        navigate("/login");
        return;
      }

      const dataSettings = await resSettings.json();

      setAiConfig({
        googleRefreshToken: dataSettings.googleRefreshToken || "",
        webChatUrl: dataSettings.webChatUrl || "",
        systemPrompt: dataSettings.systemPrompt || "Você é um agente de atendimento inbound. Qualifica e agenda no WhatsApp.",
        language: dataSettings.language || "pt-BR",
      });
      setAiModel({
        provider: dataSettings.aiProvider || "",
        model: dataSettings.aiModel || "",
      });

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
      // Inicia o checkout hospedado do gateway. O pagamento é finalizado na
      // página segura do provedor; a confirmação chega pelo webhook.
      const res = await fetch(`/api/billing/checkout/${invoiceId}`, {
        method: "POST",
        headers
      });
      const data = await res.json();
      if (res.ok && data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: "Erro ao iniciar pagamento", description: data.error || "Tente novamente", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro ao iniciar pagamento", variant: "destructive" });
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
        body: JSON.stringify({ ...aiConfig }),
      });
      if (res.ok) toast({ title: "Configurações salvas!", description: "Tudo atualizado!" });
    } catch (e) {
      toast({ title: "Falha ao salvar", variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#2563EB]" /></div>;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-12 max-w-[1200px] mx-auto animate-in fade-in duration-700">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div className="space-y-1">
                <h1 className="text-4xl font-semibold text-slate-900 tracking-tight uppercase mb-1 flex items-center gap-3">
                   Configurações <span className="text-[#2563EB]">SaaS</span>
                </h1>
                <p className="text-slate-400 font-bold text-xs">Ecossistema de SDR & Vendas Automáticas</p>
            </div>
            <Button onClick={handleSaveSettings} disabled={saving} className="h-11 px-10 bg-slate-900 text-white rounded-2xl font-semibold uppercase text-xs flex items-center gap-3 shadow-sm hover:scale-105 transition-all outline-none">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 text-[#2DD4BF]" />}
                Salvar Painel
            </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-8">
          <TabsList className="bg-muted p-1 rounded-xl inline-flex h-11 w-full md:w-auto overflow-x-auto scrollbar-thin">
            <TabsTrigger value="general" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Zap className="w-4 h-4 mr-2" /> Geral
            </TabsTrigger>
            <TabsTrigger value="account" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Lock className="w-4 h-4 mr-2" /> Segurança
            </TabsTrigger>
            <TabsTrigger value="integrations" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Database className="w-4 h-4 mr-2" /> Avançado
            </TabsTrigger>
          </TabsList>

          {/* ABA GERAL — link público de agendamento do agente */}
          <TabsContent value="general">
             <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white p-12 space-y-8">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-semibold text-slate-900 uppercase">Link de Agendamento</h3>
                    <Badge className="bg-[#2563EB] text-white border-none font-semibold text-xs px-4">Gerado Automaticamente</Badge>
                </div>
                <div className="space-y-6">
                   <div className="space-y-4">
                      <Label className="text-xs font-semibold text-slate-400 pl-2">Página pública de agendamento</Label>
                      <div className="flex gap-4">
                         <div className="flex-1 h-11 bg-slate-50 border-2 border-slate-100 rounded-2xl px-8 flex items-center font-bold text-slate-600 truncate border-dashed select-all">
                            {window.location.origin}/b/{localStorage.getItem("tenantId")}
                         </div>
                         <Button
                            onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/b/${localStorage.getItem("tenantId")}`);
                                toast({ title: "Link Copiado!", description: "O agente envia este link para agendar com os clientes." });
                            }}
                            className="h-11 px-10 bg-slate-900 text-white rounded-2xl font-semibold uppercase text-xs flex items-center gap-3 shadow-sm hover:scale-105 active:scale-95 transition-all outline-none"
                         >
                            <ExternalLink className="w-5 h-5 text-[#2DD4BF]" /> Copiar Link
                         </Button>
                      </div>
                      <p className="text-xs text-slate-400 pl-2">Link público onde o cliente escolhe um horário. O agente envia automaticamente durante a conversa.</p>
                   </div>

                   <Separator className="opacity-50" />

                   <div className="space-y-4">
                      <Label className="text-xs font-semibold text-slate-400 pl-2">Redirecionar para site personalizado (opcional)</Label>
                      <Input value={aiConfig.webChatUrl} onChange={(e) => setAiConfig({...aiConfig, webChatUrl: e.target.value})} placeholder="https://www.seusite.com.br" className="h-11 bg-slate-50 border-none rounded-2xl px-8 font-bold" />
                   </div>

                   <div className="rounded-2xl bg-blue-50 p-5 flex items-start gap-3 text-sm text-slate-600">
                      <Bot className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
                      <span>A personalidade, o tom e as instruções do agente são configurados na página <b>Agentes</b> — junto com as informações do seu negócio em <b>Meu Negócio</b>.</span>
                   </div>

                   <Separator className="opacity-50" />

                   {/* A gestão de acessos vive só em Colaboradores. Aqui fica
                       apenas o caminho, para quem procurava na aba antiga. */}
                   <div className="rounded-2xl border border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <Shield className="w-5 h-5 text-slate-400 shrink-0" />
                      <div className="flex-1">
                         <p className="text-sm font-semibold text-slate-700">Colaboradores e permissões</p>
                         <p className="text-sm text-slate-500">Cadastro, perfis de acesso, filas e ativação ficam em Colaboradores.</p>
                      </div>
                      <Button variant="outline" onClick={() => navigate("/equipe")} className="h-10 rounded-xl px-6 font-semibold text-xs uppercase shrink-0">
                         Abrir Colaboradores
                      </Button>
                   </div>
                </div>
             </Card>
          </TabsContent>

          {/* ABA AVANÇADO — motor de IA (gerido globalmente pelo SaaS) */}
          <TabsContent value="integrations">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <Card className="border-none shadow-sm rounded-2xl bg-white p-12 space-y-8">
                    <div className="flex items-center gap-4 text-[#2563EB] mb-4"><Bot className="w-8 h-8" /><h3 className="text-xl font-semibold text-slate-900 uppercase">Motor de Inteligência Artificial</h3></div>
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-400 pl-1">Modelo ativo</Label>
                          <div className="h-11 bg-slate-50 rounded-2xl px-8 flex items-center font-bold text-slate-700">
                             {aiModel.model
                               ? <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#2563EB]" /> {aiModel.model}</span>
                               : <span className="text-slate-400">Carregando…</span>}
                          </div>
                       </div>
                       {aiModel.provider && (
                         <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-400 pl-1">Provedor</Label>
                            <div className="h-11 bg-slate-50 rounded-2xl px-8 flex items-center font-bold text-slate-700 capitalize">
                               {aiModel.provider.toLowerCase()}
                            </div>
                         </div>
                       )}
                       <div className="rounded-2xl bg-blue-50 p-5 flex items-start gap-3 text-sm text-slate-600">
                          <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
                          <span>O modelo e a conexão de IA são gerenciados pela plataforma. Você não precisa configurar chaves — tudo já vem pronto para usar. O consumo é medido em tokens e mostrado na página <b>Assinatura</b>.</span>
                       </div>
                    </div>
                 </Card>
             </div>
          </TabsContent>

          {/* ABA SEGURANÇA — senha, 2FA, verificação de email */}
          <TabsContent value="account" className="space-y-6">
            <SecurityPanel />
          </TabsContent>

         </Tabs>
      </div>

    </DashboardLayout>
  );
}
