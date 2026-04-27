import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { MailModule } from '../mail/mail.module';
import { PageWatchModule } from '../page-watch/page-watch.module';

@Module({
  imports: [NotificationsModule, WebhooksModule, MailModule, PageWatchModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
