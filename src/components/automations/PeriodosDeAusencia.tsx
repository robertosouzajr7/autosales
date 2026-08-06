import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { CalendarOff, Pencil, Plus, Save, Trash2, X } from "lucide-react";

/**
 * Períodos de ausência: feriado, recesso, viagem, inventário.
 *
 * A régua semanal responde "hoje já fechamos". O que faltava era o intervalo
 * com data — de 24/12 às 18h até 02/01 às 8h —, em que o cliente escrevia e
 * ficava sem resposta, ou recebia da IA uma promessa de retorno que ninguém
 * ia cumprir.
 */

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

/** `datetime-local` fala em hora local sem fuso; o servidor fala em ISO. */
const paraCampo = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const formatar = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const ESTADO: Record<string, { rotulo: string; classe: string }> = {
  EM_CURSO: { rotulo: "em curso", classe: "bg-amber-100 text-amber-800" },
  AGENDADO: { rotulo: "agendado", classe: "bg-accent-soft text-accent-text" },
  ENCERRADO: { rotulo: "encerrado", classe: "bg-surface-2 text-faint" },
  DESLIGADO: { rotulo: "desligado", classe: "bg-surface-2 text-faint" },
};

const VAZIO = { id: "", name: "", message: "", startsAt: "", endsAt: "", pauseAi: true, active: true };

export function PeriodosDeAusencia() {
  const { toast } = useToast();
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const res = await fetch("/api/away-periods", { headers: auth() });
      setPeriodos(res.ok ? await res.json() : []);
    } catch { /* a lista vazia já comunica */ }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    const daquiUmaHora = new Date(Date.now() + 60 * 60 * 1000);
    const fim = new Date(daquiUmaHora.getTime() + 24 * 60 * 60 * 1000);
    setForm({ ...VAZIO, startsAt: paraCampo(daquiUmaHora.toISOString()), endsAt: paraCampo(fim.toISOString()) });
  };

  const abrirEdicao = (p: any) =>
    setForm({
      id: p.id, name: p.name, message: p.message,
      startsAt: paraCampo(p.startsAt), endsAt: paraCampo(p.endsAt),
      pauseAi: p.pauseAi, active: p.active,
    });

  const salvar = async () => {
    setSalvando(true);
    const corpo = {
      name: form.name,
      message: form.message,
      // `new Date(valor-local).toISOString()` converte para UTC usando o fuso
      // do navegador, que é o do negócio — é o que a pessoa quis dizer.
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      pauseAi: form.pauseAi,
      active: form.active,
    };
    const res = await fetch(form.id ? `/api/away-periods/${form.id}` : "/api/away-periods", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify(corpo),
    });
    const d = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) return toast({ title: d.error || "Não foi possível salvar.", variant: "destructive" });
    toast({ title: form.id ? "Período atualizado" : "Período agendado" });
    setForm(null);
    carregar();
  };

  const alternar = async (p: any) => {
    const res = await fetch(`/api/away-periods/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify({ active: !p.active }),
    });
    if (res.ok) carregar();
  };

  const remover = async (p: any) => {
    if (!confirm(`Remover "${p.name}"?`)) return;
    const res = await fetch(`/api/away-periods/${p.id}`, { method: "DELETE", headers: auth() });
    if (res.ok) { toast({ title: "Período removido" }); carregar(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-lg text-[12.5px] leading-relaxed text-muted-foreground">
          Para feriado, recesso ou qualquer intervalo com data em que ninguém vai atender.
          Quem escrever nesse período recebe o aviso uma única vez — repetir a cada mensagem
          é o que faz o cliente bloquear o número.
        </p>
        {!form && (
          <Button onClick={abrirNovo} size="sm" className="h-9 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Novo período
          </Button>
        )}
      </div>

      {form && (
        <div className="space-y-3 rounded-xl border border-accent-text/30 bg-accent-soft/30 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13.5px] font-semibold text-foreground">
              {form.id ? "Editar período" : "Novo período de ausência"}
            </h3>
            <button onClick={() => setForm(null)} className="rounded-lg p-1 text-faint hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11.5px] font-semibold text-muted-foreground">Nome</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Recesso de fim de ano"
              className="h-9 text-[13px]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11.5px] font-semibold text-muted-foreground">Começa em</Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="h-9 text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px] font-semibold text-muted-foreground">Termina em</Label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="h-9 text-[13px]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11.5px] font-semibold text-muted-foreground">Mensagem enviada</Label>
            <Textarea
              rows={3}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Ex.: Olá! Estamos em recesso até 02/01. Sua mensagem foi registrada e respondemos assim que voltarmos. 💙"
              className="text-[13px]"
            />
            <p className="text-[11px] text-faint">
              É o texto exato que o cliente recebe. Diga quando vocês voltam — é a única
              informação que ele quer nesse momento.
            </p>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2">
            <span>
              <span className="block text-[12.5px] font-medium text-foreground">Silenciar a IA no período</span>
              <span className="block text-[11px] text-faint">
                Sem isto o agente responde logo depois do aviso, prometendo um atendimento que não vai acontecer.
              </span>
            </span>
            <Switch checked={form.pauseAi} onCheckedChange={(v) => setForm({ ...form, pauseAi: v })} />
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setForm(null)}>Cancelar</Button>
            <Button size="sm" onClick={salvar} disabled={salvando} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> {salvando ? "Salvando…" : "Salvar período"}
            </Button>
          </div>
        </div>
      )}

      {carregando ? (
        <Skeleton className="h-20 rounded-xl" />
      ) : periodos.length === 0 ? (
        !form && (
          <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <CalendarOff className="h-6 w-6 text-border-soft" />
            <p className="text-[13px] font-medium text-foreground">Nenhum período cadastrado</p>
            <p className="max-w-sm text-[12px] text-muted-foreground">
              Cadastre antes do feriado. Depois que o cliente já escreveu sem resposta, o aviso não serve mais.
            </p>
          </div>
        )
      ) : (
        <div className="space-y-2">
          {periodos.map((p) => {
            const estado = ESTADO[p.estado] || ESTADO.AGENDADO;
            return (
              <article
                key={p.id}
                className={`rounded-xl border border-border-soft p-4 ${p.estado === "ENCERRADO" || !p.active ? "opacity-60" : ""}`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50">
                    <CalendarOff className="h-4 w-4 text-amber-600" />
                  </span>
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-semibold text-foreground">{p.name}</h3>
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${estado.classe}`}>
                        {estado.rotulo}
                      </span>
                      {p.pauseAi && (
                        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground">
                          IA silenciada
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      {formatar(p.startsAt)} até {formatar(p.endsAt)}
                      {p.avisados > 0 && ` · ${p.avisados} contato(s) avisado(s)`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch checked={p.active} onCheckedChange={() => alternar(p)} />
                    <button
                      onClick={() => abrirEdicao(p)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remover(p)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-rose-50 hover:text-rose-600"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground">
                  {p.message}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
