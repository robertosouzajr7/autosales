-- Notificações push do app do atendente.
ALTER TABLE "PlatformSettings" ADD COLUMN "fcmProjectId" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN "fcmServiceAccount" TEXT;

ALTER TABLE "User" ADD COLUMN "preferenciasDePush" TEXT;

-- A chave é o token, não o usuário: o mesmo aparelho pode trocar de dono.
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "ultimoUso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");
CREATE INDEX "DeviceToken_tenantId_idx" ON "DeviceToken"("tenantId");

ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
