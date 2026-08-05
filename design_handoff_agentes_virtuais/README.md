# Handoff: Redesign da landing page e do painel — Agentes Virtuais

## Visão geral

Redesign completo do produto **Agentes Virtuais** (agentes de IA que atendem, vendem e agendam no WhatsApp, Instagram e chat do site): a landing page pública e todas as telas do painel logado, mais as telas de entrada (login, cadastro, onboarding, 404).

O repositório de origem é `robertosouzajr7/autosales` (branch `main`), React + TypeScript com Tailwind e componentes shadcn/ui. O redesign preserva a arquitetura de navegação e o vocabulário do produto atual — muda hierarquia, densidade, tipografia e a forma de apresentar informação.

## Sobre os arquivos de design

Os arquivos `.dc.html` deste pacote são **referências de design feitas em HTML** — protótipos que mostram a aparência e o comportamento pretendidos. **Não são código de produção para copiar.**

A tarefa é **recriar esses designs no codebase existente** (`autosales`: React 18 + TypeScript + Tailwind + shadcn/ui + React Router), usando os padrões e a biblioteca de componentes que já estão lá. Onde este documento cita um valor literal (`#2563EB`, `13.5px`), traduza para o token equivalente do Tailwind/tema do projeto — não introduza CSS solto.

Cada arquivo contém **várias telas** controladas por um estado interno (`this.state.tela`) e uma barra de abas ou a própria sidebar. No app real cada tela é uma rota separada.

## Fidelidade

**Alta fidelidade (hifi).** Cores, tipografia, espaçamento, densidade e estados são finais. Recrie a UI fielmente. Os dados são realistas mas fictícios (clínica odontológica "Vida Plena") — substitua por dados reais da API.

Dois pontos **não confirmados pelo cliente**, marcados como exemplo:
- Preços dos planos: Essencial R$ 189/mês, Profissional R$ 399/mês (e as variantes anuais).
- Limites por plano (conversas, agentes, colaboradores, tokens de IA).

---

## Sistema de design

### Tokens de cor

O painel inteiro roda sobre variáveis CSS com dois temas. No app, mapeie para as classes do Tailwind/`globals.css` já existentes (`--background`, `--card`, `--muted-foreground`, etc.) em vez de duplicar.

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--bg` | `#F5F8FC` | `#080C16` | fundo da página |
| `--surface` | `#FFFFFF` | `#0E1525` | cards, header, sidebar interna |
| `--surface-2` | `#F8FAFC` | `#131C2E` | inputs, chips, cabeçalho de tabela |
| `--border` | `#E4EAF3` | `rgba(255,255,255,0.08)` | bordas de card e input |
| `--border-soft` | `#EEF2F8` | `rgba(255,255,255,0.05)` | divisores internos de lista |
| `--text` | `#0F172A` | `#F1F5F9` | texto primário |
| `--muted` | `#64748B` | `#94A3B8` | texto secundário |
| `--faint` | `#94A3B8` | `#64748B` | rótulos, placeholders |
| `--accent` | `#2563EB` | `#2563EB` | ação primária (fundo de botão) |
| `--accent-text` | `#2563EB` | `#60A5FA` | azul sobre fundo (links, ícones) |
| `--accent-soft` | `#EFF6FF` | `rgba(37,99,235,0.15)` | fundo de destaque azul |
| `--rail` | `#0F172A` | `#05080F` | fundo da sidebar |
| `--rail-glow` | `rgba(37,99,235,0.24)` | `rgba(37,99,235,0.3)` | brilho radial da sidebar |
| `--shadow` | `0 1px 2px rgba(15,23,42,0.05)` | `0 1px 2px rgba(0,0,0,0.4)` | elevação de card |

**Importante:** `--accent` e `--accent-text` são tokens distintos. Azul `#2563EB` sobre fundo escuro não passa contraste; no tema escuro o texto/ícone azul vira `#60A5FA`, mas o **fundo** de botão continua `#2563EB` (com texto branco).

O tema escuro é aplicado com `document.documentElement.setAttribute('data-theme','dark')`. No app, use o mecanismo de tema que já existir (classe `dark` do Tailwind) e persista a escolha.

