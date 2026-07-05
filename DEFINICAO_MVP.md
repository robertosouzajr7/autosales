# Definição Técnica do MVP — VendAI · Saúde

> O menor produto **vendável e compliant** para clínicas, entregável em ~60 dias. Este documento traduz a estratégia (`estrategia_clinicas`) em escopo, arquitetura-alvo, decisões de build-vs-buy, mudanças de dados e um backlog sequenciado em 4 sprints. Ele conversa com o `DIAGNOSTICO_PRODUCAO.md`: os bloqueadores de lá que são de *correção/compliance* entram aqui; os que são só de *escala* ficam para depois de haver clientes.

---

## 1. Definição de "vendável e compliant"

O MVP está pronto para cobrar quando uma clínica consegue, sozinha, passar por este fluxo sem que nada quebre e sem risco legal/operacional:

> Conecta o WhatsApp **oficial** → o agente responde um paciente de verdade em segundos, qualifica e **agenda na agenda real** → o dono vê a consulta marcada e o resultado no painel → **paga de verdade** por isso → e, se parar de pagar, **perde o acesso**.

Tudo fora desse fluxo é adiável. Se um item não ajuda a fechar esse loop, ele não está no MVP.

**Princípio de engenharia do MVP:** correção e compliance entram; escala não. Para 10 clínicas, **uma única instância** é suficiente e correta — desde que seja *correta* (billing idempotente por constraint, migrations, backups, shutdown limpo). Worker dedicado, fila distribuída, Redis pub/sub e multi-instância são de Fase 3 e **não fazem parte do MVP**. Resistir à tentação de construí-los agora é parte da disciplina.

---

## 2. Escopo — o que ESTÁ no MVP

| # | Capacidade | Por que é indispensável |
|---|-----------|-------------------------|
| E1 | **Atendimento WhatsApp oficial (Meta Cloud API)** — inbound + resposta | É o canal e o diferencial "não banível". Sem isso, não há produto. |
| E2 | **Agente de IA de qualificação + agendamento**, com escopo restrito a marcar/qualificar (nunca conselho médico) | É a cunha. Precisa usar o **calendário real**, não inventar horário. |
| E3 | **Agendamento com verificação de conflito** + sincronização com a agenda da clínica | O carro-chefe do produto tem que funcionar de verdade. |
| E4 | **Handoff humano** — o dono/recepção assume a conversa com histórico | Confiança: casos delicados vão para uma pessoa. |
| E5 | **Isolamento de tenant correto** (tenant só do JWT) + fix de IDOR | Sem isso, é breach garantido num produto multi-cliente. |
| E6 | **Cobrança real** — gateway BR com confirmação por webhook | Sem isso, não se fatura um Real. |
| E7 | **Ciclo de assinatura** — trial → ativo → inadimplente **com bloqueio de uso** | O loop de monetização precisa fechar e ter "dente". |
| E8 | **Enforcement de limites de plano + medição de uso** honesta | Proteção de margem; hoje está quebrado (schema drift). |
| E9 | **Auth endurecida** — sem segredo hardcoded, verificação de e-mail, reset de senha | Higiene mínima de conta para B2B. |
| E10 | **Opt-out / consentimento LGPD** + stop-keyword ("PARAR") | Compliance obrigatória e proteção do número do cliente. |
| E11 | **Painel de resultados da clínica** — consultas agendadas, conversas atendidas | É a prova de ROI que sustenta a renovação. |
| E12 | **Onboarding self-service** de uma clínica (conectar número, treinar agente, testar) | Reduz custo de ativação; permite os 10 pilotos. |
| E13 | **Fundação de produção** — Postgres + migrations + backup + health + Sentry | Não perder dado de cliente e enxergar o que quebra. |

## 3. Escopo — o que fica FORA (adiado, com intenção)

