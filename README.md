# AutoSales - Sistema de Gestão de Vendas

## Visão Geral do Projeto

O AutoSales é uma aplicação web completa para gestão de vendas, projetada para otimizar o processo de cobrança e gerenciamento de contatos. A plataforma permite o upload de planilhas de clientes, disparo de campanhas de comunicação e acompanhamento de métricas de performance através de um dashboard interativo.

## Funcionalidades Principais

- **Autenticação de Usuários:** Sistema de login e registro seguro.
- **Dashboard Interativo:** Visualização de estatísticas de vendas, atividades recentes e performance de campanhas.
- **Upload de Planilhas:** Importação de contatos a partir de arquivos de planilha (CSV/XLSX).
- **Gerenciamento de Contatos:** Armazenamento e organização de informações de clientes.
- **Gestão de Cobrança:** Módulo dedicado para o processo de cobrança.
- **Envio de Campanhas:** Funcionalidade para disparar campanhas de comunicação para a base de contatos.

## Tecnologias Utilizadas (Tech Stack)

- **Frontend:**
  - [Next.js](https://nextjs.org/) (React Framework)
  - [React](https://react.dev/)
  - [Tailwind CSS](https://tailwindcss.com/)
  - [TypeScript](https://www.typescriptlang.org/)
- **Backend:**
  - [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
  - [NextAuth.js](https://next-auth.js.org/) (Autenticação)
- **Banco de Dados:**
  - [Prisma](https://www.prisma.io/) (ORM)
  - PostgreSQL (ou outro banco suportado pelo Prisma)
- **Utilitários:**
  - `papaparse`: Para processar arquivos CSV.
  - `xlsx`: Para processar arquivos XLSX.
  - `axios`: Para requisições HTTP.
  - `bcryptjs`: Para hashing de senhas.
  - `lucide-react`: Para ícones.

## Como Começar (Getting Started)

Siga as instruções abaixo para configurar e rodar o projeto em seu ambiente de desenvolvimento.

### Pré-requisitos

- [Node.js](https://nodejs.org/en/) (versão 20 ou superior)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
- Uma instância de banco de dados (ex: PostgreSQL) rodando.

### Instalação

1.  **Clone o repositório:**

    ```bash
    git clone <URL_DO_REPOSITORIO>
    cd autosales
    ```

2.  **Instale as dependências:**

    ```bash
    npm install
    ```

3.  **Configure as variáveis de ambiente:**
    Crie um arquivo `.env.local` na raiz do projeto, copiando o exemplo de `.env.example` (se existir). Preencha com as informações do seu banco de dados e outras chaves necessárias.

    ```
    DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
    NEXTAUTH_SECRET="SUA_CHAVE_SECRETA"
    NEXTAUTH_URL="http://localhost:3000"
    ```

4.  **Execute as migrações do banco de dados:**

    ```bash
    npx prisma migrate dev
    ```

5.  **Rode o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador para ver a aplicação.

## Estrutura do Projeto

Uma visão geral da organização das pastas e arquivos mais importantes:

```
/
├── prisma/
│   └── schema.prisma       # Schema do banco de dados Prisma
├── public/                 # Arquivos estáticos (imagens, fontes)
└── src/
    ├── app/
    │   ├── (dashboard)/      # Rotas e layouts do dashboard principal
    │   ├── api/              # Endpoints da API (backend)
    │   ├── auth/             # Rotas e layouts de autenticação
    │   └── page.tsx          # Página inicial (landing page)
    ├── components/
    │   ├── ui/               # Componentes de UI genéricos (Botão, Card, etc.)
    │   └── ...               # Componentes específicos de funcionalidades
    ├── lib/                  # Funções e utilitários (ex: config do Prisma)
    ├── hooks/                # Hooks customizados do React
    ├── types/                # Definições de tipos TypeScript
    └── ...
```

## Endpoints da API

As rotas da API estão localizadas em `src/app/api`. Aqui estão os principais endpoints:

- `POST /api/auth/register`: Registro de um novo usuário.
- `POST /api/auth/[...nextauth]`: Rotas de autenticação do NextAuth (login, logout, session).
- `POST /api/contacts/import`: Importação de contatos via planilha.
- `DELETE /api/contacts/bulk-delete`: Deleção de contatos em massa.
- `POST /api/campaigns/send`: Envio de campanhas.
- `GET, POST /api/templates`: Gerenciamento de templates.
