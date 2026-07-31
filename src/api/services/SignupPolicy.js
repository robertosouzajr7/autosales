/**
 * Regras de entrada da conta: e-mail que existe de verdade e senha que
 * aguenta um vazamento.
 *
 * O cadastro só pedia 8 caracteres — "12345678" passava, e passava também
 * qualquer coisa com "@" no meio como e-mail. Como a conta dá acesso a
 * conversas de clientes reais, as duas coisas precisam de peso.
 */

/** Senhas que aparecem em toda lista de vazamento. Nenhuma delas entra. */
const OBVIAS = new Set([
  "12345678", "123456789", "1234567890", "senha123", "password", "password1",
  "qwerty123", "abc12345", "11111111", "00000000", "admin123", "adminadmin",
  "whatsapp1", "mudar123", "trocar123", "teste123", "123mudar",
]);

/** Domínios descartáveis: conta de teste que some não pode virar cliente. */
const DESCARTAVEIS = new Set([
  "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
  "yopmail.com", "throwawaymail.com", "trashmail.com", "sharklasers.com",
  "getnada.com", "temp-mail.org", "fakeinbox.com", "maildrop.cc",
]);

export const MIN_SENHA = 8;

/**
 * A senha é forte o bastante?
 * @returns { ok, erro, forca } — forca de 0 a 4, para a barra da tela.
 */
export function validarSenha(senha, { nome, email } = {}) {
  const s = String(senha || "");

  if (s.length < MIN_SENHA) {
    return { ok: false, forca: 0, erro: `A senha precisa de pelo menos ${MIN_SENHA} caracteres.` };
  }
  if (s.length > 200) {
    return { ok: false, forca: 0, erro: "A senha é longa demais." };
  }

  const temMinuscula = /[a-z]/.test(s);
  const temMaiuscula = /[A-Z]/.test(s);
  const temNumero = /\d/.test(s);
  const temSimbolo = /[^A-Za-z0-9]/.test(s);

  if (!temMinuscula || !temMaiuscula || !temNumero) {
    return {
      ok: false,
      forca: contarForca(s),
      erro: "Use maiúscula, minúscula e número na senha.",
    };
  }

  const minusculo = s.toLowerCase();
  if (OBVIAS.has(minusculo)) {
    return { ok: false, forca: 1, erro: "Esta senha é conhecida demais. Escolha outra." };
  }
  // Um caractere só repetido, ou sequência do teclado.
  if (/^(.)\1+$/.test(s) || /12345|abcdef|qwerty|asdfgh/.test(minusculo)) {
    return { ok: false, forca: 1, erro: "Evite sequências e repetições — são as primeiras que testam." };
  }

  // Senha que é o próprio nome ou e-mail não protege nada.
  const local = String(email || "").split("@")[0].toLowerCase();
  if (local.length >= 4 && minusculo.includes(local)) {
    return { ok: false, forca: 1, erro: "A senha não pode conter o seu e-mail." };
  }
  const primeiroNome = String(nome || "").trim().split(/\s+/)[0]?.toLowerCase();
  if (primeiroNome && primeiroNome.length >= 4 && minusculo.includes(primeiroNome)) {
    return { ok: false, forca: 1, erro: "A senha não pode conter o seu nome." };
  }

  return { ok: true, forca: contarForca(s), erro: null };
}

/** 0 a 4 — só para a barrinha da tela, não é política de aceitação. */
function contarForca(s) {
  let f = 0;
  if (s.length >= 8) f++;
  if (s.length >= 12) f++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) f++;
  if (/\d/.test(s) && /[^A-Za-z0-9]/.test(s)) f++;
  return Math.min(4, f);
}

/**
 * O e-mail tem cara de e-mail real?
 * Sem consulta de DNS de propósito: derrubar cadastro por instabilidade de
 * rede seria pior do que deixar passar um domínio inexistente — a
 * confirmação por e-mail é quem resolve isso de verdade.
 */
export function validarEmail(email) {
  const limpo = String(email || "").trim().toLowerCase();
  if (!limpo) return { ok: false, erro: "Informe o e-mail." };
  if (limpo.length > 254) return { ok: false, erro: "E-mail longo demais." };

  const formato = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;
  if (!formato.test(limpo)) return { ok: false, erro: "Este e-mail não parece válido." };
  if (limpo.includes("..")) return { ok: false, erro: "Este e-mail não parece válido." };

  const dominio = limpo.split("@")[1];
  if (DESCARTAVEIS.has(dominio)) {
    return { ok: false, erro: "Use um e-mail permanente — é por ele que você recebe acesso e avisos de cobrança." };
  }

  return { ok: true, email: limpo, erro: null };
}

export default { validarSenha, validarEmail, MIN_SENHA };
