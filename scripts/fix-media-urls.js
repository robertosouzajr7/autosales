#!/usr/bin/env node
/**
 * Backfill de URLs de mídia: reescreve URLs absolutas antigas que embutiam o
 * host interno do container (ex.: https://autosales.agentesvirtuais.com/uploads/…)
 * — que não resolvem via DNS público — para caminhos RELATIVOS /api/uploads/…,
 * que o navegador resolve na origem correta (o domínio público).
 *
 * Idempotente: só mexe em URLs que casam com o padrão de upload.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Normaliza toda URL de upload local para o caminho canônico /api/uploads/<key>.
// Cobre as formas quebradas que já foram gravadas:
//   - https://host/uploads/<key>            (host interno antigo)
//   - https://host/api/uploads/<key>
//   - /uploads/<key>
//   - https://host/<uuid>/<hex>.<ext>       (S3 sem S3_PUBLIC_URL)
//   - /<uuid>/<hex>.<ext>                    (bare key com barra)
// Não mexe no que já está correto nem em URLs externas legítimas.
const KEY = "[0-9a-fA-F-]{16,36}\\/[0-9a-zA-Z._-]+\\.[a-zA-Z0-9]+";
function toRelative(url) {
  if (typeof url !== "string" || !url) return null;
  if (url.startsWith("/api/uploads/")) return null; // já canônico
  let m;
  // .../uploads/<key> ou .../api/uploads/<key> (absoluto ou relativo)
  m = url.match(/^(?:https?:\/\/[^/]+)?\/(?:api\/)?uploads\/(.+)$/i);
  if (m) return `/api/uploads/${m[1]}`;
  // bare key: /<uuid>/<hex>.<ext> ou https://host/<uuid>/<hex>.<ext>
  m = url.match(new RegExp(`^(?:https?:\\/\\/[^/]+)?\\/(${KEY})$`));
  if (m) return `/api/uploads/${m[1]}`;
  return null;
}

async function main() {
  let fixed = 0;

  const products = await prisma.product.findMany({
    select: { id: true, imageUrl: true, audioUrl: true, videoUrl: true },
  });
  for (const p of products) {
    const data = {};
    for (const f of ["imageUrl", "audioUrl", "videoUrl"]) {
      const rel = toRelative(p[f]);
      if (rel && rel !== p[f]) data[f] = rel;
    }
    if (Object.keys(data).length) {
      await prisma.product.update({ where: { id: p.id }, data });
      fixed++;
    }
  }

  // Mensagens com mídia (histórico do chat)
  const msgs = await prisma.message.findMany({
    where: { mediaUrl: { not: null } },
    select: { id: true, mediaUrl: true },
  });
  let msgsFixed = 0;
  for (const m of msgs) {
    const rel = toRelative(m.mediaUrl);
    if (rel && rel !== m.mediaUrl) {
      await prisma.message.update({ where: { id: m.id }, data: { mediaUrl: rel } });
      msgsFixed++;
    }
  }

  console.log(`✅ URLs corrigidas — produtos: ${fixed}, mensagens: ${msgsFixed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
