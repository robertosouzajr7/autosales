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

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

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

  // Disco local
  const dir = path.join(UPLOAD_DIR, scope);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, path.basename(key)), buffer);
  const base = (process.env.PUBLIC_URL || publicBase || "").replace(/\/$/, "");
  return `${base}/uploads/${key}`;
}

export function storageMode() {
  return useS3() ? "s3" : "local";
}
