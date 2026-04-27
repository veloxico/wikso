import { Module } from '@nestjs/common';
import { HocuspocusService } from './hocuspocus.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PageLinksModule } from '../page-links/page-links.module';

@Module({
  imports: [AuthModule, PrismaModule, PageLinksModule],
  providers: [HocuspocusService],
})
export class HocuspocusModule {}
