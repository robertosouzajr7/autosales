-- AutomationConfig → Tenant agora cascateia no delete do tenant
ALTER TABLE "AutomationConfig" DROP CONSTRAINT IF EXISTS "AutomationConfig_tenantId_fkey";
ALTER TABLE "AutomationConfig" ADD CONSTRAINT "AutomationConfig_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
