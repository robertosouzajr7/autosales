import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogoIcon } from "@/components/Logo";
import {
  ArrowRight, ArrowLeft, Check, Loader2, Sparkles, QrCode, BadgeCheck,
  AlertTriangle, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Catálogo completo, para quem já passou pelo diagnóstico e quer conferir o
 * resto. A vitrine é o questionário: aqui não há plano "recomendado" porque
 * a recomendação depende do volume de cada um, e a tela não sabe o volume de
 * ninguém. Tudo vem de /api/public/plans — plano cadastrado no painel do SaaS
 * aparece aqui sem ninguém mexer no código.
 */

type Plano = {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  whatsappMode?: string;
  maxConversations: number;
  maxUsers: number;
  maxWhatsAppNumbers: number;
  maxCampaignMessages: number;
  enableVoice?: boolean;
  enableWebhooks?: boolean;
  enableCalendar?: boolean;
  enableAutomations?: boolean;
};

const brl = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const num = (v: number, vazio = "—") => (v ? v.toLocaleString("pt-BR") : vazio);

const CANAIS: { id: string; rotulo: string; icone?: typeof QrCode }[] = [
  { id: "TODOS", rotulo: "Todos os planos" },
  { id: "BAILEYS", rotulo: "Por QR Code", icone: QrCode },
  { id: "OFFICIAL", rotulo: "Com API oficial", icone: BadgeCheck },
];

export default function Planos() {
  const navigate = useNavigate();
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState(false);
  const [canal, setCanal] = useState<string>("TODOS");

  useEffect(() => {
    fetch("/api/public/plans")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDados)
      .catch(() => setErro(true));
  }, []);

  const lista: Plano[] =
    canal === "OFFICIAL" ? dados?.oficiais || [] : canal === "BAILEYS" ? dados?.qrcode || [] : dados?.planos || [];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="flex items-center justify-between px-5 py-5 lg:px-16">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
          <LogoIcon className="h-8 w-8" />
          <span className="text-[15px] font-bold tracking-tight">
            Agentes <span className="text-primary">Virtuais</span>
          </span>
        </button>
        <button onClick={() => navigate("/login")} className="text-sm text-slate-400 hover:text-white">
          Já tenho conta
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        <Link to="/comecar" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar para o diagnóstico
        </Link>

        <div className="mt-6 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-4xl">Todos os planos</h1>
          <p className="mt-2 text-slate-400">
            A diferença que pesa no preço é como o WhatsApp conecta.
            {dados?.total > 0 && " Se não souber por onde começar, responda 5 perguntas e o plano certo aparece."}
          </p>
        </div>

        {erro ? (
          <Aviso
            titulo="Não consegui carregar os planos agora"
            texto="Tente de novo em instantes ou fale com a gente pelo chat."
          />
        ) : !dados ? (
          <div className="py-24 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          </div>
        ) : dados.total === 0 ? (
          /* Sem plano publicado, mandar para o diagnóstico seria um beco:
             ele também não tem o que recomendar. O teste de 7 dias não
             depende de plano, então é por ali que a pessoa começa. */
          <Aviso
            titulo="Estamos montando os planos"
            texto="Ainda não há plano publicado. Crie a conta e use os 7 dias de teste — quando os planos entrarem no ar, eles aparecem no painel."
            acao={{ para: "/register", rotulo: "Criar conta e testar" }}
          />
        ) : (
          <>
            {/* O filtro só existe quando há o que filtrar. */}
            {dados.oficiais?.length > 0 && dados.qrcode?.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {CANAIS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCanal(c.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                      canal === c.id
                        ? "border-primary bg-primary/15 text-white"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-white"
                    )}
                  >
                    {c.icone ? <c.icone className="h-4 w-4" /> : null}
                    {c.rotulo}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {lista.map((p) => (
                <PlanoCard key={p.id} plano={p} />
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                to="/comecar"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                <Sparkles className="h-4 w-4" /> Não sabe qual escolher? Responda 5 perguntas
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Aviso({ titulo, texto, acao }: { titulo: string; texto: string; acao?: { para: string; rotulo: string } }) {
  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
      <p className="mt-4 text-lg font-medium">{titulo}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">{texto}</p>
      {acao && (
        <Link to={acao.para}>
          <Button className="mt-6 gap-2 rounded-xl">
            {acao.rotulo} <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function PlanoCard({ plano }: { plano: Plano }) {
  const modo = String(plano.whatsappMode || "BOTH").toUpperCase();
  const canal =
    modo === "OFFICIAL"
      ? { rotulo: "API oficial", icone: BadgeCheck }
      : modo === "BAILEYS"
      ? { rotulo: "QR Code", icone: QrCode }
      : { rotulo: "QR Code ou API oficial", icone: BadgeCheck };

  // Só entra na lista o que o plano realmente libera: recurso desligado
  // vira ausência, não promessa em letra miúda.
  const extras = [
    plano.enableCalendar && "Agenda com Google Calendar",
    plano.enableAutomations && "Lembretes automáticos",
    plano.enableVoice && "Agente responde em áudio",
    plano.enableWebhooks && "API e webhooks",
  ].filter(Boolean) as string[];

  return (
    <Card className="flex flex-col gap-4 rounded-2xl border-white/10 bg-white/[0.03] p-6 text-white">
      <span className="flex items-center gap-2 text-xs text-slate-400">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
          <canal.icone className="h-4 w-4" />
        </span>
        {canal.rotulo}
      </span>

      <div>
        <p className="text-sm text-slate-300">{plano.name}</p>
        <p className="text-3xl font-semibold tracking-tight">
          {brl(plano.priceMonthly)}
          <span className="text-base font-normal text-slate-500">/mês</span>
        </p>
        {plano.priceYearly > 0 && (
          <p className="mt-0.5 text-xs text-slate-500">ou {brl(plano.priceYearly)}/ano</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs">
        <Limite k="Conversas/mês" v={num(plano.maxConversations, "Sem limite")} />
        <Limite k="Pessoas" v={num(plano.maxUsers)} />
        <Limite k="Números" v={num(plano.maxWhatsAppNumbers)} />
        <Limite k="Disparos/mês" v={num(plano.maxCampaignMessages)} />
      </div>

      {extras.length > 0 && (
        <ul className="space-y-1.5 border-t border-white/10 pt-4 text-sm">
          {extras.map((e) => (
            <li key={e} className="flex items-start gap-2 text-slate-300">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {e}
            </li>
          ))}
        </ul>
      )}

      <Link to={`/register?plan=${plano.id}`} className="mt-auto block">
        <Button className="w-full gap-2 rounded-xl">
          Testar 7 dias grátis <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
      <p className="text-center text-xs text-slate-500">
        <ShieldCheck className="mr-1 inline h-3 w-3" /> Sem cartão para testar
      </p>
    </Card>
  );
}

function Limite({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-slate-500">{k}</p>
      <p className="font-semibold text-slate-200">{v}</p>
    </div>
  );
}
