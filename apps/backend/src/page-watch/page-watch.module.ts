import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PageWatchService } from './page-watch.service';
import { PageWatchController } from './page-watch.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PageWatchController],
  providers: [PageWatchService],
  exports: [PageWatchService],
})
export class PageWatchModule {}
