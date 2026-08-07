import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Sparkles, UserRound, CreditCard, HelpCircle, Check, AlertTriangle,
  Plus, Pencil, Trash2, Save, Loader2, Wand2, UtensilsCrossed, FileText, Upload, ExternalLink,
  QrCode, Copy,
} from "lucide-react";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Rótulos por vertical — o que aparece na tela.
const VERTICAL_LABELS: Record<string, { business: string; team: string; teamSingular: string; service: string; serviceSingular: string; payment: string; paymentSingular: string; customer: string }> = {
  CLINIC:     { business: "Clínica",     team: "Profissionais", teamSingular: "Profissional",   service: "Serviços",     serviceSingular: "Serviço / Procedimento", payment: "Convênios",           paymentSingular: "Convênio",        customer: "pacientes" },
  BEAUTY:     { business: "Salão",       team: "Profissionais", teamSingular: "Profissional",   service: "Serviços",     serviceSingular: "Serviço",                 payment: "Formas de pagamento", paymentSingular: "Forma de pagamento", customer: "clientes" },
  FITNESS:    { business: "Studio",      team: "Instrutores",   teamSingular: "Instrutor",      service: "Modalidades",  serviceSingular: "Modalidade",              payment: "Planos",              paymentSingular: "Plano",            customer: "alunos" },
  SERVICES:   { business: "Escritório",  team: "Profissionais", teamSingular: "Profissional",   service: "Serviços",     serviceSingular: "Serviço",                 payment: "Formas de pagamento", paymentSingular: "Forma de pagamento", customer: "clientes" },
  RESTAURANT: { business: "Restaurante", team: "Equipe",        teamSingular: "Membro da equipe", service: "Cardápio",    serviceSingular: "Prato / Experiência",     payment: "Formas de pagamento", paymentSingular: "Forma de pagamento", customer: "clientes" },
  OTHER:      { business: "Negócio",     team: "Equipe",        teamSingular: "Membro",         service: "Serviços",     serviceSingular: "Serviço",                 payment: "Formas de pagamento", paymentSingular: "Forma de pagamento", customer: "clientes" },
};

const TIPOS_DE_CHAVE_PIX = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefone" },
  { value: "RANDOM", label: "Chave aleatória" },
];

// Verticais em que o cardápio em arquivo aparece. Tem de bater com
// NICHOS_COM_CARDAPIO no MenuService do servidor.
const NICHOS_COM_CARDAPIO = ["RESTAURANT", "FOOD"];

const VERTICAL_OPTIONS = [
  { value: "CLINIC",     label: "Clínica de saúde",      hint: "Odonto, médica, veterinária, fisio, psicologia" },
  { value: "BEAUTY",     label: "Beleza e estética",     hint: "Salão, barbearia, spa, manicure" },
  { value: "FITNESS",    label: "Academia / Studio",     hint: "Musculação, pilates, personal, yoga" },
  { value: "SERVICES",   label: "Serviços profissionais", hint: "Advocacia, contabilidade, consultoria" },
  { value: "RESTAURANT", label: "Restaurante",           hint: "Reservas, cardápio, eventos" },
  { value: "OTHER",      label: "Outro",                 hint: "Configuração manual" },
];

