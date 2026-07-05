# Diagnóstico de Prontidão para Produção — AutoSales / Agentes Virtuais (VendAI)

> Análise multidisciplinar do SaaS multi-tenant de SDR/automação por WhatsApp, com foco em colocá-lo em ambiente comercial. Conduzida por 4 frentes especializadas — **Segurança**, **Arquitetura & Escalabilidade**, **Infraestrutura/Resiliência/DevOps** e **Regras de Negócio/Produto**. Todas as linhas citadas referem-se ao estado atual do repositório. Nenhum arquivo de código foi modificado nesta análise.

---

## ⛔ Veredito

**O sistema NÃO está pronto para lançamento comercial.** Ele funciona como MVP/demo, mas hoje:

1. **Não isola clientes** — qualquer usuário logado lê e destrói dados de qualquer outra empresa.
2. **Não cobra de verdade** — o pagamento é simulado; o cliente marca a própria fatura como paga digitando qualquer cartão.
3. **Não escala** — está travado em uma única instância por causa de estado em memória (WhatsApp, filas, crons).
4. **Vaza segredos** — credenciais vivas do WhatsApp, senha do banco e segredo JWT estão versionados no git.
5. **Perde/corrompe dados** — `prisma db push --accept-data-loss` roda a cada boot, sem migrations nem backups.

Os quatro especialistas convergiram de forma independente nos mesmos pontos críticos — o que reforça a confiança no diagnóstico. Abaixo, os achados consolidados e um roteiro de correção priorizado.

---

## 🔴 BLOQUEADORES DE LANÇAMENTO (Críticos)

Estes precisam estar resolvidos **antes de qualquer cliente pagante tocar no sistema.**

### CR-1 — Isolamento multi-tenant quebrado (o problema-raiz mais grave)
O tenant é resolvido como `req.headers["x-tenant-id"] || req.tenantId` em ~40 handlers — ou seja, **o header enviado pelo cliente tem precedência sobre o JWT autenticado**. O `x-tenant-id` inclusive está liberado no CORS (`app.js:33`).

- **Evidência:** `SettingsController.js:4,55`, `LeadController.js:19,38,79`, `MessageController.js:8,30,84,102,124`, `BulkController.js:8,20,45`, `SdrController.js:4,19,78`, `BillingController.js:5,60,132`, `AutomationController.js` (8 pontos), `ProspectController.js:33,90,143` e outros.
- **Exploração:** Um usuário legítimo (ou alguém que se auto-cadastra) mantém seu token válido e envia `x-tenant-id: <ID-de-outra-empresa>` → lê leads, conversas, faturas, usuários e **as chaves de API** de qualquer concorrente. Os UUIDs de tenant vazam facilmente (login, webchat público, listagens admin).
- **Correção:** Derivar `tenantId` **exclusivamente** do JWT (`req.tenantId`). Nunca ler tenant de header/body/query em rota autenticada. Remover `x-tenant-id` de `allowedHeaders` no CORS. Adicionar um "grep-ban" de `req.headers["x-tenant-id"]` no CI.

### CR-2 — IDOR: endpoints destrutivos sem escopo de tenant
Mesmo corrigindo o CR-1, várias queries usam apenas `req.params.id`, sem verificar posse:
- `LeadController.js:141` (`update`), `:165` (`delete`), `:184` (`bulkDelete`), `:173` (`bulkEnrich`) — edita/apaga **qualquer** lead de **qualquer** tenant.
- `UserController.js:27` (`deleteUser`), `PipelineController.js:29,38`, `BulkController.js:48-49` (`sendCampaign`), `MessageController.js:83-93` (`toggleBot`).
- **Exploração:** `POST /api/contacts/bulk-delete {"ids":[...]}` apaga a base de contatos de outra empresa sem nem precisar do tenant id.
- **Correção:** Toda query por id deve incluir `tenantId` no `where` (use `updateMany`/`deleteMany` com `{ id: { in: ids }, tenantId }` para operações em massa). `SdrController`/`WhatsAppController` já fazem isso corretamente — replicar o padrão.

