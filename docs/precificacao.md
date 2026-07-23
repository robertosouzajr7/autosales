# Estudo de precificação — planos vs. custos reais

Data-base: julho/2026 · Câmbio usado: **US$ 1 = R$ 5,50** (ajuste a coluna se o dólar mudar).

---

## 1. Custo de IA por token (o custo variável que importa)

Preço dos provedores (por 1 milhão de tokens, API):

| Modelo | Input | Output | Custo misto* | Em R$/1M |
|---|---|---|---|---|
| GPT-4o-mini | $0,15 | $0,60 | $0,22 | **R$ 1,20** |
| Gemini 2.5 Flash | $0,30 | $2,50 | $0,63 | **R$ 3,50** |
| Claude Haiku 4.5 | $1,00 | $5,00 | $1,60 | **R$ 8,80** |
| Claude Sonnet 5 | $3,00 | $15,00 | $4,80 | **R$ 26,40** |
| Claude Opus 4.8 | $5,00 | $25,00 | $8,00 | **R$ 44,00** |

\* Misto = 85% input / 15% output. Nossas conversas são "pesadas em input": a cada mensagem o sistema reenvia guardrails + perfil do negócio + base de conhecimento + histórico, e a resposta é curta. Por isso o custo real fica muito mais perto do preço de input.

### Custo máximo de IA por cliente (se ele consumir 100% da franquia do plano)

| Plano | Franquia | GPT-4o-mini | Gemini Flash | Haiku | Sonnet | Opus |
|---|---|---|---|---|---|---|
| Starter | 100 mil tokens | R$ 0,12 | R$ 0,35 | R$ 0,88 | R$ 2,64 | R$ 4,40 |
| Pro | 500 mil | R$ 0,60 | R$ 1,75 | R$ 4,40 | R$ 13,20 | R$ 22,00 |
| Enterprise | 2,5 milhões | R$ 3,00 | R$ 8,75 | R$ 22,00 | R$ 66,00 | R$ 110,00 |

**Conclusão 1: o token NÃO é o seu problema.** Mesmo no pior caso absoluto (Enterprise usando 100% da franquia com o modelo mais caro do mercado), o custo de IA é R$ 110 num plano de R$ 1.997 — 5,5% da receita. Com Gemini Flash (padrão recomendado), é 0,1–0,4% da receita. E a franquia de tokens do plano funciona como teto de gasto: o cliente nunca custa mais do que a tabela acima.

> WhatsApp via QR Code (Baileys) não tem custo por mensagem. Se um dia migrar clientes para a API oficial da Meta, aí sim existe custo por conversa — tratar como repasse no Enterprise.

---

## 2. Custo por venda (Stripe)

Taxa típica de assinatura no cartão no Brasil (~3,99% + R$ 0,39 — confirme na sua tabela Stripe):

| Plano | Taxa Stripe/mês |
|---|---|
| Starter (R$ 297) | R$ 12,24 |
| Pro (R$ 797) | R$ 32,19 |
| Enterprise (R$ 1.997) | R$ 80,07 |

---

## 3. Custos fixos mensais (sua estrutura hoje)

| Item | Valor | Observação |
|---|---|---|
| VPS (Hostinger) | R$ 120 | aguenta dezenas de tenants; prever +R$ 120 a cada ~50–100 clientes ativos |
| Assinatura Claude | **R$ 550** | assumi plano Max US$ 100/mês — **troque pelo seu valor real** (Pro US$ 20 ≈ R$ 110) |
| DAS do MEI | R$ 85 | ~5% do salário mínimo + ISS (valor 2026 aproximado) |
| Domínio + e-mail + misc. | R$ 30 | estimativa |
| **Total** | **≈ R$ 785/mês** | com Claude Pro seria ≈ R$ 345/mês |

Seu maior custo fixo é a assinatura do Claude — e ela é custo de desenvolvimento, não cresce com o número de clientes.

---

## 4. Margem por plano (cenário: modelo padrão Gemini Flash, cliente usando 100% da franquia)

| Plano | Receita | IA | Stripe | Contribuição | **Margem bruta** |
|---|---|---|---|---|---|
| Starter | R$ 297 | R$ 0,35 | R$ 12,24 | R$ 284 | **95,8%** |
| Pro | R$ 797 | R$ 1,75 | R$ 32,19 | R$ 763 | **95,7%** |
| Enterprise | R$ 1.997 | R$ 8,75 | R$ 80,07 | R$ 1.908 | **95,6%** |

