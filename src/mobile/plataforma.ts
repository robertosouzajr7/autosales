import { Capacitor } from "@capacitor/core";

/**
 * Onde a aplicação está rodando.
 *
 * A regra que governa todo o app: a experiência da web — desktop e celular —
 * não muda. Por isso `ehApp()` é falso em qualquer navegador, e o shell
 * mobile só entra quando o código roda dentro do empacotamento nativo.
 *
 * A exceção é o modo de conferência: com `?app=1` na URL dá para ver as
 * telas do app no navegador durante o desenvolvimento. Ninguém digita isso
 * por acaso, e enquanto não for ligado o comportamento é byte a byte o de
 * hoje. `?app=0` desliga.
 */

const CHAVE = "modo_app_preview";

function previewLigado(): boolean {
  if (typeof window === "undefined") return false;
  const param = new URLSearchParams(window.location.search).get("app");
  if (param === "1") {
    try { sessionStorage.setItem(CHAVE, "1"); } catch { /* modo privado */ }
    return true;
  }
  if (param === "0") {
    try { sessionStorage.removeItem(CHAVE); } catch { /* modo privado */ }
    return false;
  }
  try { return sessionStorage.getItem(CHAVE) === "1"; } catch { return false; }
}

export function ehApp(): boolean {
  return Capacitor.isNativePlatform() || previewLigado();
}

/** `true` só no aparelho de verdade — o preview do navegador não conta. */
export function ehNativo(): boolean {
  return Capacitor.isNativePlatform();
}

export function plataforma(): "ios" | "android" | "web" {
  return Capacitor.getPlatform() as "ios" | "android" | "web";
}