### Cores semânticas (fixas nos dois temas)

| Significado | Fundo | Texto/ícone | Ponto |
| --- | --- | --- | --- |
| Sucesso / conectado / concluído | `rgba(34,160,107,0.12)` | `#15803D` | `#22A06B` |
| Atenção / risco / em análise | `#FEF3C7` | `#B45309` | `#F59E0B` |
| Erro / reprovado / IA travou | `rgba(239,68,68,0.12)` | `#B91C1C` | `#EF4444` |
| Informação / IA atendendo | `rgba(37,99,235,0.12)` | `#1D4ED8` | `#2563EB` |
| Proposta (etapa do funil) | `rgba(168,85,247,0.12)` | `#7E22CE` | `#A855F7` |
| Instagram | `rgba(219,39,119,0.10)` | `#DB2777` | `#DB2777` |

Cores das etapas do funil (Kanban e barras): Novos `#93C5FD` → Qualificando `#60A5FA` → Proposta `#3B82F6` → Agendado `#2563EB` → Fechado `#1D4ED8`. Nos pontos coloridos das colunas: Novos `#94A3B8`, Qualificando `#3B82F6`, Proposta `#A855F7`, Agendado `#22A06B`, Fechado `#2563EB`.

### Tipografia

**Inter** (400/500/600/700) em tudo. `letter-spacing: -0.014em` no `body`.

| Papel | Tamanho | Peso | Tracking |
| --- | --- | --- | --- |
| H1 hero (landing) | 68px | 700 | −0.045em |
| H2 seção (landing) | 44px | 700 | −0.04em |
| H2 CTA final (landing) | 52px | 700 | −0.045em |
| Título de página (painel) | 22px | 700 | −0.035em |
| Título no header (painel) | 15.5px | 600 | −0.025em |
| KPI grande | 46px | 700 | −0.045em |
| KPI secundário | 32px | 700 | −0.04em |
| Número em card | 28px / 20px | 700 | −0.04em / −0.03em |
| Título de card | 14px | 600 | herda |
| Corpo | 13.5px | 400/500 | herda |
| Corpo secundário | 12.5px | 400 | herda |
| Rótulo de campo | 11.5–12px | 600 | herda |
| Rótulo de grupo (uppercase) | 10–11px | 600 | 0.12–0.14em |
| Célula de tabela | 13px | 400/600 | herda |
| Meta / timestamp | 11–11.5px | 400 | herda |

Um acento serifado (**Instrument Serif**, itálico, peso 400) aparece só na landing, em uma palavra por título de seção: "sem contratar", "num lugar só", "frequentes".

Todo número que muda (KPI, valor, hora, contador) usa `font-variant-numeric: tabular-nums`.

### Espaçamento e forma

- Raio: 8–10px controles pequenos, 11–12px inputs e itens de lista, 14px cards do painel, 16–22px cards da landing, 999px pílulas.
- Sidebar: 236px expandida, 68px colapsada (transição `width .22s cubic-bezier(.22,1,.36,1)`).
- Header do painel: 60px de altura, 24px de padding lateral.
- Conteúdo: `padding: 22px 24px 40px`, `max-width` por tela (900–1380px), `margin: 0 auto`.
- Gap padrão entre seções: 16–18px. Entre cards de grid: 16px.
- Item de navegação: 38px de altura, `padding: 0 11px`, `gap: 12px`.
- Linha de lista/tabela: 13–14px de padding vertical, divisor `--border-soft`.

### Regra crítica de layout

**Todo elemento com `height` fixo e rótulo de uma linha precisa de `white-space: nowrap`.** Isso vale para botões, pílulas, chips, itens de navegação e o lockup da marca. Sem isso o texto quebra em duas linhas e transborda o container em vez de reflowir — acontece no primeiro paint (antes da Inter carregar), em zoom diferente de 100% e com fonte fallback. Onde o texto pode ser longo demais, acrescente `overflow: hidden; text-overflow: ellipsis` no wrapper.

---

## Layout base do painel (compartilhado)

Presente em `Dashboard Redesign`, `Painel Atendimento`, `Painel Automacao`, `Painel Conteudo`, `Painel Configuracao`. Extraia como um único layout (`DashboardLayout`).

