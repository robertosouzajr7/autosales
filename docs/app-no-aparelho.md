# Rodar o app no iPhone

Duas formas de ver o app. A primeira não instala nada e serve para conferir
as telas; a segunda é o app de verdade, instalado no aparelho.

---

## 1. No navegador do celular (sem instalar nada)

Depois de publicar o frontend, abra no iPhone:

    https://seu-dominio.com.br/?app=1

É o mesmo código que vai para a loja: mesmas telas, mesmo login, mesmos
dados. O `?app=1` fica guardado na aba, então navegar por dentro não perde o
modo; `?app=0` desliga.

Em "Compartilhar → Adicionar à Tela de Início" o atalho guarda o `?app=1` e
abre sem barra de endereço.

Não dá para testar assim: Face ID, notificações e o token no Keychain — os
três dependem do empacotamento nativo.

> Atenção: são dados de produção. Assumir uma conversa e devolver à IA são
> ações reais em clientes reais. Crie um usuário atendente só para teste.

---

## 2. Instalado no iPhone (Xcode)

Precisa de um Mac com Xcode e de uma conta Apple. Para instalar no seu
próprio aparelho a conta gratuita basta — o app expira em 7 dias e é só
reinstalar. Para TestFlight ou App Store é preciso o Apple Developer Program
(US$ 99/ano).

### Uma vez só

```bash
# no Mac, com o repositório clonado
brew install cocoapods       # se ainda não tiver
npm install
```

### A cada build

O app é servido de dentro do aparelho, então `/api/...` não resolve sozinho:
é obrigatório dizer onde a API está.

```bash
VITE_API_URL=https://seu-dominio.com.br npm run app:ios
```

Sem `VITE_API_URL` o app abre e nenhuma chamada funciona (o console avisa).
Aponte para o mesmo host que serve `/api` hoje.

Isso compila o front, copia para o projeto nativo e abre o Xcode.

### No Xcode

1. Selecione o alvo **App** → aba **Signing & Capabilities**.
2. Marque **Automatically manage signing** e escolha seu **Team** (a conta
   Apple pessoal aparece como "Personal Team").
3. Se der conflito de identificador, mude o **Bundle Identifier** para algo
   único seu (`br.com.seunome.atendente`) — é só para teste local.
4. Conecte o iPhone pelo cabo, escolha-o na barra de cima e aperte ▶.
5. No iPhone: **Ajustes → Geral → VPN e Gerenciamento de Dispositivo** →
   confie no seu certificado de desenvolvedor. Sem isso o app não abre.

Depois disso, cada mudança no código é só rodar o comando de novo e apertar ▶.

---

## O que a API precisa aceitar

O app não tem o domínio do site como origem — o bundle vem de dentro do
aparelho. As origens `capacitor://localhost`, `ionic://localhost` e
`http://localhost` já entram sempre no CORS, mesmo com `ALLOWED_ORIGINS`
configurado. Não é preciso mexer em nada.

---

## Notificações push

O código está pronto dos dois lados. O que falta é a credencial — e ela é da
PLATAFORMA, não de cada conta: o app na loja é um só, e o projeto Firebase que
o assina também.

### No Firebase (uma vez)

1. Crie um projeto em <https://console.firebase.google.com>.
2. **Configurações do projeto → Contas de serviço → Gerar nova chave privada**.
   Baixa um JSON.
3. **Android**: adicione um app Android com o pacote
   `br.com.agentesvirtuais.atendente` e baixe o `google-services.json` para
   `android/app/`.
4. **iOS**: adicione um app iOS com o mesmo Bundle ID e baixe o
   `GoogleService-Info.plist` para `ios/App/App/`. Depois, em **Cloud
   Messaging**, envie a chave de autenticação APNs (`.p8`), que você gera no
   portal da Apple em **Certificates, Identifiers & Profiles → Keys**.

Sem a chave APNs o iOS não recebe nada, mesmo com o Firebase configurado — é
o Firebase que fala com a Apple por você.

### No painel

**Admin → Configurações da plataforma**, cole o JSON da conta de serviço. Ele
é validado na hora (JSON inválido ou sem `client_email`/`private_key` é
recusado) e **nunca volta pela API, nem mascarado**: contém a chave privada
do projeto inteiro.

### No Xcode

Alvo **App → Signing & Capabilities → + Capability**, adicione **Push
Notifications** e **Background Modes** (marcando *Remote notifications*).

### O que dispara notificação

- alguém entra na fila esperando um humano — vai para quem está **disponível**
  (quem está em pausa não é acordado; a segunda notificação ignorada ensina a
  ignorar todas);
- mensagem nova em conversa que já é sua;
- conversa transferida para você.

Cada atendente liga e desliga cada um desses em **Você → Avisos no celular**.
Conversa que a IA está conduzindo não notifica ninguém: seria um aviso por
mensagem de robô.

---

## Para publicar nas lojas

O que falta é trabalho de loja, não de código:

- **Ícone e tela de abertura** — hoje são os padrões do Capacitor. Precisa das
  artes (1024×1024 para o ícone).
- **Política de privacidade** — página pública obrigatória nas duas lojas.
- **Ficha da App Store** — capturas de tela por tamanho de aparelho, descrição,
  palavras-chave e o formulário de privacidade (*App Privacy*), onde é preciso
  declarar que o app coleta dados de contato do cliente.
- **Google Play** — mesma coisa, mais o formulário de *Data safety* e a
  declaração de permissões sensíveis.
- **Conta de teste para a revisão** — as duas lojas exigem login funcional
  para o revisor. Crie um atendente com dados de exemplo, não com clientes
  reais.

## O que ainda não existe

- **Face ID** — o botão só aparece no aparelho e está desabilitado; falta o
  plugin de biometria.
