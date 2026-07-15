import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
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
  Package, Plus, Pencil, Trash2, Loader2, ImageIcon, Music, Video, Upload, X,
} from "lucide-react";

function authHeaders() {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

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
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/products/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const d = await res.json();
      if (res.ok) {
        setForm((f: any) => ({ ...f, [field]: d.url }));
        toast({ title: "Mídia enviada" });
      } else {
        toast({ title: "Erro no upload", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro no upload", variant: "destructive" });
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

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
        <PageHeader
          icon={<Package className="w-5 h-5" />}
          title="Catálogo"
          subtitle="Produtos e serviços com mídia. O agente de IA pode apresentar e enviar estes itens nas conversas."
          actions={<Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo item</Button>}
        />

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
          </div>
        ) : items.length === 0 ? (
          <Card className="rounded-2xl border-border">
            <EmptyState
              icon={<Package className="w-6 h-6" />}
              title="Catálogo vazio"
              description="Cadastre produtos ou serviços com foto, áudio ou vídeo para o agente apresentar aos clientes."
              action={{ label: "Adicionar item", onClick: openNew }}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <Card key={it.id} className="rounded-2xl border-border overflow-hidden flex flex-col">
                <div className="aspect-video bg-muted grid place-items-center overflow-hidden">
                  {it.imageUrl ? (
                    <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" />
                  ) : it.videoUrl ? (
                    <Video className="w-8 h-8 text-muted-foreground" />
                  ) : it.audioUrl ? (
                    <Music className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{it.name}</p>
                    {!it.isActive && <Badge className="bg-slate-200 text-slate-600 border-none text-xs">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {it.type === "SERVICE" ? "Serviço" : "Produto"}{it.category ? ` · ${it.category}` : ""}
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {it.price != null ? `R$ ${Number(it.price).toFixed(2)}` : "Sob consulta"}
                  </p>
                  <div className="flex gap-1.5 mt-1">
                    {it.imageUrl && <ImageIcon className="w-3.5 h-3.5 text-primary" />}
                    {it.audioUrl && <Music className="w-3.5 h-3.5 text-primary" />}
                    {it.videoUrl && <Video className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <div className="flex gap-2 mt-auto pt-3">
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEdit(it)}>
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <button onClick={() => remove(it)} className="p-2 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
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
    </DashboardLayout>
  );
}

function MediaUpload({ label, icon, accept, url, uploading, onUpload, onClear }: {
  label: string; icon: React.ReactNode; accept: string; url: string; uploading: boolean;
  onUpload: (f: File) => void; onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
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
        <div className={`h-8 w-8 rounded-lg grid place-items-center ${url ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
        </div>
        <span className="text-xs font-medium text-foreground">{label}</span>
        {url ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-emerald-600">✓ enviado</span>
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