**Sidebar** (`--rail` + `background-image: radial-gradient(130% 55% at 0% 0%, var(--rail-glow), transparent 58%)`):
1. **Marca**, 64px de altura, borda inferior `rgba(255,255,255,0.07)`: logo 30×30 com `border-radius: 9px` e `linear-gradient(135deg,#2563EB,#7C5CFF)`, sombra `0 8px 18px -6px rgba(37,99,235,0.7)`; ao lado, nome em 13.5px/700 (com "Virtuais" em `#60A5FA`) e o nome do negócio em 11px `#64748B`. Ambos com `nowrap` + elipse.
2. **Navegação** em 5 grupos, cada um com um rótulo uppercase 10px/600 tracking 0.14em em `#475569`:
   - Painel: Dashboard, Relatórios
   - Atendimento: Conversas, Agendamentos, Funil de clientes, Clientes
   - Automação: Agente de IA, Fluxos, Lembretes
   - Conteúdo: Meu negócio, Catálogo, Templates, Disparos
   - Configuração: Conexões, Colaboradores, Assinatura, Configurações
   Item inativo: texto `#94A3B8`, ícone `#64748B`, fundo transparente. Ativo: texto `#FFFFFF`, ícone `#60A5FA`, fundo `rgba(255,255,255,0.09)`. Hover: fundo `rgba(255,255,255,0.06)`, texto branco. Badges numéricos à direita (Conversas em espera usa `#F59E0B`, os demais `#2563EB`).
3. **Créditos de IA** (só quando expandida): card `rgba(255,255,255,0.05)`, barra de 5px, "7,8M / 12,6M" e "62%".
4. **Usuário**: avatar 30px `#2563EB`, nome 12.5px branco, cargo 11px `#64748B`.
5. **Botão de recolher**, 34px, com ícone de chevron + rótulo "Recolher menu" quando expandida.

Quando colapsada (68px): só ícones, rótulos e cards somem, os separadores de grupo viram uma linha de 22px, cada item ganha `title` para tooltip nativo.

**Header** (60px, `--surface`, borda inferior): título da tela (15.5px/600) · busca de 36px com atalho `⌘K` · pílula de status "WhatsApp conectado" (verde, com ponto pulsando em animação `pulseDot` de 2s) · botão de tema (36×36) · notificações com ponto vermelho · avatar 34px.

---

## Telas

### 1. `Landing Redesign.dc.html` — landing page pública

Página longa, alternando claro → escuro → claro, com transições em onda SVG. Largura de conteúdo 1240px (1080px nas seções de comparativo, planos e FAQ), 840px no FAQ.

**Header** sticky, 70px, `rgba(255,255,255,0.82)` + `backdrop-filter: blur(20px)`, borda inferior `#E9EEF5`. Marca à esquerda, nav central (Resultados, Recursos, Funil, Integrações, Planos, FAQ — cada link com `padding: 8px 12px`, raio 8px, hover `background:#F1F5F9`), "Entrar" + botão "Testar 7 dias grátis" (40px, `#2563EB`, sombra `0 8px 20px -6px rgba(37,99,235,0.5)`).

**Hero** (claro, `radial-gradient(120% 80% at 50% -10%, #EEF4FF 0%, #F8FAFF 42%, #FFFFFF 78%)` com grade de 64px em `#E2E8F0` a 35% de opacidade, mascarada por `radial-gradient(70% 55% at 50% 30%, #000, transparent)`), centralizado:
- Pílula "Novo · Funil Kanban com IA que move o lead sozinho".
- H1 68px: "Automatize seus chats do WhatsApp com **Assistentes de IA**" (a segunda parte em `#2563EB`), `max-width: 900px`.
- Subtítulo 18px `#475569`, `max-width: 620px`.
- CTAs: "Testar 7 dias grátis" (54px, azul, sombra forte) + "Ver demonstração" (54px, branco, borda `#DBE4F0`, ícone de play).
- Três garantias com check verde `#22A06B`: sem cartão, conecta em 1 minuto, cancele em um clique.
- **Mockup grande do painel**: janela de navegador (barra 38px `#F1F5F9`, três semáforos, URL `app.agentesvirtuais.com/conversations`) mostrando a tela de Conversas em 520px de altura — rail de ícones 64px, lista de 6 conversas 264px, thread com bolhas, card de catálogo e confirmação de agendamento. Sombra `0 40px 80px -30px rgba(15,23,42,0.35)`; halo azul atrás.
- Faixa de logos: 6 nomes em 19px/700 `#475569` a 55% de opacidade.
- Onda de transição: `<svg viewBox="0 0 1440 110">` com `path d="M0,10 C340,110 1100,110 1440,10 L1440,110 L0,110 Z"` preenchido em `#080C16`; largura `calc(100% + 56px)` com `margin: 0 -28px` para sangrar.

