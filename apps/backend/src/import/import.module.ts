import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { ImportProcessor } from './processors/import.processor';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'confluence-import' }),
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5 GB
    }),
    SearchModule,
  ],
  controllers: [ImportController],
  providers: [ImportService, ImportProcessor],
})
export class ImportModule {}
