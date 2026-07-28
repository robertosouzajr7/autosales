# Armazenamento persistente de uploads (volume no EasyPanel)

O container é efêmero: o disco padrão é apagado a cada redeploy, então as
imagens do catálogo somem. A solução é gravar os uploads em um **volume
persistente**.

## Passo a passo (EasyPanel)

No serviço **`autosales-api`**:

1. **Variável de ambiente** — defina o caminho dos uploads:
   ```
   UPLOAD_DIR=/data/uploads
   ```

2. **Volume (Mounts)** — adicione um volume persistente montado nesse caminho:
   - Tipo: Volume
   - Mount path (no container): `/data/uploads`
   - (nome do volume: ex. `autosales-uploads`)

3. **Redeploy** do `autosales-api`.

Pronto. A partir daí:
- Os uploads são gravados em `/data/uploads` (volume) e **sobrevivem a
  redeploys**.
- A API serve os arquivos em `/uploads/...` **e** `/api/uploads/...`.
- As URLs salvas são **relativas** (`/api/uploads/...`), então o navegador as
  resolve no domínio público automaticamente.

## Credenciais do WhatsApp (auth_info) — persistir também

As credenciais do WhatsApp (Baileys) ficam em `./instances/` por padrão, que
some no redeploy — por isso o número **pede QR de novo a cada deploy** e as
quedas viram reconexão manual. Para persistir:

1. **Variável de ambiente** (não pode ser sob a pasta de uploads, que é
   pública):
   ```
   WA_AUTH_DIR=/data/instances
   ```
2. **Volume (Mounts)** — monte um volume persistente em `/data/instances`
   (pode ser o mesmo volume montado em `/data`, se você montar o pai `/data`
   em vez de `/data/uploads`).
3. Redeploy. No boot o log mostra `[WhatsApp] Credenciais (auth_info) em:
   /data/instances`.

Com isso o número **reconecta sozinho após redeploy**, sem novo QR.

## Observações

- **Imagens antigas** (enviadas antes do volume) foram perdidas com os
  redeploys anteriores — precisam ser reenviadas uma vez.
- **Envio de mídia pelo Instagram**: a Meta busca a mídia remotamente, então
  precisa de URL absoluta. Defina também:
  ```
  PUBLIC_URL=https://agentesvirtuais.com
  ```
  (no WhatsApp não é necessário — a mídia é lida direto do disco.)
- Se um dia quiser escalar para múltiplas instâncias ou tirar a mídia do disco
  do VPS, o mesmo código suporta object storage S3/R2 — basta configurar
  `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `S3_PUBLIC_URL` (nenhuma mudança de código necessária).
