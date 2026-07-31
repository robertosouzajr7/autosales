import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LogoIcon } from "@/components/Logo";
import { ArrowLeft } from "lucide-react";
import { DOCUMENTOS, VERSAO_DOCUMENTOS, VIGENTE_DESDE } from "@/content/legal";

/**
 * Termos de Uso e Política de Privacidade na mesma tela.
 *
 * O texto vem de src/content/legal.ts, que é a mesma fonte usada para gravar
 * a versão aceita no cadastro — documento e prova do aceite não podem
 * divergir. Um sumário lateral porque documento jurídico se lê por cláusula,
 * não do começo ao fim.
 */
export default function Legal({ slug }: { slug?: string }) {
  const params = useParams();
  const navigate = useNavigate();
  const chave = slug || params.slug || "termos";
  const doc = DOCUMENTOS[chave];

  useEffect(() => { window.scrollTo(0, 0); }, [chave]);

  if (!doc) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-white">
        <div className="text-center space-y-3">
          <p className="text-lg">Documento não encontrado.</p>
          <Link to="/" className="text-primary underline underline-offset-4">Voltar para o início</Link>
        </div>
      </div>
    );
  }

  const ancora = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
            <LogoIcon className="h-7 w-7" />
            <span className="text-sm font-bold tracking-tight">
              Agentes <span className="text-primary">Virtuais</span>
            </span>
          </button>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              to="/termos"
              className={chave === "termos" ? "font-medium text-white" : "text-slate-400 hover:text-white"}
            >
              Termos de Uso
            </Link>
            <Link
              to="/privacidade"
              className={chave === "privacidade" ? "font-medium text-white" : "text-slate-400 hover:text-white"}
            >
              Privacidade
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-4xl">{doc.titulo}</h1>
          <p className="mt-2 max-w-2xl text-slate-400">{doc.resumo}</p>
          <p className="mt-3 text-xs text-slate-500">
            Versão {VERSAO_DOCUMENTOS} · em vigor desde {VIGENTE_DESDE}
          </p>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
          {/* Sumário: documento jurídico se consulta por cláusula. */}
          <nav className="hidden lg:block">
            <div className="sticky top-24 space-y-1.5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Nesta página</p>
              {doc.secoes.map((s) => (
                <a
                  key={s.titulo}
                  href={`#${ancora(s.titulo)}`}
                  className="block text-[13px] leading-snug text-slate-400 hover:text-white"
                >
                  {s.titulo}
                </a>
              ))}
            </div>
          </nav>

          <article className="max-w-2xl space-y-8">
            {doc.secoes.map((s) => (
              <section key={s.titulo} id={ancora(s.titulo)} className="scroll-mt-24">
                <h2 className="text-lg font-semibold text-white">{s.titulo}</h2>
                <div className="mt-3 space-y-3">
                  {s.paragrafos.map((p, i) => (
                    <p key={i} className="text-[15px] leading-relaxed text-slate-300">{p}</p>
                  ))}
                  {s.itens && (
                    <ul className="mt-2 space-y-2">
                      {s.itens.map((li, i) => (
                        <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-slate-300">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{li}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </article>
        </div>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-500">
        {doc.slug === "termos" ? (
          <>Veja também a <Link to="/privacidade" className="text-slate-400 underline underline-offset-2 hover:text-white">Política de Privacidade</Link>.</>
        ) : (
          <>Veja também os <Link to="/termos" className="text-slate-400 underline underline-offset-2 hover:text-white">Termos de Uso</Link>.</>
        )}
      </footer>
    </div>
  );
}
