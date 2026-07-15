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
import {
  Plus, Smartphone, CheckCircle2, RefreshCw, Trash2, Code2,
  Globe, Instagram, Copy, ExternalLink, ShieldCheck,
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
  const [igForm, setIgForm] = useState({ name: "", igId: "", pageId: "", accessToken: "" });
  const [igLoading, setIgLoading] = useState(false);

  const fetchInstagram = async () => {
    try {
      const res = await fetch("/api/whatsapp/accounts?channel=INSTAGRAM", { headers: authHeaders() });
      const data = await res.json();
      setIgAccounts(Array.isArray(data) ? data : []);
    } catch {
      /* silent */
    }
  };

  const connectInstagram = async () => {
    if (!igForm.name || !igForm.igId || !igForm.pageId || !igForm.accessToken) {
      return toast({ title: "Preencha todos os campos", variant: "destructive" });
    }
    setIgLoading(true);
    try {
      const res = await fetch("/api/channels/instagram", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(igForm),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Instagram conectado", description: "O agente já responde DMs desta conta." });
        setIgForm({ name: "", igId: "", pageId: "", accessToken: "" });
        fetchInstagram();
      } else {
        toast({ title: "Erro ao conectar", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
    setIgLoading(false);
  };

  const disconnectInstagram = async (id: string) => {
    if (!confirm("Desconectar esta conta do Instagram?")) return;
    const res = await fetch(`/api/whatsapp/accounts/${id}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) { toast({ title: "Conta desconectada" }); fetchInstagram(); }
  };

  useEffect(() => {
    fetchConnections();
    fetchInstagram();
    setTenantId(localStorage.getItem("tenantId") || "");
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

  const handleOpenQr = (id: string) => {
    setShowQrModal(true);
    setQrCode(null);
    setQrStatus("Solicitando QR…");
    const eventSource = new EventSource(`/api/whatsapp/qr/${id}`);
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
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Pronto pra atender
                        </span>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleOpenQr(conn.id)}>
                          Reconectar
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
            {/* Contas conectadas */}
            {igAccounts.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {igAccounts.map((acc) => (
                  <Card key={acc.id} className="rounded-2xl border-border p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-pink-100 text-pink-600 grid place-items-center">
                        <Instagram className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">Instagram Direct</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 border-none">Conectado</Badge>
                      <button onClick={() => disconnectInstagram(acc.id)} className="p-2 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Conectar nova conta */}
            <Card className="rounded-2xl border-border p-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-pink-100 text-pink-600 grid place-items-center shrink-0">
                  <Instagram className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-foreground">Conectar Instagram Direct</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    O mesmo agente responde DMs no Instagram, com o contexto do seu negócio.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-muted p-4 space-y-2 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground uppercase tracking-wide">Pré-requisitos</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Conta <b>comercial/criador</b> no Instagram (não pessoal), vinculada a uma Página do Facebook.</li>
                  <li>No <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="text-primary underline">Graph API Explorer</a>, gere um <b>Page Access Token</b> com as permissões <code>instagram_manage_messages</code> e <code>pages_messaging</code>.</li>
                  <li>Configure o webhook do seu app Meta apontando para a URL abaixo, no campo <code>messages</code> do produto Instagram.</li>
                </ol>
                <div className="rounded-lg bg-slate-950 text-slate-100 p-2 font-mono break-all mt-2">
                  {origin}/api/webhook/meta
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nome (identifica no painel)</Label>
                  <Input value={igForm.name} onChange={(e) => setIgForm({ ...igForm, name: e.target.value })} placeholder="Ex.: @clinicasorrisovivo" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Instagram Business Account ID</Label>
                  <Input value={igForm.igId} onChange={(e) => setIgForm({ ...igForm, igId: e.target.value })} placeholder="1784xxxxxxxxxxx" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Facebook Page ID</Label>
                  <Input value={igForm.pageId} onChange={(e) => setIgForm({ ...igForm, pageId: e.target.value })} placeholder="1029xxxxxxxxxxx" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Page Access Token</Label>
                  <Input type="password" value={igForm.accessToken} onChange={(e) => setIgForm({ ...igForm, accessToken: e.target.value })} placeholder="EAAG…" />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4" /> Integração oficial via Meta — sem risco de bloqueio.
                </div>
                <Button onClick={connectInstagram} disabled={igLoading} className="gap-2">
                  {igLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
                  Conectar Instagram
                </Button>
              </div>
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
