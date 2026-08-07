import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Bot, Plus, Trash2, Save, Upload, FileText, Play, Lock, Check,
  Send, Sparkles, MessageSquare, Instagram, Globe, Volume2, Loader2, Wand2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssistenteDePrompt } from "@/components/agents/AssistenteDePrompt";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { enviarArquivo } from "@/lib/enviarArquivo";

/**
 * Agente de IA — três painéis: lista de agentes, edição e simulador.
 *
 * A edição é inline, não em modal: quem ajusta o tom de voz quer testar o
 * efeito na mesma tela, e um modal esconderia justamente o simulador.
 */

const TONS = [
  { id: "FRIENDLY", label: "Acolhedor" },
  { id: "DIRECT", label: "Direto" },
  { id: "PROFESSIONAL", label: "Formal" },
  { id: "CASUAL", label: "Descontraído" },
  { id: "TECHNICAL", label: "Técnico" },
];

const CANAL = {
  WHATSAPP: { label: "WhatsApp", Icon: MessageSquare, cls: "text-emerald-600" },
  INSTAGRAM: { label: "Instagram", Icon: Instagram, cls: "text-pink-600" },
  SITE: { label: "Site", Icon: Globe, cls: "text-blue-600" },
};
const canal = (c?: string) => CANAL[(c || "WHATSAPP").toUpperCase() as keyof typeof CANAL] || CANAL.WHATSAPP;

const VAZIO = {
  name: "", role: "SDR", agentFunction: "SCHEDULER", skills: [] as string[],
  prompt: "", knowledgeBase: "", trainingUrls: "", responseDelay: 2000,
  voiceTone: "PROFESSIONAL",
  escalationKeywords: "atendente, falar com humano, ajuda",
  followUpInterval: 120, preConfirmationHours: 12, noShowGraceMinutes: 15,
  postServiceCheckHours: 24, enableWaitlist: true, voiceId: "Kore",
  responseMode: "TEXT", accountIds: [] as string[], active: true,
};

