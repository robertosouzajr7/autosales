# Catálogo — os 4 planos como itens (tela "Catálogo")

Cadastre os planos como itens do catálogo para que a Sofia possa apresentá-los com a skill "Enviar catálogo/mídia". Tipo: **SERVICE**, categoria: **Planos**.

> Dica: crie uma imagem simples por plano (card com nome, preço e 4 bullets) e suba no campo de mídia — a Sofia envia a imagem na conversa quando apresentar o plano. `buyUrl` leva ao cadastro com o plano pré-selecionado.

---

## Item 1 — Plano Essencial

- **Nome:** `Plano Essencial`
- **Tipo:** Serviço · **Categoria:** Planos · **Preço:** `97`
- **buyUrl:** `https://{SEU_DOMINIO}/register?plan=essencial-plan`
- **Descrição:**
```
Para o pequeno negócio começar a automatizar por cerca de R$ 3/dia. 1 agente de IA, 1 número de WhatsApp, CRM com até 300 contatos, 1.000 mensagens/mês e 50 mil tokens de IA (~25-30 conversas completas). Agenda com Google Calendar e lembretes automáticos já incluídos. 7 dias grátis, sem cartão. Anual: R$ 970 (2 meses grátis).
```

## Item 2 — Plano Starter

- **Nome:** `Plano Starter`
- **Tipo:** Serviço · **Categoria:** Planos · **Preço:** `197`
- **buyUrl:** `https://{SEU_DOMINIO}/register?plan=starter-plan`
- **Descrição:**
```
Para quem já tem movimento constante. 1 agente de IA, 1 número de WhatsApp, 2 usuários, CRM com até 1.000 contatos, 3.000 mensagens/mês e 150 mil tokens de IA (~75-90 conversas). Agenda e automações incluídas. 7 dias grátis, sem cartão. Anual: R$ 1.970 (2 meses grátis).
```

## Item 3 — Plano Pro (mais escolhido)

- **Nome:** `Plano Pro — mais escolhido`
- **Tipo:** Serviço · **Categoria:** Planos · **Preço:** `497`
- **buyUrl:** `https://{SEU_DOMINIO}/register?plan=pro-plan`
- **Descrição:**
```
Para negócios com alto volume ou mais de um canal. 3 agentes de IA (vendas, suporte e agendamento), 2 números de WhatsApp, 5 usuários, CRM com até 3.000 contatos, 10.000 mensagens/mês e 600 mil tokens de IA. Tudo do Starter + API e webhooks e suporte prioritário. 7 dias grátis, sem cartão. Anual: R$ 4.970 (2 meses grátis).
```

## Item 4 — Plano Escala

- **Nome:** `Plano Escala`
- **Tipo:** Serviço · **Categoria:** Planos · **Preço:** `997`
- **buyUrl:** `https://{SEU_DOMINIO}/register?plan=escala-plan`
- **Descrição:**
```
Para operações grandes com equipe. 10 agentes de IA, 5 números de WhatsApp, 15 usuários, CRM com até 10.000 contatos, 30.000 mensagens/mês e 2 milhões de tokens de IA. API e webhooks + implantação assistida (configuramos junto com você). 7 dias grátis, sem cartão. Anual: R$ 9.970 (2 meses grátis).
```

> **Enterprise (sob consulta)** não entra no catálogo self-service: quando o lead for rede/franquia ou pedir mais de 5 números, a Sofia agenda uma conversa com o time em vez de mandar link de plano.

> Os IDs dos planos (`essencial-plan`, `starter-plan`, `pro-plan`, `escala-plan`) são os do seed. Se os planos foram recriados no painel admin com outros IDs, ajuste o parâmetro `?plan=` do buyUrl (o ID aparece na tela de Planos do admin).
