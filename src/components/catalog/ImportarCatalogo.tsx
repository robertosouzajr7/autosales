import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Download, FileUp, Loader2, Upload } from "lucide-react";
import { enviarArquivo } from "@/lib/enviarArquivo";

/**
 * Importação do catálogo em duas etapas.
 *
 * A prévia existe porque importação que grava direto e só depois avisa que
 * 40 linhas falharam obriga a limpar a base na mão. Aqui o arquivo é lido,
 * mostrado como ficaria e só grava depois que o dono confere.
 */

type Item = {
  name: string; type: string; category: string | null;
  price: number | null; description: string | null;
};
type Recusada = { linha: number; erros: string[]; dados: { name: string } };
type Previa = {
  formato: string; total: number; validos: number;
  amostra: Item[]; invalidos: Recusada[]; invalidosTotal: number;
  colunasIgnoradas: string[];
};

const dinheiro = (v: number | null) =>
  v === null || v === undefined ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ImportarCatalogo({
  open, onOpenChange, aoImportar,
}: { open: boolean; onOpenChange: (v: boolean) => void; aoImportar: () => void }) {
  const { toast } = useToast();
  const campo = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState(false);

  const limpar = () => { setArquivo(null); setPrevia(null); if (campo.current) campo.current.value = ""; };

  const escolher = async (f: File | null) => {
    if (!f) return;
    setArquivo(f);
    setPrevia(null);
    setLendo(true);
    const r = await enviarArquivo<Previa>("/api/products/import?preview=1", f);
    setLendo(false);
    if (!r.ok) return toast({ title: "Não consegui ler o arquivo", description: r.erro, variant: "destructive" });
    setPrevia(r.dados!);
  };

  const gravar = async () => {
    if (!arquivo) return;
    setGravando(true);
    const r = await enviarArquivo<{ criados: number; atualizados: number; invalidosTotal: number }>(
      "/api/products/import", arquivo
    );
    setGravando(false);
    if (!r.ok) return toast({ title: "Não consegui importar", description: r.erro, variant: "destructive" });
    const d = r.dados!;
    toast({
      title: `${d.criados} criado(s), ${d.atualizados} atualizado(s)`,
      description: d.invalidosTotal ? `${d.invalidosTotal} linha(s) foram deixadas de fora.` : "Catálogo atualizado.",
    });
    limpar();
    onOpenChange(false);
    aoImportar();
  };

  const baixarModelo = async () => {
    const res = await fetch("/api/products/import/modelo", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!res.ok) return toast({ title: "Não consegui baixar o modelo", variant: "destructive" });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-catalogo.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) limpar(); onOpenChange(v); }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>Importar catálogo</DialogTitle></DialogHeader>

        <p className="text-sm text-muted-foreground">
          Aceita CSV ou TXT — de planilha, com cabeçalho, ou uma lista solta com um item por linha
          (<span className="font-mono text-xs">Clareamento - R$ 1.400</span>). Item com o mesmo nome é
          atualizado, não duplicado.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={baixarModelo} className="h-9 gap-2">
            <Download className="h-4 w-4" /> Baixar modelo
          </Button>
          <input
            ref={campo} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden"
            onChange={(e) => escolher(e.target.files?.[0] || null)}
          />
          <Button variant="outline" onClick={() => campo.current?.click()} disabled={lendo} className="h-9 gap-2">
            {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {arquivo ? "Trocar arquivo" : "Escolher arquivo"}
          </Button>
          {arquivo && <span className="self-center text-xs text-muted-foreground">{arquivo.name}</span>}
        </div>

        {previa && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-none bg-emerald-100 text-emerald-800">
                {previa.validos} item(ns) para importar
              </Badge>
              {previa.invalidosTotal > 0 && (
                <Badge className="border-none bg-amber-100 text-amber-800">
                  {previa.invalidosTotal} linha(s) fora
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                lido como {previa.formato === "tabela" ? "planilha" : "lista solta"}
              </span>
            </div>

            {previa.colunasIgnoradas?.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Colunas que não uso e vou ignorar: {previa.colunasIgnoradas.join(", ")}.
              </p>
            )}

            {previa.amostra.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      <th className="px-3 py-2 text-left font-medium">Categoria</th>
                      <th className="px-3 py-2 text-right font-medium">Preço</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previa.amostra.map((i, n) => (
                      <tr key={n}>
                        <td className="max-w-[260px] truncate px-3 py-2 font-medium text-foreground">{i.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{i.category || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{dinheiro(i.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previa.validos > previa.amostra.length && (
                  <p className="bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    e mais {previa.validos - previa.amostra.length} item(ns).
                  </p>
                )}
              </div>
            )}

            {previa.invalidos.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                  <AlertTriangle className="h-4 w-4" /> Linhas que ficam de fora
                </p>
                <ul className="space-y-1 text-xs text-amber-900">
                  {previa.invalidos.slice(0, 10).map((r) => (
                    <li key={r.linha}>
                      <span className="font-mono">linha {r.linha}</span>
                      {r.dados.name ? ` "${r.dados.name}"` : ""} — {r.erros.join("; ")}
                    </li>
                  ))}
                </ul>
                {previa.invalidosTotal > 10 && (
                  <p className="mt-2 text-xs text-amber-800">e mais {previa.invalidosTotal - 10}.</p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={gravar} disabled={!previa || !previa.validos || gravando} className="gap-2">
            {gravando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {previa?.validos ? `${previa.validos} item(ns)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportarCatalogo;
