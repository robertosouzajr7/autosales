# ⚠️ Rotação de Segredos — AÇÃO OBRIGATÓRIA

Os segredos abaixo foram **removidos do tracking do git** (commit "chore(security): stop tracking WhatsApp session and log files"), mas **continuam no histórico** do repositório. Remover do índice **não** os torna seguros — quem tem qualquer clone ou acesso ao histórico ainda os lê. Portanto, todos devem ser tratados como **comprometidos e rotacionados**.

> A limpeza do histórico (`git filter-repo` / BFG + force-push) é uma operação destrutiva e coordenada — deve ser feita com o time avisado, pois reescreve os hashes de todos os commits. Não foi executada automaticamente por isso.

## Checklist

- [ ] **Sessão do WhatsApp (`auth_info_baileys/creds.json`)** — desconectar/deslogar todos os dispositivos vinculados e reconectar. As chaves privadas (`noiseKey`, `signedIdentityKey`, `pairingEphemeralKeyPair`) vazadas permitem sequestro da sessão. *(No MVP, migrar para a Meta Cloud API oficial elimina esse arquivo de vez.)*
- [ ] **Senha do Postgres (`Rr756213Rr`)** — presente em `docker-compose.yml` e `scripts/switch-db.js`. Rotacionar a senha do banco e mover para variável de ambiente/secret manager. Nunca publicar a porta 5432 externamente.
- [ ] **`JWT_SECRET` (`vendai-secret-key-2026`)** — gerar um segredo forte novo (32+ bytes aleatórios) e definir por env. A rotação invalida todos os tokens atuais (todos precisam relogar) — o que é desejável aqui.
- [ ] **Chaves de terceiros em logs** — revisar `error.log`, `stdout.log`, `baileys_crash.log` (no histórico) em busca de tokens/PII expostos e rotacionar o que aparecer.
- [ ] **Purgar o histórico** — após rotacionar tudo, rodar `git filter-repo --path auth_info_baileys --invert-paths` (e para os logs) e force-push, com o time avisado.

## Como gerar um JWT_SECRET forte

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Defina o valor em `JWT_SECRET` no ambiente de produção (secret manager do host). O código foi ajustado para **falhar no boot** se `JWT_SECRET` não estiver definido — não há mais fallback.
