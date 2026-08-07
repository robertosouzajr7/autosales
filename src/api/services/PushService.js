import prisma from "../config/prisma.js";

/**
 * Notificação no celular do atendente.
 *
 * É o que justifica o app existir. Sem push, quem instalou ainda precisa
 * abrir o aplicativo para descobrir que tem gente esperando — e o cliente
 * fica no vácuo exatamente pelo tempo que ninguém abriu.
 *
 * O envio é pelo Firebase Cloud Messaging (HTTP v1), que entrega para Android
 * direto e para iOS via APNs. A credencial é da PLATAFORMA, não da conta: o
 * app na loja é um só, e o projeto Firebase que o assina também.
 *
 * Nada aqui pode derrubar o que chamou. Push é aviso: se falhar, a conversa
 * continua na fila e aparece quando o atendente abrir o app.
 */

const FCM = "https://fcm.googleapis.com/v1/projects";
const ESCOPO = "https://www.googleapis.com/auth/firebase.messaging";

/** Os avisos que existem, com o padrão de quem acabou de instalar. */
export const AVISOS = {
  FILA: { chave: "fila", rotulo: "Cliente pedindo uma pessoa", padrao: true },
  MENSAGEM: { chave: "mensagem", rotulo: "Nova mensagem em conversa minha", padrao: true },
  TRANSFERIDA: { chave: "transferida", rotulo: "Conversa transferida para mim", padrao: true },
};

function querReceber(user, aviso) {
  const modelo = AVISOS[aviso];
  if (!modelo) return false;
  if (!user?.preferenciasDePush) return modelo.padrao;
  try {
    const prefs = JSON.parse(user.preferenciasDePush);
    return prefs[modelo.chave] !== false;
  } catch {
    return modelo.padrao;
  }
}

class PushService {
  /**
   * Guarda o token do aparelho.
   *
   * Chave é o token, não o usuário: o mesmo celular pode trocar de dono, e aí
   * o token passa a pertencer a quem entrou — senão o aviso do novo atendente
   * chegaria no aparelho antigo do anterior.
   */
  async registrarAparelho(userId, tenantId, token, platform = "android") {
    if (!token) throw new Error("Token do aparelho ausente.");
    return prisma.deviceToken.upsert({
      where: { token },
      update: { userId, tenantId, platform, ultimoUso: new Date() },
      create: { token, userId, tenantId, platform },
    });
  }

  /** Sair da conta: o aparelho não deve mais receber o que era daquela pessoa. */
  async esquecerAparelho(token) {
    if (!token) return;
    await prisma.deviceToken.deleteMany({ where: { token } });
  }

  async preferencias(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return Object.fromEntries(
      Object.entries(AVISOS).map(([id, a]) => [a.chave, querReceber(user, id)])
    );
  }

  async definirPreferencias(userId, prefs = {}) {
    const validas = {};
    for (const a of Object.values(AVISOS)) {
      if (prefs[a.chave] !== undefined) validas[a.chave] = !!prefs[a.chave];
    }
    await prisma.user.update({
      where: { id: userId },
      data: { preferenciasDePush: JSON.stringify(validas) },
    });
    return this.preferencias(userId);
  }