### CR-3 — Segredos vivos versionados no git
- **WhatsApp:** `auth_info_baileys/` tem **833 arquivos rastreados** no git, incluindo `creds.json` com chaves privadas (`noiseKey`, `signedIdentityKey`, `pairingEphemeralKeyPair`). O `.gitignore` lista a pasta, mas ela foi commitada **antes** do ignore, então continua rastreada. Qualquer um com acesso ao repo assume a sessão do WhatsApp (lê/envia mensagens como a empresa).
- **JWT:** `auth.js:3` e `AuthController.js:5` têm fallback hardcoded `JWT_SECRET = "vendai-secret-key-2026"`. Se o env não estiver setado (o fallback esconde o erro no boot), qualquer um forja um token `role:"SUPERADMIN"` e assume a plataforma inteira.
- **Postgres:** `docker-compose.yml:61` tem `POSTGRES_PASSWORD: Rr756213Rr` em texto puro, repetida em `scripts/switch-db.js`.
- **Logs com dados sensíveis:** `error.log`, `stdout.log`, `baileys_crash.log`, `transcript.log`, `prisma_error.txt` versionados (contêm PII, handshake do WhatsApp e o caminho local do dev).
- **Correção:** Tratar **tudo como comprometido**. Revogar/reconectar a sessão do WhatsApp; rotacionar senha do Postgres e o `JWT_SECRET` (invalida tokens atuais); remover o fallback do JWT (falhar no boot se ausente); `git rm -r --cached` dos segredos e logs; **purgar do histórico** (`git filter-repo`/BFG) e force-push.

### CR-4 — Webhook de mensagens anônimo (injeção + DoS financeiro)
`POST /api/webhook/whatsapp` (`app.js:54`) e o webchat público (`PublicController.js:47`) recebem `tenantId` do corpo, sem autenticação, e disparam a IA (consumo de tokens pagos) e envios de WhatsApp.
- **Exploração:** POST anônimo em massa com o `tenantId` de uma vítima → injeta leads/mensagens falsas, esgota a cota de IA (custo), envia WhatsApp em nome da vítima e abre vetor de **prompt injection** no bot SDR.
- **Correção:** Autenticar o webhook interno com HMAC/segredo compartilhado (bind à rede interna, nunca rota pública); rate limit + CAPTCHA no webchat/booking; resolver tenant por um slug público não-adivinhável, nunca pelo body.

### CR-5 — Pagamento é 100% simulado
`BillingController.js:59` (`payInvoiceMock`) aceita `cardNumber/cvv/expiry`, valida só que não estão vazios e marca `status:"PAID"`. Não há Stripe/Pagar.me/Mercado Pago; os campos `mercadoPagoId`/`cardLast4` do schema nunca são preenchidos.
- **Impacto:** Nenhum Real é cobrado de verdade — o cliente "paga" digitando 16 dígitos quaisquer. Ainda recebe PAN/CVV cru na API (exposição PCI-DSS).
- **Correção:** Integrar gateway real com cobrança server-side + confirmação por webhook; só marcar `PAID` no callback de sucesso do gateway; nunca receber dados de cartão crus (usar tokenização/checkout do provedor).

### CR-6 — O loop de monetização não fecha
- **Sem billing no signup (`B3`):** `register` não define `trialEnd` nem `nextBillingDate`. O cron só cobra quem tem `nextBillingDate <= now`, então **todo cadastro orgânico usa o produto de graça, para sempre.**
- **Suspensão por inadimplência é só um rótulo (`B4`):** `subscriptionStatus: "PAST_DUE"` é gravado mas **nunca é lido** no caminho de request/mensagem. Quem não paga continua enviando WhatsApp, prospectando e queimando seu custo de IA indefinidamente.
- **Escolha livre de plano (`A5`/`H4`):** `register` e `upgradePlan` deixam o cliente se auto-atribuir qualquer plano, inclusive o `VITALICIO` (limites praticamente infinitos), sem pagamento.
- **Correção:** Definir `trialEnd`/`nextBillingDate` no signup; **bloquear** os entrypoints de mensagem/prospect/IA quando `subscriptionStatus ∉ {ACTIVE, TRIAL}` ou `active === false`; mudança de plano só via webhook de pagamento confirmado.

