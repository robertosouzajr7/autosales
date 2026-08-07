import prisma from "../config/prisma.js";

/**
 * Disponibilidade do atendente.
 *
 * É o que decide para quem a fila transfere. Sem isso, uma conversa era
 * atribuída a quem estava almoçando e ficava parada até ele voltar — do lado
 * do cliente, indistinguível de ninguém ter visto.
 *
 * Em pausa a pessoa continua vendo tudo e continua podendo responder o que já
 * é dela: a pausa vale para o que CHEGA, não para o que já está na mão. Pausa
 * que tira as conversas de alguém no meio do atendimento deixaria cliente
 * falando sozinho.
 */

export const ESTADOS = { ONLINE: "ONLINE", PAUSA: "PAUSA", FORA: "FORA" };

/**
 * O estado real, considerando a volta prometida.
 *
 * "Volto em 15 minutos" que ninguém desliga vira pausa até alguém lembrar —
 * e o efeito prático é a fila parar de distribuir para essa pessoa por horas.
 * Passada a hora, ela conta como ONLINE de novo.
 */
export function estadoDe(user) {
  const estado = user?.disponibilidade || ESTADOS.ONLINE;
  if (estado === ESTADOS.ONLINE) return ESTADOS.ONLINE;
  if (user?.disponivelAte && new Date(user.disponivelAte) <= new Date()) return ESTADOS.ONLINE;
  return estado;
}

export const estaDisponivel = (user) => user?.active !== false && estadoDe(user) === ESTADOS.ONLINE;

class AvailabilityService {
  /** Muda o próprio estado. `minutos` guarda a volta prometida. */
  async definir(userId, { estado, minutos = null, recado = null }) {
    const alvo = ESTADOS[String(estado || "").toUpperCase()];
    if (!alvo) throw new Error("Estado inválido. Use ONLINE, PAUSA ou FORA.");

    const dados = {
      disponibilidade: alvo,
      recadoDeAusencia: alvo === ESTADOS.ONLINE ? null : (recado || null),
      // Voltar para ONLINE apaga a promessa de retorno: ela já se cumpriu.
      disponivelAte:
        alvo === ESTADOS.ONLINE || !minutos
          ? null
          : new Date(Date.now() + Number(minutos) * 60000),
    };
    const user = await prisma.user.update({ where: { id: userId }, data: dados });
    return this.formatar(user);
  }

  async doUsuario(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user ? this.formatar(user) : null;
  }

  /** Quem está de fato disponível numa conta, para a fila escolher. */
  async disponiveis(tenantId, { queueId = null } = {}) {
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        active: true,
        ...(queueId ? { queueMemberships: { some: { queueId } } } : {}),
      },
      orderBy: { name: "asc" },
    });
    return users.filter(estaDisponivel).map((u) => this.formatar(u));
  }

  /** A equipe inteira com o estado de cada um, para o painel. */
  async equipe(tenantId) {
    const users = await prisma.user.findMany({
      where: { tenantId, active: true },
      orderBy: { name: "asc" },
    });
    return users.map((u) => this.formatar(u));
  }

  formatar(user) {
    const estado = estadoDe(user);
    return {
      id: user.id,
      name: user.name,
      estado,
      // O guardado difere do real quando a volta prometida já passou: mostrar
      // os dois evita o atendente achar que o botão não funcionou.
      estadoGuardado: user.disponibilidade || ESTADOS.ONLINE,
      disponivelAte: user.disponivelAte,
      recado: user.recadoDeAusencia || null,
      disponivel: estaDisponivel(user),
    };
  }
}

export default new AvailabilityService();
