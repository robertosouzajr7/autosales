import { Module, Global } from '@nestjs/common';
import { AutomationEngine } from './application/services/automation-engine.service';

@Global()
@Module({
  providers: [AutomationEngine],
  exports: [AutomationEngine],
})
export class AutomationModule {}
