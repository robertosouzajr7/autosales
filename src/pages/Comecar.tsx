import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoIcon } from "@/components/Logo";
import {
  ArrowRight, ArrowLeft, Check, Loader2, Sparkles, ShieldCheck,
  QrCode, BadgeCheck, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Contratação em forma de conversa.
 *
 * A página de preços com cinco colunas obriga o visitante a virar analista
 * de si mesmo antes de comprar. Aqui ele responde cinco perguntas sobre o
 * próprio negócio e recebe duas recomendações — a melhor com API oficial e
 * a melhor por QR Code —, porque a escolha entre os canais é de preferência
 * (custo x oficialidade) e ninguém pode decidir isso por ele.
 */

type Opcao = { valor: any; rotulo: string; detalhe?: string };
type Pergunta = { id: string; titulo: string; ajuda?: string; multipla?: boolean; opcoes: Opcao[] };

const brl = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function Comecar() {
  const navigate = useNavigate();
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [passo, setPasso] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, any>>({});
  const [resultado, setResultado] = useState<any>(null);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    fetch("/api/public/plan-questions")
      .then((r) => r.json())
      .then((d) => setPerguntas(d.perguntas || []))
      .catch(() => {});
  }, []);

  const atual = perguntas[passo];
  const total = perguntas.length;
  const progresso = total ? Math.round(((resultado ? total : passo) / total) * 100) : 0;

  const responder = (opcao: Opcao) => {
    if (!atual) return;
    if (atual.multipla) {
      const antes: any[] = respostas[atual.id] || [];
      const novo = antes.includes(opcao.valor)
        ? antes.filter((v) => v !== opcao.valor)
        : [...antes, opcao.valor];
      setRespostas({ ...respostas, [atual.id]: novo });
      return;
    }
    const novasRespostas = { ...respostas, [atual.id]: opcao.valor };
    setRespostas(novasRespostas);
    // Pergunta de escolha única avança sozinha: um clique a menos por passo.
    if (passo + 1 < total) setPasso(passo + 1);
    else calcular(novasRespostas);
  };

  const calcular = async (finais = respostas) => {
    setCalculando(true);
    try {
      const r = await fetch("/api/public/plan-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respostas: finais }),
      }).then((x) => x.json());
      setResultado(r);
    } catch {
      setResultado({ erro: true });
    }
    setCalculando(false);
  };

  const respondida = atual
    ? atual.multipla
      ? (respostas[atual.id] || []).length > 0
      : respostas[atual.id] !== undefined
    : false;

  const escolher = (plano: any) => {
    // O plano escolhido e as respostas vão para o cadastro: a conta já nasce
    // no plano certo e com o tipo de negócio preenchido.
    sessionStorage.setItem("planoEscolhido", JSON.stringify({ id: plano.id, name: plano.name }));
    sessionStorage.setItem("respostasOnboarding", JSON.stringify(respostas));
    navigate(`/register?plan=${plano.id}`);
  };

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

      {/* Progresso */}
      <div className="mx-auto max-w-3xl px-5">
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>
        {!resultado && total > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Pergunta {passo + 1} de {total} · leva menos de um minuto
          </p>
        )}
      </div>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10">
        {calculando ? (
          <div className="space-y-4 py-24 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-slate-400">Montando o plano ideal para o seu volume…</p>
          </div>
        ) : resultado ? (
          <Resultado resultado={resultado} onEscolher={escolher} onRefazer={() => { setResultado(null); setPasso(0); }} />
        ) : atual ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-4xl">{atual.titulo}</h1>
            {atual.ajuda && <p className="mt-2 text-slate-400">{atual.ajuda}</p>}

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {atual.opcoes.map((o) => {
                const marcada = atual.multipla
                  ? (respostas[atual.id] || []).includes(o.valor)
                  : respostas[atual.id] === o.valor;
                return (
                  <button
                    key={String(o.valor)}
                    onClick={() => responder(o)}
                    className={cn(
                      "group flex items-center justify-between rounded-2xl border p-5 text-left transition-all",
                      marcada
                        ? "border-primary bg-primary/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
                    )}
                  >
                    <span>
                      <span className="block font-medium">{o.rotulo}</span>
                      {o.detalhe && <span className="block text-sm text-slate-400">{o.detalhe}</span>}
                    </span>
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors",
                        marcada ? "border-primary bg-primary text-white" : "border-white/20 text-transparent"
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setPasso(Math.max(0, passo - 1))}
                disabled={passo === 0}
                className="gap-2 text-slate-400 hover:text-white disabled:opacity-0"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              {atual.multipla && (
                <Button
                  onClick={() => (passo + 1 < total ? setPasso(passo + 1) : calcular())}
                  disabled={!respondida}
                  className="gap-2 rounded-xl"
                >
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="py-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
        )}
      </main>
    </div>
  );
}

function Resultado({ resultado, onEscolher, onRefazer }: any) {
  if (resultado?.erro || (!resultado?.oficial && !resultado?.qrcode)) {
    return (
      <div className="space-y-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
        <p className="text-lg font-medium">Não consegui montar a recomendação agora.</p>
        <Button onClick={onRefazer} variant="outline" className="rounded-xl">Tentar de novo</Button>
      </div>
    );
  }

  const p = resultado.precisa || {};
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Badge className="mb-3 border-none bg-primary/15 text-primary">
        <Sparkles className="mr-1 h-3 w-3" /> Sua recomendação
      </Badge>
      <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-4xl">
        Para {p.conversas?.toLocaleString("pt-BR")} conversas/mês e {p.colaboradores} pessoa(s)
      </h1>
      <p className="mt-2 text-slate-400">
        Dois caminhos servem. A diferença está em como o WhatsApp conecta — escolha o que combina com você.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <PlanoCard plano={resultado.qrcode} icone={<QrCode className="h-5 w-5" />} destaque="Mais econômico" onEscolher={onEscolher} />
        <PlanoCard plano={resultado.oficial} icone={<BadgeCheck className="h-5 w-5" />} destaque="Mais robusto" onEscolher={onEscolher} />
      </div>

      <div className="mt-8 flex items-center justify-center gap-4 text-sm">
        <button onClick={onRefazer} className="text-slate-400 underline-offset-4 hover:text-white hover:underline">
          Refazer as perguntas
        </button>
        <span className="text-slate-700">·</span>
        <a href="/#pricing" className="text-slate-400 underline-offset-4 hover:text-white hover:underline">
          Ver todos os planos
        </a>
      </div>
    </div>
  );
}

function PlanoCard({ plano, icone, destaque, onEscolher }: any) {
  if (!plano) return null;
  return (
    <Card className="flex flex-col gap-4 rounded-2xl border-white/10 bg-white/[0.03] p-6 text-white">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-slate-300">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">{icone}</span>
          {plano.canal?.titulo}
        </span>
        <Badge className="border-none bg-white/10 text-xs text-slate-200">{destaque}</Badge>
      </div>

      <div>
        <p className="text-sm text-slate-400">{plano.name}</p>
        <p className="text-3xl font-semibold tracking-tight">
          {brl(plano.priceMonthly)}
          <span className="text-base font-normal text-slate-500">/mês</span>
        </p>
      </div>

      {plano.porque && <p className="text-sm text-slate-300">{plano.porque}</p>}

      <ul className="space-y-1.5 text-sm">
        {(plano.canal?.bom || []).map((b: string) => (
          <li key={b} className="flex items-start gap-2 text-slate-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {b}
          </li>
        ))}
        {(plano.canal?.considere || []).map((c: string) => (
          <li key={c} className="flex items-start gap-2 text-slate-500">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/70" /> {c}
          </li>
        ))}
      </ul>

      <Button onClick={() => onEscolher(plano)} className="mt-auto w-full gap-2 rounded-xl">
        Começar com este <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-center text-xs text-slate-500">
        <ShieldCheck className="mr-1 inline h-3 w-3" /> 7 dias grátis · sem cartão
      </p>
    </Card>
  );
}
