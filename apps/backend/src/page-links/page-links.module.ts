import { Module } from '@nestjs/common';
import { PageLinksService } from './page-links.service';
import { PageLinksController } from './page-links.controller';

@Module({
  controllers: [PageLinksController],
  providers: [PageLinksService],
  exports: [PageLinksService],
})
export class PageLinksModule {}
