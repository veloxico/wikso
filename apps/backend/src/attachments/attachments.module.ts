import { Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { JwtOrQueryAuthGuard } from '../auth/guards/jwt-or-query-auth.guard';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, JwtOrQueryAuthGuard],
})
export class AttachmentsModule {}
