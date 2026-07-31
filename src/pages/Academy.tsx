import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { GraduationCap, PlayCircle, Loader2, BookOpen, Clock } from "lucide-react";

/**
 * Área de membros com os vídeos de treinamento.
 *
 * O player abre na própria página, ao lado da lista: sair da plataforma para
 * assistir e voltar para aplicar é atrito, e quem está aprendendo desiste no
 * atrito.
 */

type Video = {
  id: string;
  title: string;
  description?: string | null;
  embedUrl: string;
  duracao?: string | null;
};

export default function Academy() {
  const [dados, setDados] = useState<any>(null);
  const [atual, setAtual] = useState<Video | null>(null);

  useEffect(() => {
    fetch("/api/academy/videos", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setDados(d);
        const primeiro = d?.modulos?.[0]?.videos?.[0];
        if (primeiro) setAtual(primeiro);
      })
      .catch(() => setDados({ modulos: [], total: 0 }));
  }, []);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <PageHeader
          icon={<GraduationCap className="w-5 h-5" />}
          title="Academy"
          subtitle="Videoaulas para tirar o máximo da plataforma, na ordem de quem está começando."
        />

        {!dados ? (
          <div className="py-20 text-center"><Loader2 className="mx-auto w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : dados.total === 0 ? (
          <Card className="p-12 text-center">
            <GraduationCap className="mx-auto w-8 h-8 text-muted-foreground mb-3" />
            <p className="font-medium">As aulas estão sendo gravadas</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Enquanto isso, a base de conhecimento já cobre o passo a passo de tudo por escrito.
            </p>
            <Link
              to="/ajuda"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <BookOpen className="w-4 h-4" /> Ir para a base de conhecimento
            </Link>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {atual && (
                <>
                  <div className="overflow-hidden rounded-2xl border bg-black">
                    <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                      <iframe
                        key={atual.id}
                        src={atual.embedUrl}
                        title={atual.title}
                        className="absolute inset-0 h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">{atual.title}</h2>
                    {atual.description && (
                      <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{atual.description}</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-5">
              {dados.modulos.map((m: any) => (
                <div key={m.titulo}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {m.titulo}
                  </p>
                  <div className="space-y-1.5">
                    {m.videos.map((v: Video) => {
                      const ativo = atual?.id === v.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => { setAtual(v); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          className={`flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                            ativo ? "border-primary/40 bg-primary/[0.06]" : "hover:border-primary/30 hover:bg-muted/50"
                          }`}
                        >
                          <PlayCircle className={`mt-0.5 h-4 w-4 shrink-0 ${ativo ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium leading-snug">{v.title}</span>
                            {v.duracao && (
                              <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Clock className="h-3 w-3" /> {v.duracao}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <Card className="p-4">
                <p className="text-sm font-medium">Prefere ler?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A base de conhecimento tem o passo a passo escrito de cada assunto.
                </p>
                <Link to="/ajuda" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                  <BookOpen className="w-3.5 h-3.5" /> Abrir
                </Link>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
