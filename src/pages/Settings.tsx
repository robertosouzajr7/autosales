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
  CreditCard, DollarSign, Wallet, AlertTriangle, Check, Lock, ShieldCheck, KeyRound, QrCode, Copy, Download
} from "lucide-react";
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
  const [cancelando, setCancelando] = useState(false);

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

  /**
   * Cancela a assinatura no fim do período já pago.
   *
   * É a única ação destrutiva que o painel oferece hoje — não existe
   * "encerrar conta" no servidor, e um botão que não apaga nada seria pior
   * que a ausência dele.
   */
  const cancelarAssinatura = async () => {
    if (!confirm(
      "Cancelar a assinatura?\n\nO acesso continua até o fim do período já pago. Depois disso o agente para de atender."
    )) return;
    setCancelando(true);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST", headers: { "Content-Type": "application/json" } });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível cancelar.");
      toast({
        title: "Assinatura cancelada",
        description: "O acesso segue até o fim do período já pago.",
      });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setCancelando(false); }
  };

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

  const linkAgenda = `${window.location.origin}/b/${localStorage.getItem("tenantId")}`;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[900px] px-4 pb-10 pt-5 sm:px-6">

        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Configurações</h1>
            <p className="mt-0.5 text-[13.5px] text-muted-foreground">
              Preferências da conta, segurança e privacidade.
            </p>
          </div>
          <Button onClick={handleSaveSettings} disabled={saving} className="h-10 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </header>

        <div className="space-y-4">
          {/* ── Atendimento ── */}
          <Secao titulo="Atendimento" descricao="O que o agente usa durante a conversa.">
            <Linha
              titulo="Link público de agendamento"
              descricao="O agente envia este link quando o cliente quer marcar um horário."
            >
              <div className="flex w-full gap-2">
                <code className="linha-unica-elipse flex h-10 flex-1 items-center rounded-lg border border-border-soft bg-surface-2 px-3 font-mono text-[12px] text-muted-foreground">
                  {linkAgenda}
                </code>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(linkAgenda);
                    toast({ title: "Link copiado" });
                  }}
                  className="h-10 shrink-0 gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
            </Linha>

            <Linha
              titulo="Site do negócio"
              descricao="Usado pelo agente quando alguém pede o site. Opcional."
            >
              <Input
                value={aiConfig.webChatUrl}
                onChange={(e) => setAiConfig({ ...aiConfig, webChatUrl: e.target.value })}
                placeholder="https://www.seusite.com.br"
                className="h-10"
              />
            </Linha>

            <Linha
              titulo="Personalidade e regras do agente"
              descricao="Tom de voz, função e o que ele pode fazer ficam na tela do agente."
            >
              <Button variant="outline" onClick={() => navigate("/sdrs")} className="h-10 w-full gap-1.5">
                <Bot className="h-4 w-4" /> Abrir Agente de IA
              </Button>
            </Linha>

            <Linha
              titulo="Colaboradores e permissões"
              descricao="Cadastro, perfis de acesso, filas e ativação."
            >
              <Button variant="outline" onClick={() => navigate("/equipe")} className="h-10 w-full gap-1.5">
                <Shield className="h-4 w-4" /> Abrir Colaboradores
              </Button>
            </Linha>
          </Secao>

          {/* ── Segurança ── */}
          <Secao titulo="Segurança" descricao="Como você entra na conta.">
            <div className="px-5 py-4">
              <SecurityPanel />
            </div>
          </Secao>

          {/* ── Privacidade e LGPD ── */}
          <Secao titulo="Privacidade e LGPD" descricao="O que a plataforma faz com os dados dos seus clientes.">
            <Linha
              titulo="Exportar os dados da conta"
              descricao="Baixa contatos, conversas e agendamentos em um arquivo. É o direito de portabilidade."
            >
              <Button
                variant="outline"
                onClick={() => window.open("/api/compliance/account/export", "_blank")}
                className="h-10 w-full gap-1.5"
              >
                <Download className="h-4 w-4" /> Exportar
              </Button>
            </Linha>

            {/* Não é um interruptor porque não é opcional: o opt-out vale
                sempre. Dizer isso é mais honesto do que oferecer um botão
                que não desliga nada. */}
            <Linha
              titulo="Pedido de descadastro"
              descricao="Quem pede para parar de receber é excluído de todo disparo, automaticamente e sem exceção."
            >
              <span className="flex h-10 items-center gap-1.5 text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" /> Sempre ativo
              </span>
            </Linha>

            <Linha
              titulo="Remover os dados de um cliente"
              descricao="A exclusão definitiva de um contato é feita na ficha dele, em Clientes."
            >
              <Button variant="outline" onClick={() => navigate("/contacts")} className="h-10 w-full">
                Abrir Clientes
              </Button>
            </Linha>
          </Secao>

          {/* ── Plataforma ── */}
          <Secao titulo="Plataforma" descricao="Gerenciado por nós — você não precisa configurar nada.">
            <Linha titulo="Modelo de IA" descricao="O motor que responde as conversas.">
              <span className="flex h-10 items-center gap-2 text-[13px] font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-accent-text" />
                {aiModel.model || "Carregando…"}
                {aiModel.provider && <span className="text-faint">· {aiModel.provider.toLowerCase()}</span>}
              </span>
            </Linha>
            <Linha titulo="Consumo e faturas" descricao="Tokens usados no ciclo, plano e histórico de cobrança.">
              <Button variant="outline" onClick={() => navigate("/assinatura")} className="h-10 w-full">
                Abrir Assinatura
              </Button>
            </Linha>
          </Secao>

          {/* ── Zona de risco ── */}
          <section
            className="rounded-[14px] border p-5"
            style={{ borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.05)" }}
          >
            <h2 className="text-[15px] font-semibold text-[#B91C1C]">Cancelar a assinatura</h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              O acesso continua até o fim do período já pago. Depois disso o agente para de atender e as
              conversas ficam só de leitura. Seus dados não são apagados — dá para reativar quando quiser.
            </p>
            <Button
              variant="outline"
              onClick={cancelarAssinatura}
              disabled={cancelando}
              className="mt-4 h-10 gap-2 border-[#B91C1C]/40 bg-transparent text-[#B91C1C] hover:bg-red-50"
            >
              {cancelando ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              {cancelando ? "Cancelando…" : "Cancelar assinatura"}
            </Button>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

/** Seção com cabeçalho e linhas de “título + descrição + controle”. */
function Secao({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
      <header className="border-b border-border px-5 py-3.5">
        <h2 className="text-[15px] font-semibold text-foreground">{titulo}</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{descricao}</p>
      </header>
      <div className="divide-y divide-border-soft">{children}</div>
    </section>
  );
}

function Linha({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-foreground">{titulo}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{descricao}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