### CR-7 — Enforcement de limites de plano quebrado por schema drift
`BulkController` usa `tenant.monthlyMessagesCount` e `LeadController.js:150` usa `tenant.qualifiedLeadsCount` — **nenhum desses campos existe** no `Tenant` (o schema tem `usedMessages`).
- **Impacto:** `maxMessages - undefined = NaN` → o teste de cota do disparo em massa **nunca bloqueia** (blasts ilimitados em qualquer plano). O `increment` lança erro Prisma engolido pelo IIFE fire-and-forget, então o uso nunca é medido. O incremento de `qualifiedLeadsCount` quebra o update do lead a cada movimentação de pipeline.
- **Além disso:** `maxLeads` e os limites diários de prospecção/pesquisa (`IcpProfile.dailyLimit`) são **armazenados mas nunca verificados**; a medição de tokens é check-then-increment não-atômica (permite estouro sob concorrência).
- **Correção:** Reconciliar para os campos reais (`usedMessages`); regenerar o client Prisma; enforçar `maxLeads`/limites diários antes de criar; tornar a medição de tokens atômica; testes de integração para que drift quebre o CI.

### CR-8 — `prisma db push --accept-data-loss` a cada boot, sem migrations nem backups
`Dockerfile.api-express` e `backend-nest/Dockerfile` rodam `npx prisma db push --accept-data-loss && node server.js`. Não existe pasta `prisma/migrations/`.
- **Impacto:** Um `db push` pode **derrubar colunas/tabelas** silenciosamente para casar com o schema a cada restart/deploy. Sem histórico versionado, sem rollback. Uma edição de schema + restart destrói dados de cliente de forma irreversível. **Não há backup de Postgres em lugar nenhum** (só um volume Docker — perda do volume = perda total).
- **Correção:** Migrar para `prisma migrate deploy` com `prisma/migrations/` commitada, rodando como etapa de deploy separada e gated (não no CMD do app). Backup automatizado (`pg_dump`/WAL para storage externo) com restore testado e RPO/RTO documentados.

### CR-9 — Não roda mais de uma instância (trava dura de escala)
Todo estado de runtime vive na memória do processo:
- Sockets Baileys em `whatsapp.js:10` (`whatsappSessions = new Map()`); SSE via `EventEmitter` in-process (`MessageController.js:5`); 8+ `setInterval` + crons no motor de automação (`automation_engine.js:23-38`); cron de billing in-process (`BillingService.js:16`).
- **Impacto:** Com 2 réplicas você tem **billing duplicado, automações disparadas em dobro, chat em tempo real quebrado e sessão de WhatsApp corrompida/banida.** O SaaS inteiro está limitado a um único processo, que é também um ponto único de falha (crash derruba API + automações + WhatsApp + billing juntos).
- **Correção:** Extrair WhatsApp/cron para um **worker dedicado single-instance**; API web fica stateless; SSE via **Redis pub/sub** (ou Postgres `LISTEN/NOTIFY`); lock distribuído/leader election para jobs singleton.

### CR-10 — Sem fila durável: billing/automações perdem trabalho e não têm retry
A fila de execução é um array em memória (`automation_engine.js:132`); no restart todo job enfileirado/adiado é **perdido**. Erros são engolidos por dezenas de `catch` vazios, sem retry/backoff/dead-letter. Billing in-process sem idempotência → restart perto da meia-noite pode **cobrar em dobro ou zerar** faturas.
- **Correção:** Fila real (**BullMQ/Redis** ou **pg-boss/Postgres**) com jobs persistentes, retry com backoff, chave de idempotência e dead-letter, rodando em **workers dedicados**. Billing idempotente (constraint única em `(tenantId, período)`).

---

## 🟠 IMPORTANTES (corrigir antes de escalar / cobrar a sério)

