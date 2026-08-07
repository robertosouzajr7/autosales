import prisma from "../config/prisma.js";

/** Janela de atendimento da Meta: fora dela só se inicia conversa por template. */
export const SERVICE_WINDOW_HOURS = 24;

/**
 * Atualiza os contadores da conversa a partir de uma mensagem recém-criada:
 * ordenação do inbox, prévia, não-lidas e a janela de 24h.
 *
 * Fica separado do `message.create` de propósito — os contadores não podem
 * fazer o envio falhar, então erros aqui são engolidos.
 */
export async function touchConversation(message) {
  if (!message?.conversationId) return;
  const isInbound = message.role === "USER";
  try {
    // Estado ANTES da atualização: é ele que diz se esta mensagem abriu uma
    // janela nova (= conversa nova para o plano) ou continuou uma em curso.
    const antes = await prisma.conversation.findUnique({
      where: { id: message.conversationId },
      select: { lastInboundAt: true, tenantId: true, leadId: true },
    });

    await prisma.conversation.update({
      where: { id: message.conversationId },
      data: {
        lastMessageAt: message.createdAt || new Date(),
        lastMessagePreview: previewOf(message),
        // Só mensagem do cliente conta como não lida; e só ela reabre a
        // janela de 24h da Meta.
        ...(isInbound
          ? { unreadCount: { increment: 1 }, lastInboundAt: message.createdAt || new Date() }
          : {}),
      },
    });

    if (isInbound && antes?.tenantId) {
      const { registrarConversa } = await import("./UsageService.js");
      await registrarConversa(antes.tenantId, {
        leadId: antes.leadId,
        conversationId: message.conversationId,
        janelaEstavaAberta: isWindowOpen(antes.lastInboundAt),
      });
    } else if (!isInbound && antes?.tenantId && isWindowOpen(antes.lastInboundAt)) {
      // Resposta dentro da janela é mensagem de serviço — hoje grátis na
      // Meta, cobrada a partir de outubro/2026.
      const { registrarMensagemServico } = await import("./UsageService.js");
      await registrarMensagemServico(antes.tenantId, 1, {
        leadId: antes.leadId,
        conversationId: message.conversationId,
      });
    }
  } catch (e) {
    console.warn("[Conversation] Não foi possível atualizar contadores:", e.message);
  }
}

/** Zera as não-lidas — usado quando o atendente abre a conversa. */
export async function markConversationRead(conversationId) {
  try {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  } catch (e) {
    console.warn("[Conversation] Não foi possível marcar como lida:", e.message);
  }
}

/**
 * A janela de 24h está aberta? Fora dela o WhatsApp só aceita template
 * aprovado, então a UI precisa saber disso antes de deixar digitar.
 */
export function isWindowOpen(lastInboundAt) {
  if (!lastInboundAt) return false;
  const ms = Date.now() - new Date(lastInboundAt).getTime();
  return ms < SERVICE_WINDOW_HOURS * 60 * 60 * 1000;
}

/** Quanto falta para a janela fechar, em minutos (0 se já fechou). */
export function windowMinutesLeft(lastInboundAt) {
  if (!lastInboundAt) return 0;
  const ms = SERVICE_WINDOW_HOURS * 60 * 60 * 1000 - (Date.now() - new Date(lastInboundAt).getTime());
  return ms > 0 ? Math.floor(ms / 60000) : 0;
}

// Mídia não tem texto útil para a lista; mostra o tipo.
/**
 * A linha que aparece na lista de conversas.
 *
 * Mídia com legenda mostra a legenda junto do ícone, como o próprio WhatsApp
 * faz: "🖼️ Imagem" não diz nada quando o que foi enviado é um item do
 * catálogo com nome e preço. Sem legenda, ou quando o conteúdo é só o
 * endereço do arquivo, fica só o ícone — um link truncado é pior que o
 * rótulo genérico.
 */
function previewOf(message) {
  const t = message.messageType;
  const icone = t === "AUDIO" ? "🎙️" : t === "IMAGE" ? "🖼️" : t === "VIDEO" ? "🎬" : t === "DOCUMENT" ? "📄" : null;
  if (!icone) return (message.content || "").slice(0, 120);

  const legenda = String(message.content || "").trim();
  const ehEndereco = !legenda || /^(https?:\/\/|\/|data:)/i.test(legenda);
  const rotulo = { AUDIO: "Áudio", IMAGE: "Imagem", VIDEO: "Vídeo", DOCUMENT: "Documento" }[t];
  return ehEndereco ? `${icone} ${rotulo}` : `${icone} ${legenda.replace(/\*/g, "").slice(0, 110)}`;
}

export default { touchConversation, markConversationRead, isWindowOpen, windowMinutesLeft, SERVICE_WINDOW_HOURS };
