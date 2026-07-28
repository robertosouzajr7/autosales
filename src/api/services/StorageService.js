import path from "path";
import fs from "fs";
import crypto from "crypto";

/**
 * Armazenamento de mídia com dois back-ends, escolhidos por env:
 *
 *  1. Object storage S3-compatível (recomendado em produção — sobrevive a
 *     restart de container). Ativado quando S3_BUCKET está definido:
 *       S3_BUCKET, S3_REGION (default auto), S3_ENDPOINT (R2/MinIO),
 *       S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL (base pública)
 *
 *  2. Disco local (fallback / dev). Grava em UPLOAD_DIR (default
 *     public/uploads) e serve via /uploads. Em container efêmero, monte
 *     um volume persistente nesse caminho.
 */

// Diretório de uploads. Em produção aponte UPLOAD_DIR para um VOLUME
// PERSISTENTE (ex.: /data/uploads) — o container é efêmero e o disco padrão é
// apagado a cada redeploy. Garantimos que a pasta exista já no boot.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[Storage] Diretório de uploads: ${UPLOAD_DIR} (modo: ${process.env.S3_BUCKET ? "s3" : "disco"})`);
} catch (e) {
  console.error(`[Storage] Não consegui criar UPLOAD_DIR (${UPLOAD_DIR}):`, e.message);
}

function useS3() {
  return !!process.env.S3_BUCKET;
}

let _s3 = null;
async function s3() {
  if (_s3) return _s3;
  const { S3Client } = await import("@aws-sdk/client-s3");
  _s3 = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined, // R2/MinIO
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials: process.env.S3_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
  });
  return _s3;
}

/**
 * Salva um buffer e devolve a URL pública.
 * @param {Buffer} buffer
 * @param {string} ext extensão sanitizada (sem ponto)
 * @param {string} contentType mimetype
 * @param {string} scope subpasta lógica (ex.: tenantId)
 * @param {string} publicBase base p/ montar URL no modo disco (req origin)
 */
export async function saveMedia(buffer, ext, contentType, scope, publicBase) {
  const key = `${scope}/${crypto.randomBytes(8).toString("hex")}.${ext}`;

  if (useS3()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: process.env.S3_ENDPOINT ? undefined : "public-read", // R2 usa bucket público; S3 aceita ACL
      })
    );
    const base = (process.env.S3_PUBLIC_URL || "").replace(/\/$/, "");
    return `${base}/${key}`;
  }

  // Disco local. Servimos sob /api/uploads (encaminhado para a API mesmo com
  // front separado). Por padrão devolvemos um caminho RELATIVO — o navegador
  // resolve na origem da página (o domínio público), evitando embutir o host
  // interno do container (que não resolve via DNS). Só usamos base absoluta se
  // PUBLIC_URL estiver explicitamente definido (necessário p/ mídia enviada à
  // Meta, que precisa de URL pública). Nunca usamos req.host aqui.
  const dir = path.join(UPLOAD_DIR, scope);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, path.basename(key)), buffer);
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  return `${base}/api/uploads/${key}`;
}

export function storageMode() {
  return useS3() ? "s3" : "local";
}

// Mapeia uma URL de upload local (/api/uploads/... ou /uploads/...) para o
// caminho no disco. Devolve null se não for um upload local servido por nós.
export function localPathFor(url) {
  if (typeof url !== "string") return null;
  const m = url.match(/\/(?:api\/)?uploads\/(.+)$/);
  if (!m) return null;
  const rel = m[1].split("?")[0].replace(/\.\.+/g, ""); // sem path traversal
  return path.join(UPLOAD_DIR, rel);
}

// Absolutiza uma URL relativa de upload usando PUBLIC_URL (necessário quando a
// mídia precisa ser buscada remotamente, ex.: pela Meta). URLs já absolutas
// (http/https/data) passam intactas.
export function toPublicUrl(url) {
  if (typeof url !== "string" || !url) return url;
  if (/^(https?:|data:)/i.test(url)) return url;
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  if (!base) return url; // sem base pública configurada — devolve como está
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}
