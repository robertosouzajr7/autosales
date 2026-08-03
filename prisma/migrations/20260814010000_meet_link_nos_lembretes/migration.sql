-- Link da reunião nos lembretes de confirmação e de atraso.
--
-- Os textos padrão destes dois moram no DEFAULT da coluna, então mudar só o
-- código não alcança quem já tem AutomationConfig salvo — que é todo mundo.
--
-- O UPDATE toca APENAS nas linhas que ainda guardam o texto padrão antigo,
-- palavra por palavra. Quem reescreveu a mensagem no painel fica intocado:
-- sobrescrever texto que o dono do negócio escreveu é pior do que não ter o
-- link, e ele pode adicionar {link_block} quando quiser.

ALTER TABLE "AutomationConfig"
  ALTER COLUMN "confirmMsgTemplate"
  SET DEFAULT 'Olá {name}! 👋 Passando para confirmar seu atendimento de amanhã às {time}. Podemos confirmar? ✅{link_block}';

ALTER TABLE "AutomationConfig"
  ALTER COLUMN "lateMsgTemplate"
  SET DEFAULT 'Oi {name}! 😊 Notamos que você ainda não chegou para o seu horário das {time}. Está tudo bem?{link_block}';

UPDATE "AutomationConfig"
   SET "confirmMsgTemplate" = 'Olá {name}! 👋 Passando para confirmar seu atendimento de amanhã às {time}. Podemos confirmar? ✅{link_block}'
 WHERE "confirmMsgTemplate" = 'Olá {name}! 👋 Passando para confirmar seu atendimento de amanhã às {time}. Podemos confirmar? ✅';

UPDATE "AutomationConfig"
   SET "lateMsgTemplate" = 'Oi {name}! 😊 Notamos que você ainda não chegou para o seu horário das {time}. Está tudo bem?{link_block}'
 WHERE "lateMsgTemplate" = 'Oi {name}! 😊 Notamos que você ainda não chegou para o seu horário das {time}. Está tudo bem?';
