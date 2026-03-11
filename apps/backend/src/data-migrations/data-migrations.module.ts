import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DataMigrationService } from './data-migration.service';

@Module({
  imports: [PrismaModule],
  providers: [DataMigrationService],
})
export class DataMigrationsModule {}
