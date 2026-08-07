import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Globe, Instagram, Loader2, Phone, Search, UserPlus } from "lucide-react";

/**
 * Começar uma conversa com quem já está no CRM.
 *
 * Até aqui a conversa só nascia quando o cliente escrevia primeiro: um
 * contato cadastrado e nunca contatado não tinha por onde ser abordado. A
 * lista mostra, por contato, se o número tem WhatsApp — descoberto sozinho
 * depois do cadastro —, para o atendente não descobrir isso só depois de
 * escrever a mensagem.
 */

const auth = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export type ContatoDaBusca = {
  id: string; name: string; phone?: string | null; email?: string | null;
  channel?: string; igUsername?: string | null; whatsappStatus?: string | null;
  phoneFormatado?: string;
};

const CANAL: Record<string, { Icone: typeof Phone; cor: string; nome: string }> = {
  WHATSAPP: { Icone: Phone, cor: "text-emerald-600", nome: "WhatsApp" },
  INSTAGRAM: { Icone: Instagram, cor: "text-pink-600", nome: "Instagram" },
  SITE: { Icone: Globe, cor: "text-blue-600", nome: "Site" },
};

export function NovaConversa({
  open, onOpenChange, aoAbrir,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Recebe o resultado de /conversations/start: a tela decide o que fazer. */
  aoAbrir: (dados: any, contato: ContatoDaBusca) => void;
}) {
  const { toast } = useToast();
  const [termo, setTermo] = useState("");
  const [contatos, setContatos] = useState<ContatoDaBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const pedido = useRef(0);

  useEffect(() => {
    if (!open) return;
    setBuscando(true);
    const id = ++pedido.current;
    const t = setTimeout(async () => {
      try {
        const q = termo.trim() ? `&q=${encodeURIComponent(termo.trim())}` : "";
        const r = await fetch(`/api/contacts/search?limit=30${q}`, { headers: auth() }).then((x) => x.json());
        // Resposta atrasada de uma busca antiga não pode sobrescrever a atual.
        if (pedido.current !== id) return;
        setContatos(r.contatos || []);
      } catch {
        if (pedido.current === id) toast({ title: "Não consegui buscar os contatos", variant: "destructive" });
      } finally {
        if (pedido.current === id) setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [termo, open]);

  const abrir = async (c: ContatoDaBusca) => {
    setAbrindo(c.id);
    try {
      const res = await fetch("/api/conversations/start", {
        method: "POST", headers: auth(), body: JSON.stringify({ leadId: c.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onOpenChange(false);
      aoAbrir(d, c);
    } catch (e: any) {
      toast({ title: "Não consegui abrir a conversa", description: e.message, variant: "destructive" });
    }
    setAbrindo(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-hidden rounded-2xl">
        <DialogHeader><DialogTitle>Nova conversa</DialogTitle></DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input
            autoFocus
            placeholder="Buscar por nome, telefone ou e-mail"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            className="h-10 rounded-lg pl-9 text-[13px]"
          />
        </div>

        <div className="-mx-2 max-h-[52vh] overflow-y-auto px-2">
          {buscando && !contatos.length && (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-faint" /></div>
          )}
          {!buscando && !contatos.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {termo ? "Nenhum contato com esse termo." : "Nenhum contato cadastrado ainda."}
            </p>
          )}

          <div className="divide-y divide-border">
            {contatos.map((c) => {
              const meta = CANAL[String(c.channel || "WHATSAPP").toUpperCase()] || CANAL.WHATSAPP;
              const Icone = meta.Icone;
              const semWhats = String(c.channel).toUpperCase() === "WHATSAPP" && c.whatsappStatus === "NAO";
              return (
                <button
                  key={c.id}
                  onClick={() => abrir(c)}
                  disabled={abrindo === c.id}
                  className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                >
                  <Icone className={`h-4 w-4 shrink-0 ${meta.cor}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.igUsername ? `@${c.igUsername}` : c.phoneFormatado || c.phone || c.email || meta.nome}
                    </p>
                  </div>
                  {semWhats && (
                    <Badge className="shrink-0 border-none bg-amber-100 text-[10px] text-amber-800">
                      sem WhatsApp
                    </Badge>
                  )}
                  {abrindo === c.id
                    ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-faint" />
                    : <UserPlus className="h-4 w-4 shrink-0 text-faint" />}
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NovaConversa;
