# Guia completo — conectar o Instagram Direct ao agente

O Instagram não conecta por QR Code como o WhatsApp. A Meta exige um **app de desenvolvedor** que faz a ponte entre o Instagram e a plataforma. Parece muito, mas é uma configuração única de ~15–20 minutos. Siga na ordem.

> Onde aparecer `{SUA_API}`, use o domínio da sua API — ex.: `https://agentesvirtuais.com`.

---

## Pré-requisitos (5 minutos)

1. **Conta Instagram Profissional** (Comercial ou Criador de conteúdo) — não pode ser conta pessoal.
   - No app do Instagram: **Configurações → Conta → Mudar para conta profissional**.
2. **Página do Facebook** vinculada a esse Instagram.
   - Na Página do Facebook: **Configurações → Contas vinculadas → Instagram → Conectar conta**.
3. **Conta na Meta for Developers** (grátis): acesse [developers.facebook.com](https://developers.facebook.com/) e faça login com o Facebook que administra a Página.

---

## Passo 1 — Criar o app na Meta

1. Abra 👉 **[developers.facebook.com/apps/create](https://developers.facebook.com/apps/create/)**
2. Em "Do que você precisa?", selecione **"Outro"** → **Avançar**.
3. Tipo do app: **"Empresa" (Business)** → **Avançar**.
4. Dê um nome (ex.: `Agentes Virtuais - IG`), confirme o e-mail e crie.

## Passo 2 — Adicionar o produto Instagram

1. No painel do app (menu lateral **Painel/Dashboard**), procure o card **"Instagram"** e clique em **Configurar**.
   - Link direto (troque `SEU_APP_ID`): `https://developers.facebook.com/apps/SEU_APP_ID/instagram/`
2. Escolha a opção de **API do Instagram com mensagens** (Instagram Messaging / "Configuração de API com login do Instagram" ou "Messenger API para Instagram").

## Passo 3 — Vincular a Página e gerar o Token de Acesso

1. Abra 👉 **[Graph API Explorer](https://developers.facebook.com/tools/explorer/)**
2. No topo direito, em **"Meta App"**, selecione o app que você criou.
3. Clique em **"Gerar token de acesso"** (Generate Access Token) e faça login/autorize.
4. Em **"Permissões"** (Add a Permission), marque estas:
   - `instagram_basic`
   - `instagram_manage_messages`
   - `pages_show_list`
   - `pages_manage_metadata`
   - `pages_messaging`
5. Clique em **"Gerar token de acesso"** de novo para aplicar as permissões. Autorize a Página e o Instagram quando o Facebook perguntar.

## Passo 4 — Descobrir o Page ID e o Instagram Account ID

Ainda no **Graph API Explorer**, faça duas consultas (cole no campo de URL e clique em **Enviar/Submit**):

**a) Pegar o Page ID e o Page Access Token:**
```
me/accounts
```
Na resposta, ache a sua Página. Anote:
- `"id"` → esse é o **Page ID** (Facebook Page ID).
- `"access_token"` → esse é o **Page Access Token** que você vai colar no painel (é diferente do token do usuário!).

**b) Pegar o Instagram Business Account ID** (troque `PAGE_ID` pelo id acima):
```
PAGE_ID?fields=instagram_business_account
```
Na resposta, `instagram_business_account.id` → esse é o **Instagram Account ID**.

> 💡 Guarde os 3 valores num bloco de notas: **Page ID**, **Instagram Account ID** e **Page Access Token**.

## Passo 5 — Token que não expira (recomendado)

O token do Explorer expira em ~1 hora. Para não cair a conexão:
1. Vá em 👉 **[Ferramenta de Tokens de Acesso](https://developers.facebook.com/tools/debug/accesstoken/)** e cole o Page Access Token para conferir a validade.
2. Para gerar um **token de longa duração** (60 dias) ou permanente, o caminho mais simples é: no Graph API Explorer, troque o token de usuário por um de longa duração e refaça o `me/accounts` — o `access_token` da Página herdado de um user token de longa duração **não expira** enquanto as permissões forem mantidas.
   - Referência oficial: [Tokens de longa duração](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/).

## Passo 6 — Configurar o Webhook (para o agente RECEBER as mensagens)

1. No app, menu lateral **Webhooks** (ou dentro de Instagram → **Configurar webhooks**).
   - Link direto: `https://developers.facebook.com/apps/SEU_APP_ID/webhooks/`
2. No seletor, escolha **"Instagram"** e clique em **"Assinar este objeto" / Subscribe**.
3. Preencha:
   - **URL de callback (Callback URL):** `{SUA_API}/api/webhook/meta`
   - **Token de verificação (Verify Token):** o valor definido na variável de ambiente **`META_VERIFY_TOKEN`** do servidor. (Se você não sabe qual é, defina-o no EasyPanel e use o mesmo texto aqui — precisa ser idêntico.)
4. Clique em **"Verificar e salvar"**. Se der certo, o campo fica verde. (Se der erro, a API precisa estar no ar e o `META_VERIFY_TOKEN` precisa bater exatamente.)
5. Ainda nos campos do webhook do Instagram, **assine o campo `messages`** (marque a caixa e salve).

## Passo 7 — Colar no painel

No painel **Conexões → aba Instagram**, preencha:
| Campo do painel | Valor (dos passos acima) |
|---|---|
| Nome | Um apelido, ex.: `@sua_conta` |
| Instagram Business Account ID | do Passo 4b |
| Facebook Page ID | do Passo 4a |
| Page Access Token | do Passo 4a (o `access_token` da Página) |

Clique em **Conectar Instagram**. Pronto — mande uma DM de teste de outra conta e veja o agente responder.

---

## Erros comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Webhook não verifica (erro ao salvar) | `META_VERIFY_TOKEN` diferente, ou API fora do ar | Confirme que o token no Meta é idêntico ao do servidor e que `{SUA_API}/api/webhook/meta` responde |
| Conecta, mas agente não responde DMs | Campo `messages` não assinado, ou permissão faltando | Reveja Passo 6.5 (assinar `messages`) e as permissões do Passo 3 |
| Some depois de 1 hora | Token de curta duração | Gere token de longa duração (Passo 5) |
| "Conta profissional exigida" | Instagram ainda é pessoal | Converta para Comercial/Criador (Pré-requisito 1) |
| Não acha `instagram_business_account` | Instagram não vinculado à Página | Refaça o Pré-requisito 2 |

## Modo de desenvolvimento vs. produção

Enquanto o app estiver em **"Desenvolvimento"**, só contas com papel no app (admin/testador) conseguem usar. Para atender clientes de verdade, o app precisa passar pela **Revisão do App (App Review)** da Meta para as permissões `instagram_manage_messages` e `pages_messaging`. Para uso interno na sua própria conta, o modo desenvolvimento já basta.

---

## Links diretos (resumo)

- Criar app: https://developers.facebook.com/apps/create/
- Seus apps: https://developers.facebook.com/apps/
- Graph API Explorer (tokens e IDs): https://developers.facebook.com/tools/explorer/
- Depurar/checar token: https://developers.facebook.com/tools/debug/accesstoken/
- Docs Instagram Messaging: https://developers.facebook.com/docs/messenger-platform/instagram/
