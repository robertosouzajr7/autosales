# Etapa de Build
FROM node:20 AS build
WORKDIR /app
# Copia apenas os arquivos do subprojeto NestJS
COPY backend-nest/package*.json ./
RUN npm install
COPY backend-nest/ .
# Copia o schema do Nest especificamente
COPY backend-nest/prisma ./prisma
RUN npx prisma generate
RUN npm run build

# Etapa de Produção
FROM node:20-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# Gera o cliente Prisma na imagem de produção
RUN npx prisma generate

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main"]