export default function SdrManagement() {
  const [sdrs, setSdrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState<any>(null);
  const [form, setForm] = useState({ ...VAZIO });
  const [assistenteAberto, setAssistenteAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [functions, setFunctions] = useState<any[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<any[]>([]);
  const [voices, setVoices] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [upgradeVoice, setUpgradeVoice] = useState<any>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  // Simulador
  const [teste, setTeste] = useState<{ role: string; content: string }[]>([]);
  const [msgTeste, setMsgTeste] = useState("");
  const [pensando, setPensando] = useState(false);
  const fimDoTeste = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  const fetchData = async (selecionarId?: string) => {
    try {
      const [sdrsRes, fnRes, voicesRes, connRes] = await Promise.all([
        fetch("/api/sdrs"), fetch("/api/agent-functions"), fetch("/api/voices"), fetch("/api/whatsapp/accounts"),
      ]);
      // Ordem de criação: é a mesma que o motor usa para escolher quem
      // atende (`orderBy: createdAt asc` + pickAgentForAccount). Listar em
      // outra ordem faria a tela sugerir uma prioridade que não existe.
      const bruta = sdrsRes.ok ? await sdrsRes.json() : [];
      const lista = (Array.isArray(bruta) ? bruta : []).sort(
        (a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );
      const fnData = fnRes.ok ? await fnRes.json() : {};
      const voiceData = voicesRes.ok ? await voicesRes.json() : { voices: [] };
      setSdrs(lista);
      setFunctions(fnData.functions || []);
      setSkillsCatalog(fnData.skills || []);
      setVoices(voiceData.voices || []);
      setConnections(connRes.ok ? await connRes.json() : []);

      const alvo = lista.find((s: any) => s.id === selecionarId) || lista[0];
      if (alvo) escolher(alvo);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fimDoTeste.current?.scrollIntoView({ behavior: "smooth" }); }, [teste, pensando]);

  const escolher = (sdr: any) => {
    const json = (v: any) => { try { return v ? JSON.parse(v) : []; } catch { return []; } };
    setSelecionado(sdr);
    setForm({
      ...VAZIO,
      ...sdr,
      skills: json(sdr.skills),
      accountIds: json(sdr.accountIds),
      voiceTone: sdr.voiceTone || "PROFESSIONAL",
      prompt: sdr.prompt || "",
      knowledgeBase: sdr.knowledgeBase || "",
      escalationKeywords: sdr.escalationKeywords || VAZIO.escalationKeywords,
      active: sdr.active ?? true,
    });
    setTeste([]);
  };

  const novoAgente = () => {
    const padrao = functions.find((f) => f.id === "SCHEDULER") || functions[0];
    setSelecionado(null);
    setForm({ ...VAZIO, agentFunction: padrao?.id || "SCHEDULER", skills: padrao?.skills || [] });
    setTeste([]);
  };

  const salvar = async () => {
    if (!form.name.trim()) return toast({ title: "Dê um nome ao agente", variant: "destructive" });
    setSalvando(true);
    try {
      const res = await fetch(selecionado ? `/api/sdrs/${selecionado.id}` : "/api/sdrs", {
        method: selecionado ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível salvar.");
      toast({ title: selecionado ? "Agente atualizado" : "Agente criado" });
      fetchData(d.id || selecionado?.id);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSalvando(false); }
  };

  const remover = async (id: string) => {
    if (!confirm("Remover este agente?\n\nAs conversas que ele atendeu continuam no inbox.")) return;
    await fetch(`/api/sdrs/${id}`, { method: "DELETE" });
    setSelecionado(null);
    setForm({ ...VAZIO });
    fetchData();
    toast({ title: "Agente removido" });
  };

  const alternarAtivo = async (sdr: any) => {
    try {
      const res = await fetch(`/api/sdrs/${sdr.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sdr, active: !sdr.active }),
      });
      if (!res.ok) throw new Error();
      toast({ title: sdr.active ? "Agente desligado" : "Agente ligado" });
      fetchData(sdr.id);
    } catch { toast({ title: "Erro ao mudar o estado", variant: "destructive" }); }
  };

  const subirArquivo = async (e: any) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!selecionado) return toast({ title: "Salve o agente antes de treinar", variant: "destructive" });
    setUploading(true);
    try {
      const envio = await enviarArquivo<any>(`/api/sdrs/${selecionado.id}/training`, file);
      if (!envio.ok) throw new Error(envio.erro);
      const data = envio.dados;
      toast({
        title: "Documento aprendido",
        description: `${(data.extractedChars || 0).toLocaleString("pt-BR")} caracteres entraram na base.`,
      });
      setForm((f) => ({ ...f, knowledgeBase: data.sdr.knowledgeBase }));
      fetchData(selecionado.id);
    } catch (err: any) {
      toast({ title: "Erro no treinamento", description: err.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const tocarAmostra = async (v: any) => {
    try {
      previewAudio.current?.pause();
      setPreviewingId(v.id);
      let url = v.preview;
      if (!url) {
        const res = await fetch(`/api/voices/${encodeURIComponent(v.id)}/preview`);
        url = (await res.json()).url;
      }
      if (!url) throw new Error("sem amostra");
      const audio = new Audio(url);
      previewAudio.current = audio;
      audio.onended = () => setPreviewingId(null);
      audio.onerror = () => { setPreviewingId(null); toast({ title: "Não foi possível tocar a amostra", variant: "destructive" }); };
      await audio.play();
    } catch {
      setPreviewingId(null);
      toast({ title: "Não foi possível tocar a amostra", variant: "destructive" });
    }
  };

  /** Conversa de teste. Não grava contato nem conversa — só gasta token. */
  const enviarTeste = async () => {
    const texto = msgTeste.trim();
    if (!texto || !selecionado) return;
    setMsgTeste("");
    const historico = [...teste, { role: "user", content: texto }];
    setTeste(historico);
    setPensando(true);
    try {
      const res = await fetch(`/api/sdrs/${selecionado.id}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: texto, history: teste }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Falha no simulador");
      setTeste([...historico, { role: "assistant", content: d.response }]);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
      setTeste(historico);
    } finally { setPensando(false); }
  };

  const alternarSkill = (id: string) =>
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(id) ? f.skills.filter((s) => s !== id) : [...f.skills, id],
    }));

  const alternarConta = (id: string) =>
    setForm((f) => ({
      ...f,
      accountIds: f.accountIds.includes(id) ? f.accountIds.filter((a) => a !== id) : [...f.accountIds, id],
    }));

  const funcaoAtual = functions.find((f) => f.id === form.agentFunction);
  const iniciais = (n?: string) => (n || "?").trim().substring(0, 2).toUpperCase();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1500px] px-4 pb-10 pt-5 sm:px-6">

        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Agente de IA</h1>
            <p className="mt-0.5 max-w-md text-[13.5px] text-muted-foreground">
              Crie e treine o assistente que atende seus clientes no WhatsApp, Instagram e site.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => document.getElementById("simulador")?.scrollIntoView({ behavior: "smooth" })} className="h-10 gap-2">
              <Sparkles className="h-4 w-4" /> Testar no simulador
            </Button>
            <Button onClick={salvar} disabled={salvando} className="h-10 gap-2">
              <Save className="h-4 w-4" /> {salvando ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_320px]">

          {/* ───── Lista de agentes ───── */}
          <aside className="rounded-[14px] border border-border bg-card shadow-card">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-[13.5px] font-semibold text-foreground">Seus agentes</h2>
              <span className="num text-[11.5px] text-faint">{sdrs.length}</span>
            </header>
            {loading ? (
              <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : (
              <ul>
                {sdrs.map((s) => {
                  const ativo = selecionado?.id === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => escolher(s)}
                        className={`flex w-full items-center gap-3 border-l-[3px] border-b border-b-border-soft px-3.5 py-3 text-left transition-colors ${
                          ativo ? "border-l-[#2563EB] bg-accent-soft" : "border-l-transparent hover:bg-surface-2"
                        }`}
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-[11px] font-bold text-accent-text">
                          {iniciais(s.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="linha-unica-elipse block text-[13px] font-semibold text-foreground">{s.name}</span>
                          <span className="linha-unica-elipse block text-[11.5px] text-faint">
                            {functions.find((f) => f.id === s.agentFunction)?.label || "Atendimento"}
                          </span>
                        </span>
                        <span
                          title={s.active ? "Ligado" : "Desligado"}
                          className={`h-2 w-2 shrink-0 rounded-full ${s.active ? "bg-emerald-500" : "bg-slate-300"}`}
                        />
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button onClick={novoAgente} className="w-full px-3.5 py-3 text-left text-[13px] font-semibold text-accent-text hover:bg-surface-2">
                    + Novo agente
                  </button>
                </li>
              </ul>
            )}
          </aside>

          {/* ───── Edição ───── */}
          <div className="min-w-0 space-y-4">
            {/* Identidade */}
            <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
              <h2 className="text-[15px] font-semibold text-foreground">Identidade</h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">Nome do agente</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10" placeholder="Ex: Sofia" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">Função</Label>
                  <Select
                    value={form.agentFunction}
                    onValueChange={(v) => {
                      // Trocar a função troca também as ferramentas: cada preset
                      // já vem com o conjunto que faz sentido para ele.
                      const preset = functions.find((f) => f.id === v);
                      setForm({ ...form, agentFunction: v, skills: preset?.skills || form.skills });
                    }}
                  >
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {functions.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {funcaoAtual?.hint && <p className="mt-2 text-[12px] text-faint">{funcaoAtual.hint}</p>}

              <div className="mt-5 space-y-2">
                <Label className="text-[12px] font-medium text-muted-foreground">Tom de voz</Label>
                <div className="flex flex-wrap gap-2">
                  {TONS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setForm({ ...form, voiceTone: t.id })}
                      className={`h-9 rounded-lg border px-4 text-[13px] font-semibold transition-colors ${
                        form.voiceTone === t.id
                          ? "border-accent-text/40 bg-accent-soft text-accent-text"
                          : "border-border-soft bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-[12px] font-medium text-muted-foreground">Regras específicas do seu negócio</Label>
                  {/* Escrever prompt do zero é uma habilidade que o dono de
                      uma clínica não tem motivo para ter. O assistente
                      pergunta sobre o negócio e escreve por ele. */}
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => setAssistenteAberto(true)}
                    className="h-7 gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold"
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Montar com o assistente
                  </Button>
                </div>
                <Textarea
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                  rows={form.prompt && form.prompt.length > 400 ? 14 : 5}
                  className="resize-none text-[13.5px]"
                  placeholder="Sempre confirmar o nome do cliente antes de agendar. Nunca prometer desconto sem aprovação."
                />
              </div>
            </section>

            {/* Base de conhecimento */}
            <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-foreground">Base de conhecimento</h2>
                <span className="num text-[11.5px] text-faint">
                  {(form.knowledgeBase || "").length.toLocaleString("pt-BR")} caracteres
                </span>
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                O agente responde com base no que estiver aqui. Suba um documento ou escreva direto.
              </p>

              <input type="file" id="kb-file" className="hidden" accept=".pdf,.txt,.doc,.docx,.csv" onChange={subirArquivo} />
              <button
                onClick={() => document.getElementById("kb-file")?.click()}
                disabled={uploading || !selecionado}
                className="mt-4 grid w-full place-items-center gap-1.5 rounded-xl border border-dashed border-border py-8 text-faint transition-colors hover:border-accent-text/40 hover:text-accent-text disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                <span className="text-[12.5px] font-medium">
                  {uploading ? "Processando o documento…" : "Arraste um PDF, DOCX ou TXT — ou clique para escolher"}
                </span>
                {!selecionado && <span className="text-[11.5px]">Salve o agente antes de treinar</span>}
              </button>

              <Textarea
                value={form.knowledgeBase}
                onChange={(e) => setForm({ ...form, knowledgeBase: e.target.value })}
                rows={6}
                className="mt-3 resize-none text-[13px]"
                placeholder="Preços, prazos, políticas, perguntas frequentes…"
              />
            </section>

            {/* Ferramentas */}
            <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
              <h2 className="text-[15px] font-semibold text-foreground">O que o agente pode fazer</h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Desligar uma ferramenta tira a capacidade — o agente deixa de conseguir, não só de tentar.
              </p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {skillsCatalog.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-soft bg-surface-2 p-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-foreground">{s.label}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">{s.desc}</span>
                    </span>
                    <Switch checked={form.skills.includes(s.id)} onCheckedChange={() => alternarSkill(s.id)} aria-label={s.label} />
                  </label>
                ))}
              </div>
            </section>

            {/* Voz e canais */}
            <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
              <h2 className="text-[15px] font-semibold text-foreground">Voz e canais</h2>

              <div className="mt-4 space-y-1.5">
                <Label className="text-[12px] font-medium text-muted-foreground">Como o agente responde</Label>
                <Select value={form.responseMode} onValueChange={(v) => setForm({ ...form, responseMode: v })}>
                  <SelectTrigger className="h-10 sm:w-[280px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Só texto</SelectItem>
                    <SelectItem value="AUDIO">Só áudio</SelectItem>
                    <SelectItem value="MIRROR">Espelha o cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.responseMode !== "TEXT" && voices.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-[12px] font-medium text-muted-foreground">Voz</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {voices.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => (v.locked ? setUpgradeVoice(v) : setForm({ ...form, voiceId: v.id }))}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 ${
                          form.voiceId === v.id ? "border-accent-text/40 bg-accent-soft" : "border-border-soft bg-surface-2"
                        }`}
                      >
                        {v.locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                          : form.voiceId === v.id ? <Check className="h-3.5 w-3.5 shrink-0 text-accent-text" />
                          : <Volume2 className="h-3.5 w-3.5 shrink-0 text-faint" />}
                        <span className="min-w-0 flex-1">
                          {/* `name` é o que o servidor manda. Lendo `label`, que
                              não existe, sobrava o id: nas vozes do Gemini o id
                              é uma palavra ("Kore") e passava despercebido, mas
                              nas da ElevenLabs é um hash. */}
                          <span className="linha-unica-elipse block text-[13px] font-medium text-foreground">{v.name || v.label || v.id}</span>
                          {v.locked && <span className="block text-[11px] text-amber-700">Voz premium</span>}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); tocarAmostra(v); }}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint hover:text-accent-text"
                          aria-label="Ouvir amostra"
                        >
                          {previewingId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {connections.length > 0 && (
                <div className="mt-5 space-y-2">
                  <Label className="text-[12px] font-medium text-muted-foreground">Conexões que este agente atende</Label>
                  <p className="text-[11.5px] text-faint">Nenhuma marcada: ele atende todas.</p>
                  <div className="flex flex-wrap gap-2">
                    {connections.map((c) => {
                      const m = canal(c.channel);
                      const marcada = form.accountIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => alternarConta(c.id)}
                          className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-semibold transition-colors ${
                            marcada ? "border-accent-text/40 bg-accent-soft text-accent-text" : "border-border-soft text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <m.Icon className={`h-3.5 w-3.5 ${marcada ? "" : m.cls}`} /> {c.name || c.phone || m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Comportamento */}
            <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
              <h2 className="text-[15px] font-semibold text-foreground">Comportamento</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">Espera antes de responder (ms)</Label>
                  <Input type="number" min="0" value={form.responseDelay}
                    onChange={(e) => setForm({ ...form, responseDelay: Number(e.target.value) })} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">Retomar contato após (min)</Label>
                  <Input type="number" min="0" value={form.followUpInterval}
                    onChange={(e) => setForm({ ...form, followUpInterval: Number(e.target.value) })} className="h-10" />
                </div>
                <div className="col-span-full space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">Palavras que chamam um humano</Label>
                  <Input value={form.escalationKeywords}
                    onChange={(e) => setForm({ ...form, escalationKeywords: e.target.value })}
                    className="h-10" placeholder="atendente, falar com humano, reclamação" />
                  <p className="text-[11.5px] text-faint">Separe por vírgula. Ao ouvir uma delas, o agente passa a conversa para a fila.</p>
                </div>
                <label className="col-span-full flex items-center justify-between rounded-xl border border-border-soft bg-surface-2 p-3.5">
                  <span>
                    <span className="block text-[13px] font-semibold text-foreground">Lista de espera</span>
                    <span className="block text-[11.5px] text-muted-foreground">Sem horário livre, o agente oferece entrar na fila.</span>
                  </span>
                  <Switch checked={form.enableWaitlist} onCheckedChange={(v) => setForm({ ...form, enableWaitlist: v })} />
                </label>
              </div>
            </section>

            {selecionado && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border bg-card p-4 shadow-card">
                <label className="flex items-center gap-2.5">
                  <Switch checked={!!selecionado.active} onCheckedChange={() => alternarAtivo(selecionado)} />
                  <span className="text-[13px] font-medium text-foreground">
                    {selecionado.active ? "Agente ligado — está atendendo" : "Agente desligado"}
                  </span>
                </label>
                <Button variant="outline" onClick={() => remover(selecionado.id)} className="gap-2 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> Remover agente
                </Button>
              </div>
            )}
          </div>

          {/* ───── Simulador ───── */}
          <aside id="simulador" className="rounded-[14px] border border-border bg-card shadow-card xl:sticky xl:top-[76px]">
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C5CFF] text-[11px] font-bold text-white">
                {iniciais(form.name) || "IA"}
              </span>
              <div className="min-w-0">
                <p className="linha-unica-elipse text-[13.5px] font-semibold text-foreground">{form.name || "Simulador"}</p>
                <p className="text-[11.5px] text-faint">Conversa de teste</p>
              </div>
            </header>

            <div className="h-[420px] overflow-y-auto bg-surface-2 p-4">
              {!selecionado ? (
                <p className="pt-16 text-center text-[12.5px] text-muted-foreground">
                  Salve o agente para conversar com ele aqui.
                </p>
              ) : teste.length === 0 ? (
                <div className="pt-12 text-center">
                  <Bot className="mx-auto h-7 w-7 text-border-soft" />
                  <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                    Escreva como se fosse um cliente. Nada aqui vira contato,<br />conversa nem mensagem enviada.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {teste.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] whitespace-pre-wrap px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        m.role === "user"
                          ? "rounded-[14px_14px_4px_14px] bg-[#2563EB] text-white"
                          : "rounded-[14px_14px_14px_4px] border border-border-soft bg-background text-foreground"
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {pensando && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-1.5 rounded-[14px_14px_14px_4px] border border-border-soft bg-background px-3.5 py-3">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent-text"
                            style={{ animationDuration: "1.2s", animationDelay: `${i * 0.15}s` }} />
                        ))}
                        <span className="ml-1 text-[11.5px] text-faint">{form.name || "O agente"} está digitando…</span>
                      </div>
                    </div>
                  )}
                  <div ref={fimDoTeste} />
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); enviarTeste(); }}
              className="flex items-center gap-2 border-t border-border p-3"
            >
              <Input
                value={msgTeste}
                onChange={(e) => setMsgTeste(e.target.value)}
                disabled={!selecionado || pensando}
                placeholder="Escreva como um cliente…"
                className="h-10 text-[13px]"
              />
              <Button type="submit" disabled={!selecionado || pensando} className="h-10 w-10 shrink-0 p-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
            {teste.length > 0 && (
              <button onClick={() => setTeste([])} className="w-full border-t border-border-soft py-2 text-[12px] font-medium text-faint hover:text-foreground">
                Limpar conversa
              </button>
            )}
          </aside>
        </div>
      </div>

      {/* Voz premium bloqueada pelo plano */}
      <Dialog open={!!upgradeVoice} onOpenChange={(o) => !o && setUpgradeVoice(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold">
              <Lock className="h-4 w-4 text-amber-600" /> Voz premium
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              A voz “{upgradeVoice?.name || upgradeVoice?.label || upgradeVoice?.id}” está disponível nos planos com voz premium.
              As vozes padrão continuam liberadas no seu plano.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeVoice(null)}>Fechar</Button>
            <Button onClick={() => { window.location.href = "/assinatura"; }}>Ver planos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AssistenteDePrompt
        open={assistenteAberto}
        onOpenChange={setAssistenteAberto}
        agentFunction={form.agentFunction}
        skills={form.skills}
        aoGerar={(prompt) => setForm((f: any) => ({ ...f, prompt }))}
      />
    </DashboardLayout>
  );
}
