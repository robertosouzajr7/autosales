import { PushNotifications } from "@capacitor/push-notifications";
import { ehNativo, plataforma } from "./plataforma";
import { registrarAparelho, esquecerAparelho } from "./dados";

/**
 * Notificação no celular.
 *
 * É o que justifica o app existir. Sem isto, quem instalou ainda precisa
 * abrir o aplicativo para descobrir que tem gente esperando — e o cliente
 * fica no vácuo exatamente pelo tempo que ninguém abriu.
 *
 * Nada acontece no navegador: `ehNativo()` é falso lá, e o plugin nem é
 * chamado. A permissão é pedida DEPOIS do login, não na abertura: quem ainda
 * não sabe o que o app faz nega o pedido, e no iOS não há segunda chance
 * dentro do app.
 */

const CHAVE_TOKEN = "token_do_aparelho";

export type AoTocar = (dados: Record<string, string>) => void;

let jaLigado = false;

export async function ligarPush(aoTocar: AoTocar): Promise<void> {
  if (!ehNativo() || jaLigado) return;
  jaLigado = true;

  try {
    let permissao = await PushNotifications.checkPermissions();
    if (permissao.receive === "prompt" || permissao.receive === "prompt-with-rationale") {
      permissao = await PushNotifications.requestPermissions();
    }
    if (permissao.receive !== "granted") return;

    await PushNotifications.addListener("registration", async (t) => {
      try {
        localStorage.setItem(CHAVE_TOKEN, t.value);
        await registrarAparelho(t.value, plataforma());
      } catch { /* sem token registrado o app ainda funciona, só não avisa */ }
    });

    await PushNotifications.addListener("registrationError", (e) => {
      console.error("[Push] Falha ao registrar o aparelho:", JSON.stringify(e));
    });

    // Tocou no aviso: abre a conversa apontada, em vez de largar o atendente
    // na caixa de entrada para procurar de quem era.
    await PushNotifications.addListener("pushNotificationActionPerformed", (acao) => {
      const dados = (acao.notification?.data || {}) as Record<string, string>;
      if (dados.leadId) aoTocar(dados);
    });

    await PushNotifications.register();
  } catch (e) {
    console.error("[Push] Não foi possível ligar as notificações:", e);
  }
}

/** Sair da conta: este aparelho não pode continuar recebendo o que era seu. */
export async function desligarPush(): Promise<void> {
  const token = localStorage.getItem(CHAVE_TOKEN);
  if (token) {
    await esquecerAparelho(token).catch(() => { /* o servidor limpa no próximo envio */ });
    localStorage.removeItem(CHAVE_TOKEN);
  }
  if (!ehNativo()) return;
  await PushNotifications.removeAllListeners().catch(() => {});
  jaLigado = false;
}
