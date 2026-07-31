import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Search, ChevronRight, ArrowLeft, Lightbulb, AlertTriangle,
  Rocket, Bot, MessageSquare, Calendar, BookUser, Megaphone, CreditCard, Users,
} from "lucide-react";
import { CATEGORIAS, buscarArtigos, type Artigo, type Bloco } from "@/content/wiki";

/**
 * Base de conhecimento.
 *
 * Três estados na mesma tela: categorias, lista de uma categoria e o artigo.
 * Sem rota por artigo de propósito — quem chega aqui está com uma dúvida na
 * mão e volta para o painel em seguida; navegar por estado é mais rápido que
 * carregar página.
 */

const ICONES: Record<string, any> = {
  Rocket, Bot, MessageSquare, Calendar, BookUser, Megaphone, CreditCard, Users,
};

export default function Ajuda() {
  const [busca, setBusca] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [artigo, setArtigo] = useState<Artigo | null>(null);

  const resultados = useMemo(() => buscarArtigos(busca), [busca]);
  const categoria = CATEGORIAS.find((c) => c.id === categoriaId) || null;

  const abrir = (a: Artigo) => { setArtigo(a); window.scrollTo(0, 0); };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
        <PageHeader
          icon={<BookOpen className="w-5 h-5" />}
          title="Base de conhecimento"
          subtitle="Como fazer cada coisa na plataforma, explicado sem jargão."
        />

        {!artigo && (
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setCategoriaId(null); }}
              placeholder="Buscar: janela de 24h, treinar agente, importar contatos…"
              className="pl-10 h-12 rounded-xl"
            />
          </div>
        )}

        {/* 1) Resultado da busca */}
        {!artigo && busca.trim().length >= 2 ? (
          resultados.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="font-medium">Nada encontrado para “{busca}”.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tente outras palavras — ou fale com o suporte, que a gente escreve o artigo que faltou.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {resultados.length} resultado(s) para “{busca}”
              </p>
              {resultados.map((a) => (
                <ItemArtigo key={a.slug} artigo={a} categoria={a.categoriaTitulo} onClick={() => abrir(a)} />
              ))}
            </div>
          )
        ) : artigo ? (
          /* 3) Artigo aberto */
          <ArtigoAberto artigo={artigo} onVoltar={() => setArtigo(null)} />
        ) : categoria ? (
          /* 2b) Artigos de uma categoria */
          <div className="space-y-4">
            <button
              onClick={() => setCategoriaId(null)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" /> Todas as categorias
            </button>
            <div>
              <h2 className="text-xl font-semibold">{categoria.titulo}</h2>
              <p className="text-sm text-muted-foreground">{categoria.descricao}</p>
            </div>
            <div className="space-y-2">
              {categoria.artigos.map((a) => (
                <ItemArtigo key={a.slug} artigo={a} onClick={() => abrir(a)} />
              ))}
            </div>
          </div>
        ) : (
          /* 2a) Categorias */
          <div className="grid gap-4 sm:grid-cols-2">
            {CATEGORIAS.map((c) => {
              const Icone = ICONES[c.icone] || BookOpen;
              return (
                <Card
                  key={c.id}
                  onClick={() => setCategoriaId(c.id)}
                  className="cursor-pointer p-5 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icone className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold">{c.titulo}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{c.descricao}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{c.artigos.length} artigo(s)</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ItemArtigo({ artigo, categoria, onClick }: { artigo: Artigo; categoria?: string; onClick: () => void }) {
  return (
    <Card onClick={onClick} className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{artigo.titulo}</p>
          {categoria && <Badge variant="outline" className="text-[10px]">{categoria}</Badge>}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{artigo.resumo}</p>
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
    </Card>
  );
}

function ArtigoAberto({ artigo, onVoltar }: { artigo: Artigo; onVoltar: () => void }) {
  return (
    <div className="space-y-5">
      <button onClick={onVoltar} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{artigo.titulo}</h2>
        <p className="mt-1 text-muted-foreground">{artigo.resumo}</p>
      </div>

      <article className="space-y-4">
        {artigo.blocos.map((b, i) => <BlocoRender key={i} bloco={b} />)}
      </article>
    </div>
  );
}

function BlocoRender({ bloco }: { bloco: Bloco }) {
  if (bloco.tipo === "texto") {
    return <p className="text-[15px] leading-relaxed text-foreground/90">{bloco.conteudo}</p>;
  }
  if (bloco.tipo === "lista") {
    return (
      <ul className="space-y-2">
        {bloco.itens.map((li, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-foreground/90">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{li}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (bloco.tipo === "passos") {
    return (
      <ol className="space-y-3">
        {bloco.itens.map((li, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-foreground/90">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span className="pt-0.5">{li}</span>
          </li>
        ))}
      </ol>
    );
  }
  if (bloco.tipo === "dica") {
    return (
      <div className="flex gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <p className="text-sm leading-relaxed text-foreground/90">{bloco.conteudo}</p>
      </div>
    );
  }
  return (
    <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p className="text-sm leading-relaxed text-foreground/90">{bloco.conteudo}</p>
    </div>
  );
}
