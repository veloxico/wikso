import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiProviderRegistry } from './ai-provider.registry';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [AiController],
  providers: [AiService, AiProviderRegistry],
  exports: [AiService, AiProviderRegistry],
})
export class AiModule {}
