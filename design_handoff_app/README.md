# Handoff do app do atendente (iPhone)

`App Conversas.dc.html` é o design das 12 telas do app: login, caixa de
entrada, fila, chat (IA atendendo e atendente assumido), respostas rápidas,
catálogo, agendar, ficha do cliente, busca, notificações e perfil.

O arquivo apresenta **duas direções para a caixa de entrada** e trata as duas
como alternativas — 1a com a fila no topo (marcada como fluxo principal) e 1b
com abas por estado. Só uma vai para o código.

## Como visualizar

    node scripts/shot-appdesign.mjs

O arquivo carrega React e Babel de CDN. Como a saída externa é bloqueada no
ambiente de desenvolvimento, o script serve as mesmas versões a partir do
`node_modules` — sem isso a página renderiza em branco, e os `{{ }}` do
template aparecem crus. As imagens saem em /var/lib/postgresql/app-NN.png.

Requer `playwright-core` e `@babel/standalone`, que não são dependências do
projeto: `npm i --no-save playwright-core @babel/standalone@7`.

## O que o design pede e o backend ainda não tem

- **Sugestão da IA** — gerar a resposta para o atendente revisar antes de
  enviar. Hoje a IA responde direto ou fica calada; não existe "gerar sem
  enviar".
- **Respostas rápidas** — hoje é uma constante no código do painel
  (`RESPOSTAS_RAPIDAS` em Conversations.tsx). O design pede criar, buscar por
  atalho e contar uso: precisa de tabela e CRUD.
- **Disponibilidade do atendente** — não existe no `User`, e é o que decide
  para quem a fila transfere quando alguém entra em pausa.
- **Push** — não existe nada; é o que justifica o app existir.
