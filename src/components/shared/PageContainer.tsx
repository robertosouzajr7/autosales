import { cn } from "@/lib/utils";

/**
 * Moldura padrão das páginas do painel.
 *
 * Algumas telas renderavam o conteúdo direto embaixo do layout, sem
 * container: o texto encostava na borda da janela e a largura da linha
 * crescia com o monitor, o que deixava a leitura desconfortável e cada
 * página com um respiro diferente. Aqui fica um só lugar para essa medida.
 */
export function PageContainer({
  children,
  className,
  width = "default",
}: {
  children: React.ReactNode;
  className?: string;
  /** `wide` para telas de tabela/quadro que ganham com mais espaço. */
  width?: "default" | "wide" | "narrow";
}) {
  const larguras = {
    narrow: "max-w-4xl",
    default: "max-w-6xl",
    wide: "max-w-[1600px]",
  };

  return (
    <div className={cn("mx-auto w-full p-4 sm:p-6 lg:p-8", larguras[width], className)}>
      {children}
    </div>
  );
}

export default PageContainer;
