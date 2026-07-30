import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Merge, CheckCircle2, Phone, Mail } from "lucide-react";

/**
 * Duplicatas que sobraram da base antiga.
 *
 * Cadastro novo não duplica mais — o CDP resolve na entrada. Mas o que já
 * estava gravado continua lá, e juntar contato é irreversível: por isso a
 * tela mostra o que dá para juntar e deixa a decisão com o usuário, em vez
 * de sair fundindo sozinha.
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

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await fetch("/api/contacts/duplicates", { headers: auth() }).then((x) => x.json());
      const lista: Grupo[] = r.grupos || [];
      setGrupos(lista);
      // Por padrão fica o mais antigo: é o que tem mais histórico ligado.
      setPrincipal(Object.fromEntries(lista.map((g, i) => [i, g.contatos[0]?.id])));
    } catch {
      toast({ title: "Não consegui carregar as duplicatas", variant: "destructive" });
    }
    setCarregando(false);
  };

  useEffect(() => { if (open) carregar(); }, [open]);

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

        {carregando ? (
          <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
        ) : grupos.length === 0 ? (
          <div className="space-y-2 py-10 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">Nenhuma duplicata.</p>
            <p className="text-sm text-muted-foreground">
              Cadastros novos já não duplicam: o mesmo telefone ou e-mail sempre cai no mesmo contato.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escolha qual contato fica. O resto vira ele — conversas, agendamentos e histórico juntos.
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
