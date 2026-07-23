# Meu Negócio — campos do perfil da conta principal

Conteúdo para a tela **Meu Negócio** da conta principal (a "empresa" aqui é a própria Ápice). O agente usa esses dados como contexto em toda conversa.

> Troque `{SEU_DOMINIO}`, `{EMAIL_COMERCIAL}` e endereço pelos dados reais.

---

## Perfil

**Tipo de negócio:** Serviços (ou "Outro")

**Sobre o negócio (businessAbout):**
```
A Ápice é uma plataforma brasileira de agentes de inteligência artificial para atendimento, vendas e agendamento. Nossos agentes respondem clientes pelo WhatsApp, Instagram e site em segundos, 24 horas por dia — treinados com as informações de cada negócio. A plataforma inclui CRM com funil visual, caixa de entrada unificada, agenda integrada ao Google Calendar, campanhas em massa, automações e relatórios. Atendemos clínicas, salões, academias, restaurantes, prestadores de serviço e e-commerces. Teste grátis de 7 dias, sem cartão de crédito.
```

**Endereço (businessAddress):**
```
Atendimento 100% online — {CIDADE/UF da empresa, se quiser divulgar}
```

**Formas de pagamento (businessPayment):**
```
Assinatura mensal ou anual no cartão de crédito (checkout seguro via Stripe). Plano anual equivale a 10 mensalidades (2 meses grátis). Sem fidelidade e sem multa de cancelamento.
```

**Informações extras (businessExtraInfo):**
```
Teste grátis de 7 dias sem cartão em {SEU_DOMINIO}/register. Configuração guiada em menos de 15 minutos, com modelos prontos por segmento. Suporte por e-mail em todos os planos, prioritário no Pro e gerente dedicado no Enterprise. Plataforma adequada à LGPD, com 2FA e exportação/exclusão de dados.
```

---

## Horário de atendimento (BusinessHours)

| Dia | Abertura | Fechamento |
|---|---|---|
| Segunda a sexta | 09:00 | 18:00 |
| Sábado | fechado | — |
| Domingo | fechado | — |

> O agente Sofia atende 24/7; esse horário é o do time humano (demonstrações e suporte). As demonstrações agendadas pela Sofia cairão dentro dessa janela.

---

## Equipe (TeamMember)

| Nome | Cargo | Bio |
|---|---|---|
| {Seu nome} | Fundador | Especialista em automação de atendimento; conduz as demonstrações do plano Enterprise. |
| Time Comercial | Consultores | Fazem a demonstração guiada de 30 minutos e ajudam na implantação. |
| Time de Suporte | Suporte técnico | Acompanham a configuração do agente, conexão de canais e treinamento. |

---

## Serviços (Service) — usados pela agenda de demonstração

| Nome | Duração | Preço | Observações (prep) |
|---|---|---|---|
| Demonstração da plataforma | 30 min | Grátis | Chamada de vídeo. Ter em mãos: como funciona o atendimento atual e volume aproximado de mensagens/dia. |
| Implantação assistida | 60 min | Grátis (assinantes) | Configuração do agente junto com o suporte: perfil, treinamento, canais e agenda. |
| Consultoria Enterprise | 45 min | Grátis | Para redes/franquias: mapeamento de operação, múltiplos números e integrações via API. |

---

## Formas de pagamento (PaymentMethod — cadastro por item)

| Nome | Observações |
|---|---|
| Cartão de crédito | Assinatura recorrente via Stripe. Todas as bandeiras principais. |
| Plano anual | 10x o valor mensal — 2 meses grátis. |

---

## FAQ (tela de FAQs — pergunta e resposta por item)

1. **Preciso de cartão para testar?** — Não. São 7 dias grátis sem cartão. Só cadastra cartão quem decide assinar.
2. **Funciona com meu número atual de WhatsApp?** — Sim, conecta via QR Code (como o WhatsApp Web) e o número segue funcionando no celular.
3. **Quanto tempo leva para configurar?** — Menos de 15 minutos com o passo a passo guiado e modelos por segmento.
4. **Posso assumir uma conversa no lugar do robô?** — Sim, a qualquer momento pela caixa de entrada; o bot pausa sozinho naquela conversa.
5. **O que acontece se meus tokens de IA acabarem?** — O agente pausa até o próximo ciclo mensal, ou você faz upgrade de plano na hora pelo painel.
6. **Posso cancelar quando quiser?** — Sim, direto no painel, sem multa. O acesso vale até o fim do período pago.
7. **Vocês atendem meu segmento?** — Se o seu negócio atende clientes por mensagem, sim. Temos modelos para clínicas, beleza, fitness, restaurantes, serviços e e-commerce.
8. **A plataforma é segura / LGPD?** — Sim: contas isoladas, senhas criptografadas, 2FA e ferramentas de exportação/exclusão de dados de clientes finais.
