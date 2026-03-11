import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookProcessor } from './processors/webhook.processor';
import { EmailProcessor } from './processors/email.processor';
import { SearchIndexProcessor } from './processors/search-index.processor';
import { MailModule } from '../mail/mail.module';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    BullModule.registerQueue(
      { name: 'webhooks' },
      { name: 'emails' },
      { name: 'search-index' },
      { name: 'confluence-import' },
    ),
    MailModule,
  ],
  providers: [WebhookProcessor, EmailProcessor, SearchIndexProcessor],
  exports: [BullModule],
})
export class JobsModule {}