function authHeaders() {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export default function MeuNegocio() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [profile, setProfile] = useState<any>({});
  const [hours, setHours] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [aba, setAba] = useState("info");
  const [cardapio, setCardapio] = useState<any>(null);
  const [enviandoCardapio, setEnviandoCardapio] = useState(false);
  const [pix, setPix] = useState<any>({ pixKeyType: "CPF" });
  const [pixPreview, setPixPreview] = useState<any>(null);
  const [salvandoPix, setSalvandoPix] = useState(false);

  const vertical = profile.businessType || "OTHER";
  const L = useMemo(() => VERTICAL_LABELS[vertical] || VERTICAL_LABELS.OTHER, [vertical]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/business", { headers: authHeaders() });
      const d = await res.json();
      setProfile(d.profile || {});
      setCardapio(
        d.profile?.menuUrl
          ? {
              url: d.profile.menuUrl,
              kind: d.profile.menuKind || "image",
              fileName: d.profile.menuFileName || null,
              atualizadoEm: d.profile.menuUpdatedAt || null,
            }
          : null
      );
      const byDay = new Map((d.businessHours || []).map((h: any) => [h.weekday, h]));
      setHours(WEEKDAYS.map((_, wd) => byDay.get(wd) || { weekday: wd, openTime: "", closeTime: "", isClosed: wd === 0 }));
      setTeamMembers(d.teamMembers || []);
      setServices(d.services || []);
      setPaymentMethods(d.paymentMethods || []);
      setFaqs(d.faqs || []);

      const rp = await fetch("/api/business/pix", { headers: authHeaders() });
      const dp = await rp.json();
      setPix({
        pixKey: dp.pixKey || "",
        pixKeyType: dp.pixKeyType || "CPF",
        pixHolderName: dp.pixHolderName || "",
        pixHolderDoc: dp.pixHolderDoc || "",
        pixCity: dp.pixCity || "",
        pixBank: dp.pixBank || "",
      });
      setPixPreview(dp.preview || null);
    } catch (e) {
      toast({ title: "Erro ao carregar dados do negócio", variant: "destructive" });
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await fetch("/api/business/profile", { method: "PUT", headers: authHeaders(), body: JSON.stringify(profile) });
      await fetch("/api/business/hours", { method: "PUT", headers: authHeaders(), body: JSON.stringify({ hours }) });
      toast({ title: "Informações salvas", description: `O agente já vai usar esses dados nas respostas para seus ${L.customer}.` });
    } catch (e) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSavingProfile(false);
  };

  const enviarCardapio = async (arquivo: File) => {
    setEnviandoCardapio(true);
    try {
      const corpo = new FormData();
      corpo.append("file", arquivo);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/business/menu", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: corpo,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Não foi possível enviar o cardápio.");
      setCardapio({ url: d.url, kind: d.kind, fileName: d.fileName, atualizadoEm: new Date().toISOString() });
      toast({
        title: "Cardápio publicado",
        description: "O agente já entrega esse arquivo quando o cliente pedir o cardápio.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao enviar o cardápio", description: e?.message, variant: "destructive" });
    }
    setEnviandoCardapio(false);
  };

  const removerCardapio = async () => {
    if (!confirm("Tirar o cardápio do ar? O agente deixa de enviá-lo.")) return;
    try {
      await fetch("/api/business/menu", { method: "DELETE", headers: authHeaders() });
      setCardapio(null);
      toast({ title: "Cardápio removido" });
    } catch {
      toast({ title: "Erro ao remover o cardápio", variant: "destructive" });
    }
  };

  const salvarPix = async () => {
    setSalvandoPix(true);
    try {
      const res = await fetch("/api/business/pix", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(pix),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Não foi possível salvar os dados do Pix.");
      // Recarrega para o preview do QR Code refletir a chave nova.
      const rp = await fetch("/api/business/pix", { headers: authHeaders() });
      const dp = await rp.json();
      setPixPreview(dp.preview || null);
      toast({
        title: "Pix salvo",
        description: pix.pixKey
          ? "O agente já pode mandar o QR Code, o copia e cola e o link."
          : "Chave removida — o agente deixa de oferecer Pix.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao salvar o Pix", description: e?.message, variant: "destructive" });
    }
    setSalvandoPix(false);
  };

  const applyTemplate = async () => {
    if (!confirm(`Aplicar o template de "${VERTICAL_OPTIONS.find(v => v.value === vertical)?.label}"? Isso vai inserir serviços e FAQs de exemplo (sem sobrescrever o que você já cadastrou).`)) return;
    setApplyingTemplate(true);
    try {
      await fetch("/api/business/apply-template", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ businessType: vertical }),
      });
      toast({ title: "Template aplicado", description: "Revise e ajuste os itens sugeridos." });
      load();
    } catch (e) {
      toast({ title: "Erro ao aplicar template", variant: "destructive" });
    }
    setApplyingTemplate(false);
  };

  // Completude do perfil. Cada item é uma coisa que o agente passa a saber —
  // por isso a barra aponta o que falta em vez de só mostrar um número.
  const itens = [
    { id: "tipo", rotulo: "Tipo de negócio", ok: !!profile.businessType, aba: "info", acao: "Escolher" },
    { id: "sobre", rotulo: "Apresentação do negócio", ok: !!(profile.businessAbout || "").trim(), aba: "info", acao: "Escrever" },
    { id: "endereco", rotulo: "Endereço", ok: !!(profile.businessAddress || "").trim(), aba: "info", acao: "Preencher" },
    { id: "horario", rotulo: "Horário de atendimento", ok: hours.some((h) => !h.isClosed && h.openTime), aba: "info", acao: "Definir" },
    { id: "servicos", rotulo: L.service, ok: services.length > 0, aba: "services", acao: "Cadastrar" },
    { id: "equipe", rotulo: L.team, ok: teamMembers.length > 0, aba: "team", acao: "Cadastrar" },
    { id: "pagamento", rotulo: L.payment, ok: paymentMethods.length > 0, aba: "pay", acao: "Cadastrar" },
    { id: "faq", rotulo: "Perguntas frequentes", ok: faqs.length > 0, aba: "faq", acao: "Cadastrar" },
  ];
  const feitos = itens.filter((i) => i.ok).length;
  const pct = Math.round((feitos / itens.length) * 100);
  const faltando = itens.filter((i) => !i.ok);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1240px] px-4 pb-10 pt-5 sm:px-6">

        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Meu negócio</h1>
            <p className="mt-0.5 max-w-lg text-[13.5px] text-muted-foreground">
              Tudo o que o agente precisa saber para responder seus {L.customer} com precisão.
            </p>
          </div>
          <Button onClick={saveProfile} disabled={savingProfile} className="h-10 gap-2">
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingProfile ? "Salvando…" : "Salvar informações"}
          </Button>
        </header>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-[14px]" />)}</div>
        ) : (
          <>
            {/* Progresso do perfil */}
            <section className="mb-4 rounded-[14px] border border-border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-5">
                <AnelPerfil pct={pct} />
                <div className="min-w-[220px] flex-1">
                  <h2 className="text-[15px] font-semibold text-foreground">
                    {faltando.length === 0
                      ? "Perfil completo — o agente sabe tudo o que precisa"
                      : faltando.length === 1
                      ? "Falta um item para o perfil ficar completo"
                      : `Faltam ${faltando.length} itens para o perfil ficar completo`}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {faltando.length === 0
                      ? "Sempre que algo mudar no negócio, atualize aqui."
                      : "Cada item preenchido é uma pergunta a menos que o agente erra."}
                  </p>
                </div>
                {faltando.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {faltando.slice(0, 3).map((i) => (
                      <button
                        key={i.id}
                        onClick={() => setAba(i.aba)}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-[#FEF3C7] px-3 text-[12.5px] font-semibold text-amber-900 transition-colors hover:bg-amber-200"
                      >
                        {i.rotulo} <span className="text-amber-700">· {i.acao}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Abas */}
            <nav className="mb-4 flex gap-1 overflow-x-auto rounded-[14px] border border-border bg-card p-2 shadow-card">
              {[
                { id: "info", rotulo: "Informações", Icone: Building2 },
                { id: "services", rotulo: L.service, Icone: Sparkles },
                { id: "team", rotulo: L.team, Icone: UserRound },
                { id: "pay", rotulo: L.payment, Icone: CreditCard },
                { id: "faq", rotulo: "FAQ", Icone: HelpCircle },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setAba(t.id)}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold transition-colors ${
                    aba === t.id ? "bg-accent-soft text-accent-text" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.Icone className="h-3.5 w-3.5" /> {t.rotulo}
                </button>
              ))}
            </nav>

            {aba === "info" && (
              <div className="grid items-start gap-4 lg:grid-cols-2">
                {/* Identificação */}
                <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                  <h2 className="text-[15px] font-semibold text-foreground">Identificação</h2>

                  <div className="mt-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-muted-foreground">Tipo de negócio</Label>
                      <div className="flex gap-2">
                        <Select value={vertical} onValueChange={(v) => setProfile({ ...profile, businessType: v })}>
                          <SelectTrigger className="h-10 flex-1"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                          <SelectContent>
                            {VERTICAL_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                <span className="flex flex-col text-left">
                                  <span className="text-[13px]">{o.label}</span>
                                  <span className="text-[11.5px] text-muted-foreground">{o.hint}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={applyTemplate} disabled={applyingTemplate} className="h-10 shrink-0 gap-2">
                          {applyingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                          Modelo
                        </Button>
                      </div>
                      <p className="text-[11.5px] text-faint">
                        Define o vocabulário do agente. “Modelo” preenche serviços e perguntas típicas da área.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-muted-foreground">Apresentação</Label>
                      <Textarea
                        rows={3} value={profile.businessAbout || ""}
                        onChange={(e) => setProfile({ ...profile, businessAbout: e.target.value })}
                        className="resize-none text-[13.5px]"
                        placeholder="Ex.: Clínica com 12 anos de atuação, especializada em odontologia estética."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-muted-foreground">Endereço</Label>
                      <Input
                        value={profile.businessAddress || ""}
                        onChange={(e) => setProfile({ ...profile, businessAddress: e.target.value })}
                        className="h-10" placeholder="Rua, número, bairro, cidade"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-muted-foreground">Formas de pagamento aceitas</Label>
                      <Input
                        value={profile.businessPayment || ""}
                        onChange={(e) => setProfile({ ...profile, businessPayment: e.target.value })}
                        className="h-10" placeholder="Dinheiro, Pix, cartão em até 6x"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-muted-foreground">
                        Outras informações (estacionamento, acessibilidade, orientações)
                      </Label>
                      <Textarea
                        rows={3} value={profile.businessExtraInfo || ""}
                        onChange={(e) => setProfile({ ...profile, businessExtraInfo: e.target.value })}
                        className="resize-none text-[13.5px]"
                      />
                    </div>
                  </div>
                </section>

                <div className="space-y-4">
                  {/* Horário */}
                  <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                    <h2 className="text-[15px] font-semibold text-foreground">Horário de funcionamento</h2>
                    <div className="mt-4 space-y-2">
                      {hours.map((h, i) => (
                        <div key={h.weekday} className="flex items-center gap-3">
                          <span className="w-[68px] shrink-0 text-[13px] text-foreground">{WEEKDAYS[h.weekday]}</span>
                          <Switch
                            checked={!h.isClosed}
                            onCheckedChange={(v) => { const n = [...hours]; n[i] = { ...h, isClosed: !v }; setHours(n); }}
                            aria-label={WEEKDAYS[h.weekday]}
                          />
                          {h.isClosed ? (
                            <span className="text-[13px] text-faint">Fechado</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input type="time" className="h-9 w-[120px]" value={h.openTime || ""}
                                onChange={(e) => { const n = [...hours]; n[i] = { ...h, openTime: e.target.value }; setHours(n); }} />
                              <span className="text-[12.5px] text-faint">às</span>
                              <Input type="time" className="h-9 w-[120px]" value={h.closeTime || ""}
                                onChange={(e) => { const n = [...hours]; n[i] = { ...h, closeTime: e.target.value }; setHours(n); }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* O que o agente já sabe */}
                  <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                    <h2 className="text-[15px] font-semibold text-foreground">O que o agente já sabe</h2>
                    <ul className="mt-4 space-y-2">
                      {itens.slice(4).map((i) => (
                        <li
                          key={i.id}
                          className={`flex items-center gap-3 rounded-xl border p-3 ${
                            i.ok ? "border-border-soft bg-surface-2" : "border-amber-300 bg-[#FEF3C7]"
                          }`}
                        >
                          {i.ok
                            ? <Check className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={3} />
                            : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
                          <span className={`min-w-0 flex-1 text-[13px] font-medium ${i.ok ? "text-foreground" : "text-amber-900"}`}>
                            {i.rotulo}
                            {i.ok && (
                              <span className="ml-1.5 font-normal text-faint">
                                · {i.id === "servicos" ? services.length : i.id === "equipe" ? teamMembers.length : i.id === "pagamento" ? paymentMethods.length : faqs.length}
                              </span>
                            )}
                          </span>
                          {!i.ok && (
                            <button
                              onClick={() => setAba(i.aba)}
                              className="shrink-0 rounded-lg border border-amber-400 bg-card px-2.5 py-1 text-[12px] font-semibold text-amber-900 hover:bg-amber-50"
                            >
                              {i.acao}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>

                  {NICHOS_COM_CARDAPIO.includes(vertical) && (
                    <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                      <div className="flex items-start gap-2.5">
                        <UtensilsCrossed className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
                        <div className="min-w-0">
                          <h2 className="text-[15px] font-semibold text-foreground">Cardápio</h2>
                          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                            Suba a foto ou o PDF do cardápio. Quando alguém pedir o cardápio na conversa,
                            o agente envia esse arquivo.
                          </p>
                        </div>
                      </div>

                      {cardapio ? (
                        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border-soft bg-surface-2 p-3">
                          {cardapio.kind === "document" ? (
                            <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
                          ) : (
                            <img
                              src={cardapio.url}
                              alt="Cardápio"
                              className="h-12 w-12 shrink-0 rounded-lg object-cover"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-foreground">
                              {cardapio.fileName || "Cardápio"}
                            </p>
                            <p className="text-[12px] text-faint">
                              {cardapio.kind === "document" ? "PDF" : "Imagem"}
                              {cardapio.atualizadoEm
                                ? ` · atualizado em ${new Date(cardapio.atualizadoEm).toLocaleDateString("pt-BR")}`
                                : ""}
                            </p>
                          </div>
                          <a
                            href={cardapio.url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-foreground hover:bg-surface-2"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <button
                            onClick={removerCardapio}
                            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-destructive hover:bg-surface-2"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className="mt-4 rounded-xl border border-dashed border-border p-3 text-[12.5px] text-muted-foreground">
                          Nenhum cardápio publicado. Sem o arquivo, o agente responde só com o que estiver
                          cadastrado em {L.service}.
                        </p>
                      )}

                      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[12.5px] font-semibold text-foreground hover:bg-surface-2">
                        {enviandoCardapio ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {enviandoCardapio
                          ? "Enviando…"
                          : cardapio
                            ? "Substituir arquivo"
                            : "Enviar cardápio"}
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf"
                          className="hidden"
                          disabled={enviandoCardapio}
                          onChange={(e) => {
                            const arquivo = e.target.files?.[0];
                            // Zera o input: sem isso, reenviar o mesmo arquivo depois
                            // de um erro não dispara o onChange de novo.
                            e.target.value = "";
                            if (arquivo) enviarCardapio(arquivo);
                          }}
                        />
                      </label>
                      <p className="mt-2 text-[12px] text-faint">JPG, PNG, WEBP ou PDF, até 25 MB.</p>
                    </section>
                  )}
                </div>
              </div>
            )}

            {aba === "services" && (
              <CrudList
                endpoint="/api/business/services" items={services} reload={load}
                emptyIcon={<Sparkles className="h-6 w-6" />} emptyTitle={`Nenhum ${L.serviceSingular.toLowerCase()} cadastrado`}
                emptyDesc={`Cadastre ${L.service.toLowerCase()} com preço e duração para o agente informar corretamente.`}
                addLabel={`Novo ${L.serviceSingular.toLowerCase()}`}
                fields={[
                  { key: "name", label: "Nome", required: true },
                  { key: "price", label: "Preço (R$)", type: "number", hint: "deixe vazio para 'sob consulta'" },
                  { key: "durationMin", label: "Duração (min)", type: "number" },
                  { key: "description", label: "Descrição", type: "textarea" },
                  { key: "prep", label: "Preparo / observações", type: "textarea" },
                ]}
                render={(s) => (
                  <>
                    <p className="text-[13.5px] font-medium text-foreground">{s.name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {s.price != null ? Number(s.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Sob consulta"}{s.durationMin ? ` · ${s.durationMin} min` : ""}
                    </p>
                  </>
                )}
              />
            )}

            {aba === "team" && (
              <CrudList
                endpoint="/api/business/team" items={teamMembers} reload={load}
                emptyIcon={<UserRound className="h-6 w-6" />} emptyTitle={`Nenhum ${L.teamSingular.toLowerCase()} cadastrado`}
                emptyDesc={`Adicione ${L.team.toLowerCase()} para o agente indicar quem faz o quê.`}
                addLabel={`Novo ${L.teamSingular.toLowerCase()}`}
                fields={[
                  { key: "name", label: "Nome", required: true },
                  { key: "role", label: "Cargo / especialidade" },
                  { key: "credentials", label: "Registro / credenciais (opcional)" },
                  { key: "bio", label: "Sobre / diferenciais", type: "textarea" },
                ]}
                render={(p) => (
                  <>
                    <p className="text-[13.5px] font-medium text-foreground">{p.name}</p>
                    <p className="text-[12px] text-muted-foreground">{[p.role, p.credentials].filter(Boolean).join(" · ")}</p>
                  </>
                )}
              />
            )}

            {aba === "pay" && (
              <div className="space-y-4">
                <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                  <div className="flex items-start gap-2.5">
                    <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-semibold text-foreground">Recebimento por Pix</h2>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        Com a chave cadastrada, o agente manda o QR Code, o copia e cola e o link de
                        pagamento — e depois consegue conferir o comprovante contra estes dados.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-[12.5px]">Tipo da chave</Label>
                        <Select
                          value={pix.pixKeyType || "CPF"}
                          onValueChange={(v) => setPix({ ...pix, pixKeyType: v })}
                        >
                          <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIPOS_DE_CHAVE_PIX.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[12.5px]">Chave Pix</Label>
                        <Input
                          className="mt-1 h-10"
                          value={pix.pixKey || ""}
                          onChange={(e) => setPix({ ...pix, pixKey: e.target.value })}
                          placeholder="A chave que recebe o dinheiro"
                        />
                      </div>
                      <div>
                        <Label className="text-[12.5px]">Nome do recebedor</Label>
                        <Input
                          className="mt-1 h-10"
                          value={pix.pixHolderName || ""}
                          onChange={(e) => setPix({ ...pix, pixHolderName: e.target.value })}
                          placeholder="Como aparece no comprovante"
                        />
                      </div>
                      <div>
                        <Label className="text-[12.5px]">CPF/CNPJ do recebedor</Label>
                        <Input
                          className="mt-1 h-10"
                          value={pix.pixHolderDoc || ""}
                          onChange={(e) => setPix({ ...pix, pixHolderDoc: e.target.value })}
                          placeholder="Só números"
                        />
                      </div>
                      <div>
                        <Label className="text-[12.5px]">Cidade</Label>
                        <Input
                          className="mt-1 h-10"
                          value={pix.pixCity || ""}
                          onChange={(e) => setPix({ ...pix, pixCity: e.target.value })}
                          placeholder="Exigida pelo padrão do QR Code"
                        />
                      </div>
                      <div>
                        <Label className="text-[12.5px]">Instituição</Label>
                        <Input
                          className="mt-1 h-10"
                          value={pix.pixBank || ""}
                          onChange={(e) => setPix({ ...pix, pixBank: e.target.value })}
                          placeholder="Banco onde a chave está"
                        />
                      </div>
                    </div>

                    {pixPreview ? (
                      <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-border-soft bg-surface-2 p-4 lg:w-[220px]">
                        <img src={pixPreview.qrCode} alt="QR Code do Pix" className="h-[160px] w-[160px] rounded-lg bg-white" />
                        <p className="text-center text-[11.5px] text-faint">
                          Prévia sem valor. Nas cobranças o valor entra no código.
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(pixPreview.payload);
                            toast({ title: "Copia e cola copiado" });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-semibold text-foreground hover:bg-card/80"
                        >
                          <Copy className="h-3.5 w-3.5" /> Copiar código
                        </button>
                      </div>
                    ) : (
                      <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-border p-4 text-center text-[12.5px] text-muted-foreground lg:w-[220px]">
                        Cadastre a chave para ver o QR Code.
                      </div>
                    )}
                  </div>

                  <Button onClick={salvarPix} disabled={salvandoPix} className="mt-4 h-10 gap-2">
                    {salvandoPix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {salvandoPix ? "Salvando…" : "Salvar dados do Pix"}
                  </Button>
                </section>

                <CrudList
                endpoint="/api/business/payments" items={paymentMethods} reload={load}
                emptyIcon={<CreditCard className="h-6 w-6" />} emptyTitle={`Nenhum ${L.paymentSingular.toLowerCase()} cadastrado`}
                emptyDesc={`Liste ${L.payment.toLowerCase()} aceitos para o agente responder com precisão.`}
                addLabel={`Novo ${L.paymentSingular.toLowerCase()}`}
                fields={[
                  { key: "name", label: "Nome", required: true },
                  { key: "notes", label: "Observações", type: "textarea" },
                ]}
                render={(x) => (
                  <>
                    <p className="text-[13.5px] font-medium text-foreground">{x.name}</p>
                    {x.notes && <p className="text-[12px] text-muted-foreground">{x.notes}</p>}
                  </>
                )}
                />
              </div>
            )}

            {aba === "faq" && (
              <CrudList
                endpoint="/api/business/faqs" items={faqs} reload={load}
                emptyIcon={<HelpCircle className="h-6 w-6" />} emptyTitle="Nenhuma pergunta cadastrada"
                emptyDesc={`Cadastre dúvidas comuns dos seus ${L.customer} com a resposta oficial.`}
                addLabel="Nova pergunta"
                fields={[
                  { key: "question", label: "Pergunta", required: true },
                  { key: "answer", label: "Resposta", type: "textarea", required: true },
                ]}
                render={(f) => (
                  <>
                    <p className="text-[13.5px] font-medium text-foreground">{f.question}</p>
                    <p className="linha-unica-elipse text-[12px] text-muted-foreground">{f.answer}</p>
                  </>
                )}
              />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

/** Anel de completude do perfil. */
function AnelPerfil({ pct }: { pct: number }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative h-[82px] w-[82px] shrink-0">
      <svg viewBox="0 0 82 82" className="h-[82px] w-[82px] -rotate-90">
        <circle cx="41" cy="41" r={r} fill="none" strokeWidth="6" className="stroke-primary/15" />
        <circle
          cx="41" cy="41" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-700"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
        />
      </svg>
      <span className="num absolute inset-0 grid place-items-center text-[17px] font-bold text-foreground">{pct}%</span>
    </div>
  );
}

interface Field { key: string; label: string; type?: "text" | "number" | "textarea"; required?: boolean; hint?: string }
function CrudList({ endpoint, items, reload, fields, render, addLabel, emptyIcon, emptyTitle, emptyDesc }: {
  endpoint: string; items: any[]; reload: () => void; fields: Field[]; render: (item: any) => React.ReactNode;
  addLabel: string; emptyIcon: React.ReactNode; emptyTitle: string; emptyDesc: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setForm({}); setOpen(true); };
  const openEdit = (item: any) => { setEditing(item); setForm({ ...item }); setOpen(true); };

  const save = async () => {
    for (const f of fields) if (f.required && !form[f.key]) return toast({ title: `Preencha: ${f.label}`, variant: "destructive" });
    setSaving(true);
    try {
      const payload = { ...form };
      fields.forEach(f => { if (f.type === "number") payload[f.key] = payload[f.key] === "" || payload[f.key] == null ? null : Number(payload[f.key]); });
      const url = editing ? `${endpoint}/${editing.id}` : endpoint;
      await fetch(url, { method: editing ? "PUT" : "POST", headers: authHeaders(), body: JSON.stringify(payload) });
      setOpen(false); reload();
      toast({ title: editing ? "Atualizado" : "Adicionado" });
    } catch (e) { toast({ title: "Erro ao salvar", variant: "destructive" }); }
    setSaving(false);
  };

  const remove = async (item: any) => {
    if (!confirm("Remover este item?")) return;
    await fetch(`${endpoint}/${item.id}`, { method: "DELETE", headers: authHeaders() });
    reload();
  };

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{items.length} cadastrado(s)</h2>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1.5" /> {addLabel}</Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDesc} action={{ label: addLabel, onClick: openNew }} />
      ) : (
        <ul className="divide-y divide-border">
          {items.map(item => (
            <li key={item.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">{render(item)}</div>
              <button onClick={() => openEdit(item)} className="p-2 rounded-lg text-muted-foreground hover:bg-muted"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(item)} className="p-2 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar" : addLabel}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {fields.map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{f.label}{f.required ? " *" : ""}</Label>
                {f.type === "textarea" ? (
                  <Textarea rows={3} value={form[f.key] ?? ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                ) : (
                  <Input type={f.type === "number" ? "number" : "text"} value={form[f.key] ?? ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                )}
                {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
