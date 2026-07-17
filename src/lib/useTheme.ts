import { useState, useEffect } from "react";

/**
 * Tema claro/escuro compartilhado com a landing.
 * Lê/grava `landing_theme` no localStorage e alterna a classe `dark` no <html>,
 * exatamente como a LandingPage — assim login, cadastro e onboarding ficam
 * consistentes com o estilo escolhido pelo usuário. Escuro é o padrão.
 */
export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem("landing_theme") !== "light");

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDark]);

  const toggle = () =>
    setIsDark((v) => {
      const next = !v;
      localStorage.setItem("landing_theme", next ? "dark" : "light");
      return next;
    });

  return { isDark, toggle };
}
