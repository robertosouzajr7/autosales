/**
 * Versão dos documentos jurídicos.
 *
 * Fica em .js puro de propósito: o painel (TypeScript) e a API (Node) precisam
 * do MESMO número. Se cada lado tivesse a sua constante, o aceite gravado no
 * banco poderia apontar para uma versão que o usuário nunca viu — e é
 * exatamente isso que a prova de consentimento não pode ter.
 *
 * Suba quando mudar algo relevante nos Termos ou na Política.
 */
export const VERSAO_DOCUMENTOS = "1.0";
export const VIGENTE_DESDE = "31 de julho de 2026";
