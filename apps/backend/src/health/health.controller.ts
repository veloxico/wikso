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
import { execSync } from 'child_process';

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

    // Disk usage
    let diskUsage: { totalGB: number; usedGB: number; freeGB: number; usedPercent: number } | null = null;
    try {
      if (process.platform === 'win32') {
        // Windows: use wmic
        const output = execSync('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /format:csv', { encoding: 'utf-8' });
        const lines = output.trim().split('\n').filter(l => l.trim());
        const last = lines[lines.length - 1].split(',');
        const freeSpace = parseInt(last[1], 10);
        const totalSize = parseInt(last[2], 10);
        diskUsage = {
          totalGB: Math.round(totalSize / (1024 ** 3) * 100) / 100,
          usedGB: Math.round((totalSize - freeSpace) / (1024 ** 3) * 100) / 100,
          freeGB: Math.round(freeSpace / (1024 ** 3) * 100) / 100,
          usedPercent: Math.round((totalSize - freeSpace) / totalSize * 100),
        };
      } else {
        // Linux/macOS: use df
        const output = execSync('df -k / | tail -1', { encoding: 'utf-8' });
        const parts = output.trim().split(/\s+/);
        const totalKB = parseInt(parts[1], 10);
        const usedKB = parseInt(parts[2], 10);
        const freeKB = parseInt(parts[3], 10);
        diskUsage = {
          totalGB: Math.round(totalKB / (1024 ** 2) * 100) / 100,
          usedGB: Math.round(usedKB / (1024 ** 2) * 100) / 100,
          freeGB: Math.round(freeKB / (1024 ** 2) * 100) / 100,
          usedPercent: totalKB > 0 ? Math.round(usedKB / totalKB * 100) : 0,
        };
      }
    } catch {
      // Disk info unavailable — leave null
    }

    return {
      status: allUp ? 'ok' : 'degraded',
      version: this.appVersion,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memoryUsage,
      diskUsage,
      nodeVersion: process.version,
      checks,
    };
  }
}
