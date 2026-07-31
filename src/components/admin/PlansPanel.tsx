import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import { Plus, Pencil, Trash2, Loader2, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEFAULT_PLAN = {
  id: null as string | null,
  name: "",
  priceMonthly: 0,
  priceYearly: 0,
  maxLeads: 500,
  maxSdrs: 1,
  maxUsers: 2,
  maxWhatsAppNumbers: 1,
  maxKnowledgeBaseChars: 50000,
  maxTokens: 100000,
  maxMessages: 1000,
  whatsappMode: "BOTH", // OFFICIAL | BAILEYS | BOTH
  maxConversations: 0, // 0 = sem limite de conversas
  maxCampaignMessages: 0, // 0 = plano sem disparo em massa
  campaignCategory: "MARKETING", // categoria de referência para custear a franquia
  enableSdr: true,
  enableTokens: true,
  enableMessages: true,
  enableCalendar: true,
  enableAutomations: true,
  enableWebhooks: false,
  enableVoice: false,
  enablePremiumVoice: false,
  sdrUnitCost: 15.0,
  tokenUnitCost: 0.08,
  messageUnitCost: 0.05,
  active: true,
};

export function PlansPanel({ plans, reload }: { plans: any[]; reload: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(DEFAULT_PLAN);
  const [saving, setSaving] = useState(false);
  const [pricing, setPricing] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const pr = await adminApi.get("/api/admin/token-pricing");
      if (pr.ok) setPricing(pr.data);
    })();
  }, []);

  // Custo real (BRL) da franquia de tokens do plano no modelo global ativo.
  const realTokenCost = pricing
    ? ((Number(form.maxTokens) || 0) / 1_000_000) * pricing.activeModelCostBRLPer1M
    : 0;

  // Custo real da franquia de DISPAROS: quantidade × tarifa da categoria que
  // o plano promete. Este é o custo que antes passava batido — uma franquia
  // grande de marketing pode custar mais que todos os tokens do plano.
  // Conversa custa as mensagens de serviço trocadas dentro dela. Hoje a Meta
  // não cobra serviço, então isto dá zero — e passa a somar sozinho quando a
  // tarifa for preenchida (a cobrança começa em outubro/2026).
  const MSGS_POR_CONVERSA = 8;
  const unidadeServico = form.whatsappMode === "BAILEYS" ? null : pricing?.waUnit?.SERVICE;
  const qtdConversas = Number(form.maxConversations) || 0;
  const realConversationCost = unidadeServico
    ? unidadeServico.unitCostBrl * qtdConversas * MSGS_POR_CONVERSA
    : 0;

  // No QR Code a Meta não cobra por mensagem — o custo é manter o número de
  // pé. Somar tarifa de disparo num plano de QR Code inventaria custo.
  const soQrCode = form.whatsappMode === "BAILEYS";
  const custoNumero = Number(pricing?.baileysNumberCost || 0);
  const realBaileysCost = soQrCode ? custoNumero * Math.max(1, Number(form.maxWhatsAppNumbers) || 1) : 0;

  const unidadeDisparo = soQrCode ? null : pricing?.waUnit?.[form.campaignCategory || "MARKETING"];
  const qtdDisparos = Number(form.maxCampaignMessages) || 0;
  const realCampaignCost = unidadeDisparo ? unidadeDisparo.unitCostBrl * qtdDisparos : 0;
  const campaignSalePrice = unidadeDisparo ? unidadeDisparo.unitPriceBrl * qtdDisparos : 0;

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const openNew = () => { setForm(DEFAULT_PLAN); setOpen(true); };
  const openEdit = (p: any) => {
    setForm({
      ...DEFAULT_PLAN,
      ...p,
      maxUsers: p.maxUsers ?? 2,
      maxWhatsAppNumbers: p.maxWhatsAppNumbers ?? 1,
      maxKnowledgeBaseChars: p.maxKnowledgeBaseChars ?? 50000,
      whatsappMode: p.whatsappMode || "BOTH",
      maxConversations: p.maxConversations ?? 0,
      maxCampaignMessages: p.maxCampaignMessages ?? 0,
      campaignCategory: p.campaignCategory || "MARKETING",
      enableCalendar: p.enableCalendar ?? true,
      enableAutomations: p.enableAutomations ?? true,
      enableWebhooks: p.enableWebhooks ?? false,
      enableVoice: p.enableVoice ?? false,
      enablePremiumVoice: p.enablePremiumVoice ?? false,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast({ title: "Dê um nome ao plano", variant: "destructive" });
    setSaving(true);
    const payload = {
      name: form.name,
      priceMonthly: Number(form.priceMonthly),
      priceYearly: Number(form.priceYearly || form.priceMonthly * 10),
      maxLeads: Number(form.maxLeads),
      maxSdrs: Number(form.maxSdrs),
      maxUsers: Number(form.maxUsers),
      maxWhatsAppNumbers: Number(form.maxWhatsAppNumbers),
      maxKnowledgeBaseChars: Number(form.maxKnowledgeBaseChars),
      maxTokens: Number(form.maxTokens),
      maxMessages: Number(form.maxMessages),
      whatsappMode: form.whatsappMode || "BOTH",
      maxConversations: Number(form.maxConversations),
      maxCampaignMessages: Number(form.maxCampaignMessages),
      campaignCategory: form.campaignCategory || "MARKETING",
      enableSdr: !!form.enableSdr,
      enableTokens: !!form.enableTokens,
      enableMessages: !!form.enableMessages,
      enableCalendar: !!form.enableCalendar,
      enableAutomations: !!form.enableAutomations,
      enableWebhooks: !!form.enableWebhooks,
      enableVoice: !!form.enableVoice,
      enablePremiumVoice: !!form.enablePremiumVoice,
      // Custo real do plano hoje = só tokens (auto, do modelo ativo). Agente e
      // mensagem não têm custo, então gravamos 0 nesses campos legados.
      sdrUnitCost: 0,
      tokenUnitCost: pricing ? Number((pricing.activeModelCostBRLPer1M / 1000).toFixed(4)) : Number(form.tokenUnitCost),
      messageUnitCost: 0,
      active: form.active !== false,
    };
    const res = form.id
      ? await adminApi.put(`/api/admin/plans/${form.id}`, payload)
      : await adminApi.post("/api/admin/plans", payload);
    setSaving(false);
    if (res.ok) {
      toast({ title: form.id ? "Plano atualizado" : "Plano criado" });
      setOpen(false);
      reload();
    } else {
      toast({ title: "Erro ao salvar plano", description: res.data?.error, variant: "destructive" });
    }
  };

  const remove = async (p: any) => {
    if (!confirm(`Excluir o plano "${p.name}"? Clientes vinculados ficam sem plano.`)) return;
    const res = await adminApi.del(`/api/admin/plans/${p.id}`);
    if (res.ok) { toast({ title: "Plano excluído" }); reload(); }
    else toast({ title: "Erro ao excluir", description: res.data?.error, variant: "destructive" });
  };

  // Simulador de margem: o plano tem DOIS custos variáveis — os tokens de IA
  // e os disparos no WhatsApp. Considera o pior caso (cliente usa a franquia
  // inteira), que é o cenário que o preço precisa cobrir.
  const simCost = realTokenCost + realCampaignCost + realConversationCost + realBaileysCost;
  const simPrice = Number(form.priceMonthly) || 0;
  const simProfit = simPrice - simCost;
  const simMargin = simPrice > 0 ? (simProfit / simPrice) * 100 : 0;
  // Cada custo tem a sua margem, configurada na administração do SaaS.
  const suggestedPlanPrice = pricing
    ? Number((realTokenCost * (pricing.tokenMarkup || 5) + campaignSalePrice + realBaileysCost * (pricing.waMarkup || 2)).toFixed(2))
    : 0;
  const precoAbaixoDoCusto = simPrice > 0 && simPrice < simCost;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo plano</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="rounded-2xl border-border p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <p className="text-lg font-bold text-foreground">R$ {p.priceMonthly}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                </div>
              </div>
              {p.active === false && <Badge className="bg-slate-200 text-slate-600 border-none text-xs">Inativo</Badge>}
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>{p.maxSdrs} agente(s) · {(p.maxTokens / 1000).toLocaleString("pt-BR")}k tokens</li>
              <li>{p.maxMessages?.toLocaleString("pt-BR")} msgs · {p.maxLeads?.toLocaleString("pt-BR")} contatos</li>
              <li>{p.maxWhatsAppNumbers ?? 1} nº WhatsApp · {p.maxUsers ?? 2} usuários</li>
              <li>
                {p.whatsappMode === "BAILEYS"
                  ? "WhatsApp por QR Code"
                  : p.whatsappMode === "OFFICIAL"
                    ? "WhatsApp API oficial"
                    : "QR Code ou API oficial"}
              </li>
              <li>
                {(p.maxConversations ?? 0) > 0
                  ? `${(p.maxConversations).toLocaleString("pt-BR")} conversas/mês`
                  : "conversas ilimitadas"}
              </li>
              <li>
                {(p.maxCampaignMessages ?? 0) > 0
                  ? `${(p.maxCampaignMessages).toLocaleString("pt-BR")} disparos/mês · ${String(p.campaignCategory || "MARKETING").toLowerCase()}`
                  : "sem disparo em massa"}
              </li>
              {/* Margem no card: dá para varrer a lista e achar plano no vermelho. */}
              {pricing && (() => {
                const unidade = pricing.waUnit?.[p.campaignCategory || "MARKETING"];
                const custo =
                  ((p.maxTokens || 0) / 1_000_000) * pricing.activeModelCostBRLPer1M +
                  (unidade ? unidade.unitCostBrl * (p.maxCampaignMessages || 0) : 0);
                const preco = Number(p.priceMonthly) || 0;
                const negativo = preco > 0 && preco < custo;
                return (
                  <li className={negativo ? "text-rose-600 font-medium" : ""}>
                    Custo máx. {brl(custo)}
                    {preco > 0 && ` · margem ${(((preco - custo) / preco) * 100).toFixed(0)}%`}
                  </li>
                );
              })()}
              <li>
                {[p.enableCalendar && "Calendar", p.enableAutomations && "Automações", p.enableWebhooks && "Webhooks"].filter(Boolean).join(" · ") || "Sem extras"}
              </li>
            </ul>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEdit(p)}>
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
              <button onClick={() => remove(p)} className="p-2 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? `Editar plano: ${form.name}` : "Novo plano"}</DialogTitle></DialogHeader>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Preço mensal (R$)</Label>
                  <Input type="number" value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Preço anual (R$)</Label>
                  <Input type="number" value={form.priceYearly} onChange={(e) => setForm({ ...form, priceYearly: e.target.value })} />
                </div>
              </div>

              <div className="rounded-xl bg-muted p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground uppercase">Módulos incluídos</p>
                {[
                  ["enableSdr", "Agentes de IA (SDR)"],
                  ["enableTokens", "Créditos de IA (tokens)"],
                  ["enableMessages", "Mensagens WhatsApp"],
                  ["enableCalendar", "Google Calendar"],
                  ["enableAutomations", "Automações / Lembretes"],
                  ["enableWebhooks", "Webhooks / API pública"],
                  ["enableVoice", "Voz — ouvir e responder áudio"],
                  ["enablePremiumVoice", "Vozes premium (ElevenLabs)"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="text-xs text-foreground">{label}</Label>
                    <Switch checked={!!form[key]} onCheckedChange={(v) => setForm({ ...form, [key]: v })} />
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <Label className="text-xs text-foreground">Plano visível/ativo</Label>
                  <Switch checked={form.active !== false} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["maxSdrs", "Agentes de IA"],
                  ["maxTokens", "Tokens/mês"],
                  ["maxMessages", "Mensagens/mês"],
                  ["maxLeads", "Contatos"],
                  ["maxUsers", "Usuários"],
                  ["maxWhatsAppNumbers", "Nºs WhatsApp"],
                  ["maxCampaignMessages", "Disparos em massa/mês"],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input type="number" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  </div>
                ))}
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">Canal de WhatsApp</Label>
                  <Select
                    value={form.whatsappMode || "BOTH"}
                    onValueChange={(v) => setForm({ ...form, whatsappMode: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OFFICIAL">API oficial (Meta Cloud) — cobra por mensagem</SelectItem>
                      <SelectItem value="BAILEYS">QR Code — sem custo por mensagem</SelectItem>
                      <SelectItem value="BOTH">Os dois — o cliente escolhe</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {form.whatsappMode === "BAILEYS"
                      ? "Canal não oficial: sem tarifa da Meta, mas o número do cliente pode ser bloqueado por ela. O custo aqui é a infraestrutura da sessão."
                      : form.whatsappMode === "OFFICIAL"
                        ? "Canal oficial: cada template entregue é cobrado pela Meta, conforme a tarifa da categoria."
                        : "O cliente pode conectar pelos dois. O custo do plano assume o pior caso (oficial)."}
                  </p>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">Conversas/mês</Label>
                  <Input
                    type="number"
                    value={form.maxConversations}
                    onChange={(e) => setForm({ ...form, maxConversations: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Janelas de atendimento de 24h abertas por clientes. <strong>0</strong> = sem limite.
                    Ao esgotar, o agente para de abrir conversa nova e o contato vai para a fila humana.
                  </p>
                </div>
                <p className="col-span-2 text-[11px] text-muted-foreground -mt-1">
                  Disparos em massa: <strong>0</strong> desliga o recurso no plano.
                </p>
                {qtdDisparos > 0 && (
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs text-muted-foreground">Categoria da franquia de disparo</Label>
                    <Select
                      value={form.campaignCategory || "MARKETING"}
                      onValueChange={(v) => setForm({ ...form, campaignCategory: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MARKETING">Marketing — promoções (mais cara)</SelectItem>
                        <SelectItem value="UTILITY">Utilidade — lembretes e confirmações</SelectItem>
                        <SelectItem value="AUTHENTICATION">Autenticação — códigos</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      A Meta cobra tarifas diferentes por categoria. Escolha a que o plano promete —
                      é ela que define o custo da franquia.
                    </p>
                  </div>
                )}
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">Treino do agente (caracteres máx.)</Label>
                  <Input type="number" value={form.maxKnowledgeBaseChars} onChange={(e) => setForm({ ...form, maxKnowledgeBaseChars: e.target.value })} />
                </div>
              </div>

              {/* Custo & margem — baseado no custo REAL dos tokens (auto) */}
              <div className="rounded-xl bg-muted p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground uppercase">Custo & margem</p>
                  {pricing && (
                    <span className="text-[11px] text-muted-foreground">modelo: {pricing.activeModel}</span>
                  )}
                </div>

                {pricing ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Custo real dos tokens ({((Number(form.maxTokens) || 0) / 1000).toLocaleString("pt-BR")}k/mês)
                      </span>
                      <span className="font-semibold text-foreground tabular-nums">{brl(realTokenCost)}</span>
                    </div>
                    {realBaileysCost > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Infraestrutura QR Code ({Math.max(1, Number(form.maxWhatsAppNumbers) || 1)} número(s))
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">{brl(realBaileysCost)}</span>
                      </div>
                    )}
                    {soQrCode && custoNumero === 0 && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        O custo por número no QR Code está zerado em Configurações → Custo de disparo.
                        Enquanto isso, este plano aparece como se não custasse nada.
                      </p>
                    )}
                    {realConversationCost > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Custo real das conversas ({qtdConversas.toLocaleString("pt-BR")} × ~{MSGS_POR_CONVERSA} msgs)
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">{brl(realConversationCost)}</span>
                      </div>
                    )}
                    {qtdDisparos > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Custo real dos disparos ({qtdDisparos.toLocaleString("pt-BR")} {String(form.campaignCategory || "marketing").toLowerCase()})
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">{brl(realCampaignCost)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                      <span className="font-medium text-foreground">Custo total do plano</span>
                      <span className="font-bold text-foreground tabular-nums">{brl(simCost)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Preço sugerido (IA {pricing.tokenMarkup || 5}x{qtdDisparos > 0 ? ` · disparo ${pricing.waMarkup || 2}x` : ""})
                      </span>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, priceMonthly: suggestedPlanPrice })}
                        className="font-semibold text-primary hover:underline tabular-nums"
                      >
                        {brl(suggestedPlanPrice)} <span className="text-[11px] font-normal">· usar</span>
                      </button>
                    </div>
                    {precoAbaixoDoCusto && (
                      <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                        O preço deste plano está <strong>abaixo do custo</strong>: se o cliente usar toda a
                        franquia, cada mensalidade dá prejuízo de {brl(simCost - simPrice)}.
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      As margens (IA e disparo) são definidas em Configurações → Precificação.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-amber-600">
                    Não foi possível carregar a tabela de custos. Verifique o modelo ativo em Configurações.
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-slate-900 text-white p-4">
                <p className="text-[10px] uppercase text-slate-400 font-semibold mb-2">Margem do plano (uso máximo da franquia)</p>
                <div className="grid grid-cols-3 text-center gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Custo total</p>
                    <p className="text-sm font-bold text-rose-300">{brl(simCost)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Lucro</p>
                    <p className={`text-sm font-bold ${simProfit >= 0 ? "text-emerald-300" : "text-rose-400"}`}>{brl(simProfit)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Margem</p>
                    <p className={`text-sm font-bold ${simMargin >= 50 ? "text-emerald-300" : simMargin >= 10 ? "text-amber-300" : "text-rose-400"}`}>{simMargin.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
