repo: robertosouzajr7/autosales
branch: main
path: src

## Last sync

date: 2026-08-05T02:12:40Z

### Updated in this project

- Recriação fiel da landing page atual (tema escuro, mockups de chat e painel).
- Recriação fiel do dashboard atual (sidebar agrupada, KPIs, agenda, fila).
- Redesign da landing page com alternância claro/escuro, funil Kanban, planos lado a lado e FAQ accordion.
- Redesign do dashboard com sidebar em ícones expansível, hierarquia de KPIs, fila de atendimento e status de conexões.
- Redesign do módulo de Atendimento: Conversas (3 painéis), Funil Kanban, Clientes e Agendamentos.
- Redesign do módulo de Automação: Agente de IA com simulador, construtor de Fluxos e régua de Lembretes.
- Redesign de Conteúdo (Negócio, Catálogo, Templates, Disparos) e Configuração (Conexões, Equipe, Assinatura, Ajustes).
- Redesign das páginas públicas: Login, Cadastro, Onboarding com QR Code e 404.

## Screen map

| Tela do projeto | Arquivos do repositório |
| --- | --- |
| Landing Atual.dc.html | src/pages/LandingPage.tsx, src/components/landing/ChatMockup.tsx, src/components/landing/DashboardMockup.tsx, src/components/Logo.tsx, src/globals.css |
| Dashboard Atual.dc.html | src/pages/Dashboard.tsx, src/components/layout/DashboardLayout.tsx, src/components/shared/StatCard.tsx, src/components/shared/PageHeader.tsx, src/components/ui/button.tsx, src/globals.css |
| Landing Redesign.dc.html | src/pages/LandingPage.tsx, src/pages/Planos.tsx, src/components/Logo.tsx, src/globals.css |
| Dashboard Redesign.dc.html | src/pages/Dashboard.tsx, src/components/layout/DashboardLayout.tsx, src/components/shared/StatCard.tsx, src/globals.css |
| Painel Atendimento.dc.html | src/pages/Conversations.tsx, src/pages/CRM.tsx, src/pages/Contacts.tsx, src/pages/Appointments.tsx, src/components/layout/DashboardLayout.tsx |
| Painel Automacao.dc.html | src/pages/SdrManagement.tsx, src/pages/Automations.tsx, src/pages/AutomationConfig.tsx, src/components/layout/DashboardLayout.tsx |
| Painel Conteudo.dc.html | src/pages/BusinessProfile.tsx, src/pages/Catalog.tsx, src/pages/Templates.tsx, src/pages/Campaigns.tsx |
| Painel Configuracao.dc.html | src/pages/Connections.tsx, src/pages/Team.tsx, src/pages/Subscription.tsx, src/pages/Settings.tsx |
| Paginas Publicas.dc.html | src/pages/Login.tsx, src/pages/Register.tsx, src/pages/Onboarding.tsx, src/pages/NotFound.tsx |
