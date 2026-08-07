import { ReactNode, useEffect } from "react";

/**
 * A folha que sobe de baixo.
 *
 * É o padrão do iOS para o que acontece SEM sair de onde se está — e é
 * exatamente o caso aqui: escolher um item do catálogo, marcar um horário ou
 * conferir a ficha não é sair da conversa, é olhar de lado.
 *
 * Fechar pelo fundo escuro é obrigatório: numa tela de celular, o botão de
 * fechar fica longe do polegar, e quem quer sair sai pelo caminho mais curto.
 */
export function Folha({
  aberta, aoFechar, titulo, subtitulo, altura = "78%", children,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  subtitulo?: string;
  altura?: string;
  children: ReactNode;
}) {
  // Com a folha aberta, rolar embaixo dela move a conversa e desorienta.
  useEffect(() => {
    if (!aberta) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, [aberta]);

  if (!aberta) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Fechar"
        onClick={aoFechar}
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
      />
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[26px] bg-[#F7F7FA] shadow-[0_-20px_50px_rgba(0,0,0,0.25)]"
        style={{ height: altura }}
      >
        <div className="grid shrink-0 place-items-center pb-1.5 pt-2.5">
          <span className="h-[5px] w-[38px] rounded-full bg-[rgba(60,60,67,0.3)]" />
        </div>
        <div className="shrink-0 px-5 pb-3.5 pt-1.5">
          <h3 className="text-[22px] font-bold tracking-[-0.03em] text-[#0F172A]">{titulo}</h3>
          {subtitulo && <p className="mt-1 text-[13.5px] text-[rgba(60,60,67,0.6)]">{subtitulo}</p>}
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