**Bloco escuro** (`#080C16`), quatro seções:
1. **Resultados**: 4 depoimentos em grid — os dois primeiros em gradiente azul (`linear-gradient(165deg,#2563EB,#1D4ED8)` e `…#1D4ED8,#1E40AF`), os dois últimos em `#0E1525`. Cada um com 5 estrelas, citação 14px e autor com avatar de iniciais. Abaixo, 4 números: `< 5s`, `24/7`, `−48%`, `+3x`.
2. **Recursos**: bento de 3 colunas (`1.35fr 1fr 1fr`) — card grande do agente com lista de documentos, card de canais com três pílulas coloridas, card azul de agenda com "−48%"; depois grid de 4×2 com 8 recursos menores.
3. **Funil Kanban**: card de 22px de raio com sombra azul `0 40px 90px -40px rgba(37,99,235,0.5)`, 5 colunas de cards com nome, nota, valor e canal; abaixo, 4 benefícios com ícone.
4. **Integrações**: grid de 6×2 com 12 serviços (nome + categoria), cards de 84px.
5. **Comparativo**: duas colunas — "Sem Agentes Virtuais" (`#0E1525`, itens com X vermelho) e "Com Agentes Virtuais" (borda azul, gradiente, itens com check verde `#4ADE80`), 5 itens cada.
6. Onda de volta ao claro: `path d="M0,100 C340,0 1100,0 1440,100 L1440,110 L0,110 Z"` preenchido com `#F8FAFF` (a cor da seção de destino, não da origem).

**Planos** (`#F8FAFF`): toggle Mensal/Anual (−20%), dois cards lado a lado. Essencial (branco, borda `#DBE4F0`, "Conexão por QR Code", R$ 189, lista de limites como `<dl>`, recursos com check verde e dois itens riscados). Profissional (fundo `#0F172A` com gradiente radial azul, borda `#2563EB`, selo "MAIS ESCOLHIDO" posicionado em `top:-13px`, R$ 399, 7 recursos). Abaixo, faixa de garantia de 7 dias com escudo.

**FAQ** (branco): 7 itens em accordion, um aberto por vez (`state.aberta`, índice; clicar no aberto fecha). Chevron gira entre baixo e cima.

**CTA final** (`#EEF4FF`, com halo radial azul) e **footer** (`#080C16`, 4 colunas + linha legal).

Botão flutuante de WhatsApp: 56px, `#22A06B`, `position: fixed`, canto inferior direito.

### 2. `Dashboard Redesign.dc.html` — home do painel

Ordem de leitura deliberada: saudação → o que falta configurar → números → o que exige ação → agenda → funil e conexões.

1. **Saudação**: data uppercase 12px, "Boa tarde, Roberto" em 26px/700, linha com o que exige atenção. À direita: "Agenda de hoje" (secundário) e "Abrir conversas" (primário).
2. **Checklist de setup**: card `--accent-soft` com borda `--accent`. Anel de progresso SVG 44px (`r=19`, `stroke-width=4`, `stroke-dasharray=119.4`, `stroke-dashoffset=39.8` para 2/3, rotacionado −90°) com "2/3" no centro; título, descrição, dois passos riscados com check verde e botão "Criar agente de IA".
3. **KPIs**, grid `1.55fr 1fr 1fr 1fr`:
   - Card principal "Conversas atendidas": 1.042 em 46px, delta "+18,4%" verde com seta, sparkline SVG 300×64 (gradiente `#2563EB` 0.28 → 0, linha 2.5px) e rodapé "905 resolvidas pela IA · 137 passaram para a equipe".
   - Três secundários (Agendamentos 128, Comparecimento 92%, Resposta média 4s): rótulo + ícone em quadrado `--accent-soft` 30px, número 32px, delta verde + contexto.
