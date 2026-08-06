import jwt from "jsonwebtoken";
import { ipKeyGenerator } from "express-rate-limit";

/**
 * A quem pertence o orçamento de requisições.
 *
 * Só por IP, uma clínica inteira atrás de um NAT dividia os mesmos 600 —
 * bastavam três atendentes com o painel aberto para o quarto levar 429 na
 * primeira coisa que fizesse, inclusive no meio do onboarding. Quem está
 * autenticado passa a ter o próprio orçamento.
 *
 * O token é conferido de verdade, e não só lido: sem isso, inventar um token
 * qualquer daria um balde novo e o limite deixaria de existir.
 */
export function donoDoOrcamento(req) {
  const cabecalho = req.headers?.authorization || "";
  const bruto = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : req.query?.token;
  if (bruto) {
    try {
      const dados = jwt.verify(String(bruto), process.env.JWT_SECRET);
      if (dados?.userId) return `u:${dados.userId}`;
    } catch { /* token inválido ou expirado: volta a valer o IP */ }
  }
  // `ipKeyGenerator` recebe o IP, não a requisição: passar `req` devolvia
  // "[object Object]" e jogava TODO mundo que não está logado num balde só.
  // Ele também agrupa IPv6 por bloco /56, que é a unidade que um provedor
  // entrega a um assinante — sem isso, trocar de endereço na mesma casa
  // daria um balde novo a cada requisição.
  return `ip:${ipKeyGenerator(req.ip || req.socket?.remoteAddress || "desconhecido")}`;
}

/**
 * Conexões de longa duração (SSE). Uma só fica aberta por horas e não gasta
 * nada; o que gastava era a reconexão automática do navegador quando o proxy
 * derrubava o fluxo — a cada 3 segundos, indefinidamente. O keep-alive no
 * handler resolve a causa; ficarem fora da contagem evita que uma oscilação
 * de rede consuma o orçamento do dia.
 */
export const FLUXOS = ["/events", "/public/chat/stream"];

/**
 * Webhooks são chamados por origem única (loop interno localhost, ou a infra
 * da Meta em rajada) — limitá-los por IP estrangularia todos os tenants de
 * uma vez. O webhook da Meta é autenticado por HMAC.
 */
export const WEBHOOKS = ["/webhook/whatsapp", "/webhook/meta", "/webhook/payment", "/webhook/stripe"];
