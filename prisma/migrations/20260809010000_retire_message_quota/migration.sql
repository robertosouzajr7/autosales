-- A franquia de mensagens era um teto sem custo por trás: mensagem de
-- resposta é gratuita na API oficial (dentro da janela de 24h) e sempre
-- gratuita no QR Code. Pior, ela media na unidade errada — duas contas com
-- o mesmo volume de clientes batiam no teto em momentos diferentes só porque
-- uma conversa mais — e falhava do jeito mais caro: o agente emudecia no meio
-- do atendimento de um cliente que tinha pago.
--
-- Quem faz esse papel agora é maxConversations, que é a unidade que a Meta
-- cobra e que o cliente entende, e que ao esgotar passa o contato para a fila
-- humana em vez de silenciar.
--
-- enableMessages some junto: atender por WhatsApp não é um módulo opcional,
-- é o produto.
ALTER TABLE "Plan" DROP COLUMN IF EXISTS "maxMessages";
ALTER TABLE "Plan" DROP COLUMN IF EXISTS "enableMessages";
