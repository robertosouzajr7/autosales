# Product Requirements Document (PRD) - AutoSales (SaaS)

## 📌 1. Visão Geral do Produto
O **AutoSales** é uma plataforma SaaS focada em automação de vendas e atendimento via WhatsApp utilizando Inteligência Artificial. O agente atua como um SDR, vendedor, agendador e suporte de altíssima performance.

## 🎯 2. Público-Alvo
- Empresas de serviços (clínicas, agências, consultorias).
- Profissionais liberais (advogados, médicos, corretores).
- Lojistas e pequenos negócios que dependem do WhatsApp para captação, relacionamento e venda.

## 🛠 3. Casos de Uso e Funcionalidades (Skills do Agente AI)
### 3.1. Habilidades de Vendas e Negociação (SDR)
- Qualificação de leads, apresentação de produtos e resposta a objeções.

### 3.2. Agendamento e Suporte
- Verificação de disponibilidade e agendamento (Google Calendar / Calendly).

### 3.3. Multimídia Avançada
- Reprodução e transcrição de áudio.
- Respostas em áudio gerado por IA com tom natural.
- Envio de vídeos, imagens e PDFs durante o fluxo da conversa.

## ⚙️ 4. Requisitos do Sistema
### 4.1. Onboarding e Painel de Gerenciamento (CRM)
- Cadastro self-service sem atritos.
- **Painel CRM:** Visualização de leads (Kanban), métricas de conversão e histórico de conversas.
- **Hand-off:** Intervenção humana no chat caso necessário.

### 4.2. Integração e Fluxos
- Integração simplificada de WhatsApp via QR Code (ex: Evolution API/Baileys) ou API Oficial.
- Configuração do tom de voz e base de conhecimento da IA do cliente.

## 🚀 5. Modelo de Negócios e Monetização
- Planos de Assinatura baseados em volume de mensagens e números de WhatsApp conectados.

## 🛠 6. Stack Tecnológica Sugerida (A Definir)
- **Frontend / Painel Web:** React + TailwindCSS (Vite).
- **Backend / API:** Node.js (NestJS ou Express) / Next.js.
- **Inteligência Artificial:** OpenAI GPT-4o, Whisper (transcrição), ElevenLabs (TTS).
- **Banco de Dados:** PostgreSQL (Prisma/Supabase).
- **WhatsApp:** Evolution API (boa para SaaS / QR code) ou API Oficial.

## 🛤 7. Próximos Passos
1. Definir o framework back-end e a API de WhatsApp principal.
2. Interface do Painel CRM (Frontend) - Visualizar Kanban e Conversas.
3. Arquitetura do banco de dados (Tenants, Usuários, Leads, Histórico de Chat).
4. Motor do Agente AI.