### Segurança & Autorização
- **AuthZ por role vinda do body:** `UserController.createUser` e `AdminController.createTenantUser` gravam `role` direto do `req.body`, sem whitelist → um usuário comum cria um `SUPERADMIN` e escala para admin da plataforma. Validar role server-side; proibir `SUPERADMIN` por rota de tenant.
- **SuperAdmin padrão `admin`/`admin`:** `app.js:81` semeia `admin@agentesvirtuais.com` com senha `admin` e loga as credenciais. Exigir senha forte via env, troca no 1º login, sem log de credencial.
- **Segredos retornados ao cliente:** `GET /api/settings` devolve `aiApiKey`, `openAiKey`, `apolloApiKey`, `smtpPass`, `googleRefreshToken` etc. em texto puro (`SettingsController.js:22-48`). Nunca retornar segredo ao frontend (mascarar / booleano "configurado"); criptografar em repouso (KMS).
- **Helmet + rate limiter desativados; CORS `*`:** ambos comentados em `app.js:29,42`; CORS cai em `*`. Reativar helmet, aplicar o limiter (mais estrito em `/auth/login` e webhooks), definir `ALLOWED_ORIGINS` explícito.
- **JWT na query string / 7 dias sem revogação:** `auth.js:10` aceita `?token=` (vaza em logs/Referer); token de 7 dias sem refresh/blacklist, guardado em `localStorage` (roubo via XSS). Só via header `Authorization`; access token curto + refresh; revogação.
- **SSRF + TLS desligado:** `BulkController.sendCampaign` chama `listmonkUrl` controlado pelo tenant; `nodemailer` usa `rejectUnauthorized:false`; `ProspectController.enrichData` faz fetch de `url` do body. Allowlist de hosts, bloquear ranges privados/link-local, nunca desabilitar verificação TLS.
- **Upload sem limite (`multer.memoryStorage`)** sem `limits`/filtro de tipo → DoS por memória. Definir `limits.fileSize`, `fileFilter`, storage em disco/stream.
- **OTP falso:** `sendCode`/`verifyCode` sempre retornam sucesso — qualquer 2FA/verificação é fake. Implementar OTP real (hash, expiração, rate limit) ou remover.
- **Sem verificação de e-mail nem reset de senha;** sem política de senha; enumeração de usuário no `register` ("E-mail já cadastrado").

### Regras de Negócio
- **Scheduler de IA inventa horários (`B6`):** `get_availability` (`automation_engine.js:1037`) retorna 5 slots **aleatórios** (`Math.random()`), ignorando o calendário; `create_appointment` não checa conflito nem sincroniza com Google Calendar. A lógica real (`calendar_service.js:21-53`) nunca é chamada. Para um produto cujo carro-chefe é "agendamento", isso causa dano direto ao cliente final. Rotear pela `CalendarService.listAvailableSlots`, adicionar detecção de overlap, unificar enums de status (`PENDING` vs `SCHEDULED`).
- **Sem consentimento/opt-out/LGPD no WhatsApp (`B7`):** não há opt-out, "PARAR", blocklist ou registro de consentimento. Prospecção raspa telefones e dispara sem consentimento — viola política do WhatsApp Business (risco de banir o número) e a LGPD. Adicionar modelo de consentimento/opt-out, detectar stop-keywords inbound, suprimir opted-out.
- **Dedup de lead com bug (`I2`):** upsert por `phone || ""` faz **todo lead sem telefone colidir no mesmo registro** (perda silenciosa de dados); `importCSV` usa `create` e aborta o lote inteiro em duplicata.
- **Upgrade/downgrade sem proração (`I3`):** troca imediata, **zera contadores de uso** (downgrade ganha cota nova; upgrade apaga uso acumulado), fatura cheia "hoje", valida só `maxSdrs`.
- **Sem audit log nem RBAC de equipe (`I5`):** o único gate de role é `SUPERADMIN`; um `AGENT` pode fazer billing, apagar leads, mudar settings, criar usuários. B2B precisa de "quem mudou o quê".

