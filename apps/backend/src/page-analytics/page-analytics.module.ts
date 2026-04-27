import { Module } from '@nestjs/common';
import { PageAnalyticsService } from './page-analytics.service';
import { PageAnalyticsController } from './page-analytics.controller';

@Module({
  controllers: [PageAnalyticsController],
  providers: [PageAnalyticsService],
  exports: [PageAnalyticsService],
})
export class PageAnalyticsModule {}
