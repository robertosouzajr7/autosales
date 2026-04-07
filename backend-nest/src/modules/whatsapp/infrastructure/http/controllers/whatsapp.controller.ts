import { Controller, Post, Body, Param } from '@nestjs/common';
import { WhatsAppService } from '../../../../application/services/whatsapp.service';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post(':tenantId/connect')
  async connect(@Param('tenantId') tenantId: string) {
    return await this.whatsappService.createSession(tenantId);
  }

  @Post(':tenantId/send')
  async send(
    @Param('tenantId') tenantId: string,
    @Body() body: { to: string; content: string },
  ) {
    return await this.whatsappService.sendMessage(tenantId, body.to, body.content);
  }
}