4. **"Precisa de você"** (`1.15fr 1fr` com a agenda): header com ponto laranja pulsando e badge "3". Cada linha: avatar com selo de canal, nome + tempo de espera, prévia da mensagem, tag de estado e botão "Responder" (outline azul, 32px).
5. **Agenda de hoje**: 5 linhas com hora tabular, barra vertical de 3px colorida por estado, nome, serviço e pílula (Concluída verde, Agora azul, **Risco de falta** laranja, Agendada neutra).
6. **Funil** (`1.6fr 1fr` com conexões): 5 barras horizontais de 28px, largura proporcional (100%/67%/32%/21%/9%), número dentro da barra, taxa de conversão à direita; rodapé com Em negociação R$ 28.400, Fechado R$ 11.900, Ticket médio R$ 1.322.
7. **Canais e conexões**: 4 linhas com ícone colorido, nome, detalhe e pílula de status — Google Calendar em estado "Renovar" laranja.

### 3. `Painel Atendimento.dc.html` — 4 telas

**Conversas** — três painéis, sem scroll na página:
- Lista (330px, `min-width: 260px`): busca + três chips de filtro (Todas 42 / IA 39 / Espera 3, o ativo com fundo `--accent-soft` e borda azul). Cada item: `border-left: 3px` (azul quando selecionado), avatar com selo do canal (WhatsApp `#22A06B`, Instagram `#DB2777`, site `#2563EB`), nome + hora, prévia, tag de estado e contador de não lidas.
- Thread (`min-width: 420px`): header com avatar, nome, "IA atendendo · WhatsApp · telefone", toggle "Agente ativo" e botão "Assumir conversa". Corpo com separador "Hoje", bolhas (entrada branca com borda, raio `14px 14px 14px 4px`; saída `#2563EB` branca, raio `14px 14px 4px 14px`), card de produto do catálogo e faixa verde "Agendamento criado". Composer com 4 respostas rápidas em pílula, campo de 44px, anexo e enviar.
- Ficha do contato (300px, `min-width: 240px`): avatar 60px, nome, "Cliente desde…", tags, dados em pares chave/valor, etapa do funil em select, próximo agendamento e anotações.

**Funil**: header com Filtros / Editar etapas / Novo cliente; 4 cards de resumo; board com scroll horizontal, colunas de 288px (header fixo com ponto colorido e contagem, corpo `--surface-2` com scroll). Card: avatar de iniciais, nome, ícone do canal, nota, valor em 13px/700 e tempo. `cursor: grab` — o board é arrastável no app.

**Clientes**: tabela `34px 2fr 1.4fr 1.2fr 1.3fr 1fr 40px` — checkbox, cliente (avatar + nome + e-mail), telefone, canal com ícone, etapa com ponto colorido, última conversa, menu. Barra de ferramentas com busca, 4 chips e contagem "Mostrando 8 de 1.284". Ações: Importar CSV, "Ver duplicados · 4" (número em laranja), Novo cliente.

**Agendamentos**: 4 KPIs (Hoje 6, Semana 23, Comparecimento 92%, **Risco de falta 2** em laranja); coluna principal com a lista do dia (hora + duração, barra colorida, nome, serviço, pílula, botão Abrir) e navegação de dias; coluna lateral com calendário do mês (grid 7×5, dia atual em azul cheio, dias com evento com ponto azul de 4px) e três lembretes automáticos com toggle.

### 4. `Painel Automacao.dc.html` — 3 telas

**Agente de IA**, grid `260px 1fr 320px`:
- Lista de agentes (3 de 5) com avatar, função e ponto de status; item ativo com `border-left` azul.
- Centro: Identidade (nome, função em select, 5 chips de tom de voz, textarea de regras) · Base de conhecimento (4 arquivos com tamanho, data e status Aprendido/Processando, mais dropzone tracejada) · "O que o agente pode fazer" (6 ferramentas em grid 2×3, cada uma com toggle).
- Simulador `position: sticky`: header com avatar em gradiente, corpo de 420px com bolhas de teste e indicador "Sofia está digitando…" (ponto pulsando 1.2s), composer.

