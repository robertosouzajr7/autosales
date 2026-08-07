import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Plus, Pencil, Trash2, Loader2, ImageIcon, Music, Video, Upload, X, Search, FileUp,
} from "lucide-react";
import { enviarArquivo } from "@/lib/enviarArquivo";
import { ImportarCatalogo } from "@/components/catalog/ImportarCatalogo";

function authHeaders() {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

const reais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const EMPTY = {
  id: "", name: "", type: "PRODUCT", category: "", description: "", price: "",
  buyUrl: "", imageUrl: "", audioUrl: "", videoUrl: "", isActive: true,
};

export default function Catalogo() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("ALL");

  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products", { headers: authHeaders() });
      const d = await res.json();
      setItems(Array.isArray(d) ? d : []);
    } catch {
      toast({ title: "Erro ao carregar catálogo", variant: "destructive" });
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setOpen(true); };
  const openEdit = (it: any) => {
    setForm({ ...EMPTY, ...it, price: it.price ?? "" });
    setOpen(true);
  };

  const uploadFile = async (file: File, field: "imageUrl" | "audioUrl" | "videoUrl") => {
    setUploading(field);
    try {
      const envio = await enviarArquivo<{ url: string }>("/api/products/upload", file);
      if (envio.ok) {
        setForm((f: any) => ({ ...f, [field]: envio.dados.url }));
        toast({ title: "Mídia enviada" });
      } else {
        toast({ title: "Erro no upload", description: envio.erro, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    }
    setUploading(null);
  };

  const save = async () => {
    if (!form.name) return toast({ title: "Dê um nome ao item", variant: "destructive" });
    setSaving(true);
    try {
      const payload = { ...form, price: form.price === "" ? null : Number(form.price) };
      const url = form.id ? `/api/products/${form.id}` : "/api/products";
      const res = await fetch(url, { method: form.id ? "PUT" : "POST", headers: authHeaders(), body: JSON.stringify(payload) });
      if (res.ok) {
        toast({ title: form.id ? "Item atualizado" : "Item adicionado" });
        setOpen(false);
        load();
      } else {
        const d = await res.json();
        toast({ title: "Erro ao salvar", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSaving(false);
  };

  const remove = async (it: any) => {
    if (!confirm(`Remover "${it.name}" do catálogo?`)) return;
    const res = await fetch(`/api/products/${it.id}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) load();
  };

  const semMidia = items.filter((i) => !i.imageUrl && !i.audioUrl && !i.videoUrl).length;
  const categorias = Array.from(new Set(items.map((i) => i.category).filter(Boolean)))
    .filter((c: any) => !["produtos", "serviços", "servicos"].includes(String(c).toLowerCase()))
    .slice(0, 3);

  const CHIPS = [
    { id: "ALL", rotulo: "Todos" },
    { id: "PRODUCT", rotulo: "Produtos" },
    { id: "SERVICE", rotulo: "Serviços" },
    ...categorias.map((c: any) => ({ id: `cat:${c}`, rotulo: c })),
    // Sem mídia é uma pendência, não um filtro qualquer: o agente pode citar
    // o item, mas não tem o que enviar. Por isso o número vem em laranja.
    { id: "SEM_MIDIA", rotulo: "Sem mídia", n: semMidia, alerta: true },
  ];

  const visiveis = items.filter((it) => {
    if (filtro === "PRODUCT" && it.type !== "PRODUCT") return false;
    if (filtro === "SERVICE" && it.type !== "SERVICE") return false;
    if (filtro === "SEM_MIDIA" && (it.imageUrl || it.audioUrl || it.videoUrl)) return false;
    if (filtro.startsWith("cat:") && it.category !== filtro.slice(4)) return false;
    if (busca.trim() && !`${it.name || ""} ${it.description || ""} ${it.category || ""}`.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6">

        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Catálogo</h1>
            <p className="mt-0.5 max-w-lg text-[13.5px] text-muted-foreground">
              Produtos e serviços com mídia. O agente apresenta e envia estes itens durante a conversa.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)} className="h-10 gap-2">
              <FileUp className="h-4 w-4" /> Importar
            </Button>
            <Button onClick={openNew} className="h-10 gap-2"><Plus className="h-4 w-4" /> Novo item</Button>
          </div>
        </header>

        {/* Busca e filtros */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-border bg-card px-3 py-2.5 shadow-card">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <Input
              value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar item…"
              className="h-9 w-[220px] rounded-lg border-border-soft bg-surface-2 pl-9 text-[13px]"
            />
          </div>
          {CHIPS.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setFiltro(c.id)}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-semibold transition-colors ${
                filtro === c.id
                  ? "border-accent-text/30 bg-accent-soft text-accent-text"
                  : "border-border-soft bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.rotulo}
              {c.n !== undefined && c.n > 0 && (
                <span className={`num ${c.alerta ? "text-amber-600" : "text-faint"}`}>· {c.n}</span>
              )}
            </button>
          ))}
          <span className="num ml-auto text-[12px] text-faint">
            {visiveis.length} de {items.length}
          </span>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[280px] rounded-[14px]" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-[14px] border border-border bg-card px-6 py-20 text-center shadow-card">
            <Package className="h-8 w-8 text-border-soft" />
            <div>
              <p className="text-[14px] font-semibold text-foreground">Catálogo vazio</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Cadastre produtos ou serviços com foto, áudio ou vídeo para o agente apresentar.
              </p>
            </div>
            <Button onClick={openNew} className="mt-1 gap-2"><Plus className="h-4 w-4" /> Adicionar item</Button>
          </div>
        ) : visiveis.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-[14px] border border-border bg-card px-6 py-16 text-center shadow-card">
            <Package className="h-7 w-7 text-border-soft" />
            <p className="text-[13px] text-muted-foreground">Nenhum item com esse filtro.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visiveis.map((it) => {
              const midias = [it.imageUrl && "imagem", it.audioUrl && "áudio", it.videoUrl && "vídeo"].filter(Boolean);
              return (
                <article key={it.id} className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
                  {/* Faixa de mídia */}
                  <div className="relative grid h-[132px] place-items-center overflow-hidden bg-gradient-to-br from-accent-soft to-surface-2">
                    {it.imageUrl ? (
                      <img
                        src={it.imageUrl} alt={it.name} loading="lazy"
                        className="h-full w-full object-cover"
                        // Some com o <img> em vez de mostrar ícone quebrado.
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : it.videoUrl ? (
                      <Video className="h-8 w-8 text-accent-text/50" />
                    ) : it.audioUrl ? (
                      <Music className="h-8 w-8 text-accent-text/50" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-border-soft" />
                    )}
                    {midias.length > 0 && (
                      <div className="absolute left-2 top-2 flex gap-1.5">
                        <span className="rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[10.5px] font-semibold capitalize text-white backdrop-blur-sm">
                          {midias[0]}
                        </span>
                        {midias.length > 1 && (
                          <span className="num rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-sm">
                            +{midias.length - 1}
                          </span>
                        )}
                      </div>
                    )}
                    {!it.isActive && (
                      <span className="absolute right-2 top-2 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-sm">
                        Inativo
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start gap-2">
                      <span
                        title={midias.length ? "Tem mídia para enviar" : "Sem mídia — o agente só cita, não envia"}
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${midias.length ? "bg-emerald-500" : "bg-amber-500"}`}
                      />
                      <p className="min-w-0 flex-1 text-[13.5px] font-semibold text-foreground">{it.name}</p>
                    </div>
                    {it.description && (
                      <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{it.description}</p>
                    )}
                    <p className="num mt-3 text-[15px] font-bold text-foreground">
                      {it.price != null ? reais(Number(it.price)) : "Sob consulta"}
                    </p>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-soft pt-3">
                      <span className="linha-unica-elipse text-[11.5px] text-faint">
                        {it.category || (it.type === "SERVICE" ? "Serviço" : "Produto")}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          onClick={() => openEdit(it)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-accent-text"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => remove(it)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-red-50 hover:text-red-600"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs text-muted-foreground">Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRODUCT">Produto</SelectItem>
                    <SelectItem value="SERVICE">Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Estética" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Preço (R$)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="vazio = sob consulta" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Link de compra (opcional)</Label>
                <Input value={form.buyUrl} onChange={(e) => setForm({ ...form, buyUrl: e.target.value })} placeholder="https://" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            {/* Uploads de mídia */}
            <div className="grid grid-cols-3 gap-2">
              <MediaUpload label="Imagem" icon={<ImageIcon className="w-4 h-4" />} accept="image/*" url={form.imageUrl} uploading={uploading === "imageUrl"} onUpload={(f) => uploadFile(f, "imageUrl")} onClear={() => setForm({ ...form, imageUrl: "" })} />
              <MediaUpload label="Áudio" icon={<Music className="w-4 h-4" />} accept="audio/*" url={form.audioUrl} uploading={uploading === "audioUrl"} onUpload={(f) => uploadFile(f, "audioUrl")} onClear={() => setForm({ ...form, audioUrl: "" })} />
              <MediaUpload label="Vídeo" icon={<Video className="w-4 h-4" />} accept="video/*" url={form.videoUrl} uploading={uploading === "videoUrl"} onUpload={(f) => uploadFile(f, "videoUrl")} onClear={() => setForm({ ...form, videoUrl: "" })} />
            </div>
            <p className="text-xs text-muted-foreground">A imagem é a mídia principal que o agente envia. Máx. 25 MB por arquivo.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportarCatalogo open={importOpen} onOpenChange={setImportOpen} aoImportar={load} />
    </DashboardLayout>
  );
}

function MediaUpload({ label, icon, accept, url, uploading, onUpload, onClear }: {
  label: string; icon: React.ReactNode; accept: string; url: string; uploading: boolean;
  onUpload: (f: File) => void; onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const isImage = accept.includes("image");
  return (
    <div className={`rounded-xl border p-3 text-center ${url ? "border-primary bg-primary/5" : "border-dashed border-border"}`}>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }}
      />
      <div className="flex flex-col items-center gap-1.5">
        {/* Prévia da imagem enviada (some com o ícone se a imagem falhar) */}
        {url && isImage ? (
          <img
            src={url}
            alt={label}
            className="h-16 w-16 rounded-lg object-cover border border-border"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className={`h-8 w-8 rounded-lg grid place-items-center ${url ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
          </div>
        )}
        <span className="text-xs font-medium text-foreground">{label}</span>
        {url ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-emerald-600">✓ enviado</span>
            <button onClick={() => ref.current?.click()} className="text-[10px] text-primary hover:underline">trocar</button>
            <button onClick={onClear} className="text-muted-foreground hover:text-rose-600"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => ref.current?.click()} disabled={uploading} className="text-[11px] text-primary hover:underline flex items-center gap-1">
            <Upload className="w-3 h-3" /> Enviar
          </button>
        )}
      </div>
    </div>
  );
}
