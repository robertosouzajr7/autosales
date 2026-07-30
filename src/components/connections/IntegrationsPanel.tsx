import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Plug, KeyRound, Plus, Trash2, RefreshCw, Copy, Check, Loader2,
  AlertCircle, CheckCircle2, Code2, ArrowDownUp,
} from "lucide-react";

/**
 * Integrações da conta: chaves da API pública e conexões com CRM.
 *
 * Vive dentro de Conexões porque é a mesma pergunta ("por onde os contatos
 * entram e saem"), só que para sistemas em vez de canais de conversa.
 */

const auth = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

type Provider = { id: string; label: string; campos: string[]; ajuda: string; entrada: string };

export function IntegrationsPanel() {
  const { toast } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [chaves, setChaves] = useState<any[]>([]);
  const [provedores, setProvedores] = useState<Provider[]>([]);
  const [conexoes, setConexoes] = useState<any[]>([]);

  const [novaChaveNome, setNovaChaveNome] = useState("");
  const [chaveGerada, setChaveGerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const [crmAberto, setCrmAberto] = useState<Provider | null>(null);
  const [crmForm, setCrmForm] = useState<any>({ accessToken: "", direction: "BOTH", config: {} });
  const [salvandoCrm, setSalvandoCrm] = useState(false);
  const [sincronizando, setSincronizando] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [k, p, c] = await Promise.all([
        fetch("/api/integrations/api-keys", { headers: auth() }).then((r) => r.json()),
        fetch("/api/integrations/crm/providers", { headers: auth() }).then((r) => r.json()),
        fetch("/api/integrations/crm", { headers: auth() }).then((r) => r.json()),
      ]);
      setChaves(Array.isArray(k) ? k : []);
      setProvedores(Array.isArray(p) ? p : []);
      setConexoes(Array.isArray(c) ? c : []);
    } catch {
      toast({ title: "Não consegui carregar as integrações", variant: "destructive" });
    }
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, []);

  const copiar = (texto: string, marca: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(marca);
    setTimeout(() => setCopiado(null), 2000);
  };

  const criarChave = async () => {
    if (!novaChaveNome.trim()) return toast({ title: "Dê um nome para a chave", variant: "destructive" });
    const res = await fetch("/api/integrations/api-keys", {
      method: "POST", headers: auth(), body: JSON.stringify({ name: novaChaveNome }),
    });
    const data = await res.json();
    if (!res.ok) return toast({ title: "Erro ao criar", description: data.error, variant: "destructive" });
    setChaveGerada(data.key);
    setNovaChaveNome("");
    carregar();
  };

  const revogar = async (id: string, nome: string) => {
    if (!confirm(`Revogar "${nome}"?\n\nQualquer sistema usando esta chave para de funcionar na hora.`)) return;
    await fetch(`/api/integrations/api-keys/${id}`, { method: "DELETE", headers: auth() });
    carregar();
  };

  const abrirCrm = (p: Provider) => {
    const existente = conexoes.find((c) => c.provider === p.id);
    setCrmForm({
      accessToken: "",
      direction: existente?.direction || "BOTH",
      config: existente?.config || {},
    });
    setCrmAberto(p);
  };

  const salvarCrm = async () => {
    if (!crmAberto) return;
    setSalvandoCrm(true);
    const res = await fetch("/api/integrations/crm", {
      method: "POST", headers: auth(),
      body: JSON.stringify({
        provider: crmAberto.id,
        accessToken: crmForm.accessToken || undefined,
        direction: crmForm.direction,
        config: crmForm.config,
      }),
    });
    const data = await res.json();
    setSalvandoCrm(false);
    if (!res.ok) return toast({ title: "Não consegui conectar", description: data.error, variant: "destructive" });
    toast({ title: `${crmAberto.label} conectado!`, description: "A credencial foi testada antes de salvar." });
    setCrmAberto(null);
    carregar();
  };

  const sincronizar = async (conn: any) => {
    setSincronizando(conn.id);
    const res = await fetch(`/api/integrations/crm/${conn.id}/sync`, { method: "POST", headers: auth() });
    const data = await res.json();
    setSincronizando(null);
    if (!res.ok) return toast({ title: "Falha ao sincronizar", description: data.error, variant: "destructive" });
    toast({
      title: "Sincronizado",
      description: `${data.importados} contato(s) do CRM · ${data.criados} novo(s) · ${data.mesclados} duplicata(s) resolvida(s).`,
    });
    carregar();
  };

  const desconectar = async (conn: any) => {
    if (!confirm(`Desconectar ${conn.name || conn.provider}?`)) return;
    await fetch(`/api/integrations/crm/${conn.id}`, { method: "DELETE", headers: auth() });
    carregar();
  };

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const exemplo = `curl -X POST ${base}/api/v1/contacts \\
  -H "Authorization: Bearer SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Ana Souza","email":"ana@empresa.com","phone":"+55 71 98888-7777"}'`;

  if (carregando) {
    return <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* CRMs */}
      <Card className="rounded-2xl border-border">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Plug className="h-4 w-4" /></div>
            <div>
              <h3 className="text-base font-semibold text-foreground">CRM conectado</h3>
              <p className="text-sm text-muted-foreground">
                Contatos entram e saem do seu CRM automaticamente. Nada duplica: quem já existe é
                reconhecido pelo telefone, e-mail ou id do próprio CRM.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {provedores.map((p) => {
              const conn = conexoes.find((c) => c.provider === p.id);
              return (
                <div key={p.id} className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{p.label}</p>
                    {conn ? (
                      conn.lastStatus === "ERROR" ? (
                        <Badge className="border-none bg-rose-100 text-rose-700 text-xs gap-1">
                          <AlertCircle className="h-3 w-3" /> Com erro
                        </Badge>
                      ) : (
                        <Badge className="border-none bg-emerald-100 text-emerald-700 text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Conectado
                        </Badge>
                      )
                    ) : (
                      <Badge className="border-none bg-muted text-muted-foreground text-xs">Não conectado</Badge>
                    )}
                  </div>

                  {conn ? (
                    <>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                          <ArrowDownUp className="h-3 w-3" />
                          {conn.direction === "BOTH" ? "Entrada e saída" : conn.direction === "IN" ? "Só entrada" : "Só saída"}
                          {" · "}{conn.syncedCount} contato(s) sincronizado(s)
                        </p>
                        {conn.lastSyncAt && <p>Última sincronização: {new Date(conn.lastSyncAt).toLocaleString("pt-BR")}</p>}
                        {conn.lastError && <p className="text-rose-600">{conn.lastError}</p>}
                        {p.entrada === "WEBHOOK" && (
                          <div className="pt-1">
                            <p className="mb-1">Webhook para colar no {p.label}:</p>
                            <button
                              onClick={() => copiar(`${base}/api/webhooks/crm/${conn.id}`, conn.id)}
                              className="flex w-full items-center gap-2 rounded-lg bg-muted px-2 py-1.5 text-left font-mono text-[11px] hover:bg-muted/70"
                            >
                              <span className="flex-1 truncate">{base}/api/webhooks/crm/{conn.id}</span>
                              {copiado === conn.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => sincronizar(conn)} disabled={sincronizando === conn.id}>
                          {sincronizando === conn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Sincronizar
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => abrirCrm(p)}>Editar</Button>
                        <Button size="sm" variant="ghost" className="rounded-xl text-rose-600" onClick={() => desconectar(conn)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">{p.ajuda}</p>
                      <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => abrirCrm(p)}>
                        <Plus className="h-3.5 w-3.5" /> Conectar
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Chaves de API */}
      <Card className="rounded-2xl border-border">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound className="h-4 w-4" /></div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Chaves de API</h3>
              <p className="text-sm text-muted-foreground">
                Para o seu sistema cadastrar e atualizar contatos direto, sem passar por um CRM.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={novaChaveNome}
              onChange={(e) => setNovaChaveNome(e.target.value)}
              placeholder="Nome da chave (ex.: Site institucional)"
              className="rounded-xl"
            />
            <Button onClick={criarChave} className="gap-1.5 rounded-xl shrink-0">
              <Plus className="h-4 w-4" /> Gerar chave
            </Button>
          </div>

          {chaves.length === 0 ? (
            <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Nenhuma chave criada.</p>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {chaves.map((k) => (
                <div key={k.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{k.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {k.prefix}…{" · "}
                      {k.lastUsedAt ? `usada em ${new Date(k.lastUsedAt).toLocaleDateString("pt-BR")}` : "nunca usada"}
                    </p>
                  </div>
                  {k.revokedAt ? (
                    <Badge className="border-none bg-muted text-muted-foreground text-xs">Revogada</Badge>
                  ) : (
                    <Button size="icon" variant="ghost" className="text-rose-500" onClick={() => revogar(k.id, k.name)} title="Revogar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl bg-muted p-4 space-y-2">
            <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Code2 className="h-3.5 w-3.5" /> Cadastrar um contato
            </p>
            <pre className="overflow-x-auto rounded-lg bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
{exemplo}
            </pre>
            <p className="text-xs text-muted-foreground">
              Mandar o mesmo contato de novo atualiza em vez de duplicar. Use <code>POST /api/v1/contacts/batch</code>{" "}
              para até 200 de uma vez e <code>GET /api/v1/contacts?phone=…</code> para consultar.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chave recém-criada */}
      <Dialog open={!!chaveGerada} onOpenChange={() => setChaveGerada(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle>Guarde esta chave agora</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ela não será mostrada de novo. Se perder, gere outra e revogue esta.
          </p>
          <button
            onClick={() => copiar(chaveGerada || "", "nova")}
            className="flex items-center gap-2 rounded-xl bg-muted p-3 text-left font-mono text-xs hover:bg-muted/70"
          >
            <span className="flex-1 break-all">{chaveGerada}</span>
            {copiado === "nova" ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <Copy className="h-4 w-4 shrink-0" />}
          </button>
          <Button onClick={() => setChaveGerada(null)} className="rounded-xl">Guardei</Button>
        </DialogContent>
      </Dialog>

      {/* Conectar/editar CRM */}
      <Dialog open={!!crmAberto} onOpenChange={() => setCrmAberto(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle>Conectar {crmAberto?.label}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{crmAberto?.ajuda}</p>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Token de acesso</Label>
              <Input
                type="password"
                value={crmForm.accessToken}
                onChange={(e) => setCrmForm({ ...crmForm, accessToken: e.target.value })}
                placeholder={conexoes.find((c) => c.provider === crmAberto?.id) ? "Deixe em branco para manter o atual" : ""}
                className="rounded-xl"
              />
            </div>

            {crmAberto?.campos?.includes("instanceUrl") && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">URL da instância</Label>
                <Input
                  value={crmForm.config?.instanceUrl || ""}
                  onChange={(e) => setCrmForm({ ...crmForm, config: { ...crmForm.config, instanceUrl: e.target.value } })}
                  placeholder="https://sua-empresa.my.salesforce.com"
                  className="rounded-xl"
                />
              </div>
            )}
            {crmAberto?.campos?.includes("domain") && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Domínio da empresa</Label>
                <Input
                  value={crmForm.config?.domain || ""}
                  onChange={(e) => setCrmForm({ ...crmForm, config: { ...crmForm.config, domain: e.target.value } })}
                  placeholder="minhaempresa"
                  className="rounded-xl"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Direção da sincronização</Label>
              <Select value={crmForm.direction} onValueChange={(v) => setCrmForm({ ...crmForm, direction: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOTH">Entrada e saída</SelectItem>
                  <SelectItem value="IN">Só trazer do CRM</SelectItem>
                  <SelectItem value="OUT">Só enviar para o CRM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={salvarCrm} disabled={salvandoCrm} className="w-full gap-2 rounded-xl">
              {salvandoCrm && <Loader2 className="h-4 w-4 animate-spin" />}
              Testar e conectar
            </Button>
            <p className="text-xs text-muted-foreground">
              A credencial é testada antes de salvar — se o token estiver errado, nada é gravado.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default IntegrationsPanel;