### Arquitetura & Dados
- **Zero índices no banco:** `grep @@index` → **0**. Toda query quente filtra por `tenantId` (não indexado em `Lead`, `Message`, `Conversation`) e FKs não são auto-indexadas no Postgres → seq scan que degrada com o crescimento. Adicionar `@@index([tenantId])` e índices de FK/combinações (`[tenantId,status]`, `[conversationId,createdAt]`).
- **N+1 e payloads ilimitados:** `getLeads` faz `findMany({ include:{ conversations:{ include:{ messages:true }}}})` **sem paginação** — carrega todos os leads com todas as mensagens. Nenhum endpoint de lista pagina. Adicionar paginação por cursor; carregar mensagens lazy.
- **Múltiplos PrismaClient (11+):** `whatsapp.js`, `email_service.js`, `calendar_service.js`, `command_center.js` cada um cria seu próprio client/pool → risco de exaustão de conexões. Usar um singleton compartilhado + PgBouncer/`connection_limit`.
- **Dois backends divergentes:** Express (vivo, ~21 controllers) + `backend-nest` (parado, <30% de cobertura) contra o **mesmo banco e a mesma pasta `auth_info_baileys`** — se ambos rodarem, brigam pela sessão do WhatsApp. Decidir: deletar o Nest (caminho mais rápido) ou congelar o Express e terminar a migração.
- **SQLite no schema (`schema.prisma:6`):** `provider = "sqlite"` num SaaS multi-tenant concorrente — single-writer locking, perde updates de uso. Migrar para Postgres antes do launch (o compose já aponta para Postgres; o schema está inconsistente).

---

## 🏗️ Infraestrutura & Resiliência

- **`uncaughtException` que engole e continua rodando (`server.js:20-26`):** loga e não sai. Após exceção não capturada o estado do Node é indefinido — continuar servindo corrompe dados. O `baileys_crash.log` mostra loops infinitos de reconexão que esse padrão mascara. Logar, dar flush e **sair não-zero**, deixando o orquestrador reiniciar limpo.
- **Sem graceful shutdown:** nenhum handler `SIGTERM`/`SIGINT`. No deploy, requests em voo morrem, crons são cortados no meio da escrita → escritas parciais. Inviabiliza deploy zero-downtime.
- **Sem health/readiness endpoint nem HEALTHCHECK:** o LB não sabe se a API está viva/conectada ao banco. Adicionar `/healthz` (liveness) e `/readyz` (DB `SELECT 1` + estado WhatsApp).
- **nginx quebrado:** `proxy_pass http://autosales-api:3000` mas o serviço no compose se chama `venda-api-express` → 502. Sem TLS (só `listen 80`), sem headers de segurança, sem `client_max_body_size` (uploads de 10 MB vão dar 413), e **sem tuning de SSE** (`proxy_buffering off` + `proxy_read_timeout` longo) — os streams de chat vão travar/bufferizar.
- **Compose é de desenvolvimento, não produção:** bind-mount do código, `NODE_ENV=development`, Nest em `start:dev` (watch), porta `5173` (dev do Vite), e o Nest fixado em **SQLite** enquanto o Express usa Postgres — datastores divergentes. Criar `docker-compose.prod.yml` sem bind mounts, assets buildados servidos por nginx, `DATABASE_URL` Postgres único.
- **Dockerfiles:** rodam como **root**, `npm install` (não `ci`, ignora lockfile), tags flutuantes (não pinadas por digest), API sem multi-stage e carregando stack Chromium provavelmente morto; `EXPOSE` do Nest errado (3000 vs 3333). Adicionar `USER` não-root, `npm ci`, pinar por digest, corrigir portas.
- **Sem restart policy nem limites de recurso** no compose (combinado com o `uncaughtException` que não sai = zero autohealing).
- **Observabilidade quase ausente:** `pino` é dependência mas usado em 1 arquivo; o resto é `console.*` (79 em `automation_engine.js`). Sem métricas, tracing, error tracking (Sentry) ou alertas. Ninguém seria avisado dos loops de reconexão silenciosos. Adotar pino estruturado com `tenantId`/`requestId`, error tracker e alertas de saúde/erro/conexão WhatsApp.
- **Sem CI/CD nem testes:** não há `.github/workflows`, nem script de teste efetivo. Todo release é manual e não verificado. Pipeline: install → lint → typecheck → test → build → scan → migrate → deploy.

---

## 🟡 DESEJÁVEIS (pós-lançamento)

