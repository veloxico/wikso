import { Module } from '@nestjs/common';
import { AdminAiController } from './admin-ai.controller';
import { AiModule } from '../../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [AdminAiController],
})
export class AdminAiModule {}
