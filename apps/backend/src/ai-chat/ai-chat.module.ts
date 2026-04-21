import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';

@Module({
  // AiModule exports AiProviderRegistry so the ask-your-wiki chat reuses the
  // admin-configured provider (with key decryption, Redis cache, OAuth token
  // rotation) instead of maintaining its own fork of the provider layer.
  imports: [PrismaModule, AiModule],
  controllers: [AiChatController],
  providers: [AiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}
