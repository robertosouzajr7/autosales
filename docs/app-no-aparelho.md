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

## O que ainda não existe

- **Face ID** — o botão só aparece no aparelho e está desabilitado; falta o
  plugin de biometria.
- **Notificações push** — nada ainda. É o que justifica o app existir, e é a
  última etapa.
- **Ícone e tela de abertura** — os padrões do Capacitor. Trocar é rápido, mas
  precisa das artes.
