import { useState, useEffect } from "react";

/**
 * Tema claro/escuro do app inteiro.
 *
 * Era exclusivo da landing (chave `landing_theme`), enquanto o painel forçava
 * claro por conta própria — duas fontes de verdade para a mesma decisão. Aqui
 * fica uma só, e quem quiser fixar um tema numa tela específica o faz na tela.
 *
 * A chave antiga é lida uma vez na migração para ninguém perder a escolha.
 */

const CHAVE = "tema";
const CHAVE_ANTIGA = "landing_theme";

function temaSalvo(): "claro" | "escuro" | null {
  const atual = localStorage.getItem(CHAVE);
  if (atual === "claro" || atual === "escuro") return atual;

  const antigo = localStorage.getItem(CHAVE_ANTIGA);
  if (antigo === "light") return "claro";
  if (antigo === "dark") return "escuro";
  return null;
}

export function useTheme(padrao: "claro" | "escuro" = "escuro") {
  const [isDark, setIsDark] = useState<boolean>(() => (temaSalvo() ?? padrao) === "escuro");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggle = () =>
    setIsDark((v) => {
      const proximo = !v;
      localStorage.setItem(CHAVE, proximo ? "escuro" : "claro");
      return proximo;
    });

  return { isDark, toggle };
}
