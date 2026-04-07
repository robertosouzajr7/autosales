import { Module, Global } from '@nestjs/common';
import { WhatsAppService } from './application/services/whatsapp.service';
import { WhatsAppController } from './infrastructure/http/controllers/whatsapp.controller';

@Global()
@Module({
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
