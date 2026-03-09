import { Module } from '@nestjs/common';
import { RecentPagesService } from './recent-pages.service';
import { RecentPagesController } from './recent-pages.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RecentPagesController],
  providers: [RecentPagesService],
  exports: [RecentPagesService],
})
export class RecentPagesModule {}
