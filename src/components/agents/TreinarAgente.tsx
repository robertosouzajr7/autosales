import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertTriangle, Check, FileUp, Loader2, Mic, Square, Trash2, Type, Upload,
} from "lucide-react";
import { enviarArquivo } from "@/lib/enviarArquivo";

/**
 * Treinar o agente com material do negócio — e conferir antes de valer.
 *
 * Jogar o texto cru de um PDF na base é como o agente passa a responder com
 * o que estava no rodapé do documento. Aqui o material vira itens discretos,
 * e nenhum entra sem o dono ler: ele é quem sabe se o que a máquina entendeu
 * é o que o negócio faz.
 */

const auth = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

type Item = {
  id: string; pergunta: string; resposta: string; trecho?: string | null;
  origem: string; arquivo?: string | null;
};

const ORIGEM: Record<string, string> = {
  DOCUMENTO: "documento", PLANILHA: "planilha", AUDIO: "gravação", TEXTO: "texto colado",
};

export function TreinarAgente({
  open, onOpenChange, sdrId, aoConsolidar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sdrId: string;
  aoConsolidar: (knowledgeBase: string) => void;
}) {
  const { toast } = useToast();
  const campo = useRef<HTMLInputElement>(null);
  const [modo, setModo] = useState<"arquivo" | "gravar" | "texto">("arquivo");
  const [texto, setTexto] = useState("");
  const [lendo, setLendo] = useState(false);
  const [itens, setItens] = useState<Item[]>([]);
  const [descartados, setDescartados] = useState<Set<string>>(new Set());
  const [edicoes, setEdicoes] = useState<Record<string, { pergunta: string; resposta: string }>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Gravação
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const cronometro = useRef<any>(null);

  useEffect(() => {
    if (!open) return;
    setItens([]); setDescartados(new Set()); setEdicoes({}); setAviso(null); setTexto("");
    // Material de uma sessão anterior que ficou sem decisão: retoma em vez de
    // deixar o dono achar que perdeu o trabalho.
    fetch(`/api/sdrs/${sdrId}/knowledge/pending`, { headers: auth() })
      .then((r) => r.json())
      .then((d) => { if (d.itens?.length) { setItens(d.itens); setAviso("Você tem itens de um envio anterior esperando decisão."); } })
      .catch(() => {});
  }, [open, sdrId]);

  useEffect(() => () => { pararCronometro(); }, []);

  const pararCronometro = () => { clearInterval(cronometro.current); cronometro.current = null; };

  const receber = (dados: any) => {
    setItens(dados.itens || []);
    setDescartados(new Set());
    setEdicoes({});
    setAviso(
      [
        dados.extraidoPorIA ? null : `Extração sem IA${dados.motivo ? ` (${dados.motivo})` : ""} — confira com atenção.`,
        dados.truncado ? "O material é grande: li o começo dele. Envie o resto em outro arquivo." : null,
      ].filter(Boolean).join(" ") || null
    );
  };

  const enviarMaterial = async (arquivo: File) => {
    setLendo(true);
    const r = await enviarArquivo<any>(`/api/sdrs/${sdrId}/knowledge/extract`, arquivo);
    setLendo(false);
    if (!r.ok) return toast({ title: "Não consegui ler o material", description: r.erro, variant: "destructive" });
    receber(r.dados);
  };

  const enviarTexto = async () => {
    if (texto.trim().length < 30) return toast({ title: "Cole um texto um pouco maior", variant: "destructive" });
    setLendo(true);
    try {
      const res = await fetch(`/api/sdrs/${sdrId}/knowledge/extract`, {
        method: "POST", headers: auth(), body: JSON.stringify({ texto }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      receber(d);
    } catch (e: any) {
      toast({ title: "Não consegui ler o texto", description: e.message, variant: "destructive" });
    }
    setLendo(false);
  };

  const comecarGravacao = async () => {
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(fluxo);
      pedacos.current = [];
      rec.ondataavailable = (e) => e.data.size && pedacos.current.push(e.data);
      rec.onstop = async () => {
        fluxo.getTracks().forEach((t) => t.stop());
        const blob = new Blob(pedacos.current, { type: "audio/webm" });
        await enviarMaterial(new File([blob], "treinamento.webm", { type: "audio/webm" }));
      };
      rec.start();
      gravador.current = rec;
      setGravando(true);
      setSegundos(0);
      cronometro.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    } catch {
      toast({
        title: "Não consegui acessar o microfone",
        description: "Autorize o microfone no navegador e tente de novo.",
        variant: "destructive",
      });
    }
  };

  const pararGravacao = () => {
    gravador.current?.stop();
    gravador.current = null;
    setGravando(false);
    pararCronometro();
  };

  const valorDe = (i: Item, campo: "pergunta" | "resposta") => edicoes[i.id]?.[campo] ?? i[campo];

  const editar = (i: Item, campo: "pergunta" | "resposta", valor: string) =>
    setEdicoes((e) => ({
      ...e,
      [i.id]: { pergunta: valorDe(i, "pergunta"), resposta: valorDe(i, "resposta"), [campo]: valor },
    }));

  const alternar = (id: string) =>
    setDescartados((d) => {
      const n = new Set(d);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const mantidos = itens.filter((i) => !descartados.has(i.id));

  const consolidar = async () => {
    setSalvando(true);
    try {
      const res = await fetch(`/api/sdrs/${sdrId}/knowledge/consolidate`, {
        method: "POST",
        headers: auth(),
        body: JSON.stringify({
          decisoes: itens.map((i) => ({
            id: i.id,
            manter: !descartados.has(i.id),
            pergunta: valorDe(i, "pergunta"),
            resposta: valorDe(i, "resposta"),
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({
        title: `${d.aprovados} item(ns) no conhecimento do agente`,
        description: d.recusados ? `${d.recusados} descartado(s).` : "O agente já pode usar a partir da próxima conversa.",
      });
      aoConsolidar(d.knowledgeBase || "");
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Não consegui salvar", description: e.message, variant: "destructive" });
    }
    setSalvando(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>Treinar o agente</DialogTitle></DialogHeader>

        {!itens.length && (
          <>
            <p className="text-sm text-muted-foreground">
              Envie um documento, uma planilha ou grave uma explicação falando. Eu transformo em perguntas e
              respostas, e você confere item a item antes de qualquer coisa entrar na base.
            </p>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "arquivo", rotulo: "Arquivo", Icone: FileUp },
                { id: "gravar", rotulo: "Gravar voz", Icone: Mic },
                { id: "texto", rotulo: "Colar texto", Icone: Type },
              ].map(({ id, rotulo, Icone }) => (
                <button
                  key={id}
                  onClick={() => setModo(id as any)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    modo === id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  <Icone className="h-3.5 w-3.5" /> {rotulo}
                </button>
              ))}
            </div>

            {modo === "arquivo" && (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <input
                  ref={campo} type="file" className="hidden"
                  accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.mp3,.ogg,.opus,.wav,.m4a,.webm,.aac,.amr"
                  onChange={(e) => e.target.files?.[0] && enviarMaterial(e.target.files[0])}
                />
                <Button variant="outline" onClick={() => campo.current?.click()} disabled={lendo} className="gap-2">
                  {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Escolher arquivo
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">PDF, DOCX, XLSX, CSV, TXT ou áudio. Até 40 MB.</p>
              </div>
            )}

            {modo === "gravar" && (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                {lendo ? (
                  <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Transcrevendo e lendo a gravação…
                  </p>
                ) : gravando ? (
                  <>
                    <Button onClick={pararGravacao} variant="destructive" className="gap-2">
                      <Square className="h-4 w-4" /> Parar ({String(Math.floor(segundos / 60)).padStart(2, "0")}:
                      {String(segundos % 60).padStart(2, "0")})
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">Gravando. Fale como explicaria para um funcionário novo.</p>
                  </>
                ) : (
                  <>
                    <Button onClick={comecarGravacao} className="gap-2">
                      <Mic className="h-4 w-4" /> Começar a gravar
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Explique falando: o que vocês fazem, como funciona, o que o cliente sempre pergunta.
                    </p>
                  </>
                )}
              </div>
            )}

            {modo === "texto" && (
              <div className="space-y-2">
                <Textarea
                  rows={8} value={texto} onChange={(e) => setTexto(e.target.value)}
                  placeholder="Cole aqui o texto do seu material de treinamento."
                  className="resize-none text-[13.5px]"
                />
                <Button onClick={enviarTexto} disabled={lendo} className="gap-2">
                  {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Extrair conhecimento
                </Button>
              </div>
            )}
          </>
        )}

        {itens.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-none bg-emerald-100 text-emerald-800">{mantidos.length} para guardar</Badge>
              {descartados.size > 0 && (
                <Badge className="border-none bg-muted text-muted-foreground">{descartados.size} descartado(s)</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                de {ORIGEM[itens[0].origem] || "material"}
                {itens[0].arquivo ? ` · ${itens[0].arquivo}` : ""}
              </span>
            </div>

            {aviso && (
              <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] leading-snug text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {aviso}
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              Confira cada item. Pode corrigir o texto aqui mesmo — o que você escrever é o que o agente vai dizer.
            </p>

            <div className="space-y-2.5">
              {itens.map((i) => {
                const fora = descartados.has(i.id);
                return (
                  <div
                    key={i.id}
                    className={`rounded-xl border p-3.5 transition-opacity ${fora ? "border-border bg-muted/30 opacity-50" : "border-border"}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Input
                          value={valorDe(i, "pergunta")}
                          onChange={(e) => editar(i, "pergunta", e.target.value)}
                          disabled={fora}
                          className="h-8 text-[13px] font-semibold"
                        />
                        <Textarea
                          value={valorDe(i, "resposta")}
                          onChange={(e) => editar(i, "resposta", e.target.value)}
                          disabled={fora}
                          rows={3}
                          className="resize-none text-[13px]"
                        />
                        {i.trecho && (
                          <p className="text-[11px] italic text-muted-foreground">do material: “{i.trecho}”</p>
                        )}
                      </div>
                      <button
                        onClick={() => alternar(i.id)}
                        title={fora ? "Trazer de volta" : "Descartar"}
                        className={`shrink-0 rounded-lg p-1.5 transition-colors ${
                          fora ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {fora ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={() => setItens([])}>Enviar outro material</Button>
              <Button onClick={consolidar} disabled={!mantidos.length || salvando} className="gap-2">
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Guardar {mantidos.length} item(ns)
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TreinarAgente;
