/**
 * Catálogo de vozes: o que aparece na tela do admin quando a ElevenLabs
 * recusa.
 *
 *   node scripts/test-voice-catalog.mjs
 *
 * O aviso dizia sempre "verifique a chave", inclusive quando a chave estava
 * certa e faltava permissão, crédito ou saída de rede — mandando mexer no
 * lugar errado. Aqui se verifica que o motivo real chega à tela.
 */
import { motivoDaEleven } from "../src/api/services/VoiceService.js";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};
const erro = (status, data) => Object.assign(new Error("Request failed"), { response: { status, data } });

console.log("\n1. Chave recusada");
let m = motivoDaEleven(erro(401, { detail: { status: "invalid_api_key", message: "Invalid API key provided." } }));
ok(/401/.test(m) && /Invalid API key/.test(m), `fala em 401 e repete o que a ElevenLabs respondeu: "${m}"`);

console.log("\n2. Permissão faltando");
m = motivoDaEleven(erro(403, { detail: { status: "missing_permissions", message: "The API key is missing the permission voices_read." } }));
ok(/permissão/i.test(m) && /voices_read/.test(m), `aponta a permissão que falta: "${m}"`);

console.log("\n3. Limite de requisições");
m = motivoDaEleven(erro(429, { detail: "Too many requests" }));
ok(/429/.test(m) && /Too many requests/.test(m), `detail em texto puro também é lido: "${m}"`);

console.log("\n4. Erro de validação (detail em lista)");
m = motivoDaEleven(erro(422, { detail: [{ msg: "page_size must be <= 100" }] }));
ok(/page_size/.test(m), `lista de validação vira frase: "${m}"`);

console.log("\n5. Sem resposta nenhuma");
m = motivoDaEleven(Object.assign(new Error("getaddrinfo ENOTFOUND api.elevenlabs.io"), {}));
ok(/rede/i.test(m) && /ENOTFOUND/.test(m), `distingue rede de chave: "${m}"`);

console.log("\n6. Nunca cai no genérico de antes");
for (const e of [erro(401, {}), erro(500, {}), new Error("socket hang up")]) {
  const t = motivoDaEleven(e);
  ok(!/^Não foi possível listar as vozes premium \(verifique a chave\)\.$/.test(t) && t.length > 20, `explica algo: "${t}"`);
}

console.log(`\n${falhas === 0 ? "✅ Todos os cenários passaram." : `❌ ${falhas} verificação(ões) falharam.`}`);
process.exit(falhas === 0 ? 0 : 1);
