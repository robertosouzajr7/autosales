-- Endurece FKs internas para não travar exclusões (tenant/etapa/template)
-- Lead.stageId → SET NULL (lead perde a etapa, não é apagado)
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_stageId_fkey";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Campaign.templateId → CASCADE (campanha sem template não faz sentido)
ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_templateId_fkey";
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
