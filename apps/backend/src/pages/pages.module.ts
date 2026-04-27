import { Module } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { SearchModule } from '../search/search.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { PageLinksModule } from '../page-links/page-links.module';
import { PageWatchModule } from '../page-watch/page-watch.module';

@Module({
  imports: [SearchModule, NotificationsModule, WebhooksModule, PageLinksModule, PageWatchModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
