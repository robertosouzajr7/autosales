import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Merge, CheckCircle2, Phone, Mail } from "lucide-react";

/**
 * O que ainda depende de uma decisão humana.
 *
 * Cadastro com telefone ou e-mail repetido não chega mais aqui: identificador
 * igual é a mesma pessoa, e a unificação acontece sozinha — na entrada, pelo
 * CDP, e de hora em hora sobre o que escapou. Esta tela ficou com o caso em
 * que a máquina não tem como saber: contatos que só dividem o NOME. "João
 * Silva" e "João Silva" sem nada em comum podem ser duas pessoas, e juntar
 * duas pessoas não tem volta.
 */

const auth = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

type Contato = { id: string; name: string; phone?: string | null; email?: string | null; createdAt?: string };
type Grupo = { motivo: string; valor: string; contatos: Contato[]; confianca?: "ALTA" | "BAIXA" };

export function DuplicatesDialog({
  open, onOpenChange, onMerged,
}: { open: boolean; onOpenChange: (v: boolean) => void; onMerged: () => void }) {
  const { toast } = useToast();
  const [carregando, setCarregando] = useState(false);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [principal, setPrincipal] = useState<Record<number, string>>({});
  const [fundindo, setFundindo] = useState<number | null>(null);
  const [unificadosNoDia, setUnificadosNoDia] = useState(0);
  const [varrendo, setVarrendo] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await fetch("/api/contacts/duplicates", { headers: auth() }).then((x) => x.json());
      const lista: Grupo[] = r.grupos || [];
      setGrupos(lista);
      setUnificadosNoDia(r.unificadosNoDia || 0);
      // Por padrão fica o mais antigo: é o que tem mais histórico ligado.
      setPrincipal(Object.fromEntries(lista.map((g, i) => [i, g.contatos[0]?.id])));
    } catch {
      toast({ title: "Não consegui carregar as duplicatas", variant: "destructive" });
    }
    setCarregando(false);
  };

  useEffect(() => { if (open) carregar(); }, [open]);

  /** Varre a base inteira agora, sem esperar a passagem automática. */
  const unificarAgora = async () => {
    setVarrendo(true);
    try {
      const res = await fetch("/api/contacts/deduplicate", { method: "POST", headers: auth() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({
        title: data.fundidos ? `${data.fundidos} contato(s) unificado(s)` : "Nada a unificar",
        description: data.fundidos
          ? `Reunidos em ${data.grupos} pessoa(s). O histórico foi todo junto.`
          : "Nenhum cadastro com telefone ou e-mail repetido na base.",
      });
      onMerged();
      await carregar();
    } catch (e: any) {
      toast({ title: "Não consegui unificar", description: e.message, variant: "destructive" });
    }
    setVarrendo(false);
  };

  const fundir = async (grupo: Grupo, indice: number) => {
    const canonicalId = principal[indice];
    const ids = grupo.contatos.map((c) => c.id).filter((id) => id !== canonicalId);
    if (!canonicalId || !ids.length) return;
    const escolhido = grupo.contatos.find((c) => c.id === canonicalId);
    if (!confirm(
      `Juntar ${ids.length + 1} contatos em "${escolhido?.name}"?\n\n` +
      `Conversas, agendamentos e histórico vão todos para ele. Não dá para desfazer.`
    )) return;

    setFundindo(indice);
    const res = await fetch("/api/contacts/merge", {
      method: "POST", headers: auth(), body: JSON.stringify({ canonicalId, ids }),
    });
    const data = await res.json();
    setFundindo(null);
    if (!res.ok) return toast({ title: "Erro ao juntar", description: data.error, variant: "destructive" });
    toast({ title: `${data.fundidos} contato(s) juntado(s)`, description: "O histórico foi todo para o contato escolhido." });
    onMerged();
    carregar();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>Contatos repetidos</DialogTitle></DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3">
          <p className="text-sm text-emerald-900">
            {unificadosNoDia > 0 ? (
              <><strong>{unificadosNoDia}</strong> contato(s) unificado(s) automaticamente nas últimas 24 h.</>
            ) : (
              <>Telefone ou e-mail repetido é unificado automaticamente, em todos os canais.</>
            )}
          </p>
          <Button
            size="sm" variant="outline" onClick={unificarAgora} disabled={varrendo}
            className="h-8 gap-1.5 rounded-lg border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
          >
            {varrendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Merge className="h-3.5 w-3.5" />}
            Varrer a base agora
          </Button>
        </div>

        {carregando ? (
          <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
        ) : grupos.length === 0 ? (
          <div className="space-y-2 py-10 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">Nada pendente.</p>
            <p className="text-sm text-muted-foreground">
              Não há contatos com o mesmo nome esperando decisão. O que tem identificador repetido
              já foi unificado sozinho.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Estes têm o mesmo nome e nenhum telefone ou e-mail em comum — podem ser a mesma pessoa
              em duas fichas, ou dois homônimos. Escolha qual fica; o resto vira ele, com conversas,
              agendamentos e histórico juntos.
            </p>

            {grupos.map((g, i) => (
              <div key={`${g.valor}-${i}`} className="space-y-2 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-none bg-amber-100 text-amber-800 text-xs">{g.motivo}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{g.valor}</span>
                  {g.confianca === "BAIXA" && (
                    <span className="text-xs text-muted-foreground">
                      — sem telefone nem e-mail em comum. Confira antes de juntar: pode ser homônimo.
                    </span>
                  )}
                </div>

                <div className="divide-y divide-border">
                  {g.contatos.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-3 py-2">
                      <input
                        type="radio"
                        name={`principal-${i}`}
                        checked={principal[i] === c.id}
                        onChange={() => setPrincipal({ ...principal, [i]: c.id })}
                        className="h-4 w-4 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                        <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                          {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                          {c.createdAt && <span>criado em {new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>}
                        </p>
                      </div>
                      {principal[i] === c.id && (
                        <Badge className="border-none bg-primary/10 text-primary text-xs">Fica este</Badge>
                      )}
                    </label>
                  ))}
                </div>

                <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => fundir(g, i)} disabled={fundindo === i}>
                  {fundindo === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Merge className="h-3.5 w-3.5" />}
                  Juntar em um só
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DuplicatesDialog;
