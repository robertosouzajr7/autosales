---
# ANÁLISE COMPLETA: AutoSales — Módulo de Automações


## ESTADO ATUAL DA APLICAÇÃO


A aplicação tem uma estrutura sólida — backend Node.js/Express, Prisma/SQLite, frontend React/shadcn, integração Baileys + Meta Cloud API, IA via Gemini 2.5. Porém, o módulo de automações é o **elo mais fraco** e o que mais impacta a proposta de valor.


### O que existe hoje:


*  **5 tipos de nó** : `SEND_MSG`, `WAIT`, `CONDITION`, `AI_QUALIFY`, `HTTP_REQ`
*  **4 triggers** : `NEW_LEAD`, `KEYWORD`, `PIPELINE_MOVE`, `ABANDONED`
*  **Motor global** : Confirmação de agendamento, no-show, pós-venda (a cada 5min)
*  **Builder visual** : Lista sequencial de nós (sem drag-and-drop real, sem branching)
*  **Engine** : Só executa `SEND_MSG` e `WAIT`. `CONDITION`, `AI_QUALIFY`, `HTTP_REQ` existem na UI mas **não fazem nada no backend**


### Gaps críticos vs. mercado:


| Funcionalidade                | Typebot | n8n | ManyChat | AutoSales                       |
| ------------------------------- | --------- | ----- | ---------- | --------------------------------- |
| Builder visual drag-and-drop  | ✅      | ✅  | ✅       | ❌ Lista sequencial             |
| Branching IF/ELSE             | ✅      | ✅  | ✅       | ❌ Não funciona                |
| Variáveis e contexto         | ✅      | ✅  | ✅       | ❌ Só`{name}`,`{time}` |
| Blocos de IA nativos          | ✅      | ✅  | ✅       | ❌ Não implementado            |
| Delay inteligente             | ✅      | ✅  | ✅       | ⚠️ Básico                    |
| Webhook/HTTP integração     | ✅      | ✅  | ✅       | ❌ Não implementado            |
| Input do usuário (coleta)    | ✅      | ❌  | ✅       | ❌ Não existe                  |
| Templates de mensagem         | ✅      | ❌  | ✅       | ⚠️ Só 3 fixos                |
| Mídia (áudio, imagem, docs) | ✅      | ✅  | ✅       | ❌ Só texto                    |
| A/B Testing                   | ✅      | ❌  | ✅       | ❌                              |
| Analytics de fluxo            | ✅      | ✅  | ✅       | ❌                              |
| Histórico de execução      | ❌      | ✅  | ✅       | ❌                              |
---
## REQUISITOS PARA O MÓDULO DE AUTOMAÇÕES — NÍVEL DE MERCADO

### 1. TIPOS DE BLOCOS/NÓS (Padrão Typebot/n8n)

**Triggers (Gatilhos):**

| Bloco                     | Descrição                            | Prioridade |
| ------------------------- | -------------------------------------- | ---------- |
| `NOVA_MENSAGEM`         | Qualquer nova mensagem recebida        | P0         |
| `NOVO_LEAD`             | Lead criado no sistema                 | P0         |
| `KEYWORD`               | Mensagem contém palavra-chave (regex) | P0         |
| `MUDANÇA_ETAPA`        | Lead muda de etapa no pipeline         | P0         |
| `AGENDAMENTO_CRIADO`    | Novo agendamento feito                 | P1         |
| `AGENDAMENTO_CANCELADO` | Cancelamento de agendamento            | P1         |
| `INATIVIDADE`           | Lead sem resposta há X horas/dias     | P0         |
| `HORÁRIO_AGENDADO`     | Cron/schedule (todo dia às 9h, etc.)  | P1         |
| `TAG_ADICIONADA`        | Tag específica adicionada ao lead     | P1         |
| `WEBHOOK_EXTERNO`       | Requisição HTTP recebida             | P2         |

**Ações:**

