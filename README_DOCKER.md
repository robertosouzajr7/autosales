# Docker em AutoSales / VendAi

Esta configuração Docker permite rodar todo o ecossistema da aplicação de forma isolada e consistente.

## Serviços incluídos

1.  **venda-frontend**: O frontend em React (Vite) na porta `5173`.
2.  **venda-api-express**: O backend original (`server.js`) na porta `3000`.
3.  **venda-api-nest**: O novo backend em NestJS na porta `3333`.

## Como usar

Certifique-se de que o Docker Desktop esteja rodando em sua máquina e siga estes passos:

1.  **Parar processos locais**:
    Se você estiver rodando `npm run dev` ou `npm run api` localmente, pare-os para liberar as portas `5173` e `3000`.

2.  **Subir os containers**:
    ```bash
    docker compose up --build
    ```

3.  **Encerrar**:
    ```bash
    docker compose down
    ```

## Observações

- **Persistência de dados**: O banco SQLite (`dev.db`) e os arquivos de autenticação do Baileys são persistidos em volumes Docker.
- **HMR (Hot Module Replacement)**: Os volumes montam o código fonte local dentro dos containers, então alterações em tempo real no código ainda funcionarão.
- **Node Modules**: Caso você instale novos pacotes localmente, pode ser necessário reconstruir os containers (`docker compose build`).
- **NestJS**: O backend NestJS está configurado para rodar na porta `3333` dentro do Docker para não conflitar com o Express na `3000`.
