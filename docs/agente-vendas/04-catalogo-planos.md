# Catálogo — os 3 planos como itens (tela "Catálogo")

Cadastre os planos como itens do catálogo para que a Sofia possa apresentá-los com a skill "Enviar catálogo/mídia". Tipo: **SERVICE**, categoria: **Planos**.

> Dica: crie uma imagem simples por plano (card com nome, preço e 4 bullets) e suba no campo de mídia — a Sofia envia a imagem na conversa quando apresentar o plano. `buyUrl` leva ao cadastro com o plano pré-selecionado.

---

## Item 1 — Plano Starter

- **Nome:** `Plano Starter`
- **Tipo:** Serviço · **Categoria:** Planos · **Preço:** `297`
- **buyUrl:** `https://{SEU_DOMINIO}/register?plan=starter-plan`
- **Descrição:**
```
Para começar a automatizar o atendimento. 1 agente de IA, 1 número de WhatsApp, 2 usuários, CRM com até 500 contatos, 2.000 mensagens/mês e 100 mil tokens de IA (~50 conversas completas). Inclui agenda com Google Calendar e automações de lembrete. Suporte por e-mail. 7 dias grátis, sem cartão. Anual: R$ 2.970 (2 meses grátis).
```

## Item 2 — Plano Pro (mais escolhido)

- **Nome:** `Plano Pro — mais escolhido`
- **Tipo:** Serviço · **Categoria:** Planos · **Preço:** `797`
- **buyUrl:** `https://{SEU_DOMINIO}/register?plan=pro-plan`
- **Descrição:**
```
Para negócios com alto volume de conversas. 3 agentes de IA (vendas, suporte e agendamento), 2 números de WhatsApp, 5 usuários, CRM com até 3.000 contatos, 10.000 mensagens/mês e 500 mil tokens de IA. Tudo do Starter + API e webhooks para integrações e suporte prioritário. 7 dias grátis, sem cartão. Anual: R$ 7.970 (2 meses grátis).
```

## Item 3 — Plano Enterprise

- **Nome:** `Plano Enterprise`
- **Tipo:** Serviço · **Categoria:** Planos · **Preço:** `1997`
- **buyUrl:** `https://{SEU_DOMINIO}/register?plan=enterprise-plan`
- **Descrição:**
```
Para operações grandes, redes e franquias. 10 agentes de IA, 10 números de WhatsApp, 20 usuários, CRM com até 20.000 contatos, 50.000 mensagens/mês e 2,5 milhões de tokens de IA. API e webhooks + gerente de conta dedicado que configura junto com você. 7 dias grátis, sem cartão. Anual: R$ 19.970 (2 meses grátis).
```

> Os IDs dos planos (`starter-plan`, `pro-plan`, `enterprise-plan`) são os do seed. Se os planos foram recriados no painel admin com outros IDs, ajuste o parâmetro `?plan=` do buyUrl (o ID aparece na tela de Planos do admin).
