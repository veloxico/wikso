import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SharesService } from './shares.service';
import { VerifySharePasswordDto } from './dto/verify-share-password.dto';

/**
 * Public (unauthenticated) endpoints for anonymous visitors opening a guest
 * share link. Rate-limited aggressively because they're the one surface a
 * logged-out user can hit.
 *
 * Note: no @UseGuards(JwtAuthGuard) — that's the whole point.
 */
@ApiTags('Public Shares')
@Controller('public/shares')
export class PublicSharesController {
  constructor(private readonly shares: SharesService) {}

  /**
   * Returns lightweight metadata (title, requiresPassword, expiresAt).
   * Never leaks page content — callers must hit /content to read.
   * Rate limit: 30/min per IP — covers normal UX retries, blocks enumeration.
   */
  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Resolve share metadata by token (public, no content)' })
  getMeta(@Param('token') token: string) {
    return this.shares.resolveShareMeta(token);
  }

  /**
   * Returns full page content. If the share is password-protected, `password`
   * in the body must match the bcrypt hash. This endpoint is the brute-force
   * target, so the limit is tighter than metadata.
   * Rate limit: 10/min per IP — a real user enters their password once, maybe
   * twice; a bot trying 10k passwords/min cannot.
   */
  @Post(':token/content')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Fetch shared page content (optionally verifying password)' })
  getContent(@Param('token') token: string, @Body() dto?: VerifySharePasswordDto) {
    return this.shares.resolveShareContent(token, dto?.password);
  }
}