| Fora do MVP | Por quê | Volta em |
|-------------|---------|----------|
| Disparo em massa / prospecção fria | Risco de ban + LGPD; não é a dor do inbound | Fase 3 (morno, opt-in) |
| Baileys como base | Não-oficial; só modo experimental | — |
| Worker dedicado, fila BullMQ/Redis, multi-instância | Over-engineering para 10 clínicas | Fase 3 (ao escalar) |
| Backend NestJS | Um só backend (Express). Nest é deletado | — |
| Painel financeiro/ERP interno, simulador de custo | Não é problema do cliente | Talvez nunca |
| Plano VITALÍCIO grátis | Destrói valor e caixa | — |
| RBAC granular de equipe, multiunidade | Piloto é clínica pequena, 1–2 usuários | Fase 2 |
| NF-e / emissão fiscal | Não bloqueia os primeiros clientes | Fase 2 |
| Integrações com sistemas de clínica (além de Google Calendar) | Google Calendar cobre o piloto | Fase 2 |

---

## 4. Arquitetura-alvo do MVP

Deliberadamente simples — uma topologia que um dev opera sozinho e que escala até dezenas de clínicas sem reescrita.

```
  Paciente (WhatsApp)
        │
        ▼
  Meta WhatsApp Cloud API  ──webhook (assinado, HMAC)──►  ┌───────────────────────────┐
        ▲                                                  │   API VendAI (Express)     │
        │  envio (template/sessão)                         │   instância única          │
        └──────────────────────────────────────────────   │                            │
                                                           │  • Auth (JWT endurecido)   │
  Dono da clínica (SPA React) ──HTTPS──►  nginx/TLS ─────► │  • SDR/IA (Gemini, medido) │
                                                           │  • Agendamento (Calendar)  │
  Gateway de pagamento ──webhook (assinado)─────────────► │  • Billing (idempotente)   │
                                                           │  • Cron in-process (node-  │
  Google Calendar ◄──── OAuth ────────────────────────►   │    cron) p/ billing/follow │
                                                           └────────────┬──────────────┘
                                                                        │ Prisma (client único)
                                                                        ▼
                                                        Postgres gerenciado (migrations + backup/PITR)
                                                                        │
                                                        Sentry · logs estruturados (pino)
```

**Decisões-chave da topologia:**
- **Um backend só:** Express (`src/api`). `backend-nest/` é removido.
- **Postgres gerenciado** (Neon/Supabase/RDS) com backup automático e PITR — resolve backup, durabilidade e sai do SQLite de uma vez.
- **`prisma migrate deploy`** como etapa de deploy separada. `db push --accept-data-loss` **banido**.
- **Cron in-process é aceitável no MVP** (billing diário, follow-up) — desde que **idempotente** (constraint única em `Invoice(tenantId, período)`) e com shutdown limpo. Não precisa de fila distribuída para 10 clínicas.
- **WhatsApp oficial** via Meta Cloud API (direto ou por BSP — ver §5). Baileys sai do caminho de produção.
- **Instância única + `restart: unless-stopped`** e `process.exit` no erro fatal. Autohealing pelo orquestrador, sem clustering.

---

## 5. Build vs Buy — não construir o que é commodity

90% da engenharia vai para o agente de saúde (o fosso). O resto, compra-se.

| Domínio | Decisão | Escolha recomendada (MVP) | Racional |
|---------|---------|---------------------------|----------|
| Pagamentos | **BUY** | **Pagar.me** ou **Mercado Pago** (checkout hospedado + webhook) | PCI fora do seu escopo; recorrência + Pix nativos no BR. |
| WhatsApp | **BUY** | Meta Cloud API direto, ou **BSP** (360dialog / Zenvia / Gupshup) | BSP acelera aprovação e templates; oficial = não banível. |
| E-mail transacional | **BUY** | **Resend** ou SendGrid (+ SPF/DKIM/DMARC) | Verificação/reset/deliverability sem virar spam. |
| Hospedagem + Postgres | **BUY** | Railway / Render / Fly + Postgres gerenciado | Backup, TLS, deploy simples; sem operar banco na mão. |
| Error tracking | **BUY** | **Sentry** (free tier) | Enxergar erros em produção desde o dia 1. |
| Auth | **BUILD (endurecer)** | JWT próprio já existente, corrigido | Migrar auth agora custa mais que consertar; e-mail via provider. |
| Agendamento | **BUILD (reusar)** | `calendar_service.js` + Google Calendar (já no repo) | A lógica real existe; falta ligar a IA nela. |
| Agente de IA | **BUILD** | Gemini/OpenAI com camada de tools + guardrails + medição | **Aqui é o fosso.** Todo o esforço vai para cá. |