- **Fiscal/NF-e:** `Invoice` é registro interno; sem emissão de nota fiscal (necessário para B2B no Brasil, mas não bloqueia os primeiros clientes).
- **Sem fluxo de reembolso/crédito** (`Invoice.status` não tem `REFUNDED`).
- **Sem captura de aceite de Termos/Privacidade** no signup (pareia com LGPD).
- **Quirk contábil** em `FinancialController.getSummary:24` — receita contada mesmo sem `paidAt`, inflando totais; MRR calculado do preço vivo do plano, não de faturas emitidas.
- **`Lead.company` usado em personalização (`BulkController.js:147`) mas ausente do schema** → sempre vazio.
- **Marketing promete "7 dias grátis / Trial" (`design_system`) mas não existe trial** (ligado ao CR-6) — descasamento de claims/consumidor.
- **Frontend mega-bundle:** `vite.config.ts` sem code splitting/manualChunks; páginas gigantes (`Automations.tsx` 1.264 linhas) + libs pesadas (`recharts`, `@xyflow/react`, `xlsx`) no bundle principal. `xlsx@0.18.5` é versão vulnerável/sem manutenção. Adicionar `React.lazy` + `manualChunks`; trocar `xlsx`.
- **Higiene de repo:** deletar `server.cts` (servidor OpenAI obsoleto), `test_*.js`/`tmp_*.js`/`scratch/`/`tmp/`, `/api/v2` (alias falso do mesmo router).
- **`@whiskeysockets/baileys ^7.0.0-rc.9`** é release candidate em produção (risco de ban/instabilidade). Pinar versão estável e monitorar advisories.

---

## 🗺️ Roteiro de correção priorizado

O padrão-raiz recorrente é **confiar em dados controlados pelo cliente para autorização** (`x-tenant-id`, `role`, `plan`, `leadId` sem posse) e **ausência de camada de validação**. Ordem sugerida:

**Fase 0 — Contenção de incidente (fazer já, antes de tudo)**
1. Revogar a sessão do WhatsApp e rotacionar TODOS os segredos vazados (WhatsApp, Postgres, JWT). `git rm --cached` + purgar histórico de `auth_info_baileys/` e logs. (CR-3)

**Fase 1 — Segurança que bloqueia o launch**
2. Derivar tenant só do JWT; remover o path `x-tenant-id` (CR-1). 
3. Escopar toda query por-id com `tenantId` (CR-2). 
4. Remover fallback do JWT + matar superadmin `admin/admin`; whitelist de role (CR-3, AuthZ). 
5. Autenticar/proteger webhooks WhatsApp e webchat (CR-4). 
6. Reativar helmet + rate limit + CORS allowlist; parar de retornar segredos + criptografar em repouso.

**Fase 2 — Monetização e integridade de dados**
7. Gateway de pagamento real + confirmação por webhook (CR-5). 
8. Fechar o loop de billing: trial/nextBillingDate no signup, enforcement de PAST_DUE/active, plano só via pagamento (CR-6). 
9. Corrigir o schema drift dos contadores + enforçar limites de plano (CR-7). 
10. Migrar para `prisma migrate` + backups de Postgres; consolidar em Postgres (sair do SQLite) (CR-8).

**Fase 3 — Escala e resiliência**
11. Extrair worker de WhatsApp/cron; API stateless; Redis pub/sub para SSE (CR-9). 
12. Fila durável (BullMQ/pg-boss) com retry/idempotência (CR-10). 
13. Índices no banco + paginação + PrismaClient singleton. 
14. Health endpoints, graceful shutdown, sair-no-fatal, restart policies, nginx corrigido, compose de produção.

**Fase 4 — Operação e qualidade**
15. Logging estruturado (pino) + error tracking + alertas + métricas. 
16. CI/CD com lint/typecheck/test/scan/migrate. 
17. Decidir sobre o backend Nest; limpeza de código morto.

**Fase 5 — Regras de negócio e compliance**
18. Scheduler de IA usando calendário real + detecção de conflito (B6). 
19. Consentimento/opt-out LGPD + WhatsApp (B7). 
20. Audit log + RBAC de equipe; correção do dedup de leads; proração de plano.

---

### Convergência entre os especialistas
Os itens **isolamento de tenant** (CR-1/CR-2), **segredos versionados** (CR-3), **helmet/rate limit desativados**, **superadmin `admin/admin`** e **JWT hardcoded** apareceram de forma independente em **todas as quatro** análises — são os pontos de maior consenso e prioridade absoluta.
