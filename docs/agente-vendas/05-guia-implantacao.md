# Guia de implantação — agente que vende a própria plataforma

Ordem recomendada de configuração na **conta principal**. Tempo estimado: 30–40 minutos.

---

## Passo 1 — Meu Negócio
Preencha o perfil com os textos do arquivo `03-meu-negocio.md`: sobre, pagamento, informações extras, horários, equipe, serviços (demonstração/implantação), formas de pagamento e as 8 FAQs.

## Passo 2 — Catálogo
Cadastre os 3 planos como itens (arquivo `04-catalogo-planos.md`). Se possível, crie uma imagem de card por plano e anexe na mídia do item.

## Passo 3 — Funil (CRM → Etapas do pipeline)
Crie as etapas nesta ordem:
1. `Novo contato`
2. `Em qualificação`
3. `Demo agendada`
4. `Trial iniciado`
5. `Negociação`
6. `Cliente` 
7. `Futuro / sem momento`

> O prompt da Sofia manda mover para "Trial iniciado" quando envia o link de cadastro e marcar tag "quente"/"futuro" — as etapas e tags precisam existir com esses nomes.

## Passo 4 — Agente
Crie o agente **Sofia** com os campos do arquivo `01-configuracao-agente.md` (função Vendedor, skills, tom, delay, palavras de escalonamento e o prompt completo). Em seguida cole o texto do arquivo `02-base-de-conhecimento.md` no campo de treinamento.

**Antes de colar, troque em todos os textos:**
- `{SEU_DOMINIO}` → domínio real (ex.: `app.agentesvirtuais.com.br`)
- `{EMAIL_COMERCIAL}` → e-mail comercial real
- IDs dos planos no `?plan=` se diferirem do seed

## Passo 5 — Conexões
- Conecte o número de WhatsApp comercial da Agentes Virtuais (QR Code).
- Conecte o Instagram da marca, se houver.
- Gere o widget web e instale na landing page.

## Passo 6 — Chat da landing page
No painel **admin → Configurações → Landing page**, selecione a **Sofia** como "Agente do chat da landing". Assim o chat público do site usa a mesma persona e treinamento.

## Passo 7 — Agenda
Conecte o Google Calendar da conta principal para as demonstrações. Os horários oferecidos respeitarão o horário de atendimento do Passo 1.

## Passo 8 — Automações (recomendado)
- **Lembrete de demo:** confirmação automática 12h antes do horário agendado (já vem no padrão de pré-confirmação).
- **Follow-up de preço:** o campo "follow-up após preço" do agente (120 min) cobra resposta de quem recebeu os planos e sumiu.
- **Pós-demo:** mensagem 24h depois da demonstração perguntando se ficou alguma dúvida e reenviando o link de cadastro.

---

## Checklist de teste (antes de divulgar)

Converse com a Sofia de outro número e verifique:

- [ ] Ela se apresenta como consultora da Agentes Virtuais e pergunta sobre o negócio (não despeja os planos de cara)
- [ ] Pergunta uma coisa por vez (SPIN), sem parágrafos gigantes
- [ ] Ao pedir preço: apresenta os planos do catálogo com valores corretos (R$ 97 / 197 / 497 / 997)
- [ ] Ao dizer "quero testar": envia o link de cadastro correto na hora
- [ ] Ao pedir "quero falar com um humano": escala e para de responder
- [ ] Ao perguntar "você é um robô?": confirma com naturalidade e usa isso como prova do produto
- [ ] Ao pedir uma demonstração: oferece horários reais da agenda e confirma data/hora
- [ ] Lead aparece no funil na etapa certa e com as tags certas
- [ ] Objeção "tá caro": responde com a âncora do custo de atendente + teste grátis, sem inventar desconto
- [ ] Pergunta fora do escopo (ex.: "vocês fazem site?"): é honesta, não inventa funcionalidade

## Métricas para acompanhar (Relatórios)
- Conversas iniciadas → links de cadastro enviados (taxa de interesse)
- Cadastros com `?plan=` originados do agente
- Demos agendadas pela Sofia
- Conversas escaladas para humano (se muitas: reforçar a base de conhecimento com os temas que escalaram)
