import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    const checks: Record<string, { status: string; message?: string }> = {};

    // PostgreSQL
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'up' };
    } catch (err: any) {
      checks.database = { status: 'down', message: err.message };
    }

    // Redis
    try {
      const client = this.redis.getClient();
      const pong = await client.ping();
      checks.redis = { status: pong === 'PONG' ? 'up' : 'down' };
    } catch (err: any) {
      checks.redis = { status: 'down', message: err.message };
    }

    // Meilisearch
    try {
      const host = process.env.MEILISEARCH_HOST || 'http://localhost:7700';
      const res = await fetch(`${host}/health`, { signal: AbortSignal.timeout(3000) });
      checks.meilisearch = { status: res.ok ? 'up' : 'down' };
    } catch (err: any) {
      checks.meilisearch = { status: 'down', message: err.message };
    }

    const allUp = Object.values(checks).every((c) => c.status === 'up');

    return {
      status: allUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