**Fluxos** — editor em três painéis:
- Paleta (236px): 4 categorias com cor própria — Envio `#2563EB`, Inteligência `#7C3AED`, Fluxo `#F59E0B`, Ação `#22A06B`. Itens com `cursor: grab`.
- Canvas: barra com nome do fluxo, pílula "Publicado", gatilho, Simular e Publicar. Fundo `radial-gradient(var(--grid) 1px, transparent 1px)` de 22px. Nós de 180px posicionados em absoluto, cada um com header colorido por tipo (uppercase 11.5px/700) e corpo com título e descrição. Conexões em `<path>` cúbicos `#94A3B8` 1.6px — o caminho falso do condicional é tracejado (`stroke-dasharray="4 4"`).
- Propriedades (280px): nome do bloco, prompt de IA, variável de saída em monospace, ferramentas habilitadas em chips.

**Lembretes**: 5 abas (Régua do agendamento, Faltas e pós-atendimento, Funil, Handoff humano, Status) trocando o conteúdo do card principal. Cada regra: ícone, título, tag de estado, descrição, **a mensagem literal em um bloco `--surface-2`** e toggle. Abaixo, "Palavras que chamam um humano" (chips removíveis + "adicionar"). Lateral: próximos envios com hora, falhas recentes (cards vermelhos com o motivo — inclui o caso de descadastro por LGPD) e impacto no mês em três barras.

### 5. `Painel Conteudo.dc.html` — 4 telas

**Meu negócio**: card de progresso do perfil (anel 82%, `stroke-dashoffset: 21.5`) apontando o que falta; duas colunas — Identificação (5 campos, o último multilinha) e, à direita, Horário de funcionamento (7 dias com campo + toggle; domingo desligado mostra "Fechado" em `--faint`) e Pagamento e políticas (4 itens; **o item pendente usa fundo `#FEF3C7`, borda laranja e ação "Cadastrar"**).

**Catálogo**: busca + 5 chips (o último, "Sem mídia · 3", com texto laranja); grid de 4 colunas com 8 itens. Card: faixa de mídia de 132px em gradiente com dois selos (tipo de mídia e quantidade), nome, ponto de status (verde ok / laranja sem mídia), descrição, preço 15px/700 + duração, e rodapé com categoria e "N envios".

**Templates**: 4 KPIs (Aprovados 9 verde, Em análise 2 laranja, Reprovados 1 vermelho, Envios 1.836); tabela `2fr 1fr 1fr 1fr` com nome em snake_case, prévia, categoria (Utilidade/Marketing), status Meta com ponto e envios; lateral com pré-visualização da mensagem em bolha real, **variáveis `{{1}}` destacadas em `--accent-soft`**, botões de resposta rápida e detalhes do template.

**Disparos**: card de rascunho em `--accent-soft` com 4 projeções (contatos 412, custo R$ 148,32, resposta 11%, agendamentos 18), descrição do segmento e botões Revisar/Agendar; tabela de campanhas anteriores `2fr 1fr 1fr 1fr 1fr 1fr` (respostas em azul, agendamentos em verde); card de LGPD com escudo laranja e "Ver lista de bloqueio".

### 6. `Painel Configuracao.dc.html` — 4 telas

**Conexões**: 3 canais em linhas de 18px — ícone 42px, nome + pílula de status, detalhe técnico, métricas inline (`Conversas 30d 842`), ações secundária e primária. Abaixo, duas colunas: Integrações (5 itens; Google Calendar em "Renovar em 3 dias" laranja, Pipedrive com ação "Conectar") e Chave de API (chave mascarada em monospace com "Copiar", URL de webhook e 5 eventos em chips).