---

## 6. Mudanças no modelo de dados (Prisma)

Mínimas e cirúrgicas — para destravar billing, enforcement e compliance.

1. **Reconciliar contadores de uso.** Remover referências fantasmas (`monthlyMessagesCount`, `qualifiedLeadsCount`) e usar os campos reais (`usedMessages`). Incrementos atômicos (`increment`) dentro de transação onde a cota for verificada.
2. **Ciclo de assinatura no `Tenant`.** Popular `trialEnd` e `nextBillingDate` no signup; `subscriptionStatus` (`TRIAL | ACTIVE | PAST_DUE | CANCELED`) passa a ser **lido** no caminho de request.
3. **`Invoice` idempotente.** Constraint única `(tenantId, billingPeriod)` para o cron nunca duplicar fatura; campos `gatewayId`/`paidAt` preenchidos só pelo webhook.
4. **Consentimento/opt-out.** Flag `optedOut` + timestamp no contato/lead, e um registro de consentimento (origem, data). Stop-keyword marca `optedOut = true` e suprime envios.
5. **Verificação de conta.** `emailVerified: boolean` + tabela de tokens (verificação e reset de senha) com expiração.
6. **Índices.** `@@index([tenantId])` nos modelos quentes (`Lead`, `Message`, `Conversation`) e nas FKs (`conversationId`, `leadId`). Barato e destrava performance cedo.
7. **Audit mínimo.** Modelo `AuditLog` (ator, ação, entidade, timestamp) — no MVP, registrar ao menos ações de billing e admin.

Tudo isso entra como **uma migration versionada** (não `db push`).

---

## 7. Checklist de compliance para o piloto (LGPD + WhatsApp)

- [ ] Opt-in registrado antes de conversar; opt-out ("PARAR") honrado e testado.
- [ ] Termos de Uso + Política de Privacidade com aceite capturado no signup.
- [ ] Dados sensíveis de saúde: segredos criptografados em repouso; nada de segredo retornando ao frontend.
- [ ] Direitos do titular: rota de exportação e exclusão de dados do paciente.
- [ ] Templates do WhatsApp aprovados pela Meta; janela de 24h respeitada.
- [ ] Agente **proibido** de dar conselho médico — guardrail testado com casos-armadilha.
- [ ] Processo de comunicação de incidente definido (a LGPD exige).

---

## 8. Backlog priorizado — 4 sprints / 60 dias

Sequência pensada para reduzir risco na ordem certa: primeiro **não vazar/não perder dado**, depois **o produto funcionar**, depois **cobrar**, depois **compliance + ativar piloto**.

### Sprint 1 — Fundação & Segurança (semanas 1–2)
*Objetivo: parar de sangrar risco. Ao fim, o sistema é seguro e os dados são duráveis.*
- Rotacionar TODOS os segredos vazados (WhatsApp, Postgres, JWT); `git rm --cached` + purgar histórico de `auth_info_baileys/` e logs.
- Remover fallback do `JWT_SECRET` (falhar no boot se ausente); matar o superadmin `admin/admin`.
- **Tenant só do JWT** — remover o path `x-tenant-id` em todos os controllers; grep-ban no CI.
- Escopar toda query por-id com `tenantId` (fim do IDOR em leads/users/pipeline).
- Whitelist de `role` (impedir criação de SUPERADMIN por rota de tenant).
- Reativar `helmet()` + rate limit (login/webhook mais estritos) + CORS allowlist.
- Migrar para **Postgres gerenciado** + adotar `prisma migrate` + backup/PITR ligado.
- Deletar `backend-nest/`, `server.cts`, scripts `test_*/tmp_*/scratch`.
- **Gate de saída:** pentest interno do isolamento de tenant passa; restore de backup testado.

