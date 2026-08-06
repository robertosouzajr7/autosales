/**
 * Orçamento de requisições: de quem é o balde.
 *
 *   JWT_SECRET=... node scripts/test-limite-requisicoes.mjs
 *
 * O limite era por IP. Uma clínica inteira atrás de um NAT dividia os mesmos
 * 600 em 15 minutos, então bastava o painel de alguns atendentes ficar aberto
 * para o próximo levar 429 — inclusive no meio do onboarding, ao concluir o
 * cadastro. Aqui se verifica de quem passa a ser a conta, e o que fica fora
 * dela.
 */
import { donoDoOrcamento, FLUXOS, WEBHOOKS } from "../src/api/utils/rateLimitKey.js";
import jwt from "jsonwebtoken";

const SEGREDO = process.env.JWT_SECRET;
let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};

const requisicao = ({ token = null, naQuery = false, ip = "200.150.10.7" } = {}) => ({
  headers: token && !naQuery ? { authorization: `Bearer ${token}` } : {},
  query: token && naQuery ? { token } : {},
  ip,
  socket: { remoteAddress: ip },
});

if (!SEGREDO) throw new Error("Defina JWT_SECRET.");
const tokenDe = (userId) => jwt.sign({ userId, tenantId: "t1", role: "AGENT" }, SEGREDO, { expiresIn: "1h" });

// ── 1. Cada pessoa com o próprio orçamento ────────────────────
console.log("\n1. Mesmo escritório, mesma saída de internet");
const ana = donoDoOrcamento(requisicao({ token: tokenDe("user-ana") }));
const bruno = donoDoOrcamento(requisicao({ token: tokenDe("user-bruno") }));
ok(ana !== bruno, `Ana e Bruno não dividem o balde (${ana} ≠ ${bruno})`);
ok(ana.startsWith("u:"), `o balde é da pessoa (${ana})`);

const anaDeOutraRede = donoDoOrcamento(requisicao({ token: tokenDe("user-ana"), ip: "10.0.0.1" }));
ok(anaDeOutraRede === ana, "e a acompanha se ela trocar de rede");

// ── 2. O token pode vir na query (EventSource) ────────────────
console.log("\n2. Token na query");
ok(
  donoDoOrcamento(requisicao({ token: tokenDe("user-ana"), naQuery: true })) === ana,
  "o fluxo de eventos, que não manda cabeçalho, cai no mesmo balde"
);

// ── 3. Sem token válido, vale o IP ────────────────────────────
console.log("\n3. Sem credencial");
const visitante = donoDoOrcamento(requisicao());
ok(visitante.startsWith("ip:"), `quem não está logado é contado por IP (${visitante})`);

const forjado = jwt.sign({ userId: "invasor" }, "outro-segredo-qualquer-bem-diferente");
ok(
  donoDoOrcamento(requisicao({ token: forjado })) === visitante,
  "token forjado não ganha balde novo — cai no IP, senão o limite deixaria de existir"
);
const vencido = jwt.sign({ userId: "user-ana" }, SEGREDO, { expiresIn: -10 });
ok(donoDoOrcamento(requisicao({ token: vencido })) === visitante, "token vencido idem");
ok(donoDoOrcamento(requisicao({ token: "nem-é-jwt" })) === visitante, "lixo no cabeçalho idem");

const outroIp = donoDoOrcamento(requisicao({ ip: "177.20.30.40" }));
ok(outroIp !== visitante, `e IPs diferentes continuam separados (${outroIp})`);

// ── 4. O que não entra na conta ───────────────────────────────
console.log("\n4. Fora da contagem");
ok(FLUXOS.includes("/events"), "o fluxo de eventos do painel");
ok(FLUXOS.includes("/public/chat/stream"), "e o do chat do site");
for (const w of ["/webhook/whatsapp", "/webhook/meta", "/webhook/payment", "/webhook/stripe"]) {
  ok(WEBHOOKS.includes(w), `webhook ${w}`);
}

console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
process.exit(falhas === 0 ? 0 : 1);
