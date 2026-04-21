import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AiChatService } from './ai-chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('AI Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-chat')
export class AiChatController {
  constructor(private readonly service: AiChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List my conversations (paginated)' })
  list(@CurrentUser() user: any, @Query() pagination: PaginationDto) {
    return this.service.listConversations(user.id, pagination.skip, pagination.take);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create a new conversation' })
  create(@CurrentUser() user: any, @Body() dto: CreateConversationDto) {
    return this.service.createConversation(user.id, dto.title);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation with messages' })
  get(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getConversation(id, user.id);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a conversation' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.deleteConversation(id, user.id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message and stream the assistant reply as SSE' })
  // Tighter per-user limit on streaming requests to protect provider quotas.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async send(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    const stream = await this.service.streamAnswer(id, user.id, dto.message);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const reader = stream.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch {
      // Client disconnect or provider error — close the response.
    } finally {
      reader.releaseLock();
      res.end();
    }
  }
}
