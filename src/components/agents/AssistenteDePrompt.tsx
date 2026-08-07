import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Wand2 } from "lucide-react";

/**
 * Montagem guiada do prompt do agente.
 *
 * Pedir a quem tem uma clínica que "escreva o prompt do agente" é pedir uma
 * habilidade que ele não tem motivo para ter — e o resultado é sempre uma
 * linha ("seja simpático e agende"), com um agente que inventa preço e
 * discute com cliente irritado.
 *
 * Aqui ele responde oito perguntas sobre o próprio negócio, uma por tela, e
 * recebe o prompt completo para ler e editar antes de salvar.
 */

const auth = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

type Pergunta = {
  id: string; pergunta: string; ajuda?: string; tipo: string;
  exemplo?: string; obrigatoria?: boolean;
  opcoes?: { valor: string; rotulo: string }[];
};

export function AssistenteDePrompt({
  open, onOpenChange, agentFunction, skills, aoGerar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agentFunction?: string;
  skills?: string[];
  aoGerar: (prompt: string) => void;
}) {
  const { toast } = useToast();
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [passo, setPasso] = useState(0);
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<{ prompt: string; geradoPorIA: boolean; motivo?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setPasso(0);
    setResultado(null);
    fetch("/api/sdrs/prompt/questionario", { headers: auth() })
      .then((r) => r.json())
      .then((d) => setPerguntas(d.questionario || []))
      .catch(() => toast({ title: "Não consegui carregar as perguntas", variant: "destructive" }));
  }, [open]);

  const atual = perguntas[passo];
  const ultima = passo === perguntas.length - 1;
  const podeAvancar = !atual?.obrigatoria || String(respostas[atual.id] || "").trim().length > 0;

  const gerar = async () => {
    setGerando(true);
    try {
      const res = await fetch("/api/sdrs/prompt/gerar", {
        method: "POST",
        headers: auth(),
        body: JSON.stringify({ respostas, agentFunction, skills }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setResultado(d);
    } catch (e: any) {
      toast({ title: "Não consegui gerar o prompt", description: e.message, variant: "destructive" });
    }
    setGerando(false);
  };

  const usar = () => {
    if (!resultado) return;
    aoGerar(resultado.prompt);
    onOpenChange(false);
    toast({ title: "Prompt aplicado", description: "Revise e salve o agente para valer." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            {resultado ? "O prompt do seu agente" : "Montar o prompt do agente"}
          </DialogTitle>
        </DialogHeader>

        {!resultado && (
          <>
            <p className="text-sm text-muted-foreground">
              Oito perguntas sobre o seu negócio — nenhuma sobre IA. Preço, horário e equipe não são
              perguntados: o agente já lê esses dados ao vivo a cada conversa.
            </p>

            {/* Barra de progresso: saber quanto falta é o que faz terminar. */}
            <div className="flex gap-1">
              {perguntas.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full ${i <= passo ? "bg-primary" : "bg-border"}`}
                />
              ))}
            </div>

            {atual && (
              <div className="space-y-2 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label className="text-[15px] font-semibold text-foreground">{atual.pergunta}</Label>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {passo + 1} de {perguntas.length}
                  </span>
                </div>
                {atual.ajuda && <p className="text-[13px] text-muted-foreground">{atual.ajuda}</p>}

                {atual.tipo === "escolha" ? (
                  <div className="space-y-1.5 pt-1">
                    {atual.opcoes?.map((o) => (
                      <button
                        key={o.valor}
                        onClick={() => setRespostas({ ...respostas, [atual.id]: o.valor })}
                        className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] transition-colors ${
                          respostas[atual.id] === o.valor
                            ? "border-primary bg-primary/5 font-medium text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                            respostas[atual.id] === o.valor ? "border-primary bg-primary" : "border-border"
                          }`}
                        >
                          {respostas[atual.id] === o.valor && <Check className="h-2.5 w-2.5 text-white" />}
                        </span>
                        {o.rotulo}
                      </button>
                    ))}
                  </div>
                ) : atual.tipo === "texto_longo" ? (
                  <Textarea
                    autoFocus
                    rows={5}
                    value={respostas[atual.id] || ""}
                    onChange={(e) => setRespostas({ ...respostas, [atual.id]: e.target.value })}
                    placeholder={atual.exemplo}
                    className="resize-none text-[13.5px]"
                  />
                ) : (
                  <Input
                    autoFocus
                    value={respostas[atual.id] || ""}
                    onChange={(e) => setRespostas({ ...respostas, [atual.id]: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && podeAvancar && !ultima && setPasso(passo + 1)}
                    placeholder={atual.exemplo}
                    className="text-[13.5px]"
                  />
                )}

                {atual.exemplo && atual.tipo !== "escolha" && (
                  <p className="text-xs text-muted-foreground">
                    Exemplo: <span className="italic">{atual.exemplo.split("\n").join(" · ")}</span>
                  </p>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                variant="ghost" onClick={() => setPasso(passo - 1)} disabled={passo === 0}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              {ultima ? (
                <Button onClick={gerar} disabled={!podeAvancar || gerando} className="gap-2">
                  {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar o prompt
                </Button>
              ) : (
                <Button onClick={() => setPasso(passo + 1)} disabled={!podeAvancar} className="gap-1.5">
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {resultado && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {resultado.geradoPorIA ? (
                <Badge className="border-none bg-primary/10 text-primary">Escrito pela IA</Badge>
              ) : (
                <Badge className="border-none bg-amber-100 text-amber-800">Versão base</Badge>
              )}
              {resultado.motivo && <span className="text-xs text-muted-foreground">{resultado.motivo}</span>}
            </div>

            <p className="text-sm text-muted-foreground">
              Leia antes de aplicar — esta é a voz do seu negócio. Pode editar aqui mesmo.
            </p>

            <Textarea
              value={resultado.prompt}
              onChange={(e) => setResultado({ ...resultado, prompt: e.target.value })}
              rows={20}
              className="font-mono text-[12.5px] leading-relaxed"
            />

            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={() => setResultado(null)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Rever as respostas
              </Button>
              <Button onClick={usar} className="gap-2">
                <Check className="h-4 w-4" /> Usar este prompt
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AssistenteDePrompt;
