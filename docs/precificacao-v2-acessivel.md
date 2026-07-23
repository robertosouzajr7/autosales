# Precificação v2 — grade acessível para pequenos negócios

Complemento do `precificacao.md`. Objetivo: entrada acessível para pequenos negócios, mantendo margem de mercado e caminho claro de upgrade.

---

## 1. O que o mercado brasileiro cobra hoje (julho/2026)

| Concorrente | Preço de entrada | Observação |
|---|---|---|
| Zappy | **R$ 149/mês** (Starter, por usuário) | chatbot + IA |
| Clint | **R$ 299/mês** | 1 agente incluído; +R$ 99/agente extra |
| WiiChat | a partir de **R$ 379/mês** | agente de IA WhatsApp |
| SleekFlow | a partir de **R$ 459–589/mês** | "IA ilimitada", foco em operação maior |
| Zaia | add-ons: R$ 49/membro extra, whitelabel R$ 997 | base historicamente na faixa R$ 100–500 |
| Custo típico total p/ PME (estudo SocialHub) | **R$ 99 a R$ 1.200/mês** | plataforma + Meta + IA |

**Leitura do mercado:** a faixa de entrada real está entre **R$ 99 e R$ 299**. Nosso Starter atual (R$ 297) está no teto da entrada — não é "acessível", é médio. Há um degrau vazio abaixo de R$ 150 onde só a Zappy compete de verdade. E acima de R$ 500 a concorrência fica cara rápido (SleekFlow 589+), o que deixa espaço para um Pro em ~R$ 497 parecer barato em comparação.

---

## 2. Grade proposta (4 planos públicos)

Degraus de ~2x — o cliente sempre enxerga o próximo passo como "só mais um pouco":

| | **Essencial** | **Starter** | **Pro** ⭐ | **Escala** |
|---|---|---|---|---|
| **Preço/mês** | **R$ 97** | **R$ 197** | **R$ 497** | **R$ 997** |
| Anual (2 meses grátis) | R$ 970 | R$ 1.970 | R$ 4.970 | R$ 9.970 |
| Agentes de IA | 1 | 1 | 3 | 10 |
| Números WhatsApp | 1 | 1 | 2 | 5 |
| Usuários no painel | 1 | 2 | 5 | 15 |
| Leads no CRM | 300 | 1.000 | 3.000 | 10.000 |
| Mensagens/mês | 1.000 | 3.000 | 10.000 | 30.000 |
| Tokens de IA/mês | 50 mil | 150 mil | 600 mil | 2 milhões |
| Base de conhecimento | 20 mil chars | 50 mil | 150 mil | 500 mil |
| Agenda (Google Calendar) | ✅ | ✅ | ✅ | ✅ |
| Automações (lembretes) | ✅ | ✅ | ✅ | ✅ |
| API e webhooks | — | — | ✅ | ✅ |
| Suporte | E-mail | E-mail | Prioritário | Implantação assistida |

- **Enterprise (R$ 1.997) sai da vitrine e vira "sob consulta"** — para redes/franquias, vendido pela Sofia com demonstração. Quem precisa de 10 números não decide por preço de tabela.
- Agenda e automações **em todos os planos de propósito**: é o recurso que faz o pequeno negócio *sentir* o valor na primeira semana. O que segmenta os planos é volume (tokens/mensagens/leads) e recursos de operação (API, múltiplos agentes).
- O **Essencial é apertado de propósito** (50 mil tokens ≈ 25–30 conversas completas de IA): serve o negócio que recebe 1–3 contatos por dia. Cresceu, o próprio painel avisa que o limite chegou — o upgrade para Starter é natural e barato (R$ 100 de diferença).

## 3. Margens da nova grade (Gemini Flash padrão, uso 100% da franquia)

| Plano | Receita | IA (teto) | Stripe | Contribuição | Margem bruta |
|---|---|---|---|---|---|
| Essencial | R$ 97 | R$ 0,18 | R$ 4,26 | R$ 92,56 | **95,4%** |
| Starter | R$ 197 | R$ 0,53 | R$ 8,25 | R$ 188,22 | **95,5%** |
| Pro | R$ 497 | R$ 2,10 | R$ 20,22 | R$ 474,68 | **95,5%** |
| Escala | R$ 997 | R$ 7,00 | R$ 40,17 | R$ 949,83 | **95,3%** |

Mesmo com IA premium (Claude Sonnet) as margens ficam acima de 90% em todos os planos. A grade acessível **não** sacrifica margem — sacrifica receita por cliente, o que muda outras duas contas:

**Ponto de equilíbrio (fixos ≈ R$ 785/mês):** 9 clientes Essencial, ou 4 Starter, ou 2 Pro. Mix realista de primeiros 10 clientes (5 Essencial + 4 Starter + 1 Pro = R$ 1.748/mês) → lucro de ~R$ 880/mês já no décimo cliente.

**Teto do MEI (R$ 6.750/mês):** com tíquete médio menor, você precisa de **mais clientes** para chegar ao teto (~35–45 clientes no mix acessível vs. ~10 na grade antiga). Isso significa mais gente para dar suporte sozinho. As defesas: trial self-service, a Sofia fazendo o onboarding, os docs/FAQ, e o Essencial/Starter sem canal de suporte além do e-mail.

## 4. Comparação direta com o mercado (argumento de venda da Sofia)

| Faixa | Concorrência | Nós |
|---|---|---|
| Entrada | Zappy R$ 149, Clint R$ 299 | **Essencial R$ 97** — mais barato que todos, com agenda inclusa |
| Intermediário | WiiChat R$ 379, SleekFlow R$ 459+ | **Pro R$ 497 com 3 agentes** (Clint cobraria R$ 299 + 2×R$ 99 = R$ 497 por 3 agentes, sem CRM completo) |
| Avançado | SleekFlow R$ 589+, whitelabel Zaia R$ 997 | **Escala R$ 997 com 10 agentes e 5 números** |

## 5. O que muda se aprovar esta grade

1. `seed_plans.js` — nova grade (4 planos + Enterprise inativo/sob consulta)
2. Painel admin → Planos — atualizar os existentes (quem já assinou mantém o preço antigo: *grandfathering*; a mudança vale para novos)
3. Material da Sofia — `02-base-de-conhecimento.md` e `04-catalogo-planos.md` com os novos valores
4. Landing page — seção de preços mostra os 4 planos + "Enterprise: fale com a gente"

Fontes: [Clint — custo de agentes de IA 2026](https://www.clint.digital/blog/custo-agente-ia-whatsapp-2026/) · [Zappy — planos](https://www.zappy.chat/planos-e-precos/) · [WiiChat — preços](https://wiichat.com.br/precos) · [SleekFlow — quanto custa um agente de IA](https://sleekflow.io/pt-br/blog/quanto-custa-agente-IA) · [SocialHub — quanto custa chatbot WhatsApp 2026](https://www.socialhub.pro/blog/quanto-custa-chatbot-whatsapp-2026/) · [Zaia — whitelabel](https://zaia.so/whitelabel)
