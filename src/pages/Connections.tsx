import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { QRCodeCanvas } from "qrcode.react";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Smartphone, CheckCircle2, RefreshCw, Trash2, Code2,
  Globe, Instagram, Copy, ExternalLink, ShieldCheck, CalendarClock,
  Eye, EyeOff, Wifi, Pencil, X,
} from "lucide-react";

interface Connection {
  id: string;
  name: string;
  phone: string;
  status: "CONNECTED" | "DISCONNECTED" | "CONNECTING";
  instance: string;
  lastActive: string;
}

function authHeaders() {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export default function Connections() {
  const { toast } = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [tenantId, setTenantId] = useState<string>("");

  // WhatsApp add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  // QR modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState("Aguardando…");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setTimeout(() => setCooldownSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldownSeconds]);

  const fetchConnections = async () => {
    try {
      const res = await fetch("/api/whatsapp/accounts", { headers: authHeaders() });
      const data = await res.json();
      setConnections(Array.isArray(data) ? data : []);
    } catch {
      /* silent */
    }
  };

  // Instagram
  const [igAccounts, setIgAccounts] = useState<any[]>([]);
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});
  const [igTestingId, setIgTestingId] = useState<string | null>(null);

  // Edição de uma conexão existente
  const [editingIgId, setEditingIgId] = useState<string | null>(null);
  const [igForm, setIgForm] = useState({ name: "", igId: "", accessToken: "" });
  const [igLoading, setIgLoading] = useState(false);

  const startEditIg = (acc: any) => {
    setEditingIgId(acc.id);
    setIgForm({ name: acc.name || "", igId: acc.igId || "", accessToken: "" });
    setTimeout(() => document.getElementById("ig-edit-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const cancelEditIg = () => {
    setEditingIgId(null);
    setIgForm({ name: "", igId: "", accessToken: "" });
  };

  const saveEditIg = async () => {
    if (!editingIgId) return;
    setIgLoading(true);
    try {
      const res = await fetch(`/api/channels/instagram/${editingIgId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(igForm), // token vazio = mantém o atual
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Conexão atualizada", description: "Use 'Testar conexão' para validar." });
        cancelEditIg();
        fetchInstagram();
      } else {
        toast({ title: "Erro ao salvar", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
    setIgLoading(false);
  };

  const toggleIgEnabled = async (acc: any) => {
    try {
      const res = await fetch(`/api/channels/instagram/${acc.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ enabled: !acc.enabled }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: acc.enabled ? "Conexão desabilitada" : "Conexão habilitada", description: acc.enabled ? "O agente vai ignorar DMs desta conta." : "O agente volta a responder DMs desta conta." });
        fetchInstagram();
      } else {
        toast({ title: "Erro", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
  };

  const [igOauthLoading, setIgOauthLoading] = useState(false);
  const connectWithMeta = async () => {
    setIgOauthLoading(true);
    try {
      const res = await fetch("/api/channels/instagram/oauth-url", { headers: authHeaders() });
      const d = await res.json();
      if (res.ok && d.url) {
        window.location.href = d.url; // vai para o diálogo de autorização da Meta
      } else {
        toast({ title: "Login com a Meta indisponível", description: d.error, variant: "destructive" });
        setIgOauthLoading(false);
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setIgOauthLoading(false);
    }
  };

  const testIgConnection = async (id: string) => {
    setIgTestingId(id);
    try {
      const res = await fetch(`/api/channels/instagram/${id}/test`, {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        toast({ title: "Conexão OK ✅", description: d.message });
      } else {
        toast({ title: "Falha na conexão", description: `${d.error || ""}${d.hint ? ` — ${d.hint}` : ""}`, variant: "destructive" });
      }
      fetchInstagram();
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
    setIgTestingId(null);
  };

  // Google Calendar
  const [gcal, setGcal] = useState<{ configured: boolean; connected: boolean }>({ configured: false, connected: false });
  const [gcalLoading, setGcalLoading] = useState(false);

  const fetchGcal = async () => {
    try {
      const res = await fetch("/api/google/status", { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setGcal({ configured: !!data.configured, connected: !!data.connected });
    } catch {
      /* silent */
    }
  };

  const connectGoogle = async () => {
    setGcalLoading(true);
    try {
      const res = await fetch("/api/google/auth-url", { headers: authHeaders() });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url; // redireciona para o consentimento do Google
      } else {
        toast({ title: "Não foi possível iniciar", description: data.error, variant: "destructive" });
        setGcalLoading(false);
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setGcalLoading(false);
    }
  };

  const disconnectGoogle = async () => {
    setGcalLoading(true);
    try {
      const res = await fetch("/api/google/disconnect", { method: "POST", headers: authHeaders() });
      if (res.ok) {
        toast({ title: "Google Calendar desconectado" });
        setGcal((g) => ({ ...g, connected: false }));
      }
    } finally {
      setGcalLoading(false);
    }
  };

  const fetchInstagram = async () => {
    try {
      const res = await fetch("/api/whatsapp/accounts?channel=INSTAGRAM", { headers: authHeaders() });
      const data = await res.json();
      setIgAccounts(Array.isArray(data) ? data : []);
    } catch {
      /* silent */
    }
  };

  const disconnectInstagram = async (id: string) => {
    if (!confirm("Desconectar esta conta do Instagram?")) return;
    const res = await fetch(`/api/whatsapp/accounts/${id}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) { toast({ title: "Conta desconectada" }); fetchInstagram(); }
  };

  useEffect(() => {
    fetchConnections();
    fetchInstagram();
    fetchGcal();
    setTenantId(localStorage.getItem("tenantId") || "");

    // Retorno do OAuth do Google (?google=connected|denied|expired|error|notoken)
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (g) {
      const map: Record<string, { title: string; variant?: "destructive" }> = {
        connected: { title: "Google Calendar conectado com sucesso" },
        denied: { title: "Você cancelou a autorização no Google", variant: "destructive" },
        expired: { title: "A sessão de conexão expirou, tente de novo", variant: "destructive" },
        notoken: { title: "Google não retornou o token — remova o acesso em myaccount.google.com e reconecte", variant: "destructive" },
        error: { title: "Falha ao conectar com o Google", variant: "destructive" },
      };
      const m = map[g] || map.error;
      toast({ title: m.title, variant: m.variant });
      window.history.replaceState({}, "", "/connections");
      fetchGcal();
    }

    // Retorno do OAuth da Meta (?instagram=connected|nopage|denied|expired|error)
    const ig = params.get("instagram");
    if (ig) {
      const igMap: Record<string, { title: string; description?: string; variant?: "destructive" }> = {
        connected: { title: "Instagram conectado 🎉", description: "O agente já pode responder DMs desta conta." },
        nopage: { title: "Nenhum Instagram profissional encontrado", description: "Vincule sua conta Instagram (Comercial/Criador) a uma Página do Facebook e tente de novo.", variant: "destructive" },
        denied: { title: "Você cancelou a autorização na Meta", variant: "destructive" },
        expired: { title: "A sessão de conexão expirou, tente de novo", variant: "destructive" },
        error: { title: "Falha ao conectar com a Meta", description: "Tente novamente; se persistir, use a conexão manual.", variant: "destructive" },
      };
      const im = igMap[ig] || igMap.error;
      const reason = params.get("reason");
      toast({ title: im.title, description: reason ? `Meta: ${reason}` : im.description, variant: im.variant });
      window.history.replaceState({}, "", "/connections");
      fetchInstagram();
    }
  }, []);

  const handleAddConnection = async () => {
    if (!newName) return;
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/accounts", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShowAddModal(false);
      setNewName("");
      setTimeout(() => handleOpenQr(data.id), 500);
      fetchConnections();
    } catch {
      toast({ title: "Erro ao criar conexão", variant: "destructive" });
    }
    setLoading(false);
  };

  // Reconecta/atualiza: primeiro limpa cooldown + sessão presa no backend
  // (senão o QR volta em COOLDOWN e nunca reconecta), depois abre o QR.
  const handleReconnect = async (id: string) => {
    try {
      await fetch(`/api/whatsapp/accounts/${id}/reconnect`, { method: "POST", headers: authHeaders() });
    } catch { /* segue mesmo se falhar */ }
    handleOpenQr(id);
  };

  const handleOpenQr = (id: string) => {
    setShowQrModal(true);
    setQrCode(null);
    setQrStatus("Solicitando QR…");
    // EventSource não envia headers → token vai na query (o authMiddleware aceita).
    const token = localStorage.getItem("token");
    const eventSource = new EventSource(`/api/whatsapp/qr/${id}?token=${encodeURIComponent(token || "")}`);
    eventSource.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.qr) {
          setQrCode(data.qr);
          setQrStatus("Escaneie com seu WhatsApp");
        }
        if (data.status === "CONNECTED") {
          setQrStatus("Conectado com sucesso ✅");
          fetchConnections();
          setTimeout(() => setShowQrModal(false), 1500);
          eventSource.close();
        }
        if (data.status === "COOLDOWN") {
          setCooldownSeconds(data.seconds || 60);
          setQrStatus(`Aguarde ${Math.ceil((data.seconds || 60) / 60)} min`);
          eventSource.close();
        }
      } catch {
        /* silent */
      }
    };
    eventSource.onerror = () => {
      setQrStatus("Erro de conexão com o servidor.");
      eventSource.close();
    };
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm("Remover esta conexão?")) return;
    try {
      const res = await fetch(`/api/whatsapp/accounts/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        toast({ title: "Conexão removida" });
        fetchConnections();
      }
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  // Widget snippet — o cliente cola isso no site dele.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const snippet = `<script src="${origin}/widget.js" data-tenant="${tenantId}" defer></script>`;
  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast({ title: "Código copiado", description: "Cole antes do </body> no seu site." });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
        <PageHeader
          icon={<Smartphone className="w-5 h-5" />}
          title="Canais de atendimento"
          subtitle="Conecte os canais onde o seu agente vai atender clientes."
        />

        <Tabs defaultValue="whatsapp" className="space-y-6">
          <TabsList className="bg-muted p-1 rounded-xl inline-flex h-11 w-full md:w-auto overflow-x-auto scrollbar-thin">
            <TabsTrigger value="whatsapp" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Smartphone className="w-4 h-4 mr-2" /> WhatsApp
            </TabsTrigger>
            <TabsTrigger value="widget" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Globe className="w-4 h-4 mr-2" /> Widget para site
            </TabsTrigger>
            <TabsTrigger value="instagram" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Instagram className="w-4 h-4 mr-2" /> Instagram
              {igAccounts.length > 0 && (
                <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-none text-[10px] px-1.5 py-0">{igAccounts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="agenda" className="rounded-lg h-full px-4 text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <CalendarClock className="w-4 h-4 mr-2" /> Agenda
              {gcal.connected && (
                <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-none text-[10px] px-1.5 py-0">on</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* WHATSAPP ─────────────────────────────────────────── */}
          <TabsContent value="whatsapp" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {connections.length} conta{connections.length === 1 ? "" : "s"} conectada{connections.length === 1 ? "" : "s"}
              </h2>
              <Button onClick={() => setShowAddModal(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Nova conexão
              </Button>
            </div>

            {connections.length === 0 ? (
              <Card className="rounded-2xl border-border">
                <EmptyState
                  icon={<Smartphone className="w-6 h-6" />}
                  title="Nenhuma conta conectada"
                  description="Conecte um número para o agente começar a atender pelo WhatsApp."
                  action={{ label: "Conectar WhatsApp", onClick: () => setShowAddModal(true) }}
                />
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {connections.map((conn) => (
                  <Card key={conn.id} className="rounded-2xl border-border p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl grid place-items-center ${conn.status === "CONNECTED" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{conn.name}</p>
                          <p className="text-xs text-muted-foreground">{conn.phone || "sem número"}</p>
                        </div>
                      </div>
                      <Badge className={conn.status === "CONNECTED" ? "bg-emerald-100 text-emerald-700 border-none" : "bg-rose-100 text-rose-700 border-none"}>
                        {conn.status === "CONNECTED" ? "Conectado" : "Desconectado"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      {conn.status === "CONNECTED" ? (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Pronto pra atender
                          </span>
                          <button
                            onClick={() => handleReconnect(conn.id)}
                            title="Atualizar / reconectar"
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                          </button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleReconnect(conn.id)} className="gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5" /> Reconectar
                        </Button>
                      )}
                      <button
                        onClick={() => handleDeleteConnection(conn.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* WIDGET WEB ────────────────────────────────────────── */}
          <TabsContent value="widget" className="space-y-6">
            <Card className="rounded-2xl border-border p-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-foreground">Widget para o seu site</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adiciona um botão flutuante no seu site que abre o chat com o agente. Funciona em qualquer site — WordPress, Wix, HTML puro, etc.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-950 text-slate-100 p-4 font-mono text-xs overflow-x-auto">
                <code>{snippet}</code>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={copySnippet} className="gap-2">
                  <Copy className="w-4 h-4" /> Copiar código
                </Button>
                <a href={`/chat/${tenantId}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="w-4 h-4" /> Visualizar chat
                  </Button>
                </a>
              </div>

              <div className="rounded-xl bg-muted p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5" /> Como instalar
                </p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Copie o código acima.</li>
                  <li>No seu site, cole logo antes da tag <code className="text-foreground">&lt;/body&gt;</code>.</li>
                  <li>Salve e recarregue a página — o botão aparece no canto inferior direito.</li>
                  <li>Todo visitante que abrir o chat cai como conversa nova no seu inbox.</li>
                </ol>
              </div>
            </Card>
          </TabsContent>

          {/* INSTAGRAM ─────────────────────────────────────────── */}
          <TabsContent value="instagram" className="space-y-6">
            {/* Conexão rápida (OAuth Meta) */}
            <Card className="rounded-2xl border-border p-6 bg-gradient-to-br from-pink-50 via-white to-purple-50">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 text-white grid place-items-center shrink-0 shadow-lg shadow-pink-500/30">
                  <Instagram className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <h2 className="text-base font-semibold text-foreground">Conectar Instagram em 1 clique</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Você autoriza na janela da Meta e pronto: detectamos sua Página, seu Instagram e configuramos tudo automaticamente.
                  </p>
                </div>
                <Button onClick={connectWithMeta} disabled={igOauthLoading} size="lg" className="gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white border-0">
                  {igOauthLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
                  Conectar com a Meta
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Requisitos: conta Instagram profissional vinculada a uma Página do Facebook. Você pode revogar o acesso quando quiser.
              </p>
            </Card>

            {/* Contas conectadas */}
            {igAccounts.length > 0 && (
              <div className="space-y-4">
                {igAccounts.map((acc) => (
                  <Card key={acc.id} className={`rounded-2xl border-border p-5 space-y-4 ${acc.enabled === false ? "opacity-75" : ""}`}>
                    {/* Cabeçalho: identidade + status + toggle */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-pink-100 text-pink-600 grid place-items-center shrink-0">
                          <Instagram className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{acc.name}</p>
                          <p className="text-xs text-muted-foreground">Instagram Direct</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {acc.enabled === false ? (
                          <Badge className="bg-slate-200 text-slate-600 border-none">Desabilitado</Badge>
                        ) : acc.status === "CONNECTED" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-none">Conectado</Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-700 border-none">Falha na conexão</Badge>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Switch checked={acc.enabled !== false} onCheckedChange={() => toggleIgEnabled(acc)} />
                          <span className="text-xs text-muted-foreground">{acc.enabled !== false ? "Ativo" : "Inativo"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Dados da conexão */}
                    <div className="grid sm:grid-cols-3 gap-3 text-xs">
                      <div className="rounded-xl bg-muted p-3">
                        <p className="text-muted-foreground mb-1">Instagram Account ID</p>
                        <p className="font-mono text-foreground break-all">{acc.igId || "—"}</p>
                      </div>
                      <div className="rounded-xl bg-muted p-3">
                        <p className="text-muted-foreground mb-1">Facebook Page ID</p>
                        <p className="font-mono text-foreground break-all">{acc.pageId || "—"}</p>
                      </div>
                      <div className="rounded-xl bg-muted p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-muted-foreground">Page Access Token</p>
                          <button
                            type="button"
                            onClick={() => setShowToken((s) => ({ ...s, [acc.id]: !s[acc.id] }))}
                            className="text-muted-foreground hover:text-foreground"
                            title={showToken[acc.id] ? "Ocultar token" : "Mostrar token"}
                          >
                            {showToken[acc.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <p className="font-mono text-foreground break-all">
                          {acc.accessToken
                            ? (showToken[acc.id] ? acc.accessToken : `${acc.accessToken.slice(0, 6)}••••••••${acc.accessToken.slice(-4)}`)
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => testIgConnection(acc.id)} disabled={igTestingId === acc.id}>
                        {igTestingId === acc.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                        Testar conexão
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => startEditIg(acc)}>
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => disconnectInstagram(acc.id)}>
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Requisitos e passo a passo (o que precisa estar pronto na Meta) */}
            <Card className="rounded-2xl border-border p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-600 grid place-items-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-foreground">Requisitos para conectar o Instagram</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Antes de clicar em "Conectar com a Meta", garanta que estes itens estão prontos. É uma configuração única.
                  </p>
                </div>
              </div>

              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="flex-none w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">1</span>
                  <div>
                    <p className="font-medium text-foreground">Conta Instagram profissional</p>
                    <p className="text-xs text-muted-foreground mt-0.5">No app do Instagram, use uma conta <b>Comercial</b> ou <b>Criador de conteúdo</b> (não pode ser conta pessoal): Configurações → Conta → Mudar para conta profissional.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-none w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">2</span>
                  <div>
                    <p className="font-medium text-foreground">Permitir acesso a mensagens</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Ainda no app do Instagram: Configurações → <b>Ferramentas e controles empresariais</b> → ative <b>"Permitir acesso a mensagens"</b>. Sem isso o agente não recebe as DMs.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-none w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">3</span>
                  <div>
                    <p className="font-medium text-foreground">Criar um app no Facebook Developers</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Acesse o <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">Facebook Developers <ExternalLink className="w-3 h-3" /></a>, crie um app e adicione o produto <b>Instagram</b> (API com login do Instagram). É nesse app que a conexão acontece.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-none w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">4</span>
                  <div>
                    <p className="font-medium text-foreground">Assinar o webhook de mensagens</p>
                    <p className="text-xs text-muted-foreground mt-0.5">No app → Instagram → Webhooks, assine o campo <code className="text-[11px] bg-muted px-1 rounded">messages</code> usando a URL abaixo.</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 rounded-lg bg-slate-950 text-slate-100 p-2 font-mono break-all text-xs">{origin}/api/webhook/meta</div>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(`${origin}/api/webhook/meta`); toast({ title: "URL copiada" }); }}
                        className="p-2 rounded-lg bg-muted hover:bg-primary/10 text-primary shrink-0"
                        title="Copiar URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              </ol>

              <div className="rounded-xl bg-muted p-3 flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Com os requisitos prontos, use o botão <b>"Conectar com a Meta"</b> acima — o resto é automático (detectamos a conta, o token e configuramos tudo).</span>
              </div>
            </Card>

            {/* Editar conexão — aparece ao clicar em "Editar" numa conta */}
            {editingIgId && (
              <Card id="ig-edit-form" className="rounded-2xl p-6 space-y-5 border-primary ring-2 ring-primary/20">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-xl bg-pink-100 text-pink-600 grid place-items-center shrink-0">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-foreground">Editar conexão do Instagram</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ajuste o nome ou cole um novo token de acesso. Deixe o token vazio para manter o atual.
                    </p>
                  </div>
                  <button onClick={cancelEditIg} className="p-2 rounded-lg text-muted-foreground hover:bg-muted" title="Cancelar">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome (identifica no painel)</Label>
                    <Input value={igForm.name} onChange={(e) => setIgForm({ ...igForm, name: e.target.value })} placeholder="Ex.: @sua_conta" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Novo token de acesso (opcional)</Label>
                    <Input type="password" value={igForm.accessToken} onChange={(e) => setIgForm({ ...igForm, accessToken: e.target.value })} placeholder="Deixe vazio para manter o atual" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={cancelEditIg} disabled={igLoading}>Cancelar</Button>
                  <Button onClick={saveEditIg} disabled={igLoading} className="gap-2">
                    {igLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                    Salvar alterações
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* AGENDA / GOOGLE CALENDAR ─────────────────────────── */}
          <TabsContent value="agenda" className="space-y-6">
            <Card className="rounded-2xl border-border p-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-blue-100 text-blue-600 grid place-items-center shrink-0">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-foreground">Google Calendar</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Conecte sua agenda para o agente consultar horários livres e marcar compromissos direto no seu calendário — sem conflito de horário.
                  </p>
                </div>
                {gcal.connected && <Badge className="bg-emerald-100 text-emerald-700 border-none">Conectado</Badge>}
              </div>

              {!gcal.configured ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                  A integração com o Google ainda não foi habilitada no servidor. É preciso configurar as credenciais OAuth
                  (<code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> e <code>GOOGLE_REDIRECT_URI</code>) no ambiente da plataforma.
                </div>
              ) : gcal.connected ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3 text-sm text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>Sua agenda está conectada. Novos agendamentos feitos pelo agente aparecem no seu Google Calendar, e horários já ocupados no calendário não são oferecidos aos clientes.</span>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={disconnectGoogle} disabled={gcalLoading} className="gap-2 text-rose-600 border-rose-200 hover:bg-rose-50">
                      {gcalLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Desconectar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl bg-muted p-4 space-y-2 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground uppercase tracking-wide">Como funciona</p>
                    <ol className="space-y-1 list-decimal list-inside">
                      <li>Clique em <b>Conectar Google Calendar</b> — você vai para a tela de permissão do Google.</li>
                      <li>Escolha a conta e autorize o acesso à agenda.</li>
                      <li>Você volta para cá já conectado. Pronto.</li>
                    </ol>
                  </div>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="w-4 h-4" /> Acesso apenas à agenda (eventos). Você pode desconectar quando quiser.
                    </div>
                    <Button onClick={connectGoogle} disabled={gcalLoading} className="gap-2">
                      {gcalLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                      Conectar Google Calendar
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* MODAL ADD WHATSAPP */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova conexão WhatsApp</DialogTitle>
            <DialogDescription>Escolha como conectar seu número.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="baileys" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted p-1 mb-4">
              <TabsTrigger value="baileys" className="rounded-lg text-xs">QR Code</TabsTrigger>
              <TabsTrigger value="meta" className="rounded-lg text-xs">Meta Oficial (Cloud API)</TabsTrigger>
            </TabsList>

            <TabsContent value="baileys" className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nome da conexão</Label>
                <Input
                  placeholder="Ex.: Recepção Vila Mariana"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <Button onClick={handleAddConnection} disabled={loading || !newName} className="w-full">
                {loading ? "Gerando…" : "Gerar QR Code"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Modo simples via QR Code. Bom pra testar; para produção séria, use a Meta Oficial.
              </p>
            </TabsContent>

            <TabsContent value="meta" className="space-y-3">
              <div className="grid gap-2">
                <Input id="meta-name" placeholder="Nome do canal" />
                <Input id="meta-phone" placeholder="Número (ex.: 5511999999999)" />
                <Input id="meta-phoneid" placeholder="Phone Number ID" />
                <Input id="meta-waba" placeholder="WABA ID" />
                <Input id="meta-verify" placeholder="Verify Token (senha que você escolhe)" />
                <Textarea id="meta-token" placeholder="Access Token permanente (Bearer)" rows={3} />
              </div>
              <div className="rounded-xl bg-slate-950 text-slate-100 p-3 font-mono text-xs">
                <p className="text-slate-400 mb-1">Webhook URL para colar no Meta:</p>
                <p className="break-all">{origin}/api/webhook/meta</p>
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
                      headers: authHeaders(),
                      body: JSON.stringify(payload),
                    });
                    toast({ title: "Conta Meta vinculada" });
                    setShowAddModal(false);
                    fetchConnections();
                  } catch {
                    toast({ title: "Erro ao vincular", variant: "destructive" });
                  }
                  setLoading(false);
                }}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Vinculando…" : "Vincular conta oficial"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* MODAL QR CODE */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="rounded-2xl text-center">
          <DialogHeader>
            <DialogTitle className="text-center">Conectar WhatsApp</DialogTitle>
            <DialogDescription className="text-center">Aponte a câmera do seu celular para o QR.</DialogDescription>
          </DialogHeader>

          <div className="p-6 bg-muted rounded-2xl grid place-items-center aspect-square">
            {qrCode ? (
              <QRCodeCanvas value={qrCode} size={220} level="H" includeMargin />
            ) : cooldownSeconds > 0 ? (
              <div className="flex flex-col items-center gap-2 text-amber-600">
                <span className="text-4xl font-bold tabular-nums">
                  {Math.floor(cooldownSeconds / 60)}:{String(cooldownSeconds % 60).padStart(2, "0")}
                </span>
                <span className="text-xs text-muted-foreground">Aguarde para tentar de novo</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span className="text-xs">{qrStatus}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{qrStatus}</p>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
