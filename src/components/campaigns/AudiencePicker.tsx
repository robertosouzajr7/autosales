import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Upload, Check, Users, AlertTriangle, RefreshCw, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { enviarArquivo } from "@/lib/enviarArquivo";

interface Props {
  /** Ids selecionados (controlado pelo pai). */
  value: string[];
  onChange: (ids: string[]) => void;
}

const POR_PAGINA = 25;

/**
 * Escolha dos contatos que vão receber o disparo.
 *
 * Só contato com telefone válido e sem opt-out pode ser marcado — quem não
 * pode aparece esmaecido com o motivo, em vez de sumir da lista sem explicação.
 */
export function AudiencePicker({ value, onChange }: Props) {
  const { toast } = useToast();
  const [contatos, setContatos] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [importando, setImportando] = useState(false);

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [canal, setCanal] = useState("TODOS");
  const [etapa, setEtapa] = useState("TODAS");
  const [tagId, setTagId] = useState("TODAS");

  const [tags, setTags] = useState<any[]>([]);
  const [etapas, setEtapas] = useState<any[]>([]);

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  const params = useCallback(
    (extra: Record<string, string> = {}) => {
      const p = new URLSearchParams({ comTelefone: "true", ...extra });
      if (buscaAplicada) p.set("q", buscaAplicada);
      if (canal !== "TODOS") p.set("channel", canal);
      if (etapa !== "TODAS") p.set("stageId", etapa);
      if (tagId !== "TODAS") p.set("tagIds", tagId);
      return p;
    },
    [buscaAplicada, canal, etapa, tagId]
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const p = params({ page: String(pagina), limit: String(POR_PAGINA) });
      const res = await fetch(`/api/contacts/search?${p}`, { headers: auth() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setContatos(d.contatos || []);
      setTotal(d.total || 0);
    } catch (e: any) {
      toast({ title: e.message || "Não foi possível buscar contatos", variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  }, [pagina, params, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    Promise.all([
      fetch("/api/contacts/tags", { headers: auth() }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/pipeline-stages", { headers: auth() }).then((r) => (r.ok ? r.json() : [])),
    ]).then(([t, e]) => { setTags(t || []); setEtapas(e || []); }).catch(() => {});
  }, []);

  // Trocar filtro volta para a primeira página: manter a página antiga daria
  // lista vazia sem motivo aparente.
  useEffect(() => { setPagina(1); }, [buscaAplicada, canal, etapa, tagId]);

  const alternar = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const marcarPagina = () => {
    const daPagina = contatos.filter((c) => c.disparavel).map((c) => c.id);
    const todosMarcados = daPagina.every((id) => value.includes(id));
    onChange(todosMarcados
      ? value.filter((id) => !daPagina.includes(id))
      : Array.from(new Set([...value, ...daPagina])));
  };

  const marcarTodosDoFiltro = async () => {
    try {
      const res = await fetch(`/api/contacts/search-ids?${params()}`, { headers: auth() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onChange(d.ids || []);
      toast({
        title: `${d.total} contato(s) selecionado(s)`,
        description: d.ignorados ? `${d.ignorados} ignorado(s) por não ter telefone válido ou estar em opt-out.` : undefined,
      });
    } catch (e: any) {
      toast({ title: e.message || "Erro ao selecionar", variant: "destructive" });
    }
  };

  const importarCsv = async (file: File) => {
    setImportando(true);
    try {
      const envio = await enviarArquivo<any>("/api/contacts/import-csv", file);
      if (!envio.ok) throw new Error(envio.erro);
      const d = envio.dados;

      const partes = [`${d.criados} novo(s)`, `${d.atualizados} atualizado(s)`];
      if (d.duplicadosNoArquivo) partes.push(`${d.duplicadosNoArquivo} repetido(s) no arquivo`);
      const recusadas = d.invalidos?.length || 0;
      if (recusadas) partes.push(`${recusadas} sem telefone válido`);

      toast({
        title: "Importação concluída",
        description: partes.join(" · ") + (recusadas
          ? `\nEx.: linha ${d.invalidos[0].linha} — ${d.invalidos[0].motivo}`
          : ""),
      });
      carregar();
    } catch (e: any) {
      toast({ title: e.message || "Falha ao importar", variant: "destructive" });
    } finally {
      setImportando(false);
    }
  };

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="space-y-3">
      {/* Busca e importação */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setBuscaAplicada(busca); } }}
            onBlur={() => setBuscaAplicada(busca)}
            placeholder="Nome, telefone, e-mail ou @usuario"
            className="pl-9 rounded-2xl bg-slate-50 border-none font-medium"
          />
          {busca && (
            <button
              type="button"
              onClick={() => { setBusca(""); setBuscaAplicada(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <input
          type="file" id="csv-contatos" accept=".csv,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importarCsv(f); e.target.value = ""; }}
        />
        <Button
          type="button" variant="outline" disabled={importando}
          onClick={() => document.getElementById("csv-contatos")?.click()}
          className="rounded-2xl font-bold shrink-0"
        >
          {importando
            ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Importando…</>
            : <><Upload className="w-4 h-4 mr-2" /> Importar CSV</>}
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-3 gap-2">
        <Select value={canal} onValueChange={setCanal}>
          <SelectTrigger className="rounded-2xl bg-slate-50 border-none font-bold text-xs h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS" className="font-bold">Todos os canais</SelectItem>
            <SelectItem value="WHATSAPP" className="font-bold">WhatsApp</SelectItem>
            <SelectItem value="INSTAGRAM" className="font-bold">Instagram</SelectItem>
            <SelectItem value="SITE" className="font-bold">Site</SelectItem>
          </SelectContent>
        </Select>
        <Select value={etapa} onValueChange={setEtapa}>
          <SelectTrigger className="rounded-2xl bg-slate-50 border-none font-bold text-xs h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS" className="font-bold">Todas as etapas</SelectItem>
            {etapas.map((e) => <SelectItem key={e.id} value={e.id} className="font-bold">{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tagId} onValueChange={setTagId}>
          <SelectTrigger className="rounded-2xl bg-slate-50 border-none font-bold text-xs h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS" className="font-bold">Todas as tags</SelectItem>
            {tags.map((t) => <SelectItem key={t.id} value={t.id} className="font-bold">{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Seleção em massa */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={marcarPagina} className="h-7 text-xs font-bold rounded-xl">
            Marcar esta página
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={marcarTodosDoFiltro} className="h-7 text-xs font-bold rounded-xl text-[#2563EB]">
            Marcar todos ({total})
          </Button>
          {value.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} className="h-7 text-xs font-bold rounded-xl text-slate-400">
              Limpar
            </Button>
          )}
        </div>
        <span className="font-bold text-slate-600 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> {value.length} selecionado(s)
        </span>
      </div>

      {/* Lista */}
      <div className="border border-slate-100 rounded-2xl divide-y divide-slate-50 max-h-64 overflow-y-auto">
        {carregando ? (
          <div className="p-8 text-center text-xs text-slate-400">Carregando…</div>
        ) : contatos.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhum contato encontrado com esses filtros.
          </div>
        ) : contatos.map((c) => {
          const marcado = value.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              disabled={!c.disparavel}
              onClick={() => alternar(c.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                !c.disparavel ? "opacity-50 cursor-not-allowed" : marcado ? "bg-[#2563EB]/5" : "hover:bg-slate-50"
              }`}
            >
              <span className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${marcado ? "bg-[#2563EB]" : "bg-slate-200"}`}>
                {marcado && <Check className="w-3 h-3 text-white" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-700 truncate">{c.name}</span>
                <span className="block text-[11px] text-slate-400 truncate">
                  {c.phoneFormatado || "sem telefone"}
                  {c.stage?.name ? ` · ${c.stage.name}` : ""}
                  {c.channel !== "WHATSAPP" ? ` · ${c.channel === "INSTAGRAM" ? "Instagram" : "Site"}` : ""}
                </span>
              </span>
              {c.tags?.slice(0, 2).map((t: any) => (
                <Badge key={t.id} variant="outline" className="text-[10px] font-bold shrink-0">{t.name}</Badge>
              ))}
              {!c.disparavel && (
                <span className="text-[10px] text-amber-600 font-bold shrink-0 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {c.optedOut ? "opt-out" : "sem telefone"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {paginas > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Página {pagina} de {paginas}</span>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)} className="h-7 rounded-xl">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={pagina >= paginas}
              onClick={() => setPagina((p) => p + 1)} className="h-7 rounded-xl">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 leading-relaxed">
        O CSV precisa de uma coluna <strong>telefone</strong> (ou <em>phone</em>); nome e e-mail são
        opcionais. Contatos em opt-out e sem telefone válido não podem ser selecionados.
      </p>
    </div>
  );
}
