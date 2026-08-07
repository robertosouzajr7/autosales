-- O telefone do contato tem WhatsApp? Descoberto sozinho depois do cadastro.
ALTER TABLE "Lead" ADD COLUMN "whatsappStatus" TEXT;
ALTER TABLE "Lead" ADD COLUMN "whatsappCheckedAt" TIMESTAMP(3);
