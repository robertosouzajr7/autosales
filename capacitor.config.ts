import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Empacotamento do app do atendente.
 *
 * O app é a MESMA aplicação da web, servida de dentro do aparelho. O que
 * muda é o que o roteador entrega: `ehApp()` (src/mobile/plataforma.ts) é
 * verdadeiro só aqui dentro, e é o que faz o shell mobile aparecer sem
 * alterar uma linha do que o navegador vê.
 *
 * `server.url` fica de fora de propósito: apontar o app para o site remoto
 * é o atalho que a Apple recusa como "site empacotado". O que vai para a
 * loja é o bundle do `dist`, e só as chamadas de API saem para a rede.
 */
const config: CapacitorConfig = {
  appId: "br.com.agentesvirtuais.atendente",
  appName: "Agentes Virtuais",
  webDir: "dist",
  ios: {
    // O app tem fundo claro; sem isto o rebote da rolagem mostra preto.
    backgroundColor: "#ffffff",
    contentInset: "always",
  },
  android: {
    backgroundColor: "#ffffff",
  },
  plugins: {
    Keyboard: {
      // O campo de mensagem precisa subir junto com o teclado; sem `body`
      // o compositor fica escondido atrás dele no iOS.
      resize: "body" as any,
    },
  },
};

export default config;
