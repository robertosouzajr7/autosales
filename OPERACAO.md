# Operação & Deploy — Agentes Virtuais

Guia consolidado das ações de produção. Itens marcados **[VOCÊ]** dependem
de ação manual sua (infra/credenciais); os demais já estão no código.

---

## 1. Banco de dados — migrations (crítico) ✅ no código

O deploy **não usa mais** `db push --accept-data-loss`. Agora aplica
**migrations versionadas** (`prisma migrate deploy`) via
`scripts/migrate-and-start.js`, com **baseline automático** para o banco
que já existe.

### O que acontece no primeiro deploy
- **Banco novo (vazio):** cria tudo a partir de `prisma/migrations/0_init`.
- **Banco que já existe (criado antes por db push):** o primeiro
  `migrate deploy` falha (schema não vazio); o script então faz o
  *baseline* (`migrate resolve --applied 0_init`) e roda de novo. A partir
  daí, o histórico fica registrado.

### **[VOCÊ]** Recomendado: baseline manual antes do 1º deploy
Para evitar qualquer surpresa, rode uma vez, apontando para o banco de produção:
```bash
DATABASE_URL="postgresql://..." npx prisma migrate resolve --applied 0_init
```
Se você não rodar, o `migrate-and-start.js` tenta fazer sozinho — mas o
manual é mais previsível.

### Criando novas migrations (daqui pra frente)
```bash
# em dev, após mudar o schema:
npm run migrate:new -- nome_da_mudanca
# conferir status:
npm run migrate:status
```
Nunca mais edite o schema e confie no `db push` em produção.

---

## 2. Segredos — rotação e histórico (crítico) **[VOCÊ]**

### 2a. Rotacionar o que vazou
Durante o desenvolvimento, credenciais foram expostas (em conversa/logs).
Rotacione **todas** no respectivo painel e atualize as envs no EasyPanel:
- `JWT_SECRET` (gera novo; desloga todo mundo — esperado)
- `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `SERPER_API_KEY`
- Credenciais SNOV, senha do **Postgres**, senha **SMTP**

### 2b. Histórico do git contém credenciais do WhatsApp
`auth_info_baileys/creds.json` (sessão do WhatsApp Baileys) está no
**histórico** do repositório (foi commitado antes de entrar no
`.gitignore`). O working tree já está limpo, mas o histórico não.

Para purgar (⚠️ **reescreve o histórico — coordene, força push**):
```bash
# opção recomendada: git filter-repo
pip install git-filter-repo
git filter-repo --path auth_info_baileys --invert-paths
git push --force --all
```
Depois de purgar, **reconecte o WhatsApp** (a sessão antiga deve ser
considerada comprometida) e prefira a **Meta Cloud API** (oficial) no lugar
do Baileys.

> O `.gitignore` já cobre `.env`, `auth_info_baileys/`, `*.log` e
> `uploads/` — não haverá novos vazamentos por esses caminhos.

---

## 3. Observabilidade — Sentry (médio) ✅ no código / **[VOCÊ]** DSN

`@sentry/node` está instalado e ligado: exceções de rota (error middleware),
`unhandledRejection` e `uncaughtException` são capturadas. Só falta o DSN:
```
SENTRY_DSN=https://...@o0.ingest.sentry.io/0
```
Sem DSN, tudo continua indo para os logs estruturados (pino) — nada quebra.

---

## 4. Mídia do catálogo — armazenamento (médio) ✅ no código / **[VOCÊ]** infra

Uploads usam `StorageService`, que escolhe o back-end por env:

- **Sem `S3_BUCKET`** → grava em disco local (`UPLOAD_DIR`, servido em
  `/uploads`). Em container efêmero (EasyPanel), **monte um volume
  persistente** no caminho de `UPLOAD_DIR` (ou `public/uploads`), senão as
  mídias somem no restart.
- **Com `S3_BUCKET`** (recomendado) → grava em object storage S3-compatível
  (**Cloudflare R2**, AWS S3, MinIO). Sobrevive a restart e escala. Ver
  `.env.example` para as variáveis (`S3_ENDPOINT`, `S3_PUBLIC_URL`, etc.).

**Sugestão:** Cloudflare R2 tem free tier generoso e é S3-compatível —
crie um bucket público, preencha as envs `S3_*` e pronto.

---

## 5. Canais oficiais **[VOCÊ]** (dependem de aprovação externa)

- **WhatsApp:** templates aprovados na Meta; respeitar janela de 24h.
- **Instagram Direct:** app Meta com produto Instagram + permissão
  `instagram_manage_messages` no App Review (~5 dias úteis). O código já
  está pronto (texto e mídia); é só conectar depois de aprovado.

---

## 6. Checklist de deploy no EasyPanel

1. Envs obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `PUBLIC_URL`,
   `FRONTEND_URL`, `ALLOWED_ORIGINS`.
2. E-mail: `SMTP_HOST/PORT/USER/PASS/FROM` (senha entre aspas se tiver `#`).
3. Pagamento: configurar no painel admin, ou `MP_ACCESS_TOKEN` /
   `STRIPE_SECRET_KEY` + secrets de webhook.
4. Observabilidade: `SENTRY_DSN` (opcional).
5. Mídia: `S3_*` (recomendado) **ou** volume persistente em `public/uploads`.
6. WhatsApp: `META_VERIFY_TOKEN`, `META_APP_SECRET` (webhook oficial).
7. **Rebuild** dos serviços `autosales-api` e `autosales-frontend`.
8. Rodar `seed_plans.js` uma vez se os planos ainda não existirem.