### Sprint 2 — WhatsApp oficial + loop do SDR (semanas 3–4)
*Objetivo: o produto faz o que promete, no canal certo.*
- Integração **Meta Cloud API** (via `meta.js`, endurecido): webhook assinado (HMAC), envio por template/sessão.
- Pipeline inbound → IA qualifica → responde, com **medição de tokens atômica**.
- **Agendamento real:** ligar a IA à `CalendarService.listAvailableSlots`; `create_appointment` com **detecção de conflito** + sync Google Calendar; unificar status.
- Guardrails do agente: escopo restrito a agendar/qualificar; nunca conselho médico; camada de tools estruturada (sem concatenar input cru no prompt).
- Handoff humano: toggle bot on/off por conversa, com histórico.
- Baileys → modo experimental, fora do caminho de produção.
- **Gate de saída:** uma clínica de teste agenda uma consulta real de ponta a ponta pelo WhatsApp oficial.

### Sprint 3 — Monetização (semanas 5–6)
*Objetivo: cobrar de verdade e fechar o loop.*
- Gateway (Pagar.me/Mercado Pago): checkout hospedado + **webhook confirma pagamento** (fatura só vira PAID no callback). Remover `payInvoiceMock` e recebimento de cartão cru.
- Ciclo de assinatura: `trialEnd`/`nextBillingDate` no signup; cron de billing **idempotente**.
- **Enforcement de PAST_DUE/active:** middleware bloqueia mensagem/IA/agendamento quando não está `ACTIVE|TRIAL`.
- Enforcement de limites de plano (mensagens, leads, tokens) usando os campos reconciliados; alerta de overage.
- Auth: verificação de e-mail + reset de senha (via Resend); política de senha; remover escolha livre de plano no registro.
- **Gate de saída:** um cliente-teste assina, é cobrado por Pix/cartão de verdade, e ao cancelar perde o acesso.

### Sprint 4 — Compliance, observabilidade & piloto (semanas 7–8)
*Objetivo: pronto para colocar clínicas reais e enxergar o que acontece.*
- Opt-out/consentimento + stop-keyword; Termos/Privacidade com aceite; rota de exportação/exclusão de dados.
- Observabilidade: Sentry, logs estruturados (pino com `tenantId`/`requestId`), `/healthz` + `/readyz`, graceful shutdown, `process.exit` no fatal, `restart` policy.
- AuditLog mínimo (billing/admin).
- Painel de resultados da clínica: consultas agendadas, conversas atendidas, tempo de resposta.
- Fluxo de onboarding self-service: conectar número, treinar agente com dados da clínica, testar em sandbox.
- **Gate de saída (launch gate):** onboarding completo por um usuário não-técnico em < 30 min; 10 clínicas-piloto em produção.

---

## 9. Launch gate — Definition of Done do MVP

O MVP só vai ao mercado quando **todos** forem verdade:

1. Um usuário de um tenant **não** consegue, por nenhum header/param, tocar em dados de outro. *(teste automatizado)*
2. Nenhum segredo no repositório ou no histórico; todos rotacionados. *(scan de segredo no CI)*
3. Deploy roda `prisma migrate deploy`; nunca `db push`. Restore de backup testado.
4. WhatsApp é oficial; templates aprovados; opt-out funciona.
5. O agente agenda no calendário real, sem conflito, e nunca dá conselho médico. *(evals com casos-armadilha)*
6. Pagamento é confirmado por webhook do gateway; inadimplência bloqueia uso.
7. Limites de plano são enforçados e o uso é medido corretamente.
8. Health checks, Sentry e logs estruturados no ar; shutdown limpo.
9. Termos/Privacidade aceitos no signup; exportação/exclusão de dados disponível.
10. Uma clínica-piloto passou pelo fluxo inteiro — do onboarding à consulta agendada à cobrança — sem intervenção de engenharia.

---

## 10. Métricas do piloto

- **North-star:** consultas agendadas pelo agente / clínica / mês.
- **Ativação:** % de clínicas que conectam o número e treinam o agente em < 24h.
- **Valor:** % de leads respondidos em < 1 min; nº de handoffs (saudável, não zero).
- **Negócio:** conversão trial → pago; margem por cliente (receita − custo de IA/WhatsApp medido).
- **Confiança:** CSAT do paciente; zero incidentes de vazamento cross-tenant; zero número banido.

---

### Sequência recomendada de execução
Começar pelo **Sprint 1 na branch `claude/oi-6b6qxc`** — é o de maior risco e o pré-requisito de tudo. Cada sprint tem um *gate de saída* verificável, então dá para parar, revisar e ajustar rota a cada 2 semanas sem comprometer o todo.
