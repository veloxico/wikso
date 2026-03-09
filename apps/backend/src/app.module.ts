import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
import { SetupModule } from './setup/setup.module';
import { RedisModule } from './redis/redis.module';
import { SettingsModule } from './settings/settings.module';
import { RecentPagesModule } from './recent-pages/recent-pages.module';
import { FavoritesModule } from './favorites/favorites.module';
import { TemplatesModule } from './templates/templates.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    SetupModule,
    SettingsModule,
    RecentPagesModule,
    FavoritesModule,
    TemplatesModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