No pior cenário (Claude Opus para todos): Starter 94,4% · Pro 93,2% · Enterprise 90,5%.

**Benchmark de mercado:** SaaS saudável opera com margem bruta de 70–85%; SaaS de IA, 60–80% (o custo de inferência costuma comer margem). **Seus planos estão ACIMA do benchmark em qualquer cenário de modelo** — ou seja, os preços atuais não estão baratos demais pelo custo; estão corretos ou até com folga.

---

## 5. Ponto de equilíbrio e cenários de lucro (mix com Gemini Flash)

| Cenário | Receita/mês | Lucro líquido/mês* |
|---|---|---|
| **3 clientes Starter** | R$ 891 | ≈ R$ 70 → **ponto de equilíbrio** |
| 5 clientes (3 Starter + 2 Pro) | R$ 2.485 | ≈ R$ 1.590 |
| 10 clientes (6 Starter + 3 Pro + 1 Ent) | R$ 6.170 | ≈ R$ 5.120 |
| Teto do MEI (~R$ 6.750/mês) | R$ 6.750 | ≈ R$ 5.600 |

\* Antes do seu pró-labore; DAS já incluído nos fixos.

---

## 6. ⚠️ O teto do MEI é o seu limite real (não o custo)

- Limite MEI: **R$ 81.000/ano ≈ R$ 6.750/mês**. Você chega nele com apenas **~8 clientes Pro** ou **6 Starter + 3 Pro + 1 Enterprise**.
- Estourou até 20% (R$ 97,2 mil): paga a diferença e vira ME no ano seguinte. Estourou mais de 20%: desenquadramento **retroativo** a janeiro (imposto sobre tudo).
- Um único **Enterprise anual (R$ 19.970)** consome 25% do teto do ano num pagamento só — cuidado ao vender anual perto do limite.
- Como ME no Simples Nacional, planeje alíquota efetiva de **~6% a 15,5%** conforme anexo/Fator R. Suas margens de 90%+ absorvem isso sem precisar reajustar preço — mas fale com um contador **antes** de chegar a ~R$ 5.500/mês de receita recorrente, e confirme desde já se o seu CNAE de MEI comporta receita de licenciamento de software (muitos devs MEI operam com CNAE de suporte técnico; contador resolve).

---

## 7. Recomendações finais

1. **Mantenha os preços** R$ 297 / 797 / 1.997 — estão na faixa praticada no Brasil para agentes de IA no WhatsApp (concorrentes cobram de ~R$ 150 a R$ 1.000+/mês) e com margem acima do padrão do setor. Seu gargalo é tempo e teto do MEI, não margem.
2. **Modelo padrão da plataforma: Gemini 2.5 Flash** (ou GPT-4o-mini, mais barato ainda). Posicione os modelos Claude/GPT premium como diferencial dos planos Pro/Enterprise ("IA premium") — o custo cabe, e vira argumento de venda.
3. **Anual = 10x o mensal** (2 meses grátis ≈ 17% de desconto) está dentro do padrão de mercado (10–20%). Mantenha.
4. **Corrija os custos unitários no admin** para a margem exibida ser real: `tokenUnitCost` está em R$ 0,08/1k tokens (= R$ 80/1M — 20x acima do real). Valores corretos: ~R$ 0,0035/1k (Gemini Flash) ou R$ 0,044/1k (Opus); `messageUnitCost` = R$ 0 via Baileys.
5. **Não crie plano mais barato que o Starter.** Você trabalha sozinho: cada cliente consome seu tempo de onboarding/suporte, e cliente de R$ 97 dá o mesmo trabalho do de R$ 297. O trial de 7 dias já cumpre o papel de porta de entrada.
6. Quando a receita recorrente passar de ~R$ 5.500/mês: contador + migração planejada para ME. É um "problema bom" — significa ~R$ 5 mil/mês de lucro.

Fontes de preço de API: [Gemini](https://aicostcheck.com/blog/google-gemini-pricing-guide-2026) ($0,30/$2,50), [GPT-4o-mini](https://pricepertoken.com/pricing-page/model/openai-gpt-4o-mini) ($0,15/$0,60); Claude conforme tabela oficial Anthropic (Haiku $1/$5, Sonnet $3/$15, Opus $5/$25).
