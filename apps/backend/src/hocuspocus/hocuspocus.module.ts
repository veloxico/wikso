import { Module } from '@nestjs/common';
import { HocuspocusService } from './hocuspocus.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [HocuspocusService],
})
export class HocuspocusModule {}
