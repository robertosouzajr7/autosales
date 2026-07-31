import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import { Plus, Pencil, Trash2, Loader2, GraduationCap, GripVertical } from "lucide-react";

/**
 * Publicação dos vídeos da Academy.
 *
 * O texto da base de conhecimento vive no código (versiona com o produto),
 * mas vídeo é conteúdo seu e muda toda semana — então fica aqui, sem depender
 * de deploy para entrar no ar.
 */

const VAZIO = {
  id: null as string | null,
  title: "",
  description: "",
  url: "",
  modulo: "Primeiros passos",
  duracao: "",
  order: 0,
  active: true,
};

export function AcademyPanel() {
  const { toast } = useToast();
  const [videos, setVideos] = useState<any[]>([]);
  const [form, setForm] = useState<any>(VAZIO);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    const r = await adminApi.get("/api/admin/academy/videos");
    if (r.ok && Array.isArray(r.data)) setVideos(r.data);
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!form.title || !form.url) {
      return toast({ title: "Falta título ou link do vídeo", variant: "destructive" });
    }
    setSalvando(true);
    const payload = {
      title: form.title, description: form.description, url: form.url,
      modulo: form.modulo, duracao: form.duracao, order: Number(form.order) || 0,
      active: form.active !== false,
    };
    const r = form.id
      ? await adminApi.put(`/api/admin/academy/videos/${form.id}`, payload)
      : await adminApi.post("/api/admin/academy/videos", payload);
    setSalvando(false);
    if (r.ok) { toast({ title: form.id ? "Aula atualizada" : "Aula publicada" }); setAberto(false); carregar(); }
    else toast({ title: "Erro ao salvar", description: r.data?.error, variant: "destructive" });
  };

  const remover = async (v: any) => {
    if (!confirm(`Excluir a aula "${v.title}"?`)) return;
    const r = await adminApi.del(`/api/admin/academy/videos/${v.id}`);
    if (r.ok) { toast({ title: "Aula excluída" }); carregar(); }
  };

  // Agrupado por módulo: é assim que o cliente vê na área de membros.
  const modulos = videos.reduce((acc: Record<string, any[]>, v) => {
    (acc[v.modulo] = acc[v.modulo] || []).push(v);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {videos.length} aula(s) cadastrada(s). Aceita link do YouTube ou do Vimeo.
        </p>
        <Button onClick={() => { setForm(VAZIO); setAberto(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nova aula
        </Button>
      </div>

      {carregando ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : videos.length === 0 ? (
        <Card className="p-12 text-center">
          <GraduationCap className="mx-auto w-8 h-8 text-muted-foreground mb-3" />
          <p className="font-medium">Nenhuma aula publicada</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Enquanto não houver vídeo, a Academy indica a base de conhecimento para os clientes.
          </p>
        </Card>
      ) : (
        Object.entries(modulos).map(([modulo, lista]) => (
          <div key={modulo} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{modulo}</p>
            {(lista as any[]).map((v) => (
              <Card key={v.id} className="flex items-center gap-3 p-3.5">
                <GripVertical className="w-4 h-4 shrink-0 text-muted-foreground/50" />
                <span className="w-8 shrink-0 text-center text-xs text-muted-foreground tabular-nums">{v.order}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate">{v.title}</p>
                    {!v.active && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">oculta</span>}
                    {v.duracao && <span className="text-[11px] text-muted-foreground">{v.duracao}</span>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{v.url}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { setForm({ ...VAZIO, ...v, description: v.description || "", duracao: v.duracao || "" }); setAberto(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remover(v)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Card>
            ))}
          </div>
        ))
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? "Editar aula" : "Nova aula"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Como conectar o WhatsApp" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Link do vídeo (YouTube ou Vimeo)</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://youtu.be/..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="O que a pessoa aprende nesta aula." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs text-muted-foreground">Módulo</Label>
                <Input value={form.modulo} onChange={(e) => setForm({ ...form, modulo: e.target.value })} placeholder="Primeiros passos" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Duração</Label>
                <Input value={form.duracao} onChange={(e) => setForm({ ...form, duracao: e.target.value })} placeholder="8 min" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ordem no módulo</Label>
                <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
                <Label className="text-xs">Visível aos clientes</Label>
                <Switch checked={form.active !== false} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Módulos com o mesmo nome aparecem juntos. A posição do módulo na Academy segue o
              menor número de ordem dentro dele — para deixar um módulo antes do outro, use
              números menores nas aulas dele (ex.: Primeiros passos 1–5, Disparos 10–15).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando} className="gap-2">
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AcademyPanel;
