import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GlobalRole } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly appVersion: string;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    this.appVersion = this.readPackageVersion();
  }

  private readPackageVersion(): string {
    try {
      const candidates = [
        path.resolve(process.cwd(), 'package.json'),
        path.resolve(__dirname, '..', '..', 'package.json'),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          const pkg = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
          if (pkg.version) return pkg.version;
        }
      }
      return '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  @Get()
  @ApiOperation({ summary: 'Public health check (minimal info)' })
  async check() {
    // Public endpoint — only return minimal status, no internals
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      return { status: 'degraded' };
    }
  }

  @Get('detailed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detailed health check (admin only)' })
  async detailedCheck() {
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

    // System info
    const mem = process.memoryUsage();
    const memoryUsage = {
      rss: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
    };

    return {
      status: allUp ? 'ok' : 'degraded',
      version: this.appVersion,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memoryUsage,
      nodeVersion: process.version,
      checks,
    };
  }
}
