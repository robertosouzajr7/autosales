import { Preferences } from "@capacitor/preferences";
import { ehNativo } from "./plataforma";

/**
 * Onde o token de sessão mora no app.
 *
 * No navegador continua em `localStorage`, como sempre — o interceptador de
 * fetch do `main.tsx` lê de lá, e mexer nisso mudaria a web. No aparelho o
 * token vai também para o armazenamento do sistema (Keychain no iOS,
 * EncryptedSharedPreferences no Android), que sobrevive à limpeza do WebView
 * e não fica exposto a script injetado numa página.
 *
 * Os dois convivem: o `localStorage` segue como a fonte que o resto do
 * código lê, e o armazenamento seguro é quem repõe o valor quando o app
 * abre de novo. Isso evita reescrever cada `localStorage.getItem("token")`
 * espalhado pelas 38 telas.
 */

const CHAVES = ["token", "user", "userId", "userName", "userRole", "tenantId", "tenantName", "userPlan"];

/** Repõe a sessão guardada pelo sistema. Chamar uma vez, antes de renderizar. */
export async function restaurarSessao(): Promise<void> {
  if (!ehNativo()) return;
  for (const chave of CHAVES) {
    try {
      const { value } = await Preferences.get({ key: chave });
      if (value && !localStorage.getItem(chave)) localStorage.setItem(chave, value);
    } catch { /* sem armazenamento: segue com o que houver no WebView */ }
  }
}

/** Guarda a sessão no armazenamento do sistema depois do login. */
export async function guardarSessao(): Promise<void> {
  if (!ehNativo()) return;
  for (const chave of CHAVES) {
    const valor = localStorage.getItem(chave);
    try {
      if (valor) await Preferences.set({ key: chave, value: valor });
      else await Preferences.remove({ key: chave });
    } catch { /* ignora */ }
  }
}

/** Sair: limpa os dois lados, senão o app reabre logado. */
export async function encerrarSessao(): Promise<void> {
  for (const chave of CHAVES) localStorage.removeItem(chave);
  if (!ehNativo()) return;
  for (const chave of CHAVES) {
    try { await Preferences.remove({ key: chave }); } catch { /* ignora */ }
  }
}
