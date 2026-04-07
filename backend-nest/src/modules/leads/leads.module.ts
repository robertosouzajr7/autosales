import { Module } from '@nestjs/common';
import { LeadsController } from './infrastructure/http/controllers/leads.controller';
import { LeadsService } from './application/services/leads.service';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
