import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';
import { AiTransformDto } from './dto/ai-transform.dto';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private aiService: AiService,
    private prisma: PrismaService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get AI availability status' })
  async getStatus() {
    return this.aiService.getStatus();
  }

  @Post('transform')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Transform text using AI (SSE stream)' })
  async transform(
    @Body() dto: AiTransformDto,
    @CurrentUser() user: any,
    @Res() res: any,
  ) {
    const enabled = await this.aiService.isEnabled();
    if (!enabled) {
      throw new NotFoundException(
        'AI is not configured. An administrator must set up an AI provider.',
      );
    }

    const page = await this.prisma.page.findUnique({
      where: { id: dto.pageId },
      include: { space: true },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    if (user.role !== 'ADMIN') {
      const space = page.space;
      if (!space) {
        throw new ForbiddenException('No access to this page');
      }
      if (space.ownerId !== user.id) {
        const perm = await this.prisma.spacePermission.findFirst({
          where: {
            spaceId: space.id,
            OR: [
              { userId: user.id },
              { group: { members: { some: { userId: user.id } } } },
            ],
          },
        });
        if (!perm) {
          throw new ForbiddenException('No access to this space');
        }
        if (perm.role === 'VIEWER' || perm.role === 'GUEST') {
          throw new ForbiddenException(
            'Editor or higher permission required for AI features',
          );
        }
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.aiService.streamTransform(
        dto.selection,
        dto.operation,
        dto.context,
        dto.customPrompt,
      )) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err: any) {
      this.logger.error('AI transform failed', err);
      if (!res.writableEnded) {
        const message =
          err?.message === 'NO_PROVIDER_CONFIGURED'
            ? 'AI is not configured.'
            : 'AI provider temporarily unavailable. Please try again.';
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      }
    } finally {
      res.end();
    }
  }
}