| Bloco                    | Descrição                                        | Prioridade |
| ------------------------ | -------------------------------------------------- | ---------- |
| `ENVIAR_TEXTO`         | Enviar mensagem de texto                           | P0         |
| `ENVIAR_AUDIO`         | Enviar mensagem de áudio                          | P1         |
| `ENVIAR_IMAGEM`        | Enviar imagem/documento                            | P1         |
| `ENVIAR_BOTOES`        | Mensagem com botões de resposta rápida           | P0         |
| `ENVIAR_LISTA`         | Lista de opções selecionáveis                   | P0         |
| `DELAY`                | Esperar X min/horas/dias                           | P0         |
| `DELAY_INTELIGENTE`    | Esperar até horário comercial                    | P1         |
| `CHAMAR_IA`            | Gerar resposta via IA (Gemini) com contexto        | P0         |
| `COLETAR_INPUT`        | Esperar resposta do usuário e salvar em variável | P0         |
| `HTTP_REQUEST`         | Chamada externa (webhook, API)                     | P1         |
| `ADICIONAR_TAG`        | Adicionar tag ao lead                              | P0         |
| `REMOVER_TAG`          | Remover tag                                        | P1         |
| `MOVER_ETAPA`          | Mover lead no pipeline                             | P0         |
| `ATRIBUIR_RESPONSAVEL` | Atribuir lead a um agente humano                   | P1         |
| `AGENDAR_REUNIAO`      | Criar agendamento automático                      | P0         |
| `TRANSFERIR_HUMANO`    | Pausar IA e notificar humano                       | P0         |
| `ATUALIZAR_LEAD`       | Modificar campos do lead (nome, email, etc.)       | P1         |
| `QUALIFICAR_LEAD`      | Score automático baseado em regras                | P1         |

**Controle de Fluxo (Lógica):**

| Bloco          | Descrição                        | Prioridade |
| -------------- | ---------------------------------- | ---------- |
| `CONDIÇÃO` | IF/ELSE com múltiplas regras      | P0         |
| `SWITCH`     | Múltiplos caminhos (case/when)    | P1         |
| `A/B_SPLIT`  | Dividir tráfego % entre caminhos  | P2         |
| `GOTO`       | Pular para outro ponto do fluxo    | P1         |
| `SUBFLUXO`   | Chamar outro fluxo como sub-rotina | P2         |
| `FIM`        | Encerrar fluxo                     | P0         |

### 2. SISTEMA DE VARIÁVEIS E CONTEXTO

Essencial para automações inteligentes. Cada fluxo mantém um  **contexto de execução** :

```
Variáveis do Sistema:
  {{lead.name}}          → Nome do lead
  {{lead.phone}}         → Telefone
  {{lead.email}}         → Email
  {{lead.status}}        → Etapa atual
  {{lead.tags}}          → Tags do lead
  {{lead.score}}         → Score de qualificação
  {{lead.source}}        → Origem (WhatsApp, Website, etc.)
  {{lead.created_at}}    → Data de criação
  {{conversation.last_message}} → Última mensagem
  {{conversation.count}} → Total de mensagens
  {{appointment.date}}   → Data do agendamento
  {{appointment.time}}   → Hora do agendamento
  {{tenant.name}}        → Nome da empresa
  {{current.date}}       → Data atual
  {{current.time}}       → Hora atual
  {{current.day_of_week}} → Dia da semana

Variáveis Customizadas:
  {{input.resposta}}     → Valor coletado do usuário
  {{ai.response}}        → Resposta gerada pela IA
  {{http.response.data}} → Resposta de webhook
  {{custom.campo_x}}     → Variável criada pelo usuário
```

### 3. CONDIÇÕES — MOTOR DE REGRAS

O bloco `CONDIÇÃO` deve suportar:

```
Operadores:
  - é igual a / não é igual a
  - contém / não contém
  - começa com / termina com
  - é maior que / menor que (numérico)
  - está vazio / não está vazio
  - regex match
  - está na lista (IN)

Combinadores:
  - E (AND) — todas as regras devem ser verdadeiras
  - OU (OR) — pelo menos uma regra verdadeira

Exemplos de condições:
  SE {{lead.tags}} contém "quente" E {{lead.score}} > 70
  SE {{input.resposta}} contém "sim" OU contém "quero"
  SE {{current.time}} >= "08:00" E <= "18:00"
```

### 4. ARQUITETURA DO ENGINE (Backend)

O engine atual é muito simples. Para nível de mercado:

```
ARQUITETURA PROPOSTA:

┌─────────────────────────────────┐
│       TRIGGER DISPATCHER        │
│  Recebe eventos e encontra      │
│  automações que devem disparar  │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│        FLOW EXECUTOR            │
│  Percorre o grafo DAG do fluxo  │
│  Resolve variáveis de contexto  │
│  Gerencia estado (progresso)    │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│       NODE PROCESSORS           │
│  Um handler por tipo de nó      │
│  Cada um retorna: nextNodeId    │
│  ou lista de nodeIds (branch)   │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│      CONTEXT MANAGER            │
│  Armazena variáveis do fluxo    │
│  Resolve templates {{var}}      │
│  Persiste entre steps           │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│     EXECUTION LOG               │
│  Registra cada step executado   │
│  Tempo, resultado, erros        │
│  Permite debug e analytics      │
└─────────────────────────────────┘
```

