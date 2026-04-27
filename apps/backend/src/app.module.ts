import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SpacesModule } from './spaces/spaces.module';
import { PagesModule } from './pages/pages.module';
import { CommentsModule } from './comments/comments.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { SearchModule } from './search/search.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AdminModule } from './admin/admin.module';
import { HocuspocusModule } from './hocuspocus/hocuspocus.module';
import { MailModule } from './mail/mail.module';
import { AiModule } from './ai/ai.module';
import { AdminAiModule } from './admin/ai/admin-ai.module';
import { SetupModule } from './setup/setup.module';
import { SetupGuard } from './setup/setup.guard';
import { RedisModule } from './redis/redis.module';
import { SettingsModule } from './settings/settings.module';
import { RecentPagesModule } from './recent-pages/recent-pages.module';
import { FavoritesModule } from './favorites/favorites.module';
import { TemplatesModule } from './templates/templates.module';
import { HealthModule } from './health/health.module';
import { TagsModule } from './tags/tags.module';
import { JobsModule } from './jobs/jobs.module';
import { ImportModule } from './import/import.module';
import { DataMigrationsModule } from './data-migrations/data-migrations.module';
import { GroupsModule } from './groups/groups.module';
import { SharesModule } from './shares/shares.module';
import { PageLinksModule } from './page-links/page-links.module';
import { PageAnalyticsModule } from './page-analytics/page-analytics.module';
import { PageWatchModule } from './page-watch/page-watch.module';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { SlackModule } from './integrations/slack/slack.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppConfigModule,
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    SpacesModule,
    PagesModule,
    CommentsModule,
    AttachmentsModule,
    SearchModule,
    NotificationsModule,
    WebhooksModule,
    AdminModule,
    HocuspocusModule,
    MailModule,
    AiModule,
    AdminAiModule,
    SetupModule,
    SettingsModule,
    RecentPagesModule,
    FavoritesModule,
    TemplatesModule,
    HealthModule,
    TagsModule,
    JobsModule,
    ImportModule,
    DataMigrationsModule,
    GroupsModule,
    SharesModule,
    PageLinksModule,
    PageAnalyticsModule,
    PageWatchModule,
    AiChatModule,
    SlackModule,
  ],
  providers: [
    // Global: gate all non-setup routes behind setup completion
    {
      provide: APP_GUARD,
      useClass: SetupGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
