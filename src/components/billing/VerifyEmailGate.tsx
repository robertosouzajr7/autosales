import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { MailCheck, Loader2, RefreshCw } from "lucide-react";

/**
 * Aviso fixo enquanto o e-mail não é confirmado.
 *
 * A API já recusa qualquer operação nesse estado. Sem este aviso, o cliente
 * clicaria em tudo e receberia erro sem entender o motivo — a barra explica
 * a trava e dá o botão para sair dela na mesma linha.
 */
export function VerifyEmailGate() {
  const { toast } = useToast();
  const [pendente, setPendente] = useState(false);
  const [email, setEmail] = useState("");
  const [reenviando, setReenviando] = useState(false);

  const conferir = () => {
    fetch("/api/users/me", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (!me) return;
        setPendente(me.emailVerified === false);
        setEmail(me.email || "");
      })
      .catch(() => {});
  };

  useEffect(() => {
    conferir();
    // Quem confirma em outra aba não deveria precisar recarregar o painel.
    const t = setInterval(conferir, 30_000);
    const aoVoltar = () => conferir();
    window.addEventListener("focus", aoVoltar);
    return () => { clearInterval(t); window.removeEventListener("focus", aoVoltar); };
  }, []);

  if (!pendente) return null;

  const reenviar = async () => {
    setReenviando(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      toast(
        res.ok
          ? { title: "Link reenviado", description: `Confira a caixa de ${email}.` }
          : { title: "Não consegui reenviar", description: d.error, variant: "destructive" }
      );
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
    setReenviando(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 md:px-6">
      <MailCheck className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-[16rem]">
        Confirme <strong>{email}</strong> para liberar o painel. Enquanto isso você navega, mas não
        consegue conectar canais nem enviar mensagens.
      </span>
      <Button size="sm" variant="outline" onClick={reenviar} disabled={reenviando}
        className="gap-1.5 border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
        {reenviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Reenviar link
      </Button>
    </div>
  );
}

export default VerifyEmailGate;