### 5. MODELO DE DADOS (Schema Prisma proposto)

```prisma
model Automation {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  description String?
  
  // Trigger
  triggerType String   // NEW_MSG, NEW_LEAD, KEYWORD, SCHEDULE, etc.
  triggerConfig String? // JSON: { keywords: [], schedule: "0 9 * * *", etc. }
  
  // Flow Definition (formato Typebot/ReactFlow)
  nodes       String?  // JSON: [{ id, type, position, data }]
  edges       String?  // JSON: [{ id, source, target, sourceHandle }]
  
  // Status
  active      Boolean  @default(true)
  version     Int      @default(1)
  
  // Stats
  totalExecutions  Int @default(0)
  lastExecutedAt   DateTime?
  
  tenant      Tenant   @relation(...)
  executions  AutomationExecution[]
}

model AutomationExecution {
  id             String   @id @default(uuid())
  automationId   String
  leadId         String
  
  status         String   // RUNNING, WAITING_INPUT, WAITING_DELAY, COMPLETED, FAILED, CANCELLED
  currentNodeId  String?
  
  // Contexto de variáveis do fluxo
  context        String?  // JSON: { variables: {}, inputs: {} }
  
  // Para delays
  resumeAt       DateTime?
  
  // Para input do usuário
  waitingForInput Boolean @default(false)
  inputVariable   String? // nome da variável onde salvar
  
  // Logs
  startedAt      DateTime @default(now())
  completedAt    DateTime?
  error          String?
  
  automation     Automation @relation(...)
  lead           Lead       @relation(...)
  steps          AutomationStepLog[]
  
  @@unique([automationId, leadId, status]) // evita duplicatas ativas
}

model AutomationStepLog {
  id           String   @id @default(uuid())
  executionId  String
  nodeId       String
  nodeType     String
  
  // Resultado
  status       String   // SUCCESS, FAILED, SKIPPED
  input        String?  // JSON: dados de entrada
  output       String?  // JSON: resultado da execução
  duration     Int?     // ms
  
  createdAt    DateTime @default(now())
  
  execution    AutomationExecution @relation(...)
}
```

### 6. BUILDER VISUAL (Frontend)

O builder atual é uma lista. Para competir com Typebot/n8n, precisa:

**Opção pragmática (recomendada): usar ReactFlow**

* Biblioteca open-source para builders visuais de grafos
* Drag-and-drop, zoom, pan, minimap
* Já usado por n8n, Typebot e dezenas de outros
* Conexões visuais entre nós
* Custom node rendering com shadcn/ui