**Colaboradores**: tabela `2fr 1.2fr 1fr 1.1fr 40px` com 6 pessoas (a última em "Convite pendente", ponto laranja); cargo como pílula colorida (Proprietário azul, Gestor roxo, demais neutros). Abaixo, matriz de permissões `1.6fr repeat(4,1fr)` com 7 linhas × 4 cargos, check verde `#15803D` / X `#CBD5E1`; wrapper com `overflow-x: auto` e `min-width: 640px`.

**Assinatura**: card do plano em `--accent-soft` com borda azul — rótulo, "Profissional" 24px, detalhe de renovação, preço 28px à direita, 4 barras de consumo e dois botões. Lateral: forma de pagamento (cartão mascarado + dados de NF) e 5 faturas (a do mês em "Em aberto" azul, as outras "Paga" verde).

**Configurações** (largura 900px): três seções com header e linhas de `título + descrição + controle` — Preferências (3 selects), Notificações (4 toggles, o último desligado), Privacidade e LGPD (2 toggles, 1 select de retenção, 1 botão Exportar). No fim, zona vermelha "Encerrar conta" com borda `rgba(239,68,68,0.3)`, fundo `rgba(239,68,68,0.05)` e botão outline `#B91C1C`.

### 7. `Paginas Publicas.dc.html` — 4 telas

**Login**, duas colunas iguais:
- Esquerda (`--surface`, form de 380px centralizado): marca, "Entrar no painel" 28px, e-mail, senha com olho e "Esqueci a senha", checkbox "Manter conectado", botão de 48px, divisor "ou", "Continuar com Google" e link para o teste grátis.
- Direita (`#080C16` com `radial-gradient(120% 80% at 80% 0%, rgba(37,99,235,0.35), transparent 60%)`): "O agente atendeu 47 clientes e marcou 9 horários" em 32px, 4 linhas de resumo com ícone, rótulo e número, e a nota de que os dados são da madrugada sem equipe online. Esse painel deve vir da API — é a prova de valor no momento do login.

**Cadastro** (940px): stepper de 3 passos (feito verde com check / ativo azul / pendente neutro, ligados por linha de 1px); form em card de 28px com nome + WhatsApp em duas colunas, e-mail, negócio, 7 chips de segmento, senha com medidor de força (4 barras, 3 preenchidas em verde + "Senha forte"), aceite de termos/LGPD e CTA "Criar conta e conectar o WhatsApp". Lateral: "O que já vem no teste" (5 itens com check verde) e um depoimento em card escuro.

**Onboarding** (820px), passo 2 de 4: header com rótulo do passo, título, descrição e "Fazer isso depois"; barra de progresso de 6px em 50%; duas colunas — QR Code (grid 9×9 de células, matriz fictícia; estado "Aguardando leitura" com ponto pulsando, expiração e link para a API oficial) e, à direita, "Como escanear" (4 passos numerados) + "Seu progresso" (4 etapas: duas feitas riscadas, a atual com ponto azul, a última pendente).

**404** (520px, centralizado): ícone de chat em quadrado `--accent-soft` 64px, título 30px, explicação, dois CTAs e 4 links de destino comuns.

---

## Interações e comportamento

| Interação | Comportamento |
| --- | --- |
| Navegação da sidebar | Rota; item ativo com fundo, texto branco e ícone `#60A5FA` |
| Recolher sidebar | 236px ↔ 68px, `width .22s cubic-bezier(.22,1,.36,1)`; rótulos e cards somem; `title` nos ícones |
| Alternar tema | `data-theme="dark"` no `<html>` (no app: classe `dark`), persistido |
| FAQ da landing | Accordion de um item; clicar no aberto fecha; chevron gira |
| Abas de Lembretes / páginas públicas | Trocam o conteúdo do card principal; aba ativa com `--surface` + sombra |
| Chips de filtro | Ativo com `--accent-soft` + borda `--accent` + texto `--accent-text` |
| Toggles | Trilho de 32–36px; ligado `#22A06B` com botão à direita, desligado `--border` à esquerda |
| Cards do Kanban | `cursor: grab`; arrastar entre colunas dispara mudança de etapa |
| Hover em linha de lista/tabela | `background: var(--surface-2)` |
| Hover em nav da landing | `background: #F1F5F9` |
| Ponto de status ao vivo | `@keyframes pulseDot` (opacidade 1 → 0.3 → 1), 2s; 1.6s no QR, 1.2s no "digitando" |
| Assumir conversa | Desliga o agente naquela thread e passa o controle ao humano |

