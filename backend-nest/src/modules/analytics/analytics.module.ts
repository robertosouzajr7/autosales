import { Module } from '@nestjs/common';
import { AnalyticsService } from './application/services/analytics.service';

@Module({
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
