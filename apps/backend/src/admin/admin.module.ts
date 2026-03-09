import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { PagesModule } from '../pages/pages.module';

@Module({
  imports: [AuthModule, MailModule, PagesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