Estados que precisam existir e não estão desenhados: carregamento (skeleton nas listas e tabelas), lista vazia (catálogo, campanhas, colaboradores), erro de conexão de canal, validação inline dos formulários. Sugestão: skeleton com o mesmo raio e altura da linha real, em `--surface-2`.

**Responsivo:** os designs são desktop (1440px). O painel abaixo de ~1100px deve colapsar a sidebar para ícones; abaixo de ~900px, os grids de duas/três colunas viram uma coluna e as tabelas ganham scroll horizontal. Em Conversas, no mobile os três painéis viram navegação em pilha (lista → thread → ficha). A landing empilha todas as seções e reduz o H1 de 68px para ~40px.

## Estado

Por tela, o mínimo:
- Global: tema, sidebar expandida/colapsada, usuário e plano, status dos canais.
- Conversas: conversa selecionada, filtro ativo, agente ligado/desligado por thread, contador de não lidas, fila de espera.
- Funil: colunas com cards, card em arraste, filtros de período e canal.
- Agente de IA: agente selecionado, campos de identidade, arquivos e status de processamento, ferramentas ligadas, histórico do simulador.
- Fluxos: nós e conexões, nó selecionado, estado publicado/rascunho.
- Lembretes: aba ativa, regras ligadas, lista de palavras-gatilho.
- Landing: item do FAQ aberto, ciclo de cobrança do toggle de planos.
- Cadastro/Onboarding: passo atual, segmento escolhido, força da senha, status da conexão do QR (polling até conectar).

## Assets

Nenhuma imagem binária. Todos os ícones são SVG inline de 24×24 com `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap/linejoin="round"` — equivalentes a **lucide-react**, que o projeto já usa. Substitua pelos componentes do lucide, não copie os `<path>`.

O logo é um SVG próprio: `viewBox="0 0 64 64"`, dois triângulos com `fill-rule="evenodd"`, `d="M32 6 L58 56 L6 56 Z M32 30 L45.5 56 L18.5 56 Z"`, preenchido em `#2563EB` (ou branco sobre o quadrado em gradiente).

As áreas de foto (mockups de catálogo, mídia dos itens) são **placeholders em gradiente**. Substitua por imagens reais do cliente antes de publicar.

Fonte: Inter via Google Fonts, pesos 400/500/600/700. A landing carrega também Instrument Serif (itálico, 400) só para os acentos de título.

## Arquivos deste pacote

| Arquivo | Conteúdo |
| --- | --- |
| `Landing Redesign.dc.html` | Landing page completa |
| `Dashboard Redesign.dc.html` | Home do painel, com sidebar colapsável e alternador de tema |
| `Painel Atendimento.dc.html` | Conversas, Funil, Clientes, Agendamentos |
| `Painel Automacao.dc.html` | Agente de IA, Fluxos, Lembretes |
| `Painel Conteudo.dc.html` | Meu negócio, Catálogo, Templates, Disparos |
| `Painel Configuracao.dc.html` | Conexões, Colaboradores, Assinatura, Configurações |
| `Paginas Publicas.dc.html` | Login, Cadastro, Onboarding, 404 |
| `Landing Atual.dc.html` | Recriação fiel da landing **atual**, para comparação |
| `Dashboard Atual.dc.html` | Recriação fiel do dashboard **atual**, para comparação |
| `github.md` | Repo de origem e mapa tela → arquivos do repositório |

Abra qualquer `.dc.html` direto no navegador. Nos arquivos com várias telas, use a sidebar ou a barra de abas no topo para navegar.

## Ordem de implementação sugerida

1. Tokens e tema (as duas paletas + o mecanismo de alternância) — tudo depende disso.
2. `DashboardLayout` com a sidebar colapsável e o header.
3. Dashboard (valida os padrões de card, KPI e lista).
4. Conversas (a tela mais complexa e a de maior uso).
5. Funil, Clientes, Agendamentos.
6. Automação, Conteúdo, Configuração.
7. Páginas públicas e landing.
