import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiProviderRegistry } from './providers/ai-provider.registry';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { OllamaProvider } from './providers/ollama.provider';

@Module({
  imports: [PrismaModule],
  controllers: [AiChatController],
  providers: [
    AiChatService,
    AiProviderRegistry,
    AnthropicProvider,
    OpenAiProvider,
    OllamaProvider,
  ],
  exports: [AiChatService, AiProviderRegistry],
})
export class AiChatModule {}