```
Layout do Builder:
┌──────────────────────────────────────────────┐
│ [← Voltar]  Nome do Fluxo  [Salvar] [Testar]│
├──────────┬───────────────────────────────────┤
│          │                                   │
│ BLOCOS   │       CANVAS (ReactFlow)          │
│          │                                   │
│ Triggers │   ┌──────────┐                    │
│ · Msg    │   │ Trigger  │                    │
│ · Lead   │   │ Nova Msg │                    │
│ · Key    │   └────┬─────┘                    │
│          │        │                          │
│ Ações    │   ┌────▼─────┐                    │
│ · Texto  │   │ Condição │                    │
│ · Áudio  │   │ contém?  │                    │
│ · IA     │   └──┬────┬──┘                    │
│ · Delay  │      │    │                       │
│ · Tag    │   ┌──▼┐  ┌▼──┐                   │
│ · HTTP   │   │SIM│  │NÃO│                   │
│          │   │IA │  │Msg│                    │
│ Lógica   │   └───┘  └───┘                   │
│ · IF     │                                   │
│ · Switch │                                   │
│ · A/B    │          [+ Adicionar Bloco]      │
│          │                                   │
├──────────┼───────────────────────────────────┤
│ PROPRIEDADES DO NÓ SELECIONADO              │
│ ┌─────────────────────────────────────────┐ │
│ │ Tipo: Enviar Texto                       │ │
│ │ Mensagem: Olá {{lead.name}}! ...        │ │
│ │ Delay após: 0s                          │ │
│ └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### 7. TEMPLATES PRÉ-CONFIGURADOS

Para facilitar adoção, oferecer templates prontos:

| Template                          | Trigger                | Fluxo                                                                           |
| --------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| **Boas-vindas**             | Novo Lead              | Saudação → Coleta nome → Pergunta interesse → Tag                          |
| **Qualificação BANT**     | Nova mensagem          | IA pergunta Budget → Authority → Need → Timeline → Score                    |
| **Agendamento Automático** | Keyword "agendar"      | Verifica disponibilidade → Oferece horários → Confirma → Cria agendamento   |
| **Follow-up Inteligente**   | Inatividade 24h        | Envia lembrete → Espera 48h → Segundo lembrete → Espera 72h → Último       |
| **Recuperação de Lead**   | Inatividade 7 dias     | IA gera msg personalizada → Oferece desconto → Agenda                         |
| **Pós-venda**              | Agendamento concluído | Pesquisa satisfação → Se nota < 7, alerta humano → Se > 8, pede indicação |
| **Objeção de Preço**     | Keyword "caro/preço"  | IA com script de objeções → Oferece condições → Agenda reunião           |
| **Campanha Sazonal**        | Schedule (cron)        | Seleciona leads ativos → Envia oferta personalizada → Coleta interesse        |

### 8. CAPACIDADES DE IA NO FLUXO

O diferencial do AutoSales vs. Typebot/n8n é a  **IA nativa** . O bloco `CHAMAR_IA` deve:

```
Configuração do Bloco de IA:
├── Prompt do Sistema (customizável)
│   "Você é um SDR da {{tenant.name}}. Qualifique o lead..."
├── Contexto Automático
│   - Histórico da conversa
│   - Dados do lead (nome, tags, score)
│   - Knowledge base do SDR ativo
│   - Produtos/serviços cadastrados
├── Ferramentas (Tool Use)
│   - Verificar agenda
│   - Criar agendamento
│   - Consultar estoque/preços
│   - Buscar FAQ
├── Output
│   - Salvar resposta em {{ai.response}}
│   - Extrair dados estruturados (nome, email, interesse)
│   - Classificar intent (comprar, agendar, dúvida, reclamação)
└── Fallback
    - Se IA falhar → Transferir humano
    - Se confiança < 60% → Pedir confirmação
```

### 9. PRIORIZAÇÃO (Roadmap de Implementação)

**FASE 1 — Motor Funcional (MVP de mercado)**

* [ ] Implementar engine de execução DAG (edges reais)
* [ ] Sistema de variáveis e resolução de templates `{{var}}`
* [ ] Blocos: `CONDIÇÃO` funcional, `COLETAR_INPUT`, `CHAMAR_IA`
* [ ] Trigger `INATIVIDADE` (lead sem resposta há X tempo)
* [ ] Logs de execução (`AutomationStepLog`)
* [ ] Contexto persistido entre steps

**FASE 2 — Builder Visual**

* [ ] Integrar ReactFlow no frontend
* [ ] Painel de propriedades por nó
* [ ] Drag-and-drop de blocos
* [ ] Conexões visuais (edges)
* [ ] 4 templates iniciais pré-configurados
* [ ] Preview/teste do fluxo

**FASE 3 — IA Avançada**

* [ ] Bloco de IA com prompt customizável e tool use
* [ ] Extração de dados estruturados da conversa (NER)
* [ ] Intent classification para routing inteligente
* [ ] A/B testing de mensagens
* [ ] Score de qualificação automático via IA

**FASE 4 — Escalabilidade**

* [ ] Fila de execução (job queue) para não bloquear
* [ ] Rate limiting por sessão WhatsApp (evitar ban)
* [ ] Analytics de funil por automação
* [ ] Subfluxos (um fluxo chama outro)
* [ ] Webhook trigger (receber eventos externos)
* [ ] Suporte a mídia (áudio, imagem, documentos)

---

### CONCLUSÃO

O AutoSales tem a **infraestrutura certa** (WhatsApp, IA, CRM, multi-tenant), mas o módulo de automações precisa evoluir de uma **lista sequencial de ações** para um **motor de execução de grafos** com variáveis, condições reais, e IA nativa.

O diferencial competitivo vs. Typebot/n8n é que eles são ferramentas genéricas — o AutoSales é  **verticalmente integrado** : o builder já conhece o lead, a conversa, o agendamento, e o agente de IA. Isso permite automações que nenhuma ferramenta genérica consegue fazer out-of-the-box.

Quer que eu comece a implementar a Fase 1?
