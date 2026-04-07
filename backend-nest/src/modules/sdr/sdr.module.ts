import { Module, Global } from '@nestjs/common';
import { SdrService } from './application/services/sdr.service';

@Global()
@Module({
  providers: [SdrService],
  exports: [SdrService],
})
export class SdrModule {}