  /**
   * Envia para todos os aparelhos de um atendente.
   *
   * Devolve o que aconteceu em vez de lançar: quem chamou está no meio de
   * entregar uma mensagem ao cliente, e um push que falhou não pode
   * interromper isso.
   */
  async avisar(userId, aviso, { titulo, corpo, dados = {} } = {}) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { dispositivos: true },
      });
      if (!user || user.active === false) return { enviados: 0, motivo: "Atendente inativo." };
      if (!querReceber(user, aviso)) return { enviados: 0, motivo: "O atendente desligou este aviso." };
      if (!user.dispositivos.length) return { enviados: 0, motivo: "Nenhum aparelho registrado." };

      const credencial = await this.credencial();
      if (!credencial) return { enviados: 0, motivo: "Push não configurado na plataforma." };

      let enviados = 0;
      const mortos = [];
      for (const d of user.dispositivos) {
        const r = await this.enviarParaToken(credencial, d.token, { titulo, corpo, dados });
        if (r.ok) enviados++;
        else if (r.tokenMorto) mortos.push(d.token);
      }

      // Token que o Firebase recusou não volta a funcionar: apagar na hora é
      // o que impede a fila de push ficar lenta com o tempo.
      if (mortos.length) {
        await prisma.deviceToken.deleteMany({ where: { token: { in: mortos } } }).catch(() => {});
      }
      return { enviados, removidos: mortos.length };
    } catch (e) {
      console.error("[Push] Falha ao avisar:", e.message);
      return { enviados: 0, motivo: e.message };
    }
  }

  /** Avisa vários de uma vez (a fila avisa todo mundo que pode atender). */
  async avisarVarios(userIds, aviso, conteudo) {
    let total = 0;
    for (const id of [...new Set(userIds)]) {
      const r = await this.avisar(id, aviso, conteudo);
      total += r.enviados || 0;
    }
    return { enviados: total };
  }

  /** Credencial da conta de serviço do Firebase, guardada pelo admin. */
  async credencial() {
    const s = await prisma.platformSettings.findFirst().catch(() => null);
    if (!s?.fcmServiceAccount || !s?.fcmProjectId) return null;
    try {
      return { projectId: s.fcmProjectId, conta: JSON.parse(s.fcmServiceAccount) };
    } catch {
      console.error("[Push] A conta de serviço do Firebase não é um JSON válido.");
      return null;
    }
  }

  /**
   * Uma mensagem, um aparelho.
   *
   * `notification` faz o sistema mostrar o aviso mesmo com o app fechado;
   * `data` é o que o app lê ao ser tocado para abrir a conversa certa. Os
   * dois juntos porque, só com `data`, o aviso não aparece com o app fechado
   * no iOS — e é justamente aí que ele importa.
   */
  async enviarParaToken(credencial, token, { titulo, corpo, dados = {} }) {
    try {
      const acesso = await this.tokenDeAcesso(credencial.conta);
      if (!acesso) return { ok: false };

      const res = await fetch(`${FCM}/${credencial.projectId}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${acesso}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: titulo, body: corpo },
            // Tudo string: o FCM recusa o envio inteiro se um valor de `data`
            // não for texto, e o erro que devolve não diz qual campo era.
            data: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, String(v)])),
            android: { priority: "high", notification: { sound: "default" } },
            apns: { payload: { aps: { sound: "default", badge: 1 } } },
          },
        }),
      });

      if (res.ok) return { ok: true };
      const erro = await res.json().catch(() => ({}));
      const codigo = erro?.error?.details?.[0]?.errorCode || erro?.error?.status;
      const tokenMorto = res.status === 404 || codigo === "UNREGISTERED" || codigo === "INVALID_ARGUMENT";
      if (!tokenMorto) console.error("[Push] FCM recusou:", res.status, erro?.error?.message);
      return { ok: false, tokenMorto };
    } catch (e) {
      console.error("[Push] Falha na chamada ao FCM:", e.message);
      return { ok: false };
    }
  }

  /**
   * Token OAuth da conta de serviço, com cache.
   *
   * O token vale uma hora; pedir um novo a cada push seria uma chamada extra
   * por notificação, e o Google limita isso.
   */
  async tokenDeAcesso(conta) {
    const agora = Date.now();
    if (this._acesso && this._acessoAte > agora + 60000) return this._acesso;

    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({ credentials: conta, scopes: [ESCOPO] });
    const cliente = await auth.getClient();
    const { token } = await cliente.getAccessToken();
    this._acesso = token;
    this._acessoAte = agora + 55 * 60 * 1000;
    return token;
  }
}

export default new PushService();
